import {readFile,lstat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {GOOGLE_TEST_TARGET,createGoogleOnlyTestManager} from './customer-account-google-test.mjs'
import {GOOGLE_ONLY_USERS,GOOGLE_ONLY_PLAN_SHA256,assertGoogleOnlyWindow} from '../tools/customer-account-google-only/contract.mjs'
import {semanticSettingsEvidence} from './customer-account-settings-fingerprint.mjs'
import {createCustomerAccountTestProbe} from './customer-account-test-monitor.mjs'
import {createGoogleOnlyPages} from './build-customer-account-google-only.mjs'
import {assertCustomerPrivateAcl,assertCustomerPublicReadOnlyAcl,assertCustomerOwnerAttribute,assertCustomerOwnerIndex} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'
const target=GOOGLE_TEST_TARGET,operating=['verygood-main','verygood-au','69cb27ef002b63e77c53','69db3ae20026cdc0c7fe'],team='69bf44eb000f319a38a2'
const metricsTarget={endpoint:target.endpoint,projectId:target.projectId,resources:{databaseIds:[],functionIds:[]}}
const fail=()=>{throw Error('GOOGLE_ONLY_LIVE_UNVERIFIED')}
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex')
export function assertGoogleOnlyAttributeDefinition(actual,expected){
 if(!actual)fail()
 for(const [key,value] of Object.entries(expected)){
  if(key==='type'&&value==='enum'){if(actual.type!=='string'||actual.format!=='enum')fail()}
  else if(JSON.stringify(actual[key])!==JSON.stringify(value))fail()
 }
}
export function googleOnlyAccountStateSafe(enabled,journal,window,now=Date.now()){
 if(!Number.isFinite(now)||now<window.startsAt||now>=window.endsAt)return false
 if(journal.phase==='opening')return Number.isSafeInteger(journal.activationRequestedAt)&&journal.activationRequestedAt>=window.startsAt&&now>=journal.activationRequestedAt&&now-journal.activationRequestedAt<=8000&&typeof enabled==='boolean'
 if(journal.phase==='prepared')return enabled===false&&journal.accountOn===false
 if(journal.phase==='open')return enabled===true&&journal.accountOn===true
 return false
}
export async function readGoogleOnlyPrivateJson(path){
 const s=await lstat(path)
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.uid!==process.getuid())fail()
 return JSON.parse(await readFile(path,'utf8'))
}
function reader(cliSession,transport){
 if(cliSession?.endpoint!==target.endpoint||!cliSession.cookie||cliSession.key||/[\r\n]/.test(cliSession.cookie))fail()
 return async(path,project=target.projectId)=>{
  const plain=path.split('?')[0]
  const consoleOk=project==='console'&&(['/account','/account/sessions/current','/teams/'+team+'/memberships','/projects/'+target.projectId+'/webhooks'].includes(plain)||[...operating,target.projectId].some(id=>plain==='/projects/'+id))
  const operatingOk=operating.includes(project)&&plain==='/functions'
  const metadataOk=project===target.projectId&&/^\/databases(?:\/ca_test_(?:cake|kids)_au\/collections(?:\/[\w.-]+\/(?:attributes|indexes))?)?$/.test(plain)
  if(!consoleOk&&!operatingOk&&!metadataOk)fail()
  try{
   const r=await transport(target.endpoint+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':project,...(project==='console'?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie}})
   if(!r.ok||r.redirected)fail();return await r.json()
  }catch{fail()}
 }
}
export async function assertGoogleOnlyWebhooksEmpty({cliSession,transport=fetch}){
 const data=await reader(cliSession,transport)('/projects/'+target.projectId+'/webhooks','console')
 if(data.total!==0||data.webhooks?.length!==0)fail()
}
export async function captureGoogleOnlyCheckpoint({cliSession,manifestBytes,transport=fetch,readMetrics,onStage=()=>{}}){
 const get=reader(cliSession,transport)
 onStage('owner')
 const [owner,session,members]=await Promise.all([get('/account','console'),get('/account/sessions/current','console'),get('/teams/'+team+'/memberships','console')])
 if(!owner.$id||session.userId!==owner.$id||session.current!==true||Date.parse(session.expire)<=Date.now()||!members.memberships?.some(m=>m.userId===owner.$id&&m.confirm===true&&m.roles?.includes('owner')))fail()
 onStage('test-policy-and-function')
 const manager=createGoogleOnlyTestManager({target,cliSession,transport}),state=await manager.inspect()
 if(state.accountEnabled!==false||Object.values(state.sessions).some(x=>x.length))fail()
 onStage('operating-metadata')
 const operatingProjects={},operatingFunctions={}
 for(const id of operating){
  const [p,f]=await Promise.all([get('/projects/'+id,'console'),get('/functions',id)])
  if(p.$id!==id||f.total!==f.functions?.length)fail()
  operatingProjects[id]=semanticSettingsEvidence(p).sha256
  operatingFunctions[id]=f.functions.map(x=>({id:x.$id,deploymentId:x.deploymentId,runtime:x.runtime,enabled:x.enabled})).sort((a,b)=>a.id.localeCompare(b.id))
 }
 onStage('manifest-and-db-inventory')
 if(hash(manifestBytes)!=='75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94')fail()
 const manifest=JSON.parse(manifestBytes),q='?queries[]='+encodeURIComponent(JSON.stringify({method:'limit',values:[100]})),dbs=await get('/databases'+q)
 if(dbs.total!==2||dbs.databases?.length!==2||dbs.databases.some(d=>!manifest.creates.databases.some(x=>x.databaseId===d.$id)))fail()
 const metadata=[];let collections=0,attributes=0,indexes=0
 for(const db of manifest.creates.databases){
  const rows=await get('/databases/'+db.databaseId+'/collections'+q)
  if(rows.total!==rows.collections?.length)fail()
  for(const c of rows.collections){
   onStage('schema-'+db.databaseId+'-'+c.$id)
   const expected=manifest.creates.collections.find(x=>x.databaseId===db.databaseId&&x.collectionId===c.$id)
   if(!expected)fail()
   if(['settings','cake_pickup_openings','class_booked_dates'].includes(c.$id))assertCustomerPublicReadOnlyAcl(c,manifest.adminUserIds);else assertCustomerPrivateAcl(c,manifest.adminUserIds)
   if(JSON.stringify([...c.$permissions].sort())!==JSON.stringify([...expected.permissions].sort()))fail()
   const base='/databases/'+db.databaseId+'/collections/'+c.$id
   const a=await get(base+'/attributes'+q),i=await get(base+'/indexes'+q),owner=c.$id==='reservations'&&db.databaseId==='ca_test_cake_au'
   if(a.total!==a.attributes?.length||i.total!==i.indexes?.length||a.total!==expected.attributes.length+(owner?1:0)||i.total!==expected.indexes.length+(owner?1:0)||[...a.attributes,...i.indexes].some(x=>x.status!=='available'))fail()
   for(const def of expected.attributes)assertGoogleOnlyAttributeDefinition(a.attributes.find(x=>x.key===def.key),def)
   for(const def of expected.indexes){const actual=i.indexes.find(x=>x.key===def.key);if(!actual||Object.entries(def).some(([k,v])=>JSON.stringify(actual[k])!==JSON.stringify(v)))fail()}
   if(owner){assertCustomerOwnerAttribute(a.attributes.find(x=>x.key==='customerUserId'));assertCustomerOwnerIndex(i.indexes.find(x=>x.key==='customerUser_created_idx'))}
   metadata.push({db:db.databaseId,id:c.$id,permissions:[...c.$permissions].sort(),enabled:c.enabled,documentSecurity:c.documentSecurity,attributes:a.attributes.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>!k.startsWith('$')))).sort((a,b)=>a.key.localeCompare(b.key)),indexes:i.indexes.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>!k.startsWith('$')))).sort((a,b)=>a.key.localeCompare(b.key))})
   collections++;attributes+=a.total;indexes+=i.total
  }
 }
 if(collections!==12||attributes!==182||indexes!==38)fail()
 onStage('webhooks-and-closed-api')
 const project=await get('/projects/'+target.projectId,'console')
 await assertGoogleOnlyWebhooksEmpty({cliSession,transport})
 const account=await transport(target.endpoint+'/account',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'X-Appwrite-Project':target.projectId}})
 if(account.status!==403||(await account.json()).type!=='general_service_disabled')fail()
 const site=await transport(target.origin+'/test-window.json',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)})
 if(site.status!==200||(await site.json()).enabled!==false)fail()
 const entry=await transport(target.origin+'/',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)})
 if(entry.status!==200||/<script\b/i.test(await entry.text()))fail()
 onStage('server-resources')
 const probe=createCustomerAccountTestProbe({target:metricsTarget,transport,...(readMetrics?{readMetrics}:{} )}),metrics=await probe()
 if(!metrics.apiHealthy||metrics.memoryAvailableBytes<3*2**30||metrics.diskAvailableBytes<30*2**30)fail()
 return {ownerVerified:true,ownerSessionExpiresAt:session.expire,state,operatingProjects,operatingFunctions,testProtectedSettingsFingerprint:semanticSettingsEvidence(Object.fromEntries(Object.entries(project).filter(([k])=>!['authLimit','serviceStatusForAccount'].includes(k)))).sha256,schema:{dbs:2,collections,attributes,indexes,aclVerified:true,sha256:hash(metadata.sort((a,b)=>(a.db+'/'+a.id).localeCompare(b.db+'/'+b.id)))},accountOff403:true,siteClosed:true,metrics,historicalAuRaw:'UNVERIFIED',functionExecutionsUsed:8,pagesUsed:7}
}
export async function createGoogleOnlyLiveAdapters(c,{transport=fetch,readMetrics,readJson=readGoogleOnlyPrivateJson,clock=Date.now,runPages}={}){
 if(c?.kind!=='GOOGLE_ONLY'||c.startAuthorized!==true||c.planSha256!==GOOGLE_ONLY_PLAN_SHA256)fail()
 const [proof,cliSession,baseline]=await Promise.all([readJson(c.approvalProofPath),readJson(c.cliSessionPath),readJson(c.baselinePath)])
 if(proof.kind!=='GOOGLE_ONLY'||proof.startAuthorized!==true||proof.planSha256!==GOOGLE_ONLY_PLAN_SHA256||JSON.stringify(proof.window)!==JSON.stringify(c.window)||baseline.ownerVerified!==true||baseline.functionExecutionsUsed!==8||baseline.pagesUsed!==7)fail()
 assertGoogleOnlyWindow(c.window,{now:c.window.startsAt})
 const manager=createGoogleOnlyTestManager({target,cliSession,transport,clock,expectedBaseline:baseline.state})
 const pages=createGoogleOnlyPages({directory:c.directory,artifactDirectory:c.artifactDirectory,wranglerPath:c.wranglerPath,clock,...(runPages?{run:runPages}:{} )})
 const resource=createCustomerAccountTestProbe({target:metricsTarget,transport,clock,...(readMetrics?{readMetrics}:{} )})
 async function journal(){const j=await readJson(c.journalPath);if(j.kind!=='GOOGLE_ONLY'||j.runId!==c.window.runId)fail();return j}
 function attributed(s,userId,j){return s.userId===userId&&s.provider==='google'&&Date.parse(s.createdAt)>=c.window.startsAt&&Date.parse(s.createdAt)<=c.window.endsAt&&j.loginIntents?.some(x=>x.userId===userId&&x.at>=c.window.startsAt&&x.at<=Date.parse(s.createdAt)&&x.at<c.window.endsAt)}
 return {
  off:()=>manager.stop(),
  async probe(){
   const [state,metrics,j]=await Promise.all([manager.inspect(),resource(),journal()])
   let safe=googleOnlyAccountStateSafe(state.accountEnabled,j,c.window,clock())
   for(const [id,rows] of Object.entries(state.sessions))for(const s of rows){if(!Object.values(GOOGLE_ONLY_USERS).some(u=>u.id===id)||!attributed(s,id,j))safe=false}
   return {...metrics,safe:safe&&metrics.apiHealthy===true}
  },
  async cleanup(){
   const state=await manager.inspect(),j=await journal()
   for(const [id,rows] of Object.entries(state.sessions))for(const s of rows){
    if(!attributed(s,id,j))fail()
    const intent=j.loginIntents.find(x=>x.userId===id&&x.at<=Date.parse(s.createdAt))
    await manager.cleanupSession({userId:id,sessionId:s.id,intentAt:intent.at,proof})
   }
  },
  async siteOff(){
   try{await lstat(c.directory+'/pages-8.claim')}catch(error){if(error.code!=='ENOENT')fail();const r=await transport(target.origin+'/test-window.json',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok||(await r.json()).enabled!==false)fail();return}
   return pages.closed(proof)
  },
  async verify(){
   const state=await manager.inspect()
   const [a,w,entry]=await Promise.all([transport(target.endpoint+'/account',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'X-Appwrite-Project':target.projectId}}),transport(target.origin+'/test-window.json',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)}),transport(target.origin+'/',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)})])
   const html=await entry.text()
   return state.accountEnabled===false&&Object.values(state.sessions).every(s=>s.length===0)&&a.status===403&&(await a.json()).type==='general_service_disabled'&&w.status===200&&(await w.json()).enabled===false&&entry.status===200&&!/<script\b/i.test(html)&&/closed/i.test(html)
  },
 }
}
