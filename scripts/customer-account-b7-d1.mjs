// D1 has no authentication/site opening capability. Owner health and one fresh deployment only.
import {webcrypto} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {createB7Runner} from './customer-account-b7-v3-runner.mjs'
import {assertB7Run,sha256} from './customer-account-b7-v3-execution-contract.mjs'
import {createB7BrowserTransport} from '../tools/customer-account-b7-v3/browser-transport.mjs'
const fail=()=>{throw Error('B7_D1_REJECTED')},actions=['health','renewal-health','customer-account-health']
const uid=/^[-\w.]{1,36}$/
export function assertB7D1Approval({manifestBytes,approvalProof}){
 const target=JSON.parse(manifestBytes).target
 const {manifest}=assertB7Run({manifestBytes,approvalProof,target,phase:'prepare',now:Date.now()}),d=approvalProof.diagnostic
 if(d?.kind!=='B7_D1'||d.approved!==true||d.priorExecutions!==7||d.priorPages!==7||d.deploymentMax!==1||d.healthMax!==3||d.windowSecondsMax!==300||d.accountMayOpen!==false||d.pagesMayDeploy!==false||['archiveSha256','fixtureSha256','priorJournalSha256'].some(k=>!(/^[a-f\d]{64}$/.test(d[k]))))fail()
 return manifest
}
export function createB7D1State({manifestBytes,approvalProof,priorStateBytes}){
 const m=assertB7D1Approval({manifestBytes,approvalProof}),d=approvalProof.diagnostic
 if(!Buffer.isBuffer(priorStateBytes)||sha256(priorStateBytes)!==d.priorJournalSha256)fail()
 const p=JSON.parse(priorStateBytes)
 if(p.deploymentId!=='6ad456239aeb781a4f4d'||p.initialVariableCount!==23||p.fixtureSha256!==d.fixtureSha256||Object.keys(p.guardVariableIds||{}).length!==7||m.newFunctionVariableNames.some(k=>!uid.test(p.guardVariableIds[k]))||[m.actors.G.uid,m.actors.H.uid].some(id=>!isDeepStrictEqual(p.sessionBaseline?.[id],[])))fail()
 return {attempts:{prepareVariables:true},initialVariableCount:23,archiveSha256:d.archiveSha256,fixtureSha256:d.fixtureSha256,guardVariableIds:structuredClone(p.guardVariableIds),sessionBaseline:structuredClone(p.sessionBaseline),createdSessionIds:{[m.actors.G.uid]:[],[m.actors.H.uid]:[]},continuation:{priorExecutions:7,priorPages:7,priorJournalSha256:d.priorJournalSha256},d1:{kind:'B7_D1',phase:'prepared',deploymentRequests:0,healthAttempts:[],failed:false}}
}
export function d1VariablesDigest(rows){return sha256(JSON.stringify(rows.map(v=>({id:v.$id,key:v.key,secret:v.secret===true,...(v.secret?{}:{value:v.value}),updatedAt:v.$updatedAt})).sort((a,b)=>a.key.localeCompare(b.key))))}
export function createB7D1Runner({manifestBytes,approvalProof,state,cliSession,transport=fetch,persist,clock=Date.now,lease=async()=>false}){
 const m=assertB7D1Approval({manifestBytes,approvalProof}),d=approvalProof.diagnostic,fn='/functions/'+m.target.functionId,project='/projects/'+m.target.projectId
 if(state?.d1?.kind!=='B7_D1'||state.continuation?.priorExecutions!==7||state.fixtureSha256!==d.fixtureSha256||typeof persist!=='function')fail()
 let closing=false,configuringSecret,healthSecret,pendingHealth,busy=false
 const save=()=>persist(structuredClone(state))
 const within=()=>{const w=state.window,at=clock();if(!w||!Number.isSafeInteger(w.startsAt)||!Number.isSafeInteger(w.endsAt)||w.endsAt<=w.startsAt||w.endsAt-w.startsAt>300000||!Number.isFinite(at)||at<w.startsAt||at>=w.endsAt)fail()}
 const controlled=async(url,o)=>{
  const u=new URL(url);if(u.origin+u.pathname.slice(0,3)!==m.target.endpoint||u.search||o.redirect!=='error')fail()
  const path=u.pathname.slice(3),body=typeof o.body==='string'?JSON.parse(o.body):o.body
  const getAllowed=[project,fn,fn+'/variables','/account',...Object.keys(state.sessionBaseline||{}).map(id=>'/users/'+id+'/sessions')].includes(path)||path===fn+'/deployments/'+state.deploymentId||path===fn+'/deployments/'+m.target.baseDeploymentId
  if(o.method==='GET'){if(!getAllowed)fail()}
  else if(o.method==='PUT'&&path===fn){if(body?.enabled!==false||!isDeepStrictEqual(body.execute,[]))fail()}
  else if(o.method==='PATCH'&&path===project+'/service'){if(!isDeepStrictEqual(body,{service:'account',status:false}))fail()}
  else if(o.method==='PATCH'&&path===project+'/auth/limit'){if(!isDeepStrictEqual(body,{limit:2}))fail()}
  else if(o.method==='PUT'&&path.startsWith(fn+'/variables/')){
   const keys=[...m.newFunctionVariableNames,'CUSTOMER_ACCOUNT_ENABLED'],key=body?.key
   if(!keys.includes(key)||body.secret!==(key==='B7_TEST_HMAC_SECRET')||key!=='CUSTOMER_ACCOUNT_ENABLED'&&path!==fn+'/variables/'+state.guardVariableIds[key])fail()
   if(closing){if(!(Object.hasOwn(m.restoreState.serverFlags,key)&&body.value==='false'||key==='B7_TEST_HMAC_SECRET'&&body.value==='B7_REVOKED'))fail()}
   else {within();if(state.d1.phase!=='configuring'||state.attempts.deployment)fail();const expected={B7_TEST_RUN_ID:m.runId,B7_TEST_STARTS_AT:String(state.window.startsAt),B7_TEST_ENDS_AT:String(state.window.endsAt),B7_TEST_HMAC_SECRET:configuringSecret,B7_TEST_FIXTURE_MANIFEST_SHA256:state.fixtureSha256,...m.proposedTemporaryState.serverFlags};if(body.value!==expected[key])fail()}
  }else if(o.method==='POST'&&path===fn+'/deployments'){
   within();if(state.d1.phase!=='deploying'||state.d1.deploymentRequests!==1||!(body instanceof FormData)||body.get('activate')!=='false'||body.get('entrypoint')!=='src/b7-entry.mjs')fail()
  }else if(o.method==='PATCH'&&path===fn+'/deployments/'+(closing?m.target.baseDeploymentId:state.deploymentId)){
   if(!closing){within();if(state.d1.phase!=='activating')fail()}
  }else if(o.method==='POST'&&path===fn+'/executions'){
   within();if(!pendingHealth||!isDeepStrictEqual(body,pendingHealth)||state.d1.phase!=='active')fail()
  }else fail()
  const response=await transport(url,o)
  if(o.method==='POST'&&path===fn+'/deployments'&&response.ok){
   const received=await response.clone().json(),created=Date.parse(received.$createdAt)
   state.d1.receivedDeploymentId=uid.test(received.$id||'')?received.$id:null;state.d1.deploymentCreatedAt=Number.isFinite(created)?received.$createdAt:null;await save()
   if(!Number.isFinite(created)||created<state.window.startsAt||created<state.d1.variablesFrozenAt-1000||created>=state.window.endsAt)fail()
  }
  return response
 }
 const api=createB7Runner({manifestBytes,approvalProof,target:m.target,cliSession,state,persist,transport:controlled,clock})
 async function getVars(){const r=await controlled(m.target.endpoint+fn+'/variables',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':m.target.projectId,'X-Appwrite-Mode':'admin',Cookie:cliSession.cookie}});if(!r.ok)fail();const x=await r.json();if(x.total!==30||x.variables?.length!==30)fail();return x.variables}
 async function closed(){const x=await api.inspect();if(x.project.serviceStatusForAccount!==false||x.project.authLimit!==2||x.function.enabled!==false||x.function.execute?.length!==0)fail();return x}
 async function frozen(){if(!state.d1.variablesDigest||d1VariablesDigest(await getVars())!==state.d1.variablesDigest)fail()}
 async function serial(action){if(busy)fail();busy=true;try{return await action()}finally{busy=false}}
 const operations=Object.fromEntries(['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','restoreAuthLimit','cleanupRunSessions'].map(name=>[name,async()=>{closing=true;return api[name]()}]))
 return {operations,verifyClosed:api.verifyClosed,inspect:api.inspect,
  configure:({window,secret})=>serial(async()=>{
   if(closing||state.d1.phase!=='prepared'||state.window||!window||window.endsAt-window.startsAt>300000||window.endsAt<=window.startsAt||clock()<window.startsAt||clock()>=window.endsAt)fail()
   state.d1.phase='configuring';configuringSecret=secret;await save()
   try{await closed();await api.configureGuard({window,secret,fixtureSha256:state.fixtureSha256});state.d1.variablesDigest=d1VariablesDigest(await getVars());state.d1.variablesFrozenAt=clock();healthSecret=secret;state.d1.phase='configured';await save()}finally{configuringSecret=undefined}
  }),
  deploy:({archive})=>serial(async()=>{
   within();if(closing||state.d1.phase!=='configured'||state.d1.deploymentRequests!==0||sha256(archive)!==d.archiveSha256)fail();await closed();await frozen();if(await lease()!==true)fail()
   state.d1.phase='deploying';state.d1.deploymentRequests=1;await save()
   const result=await api.deployGuarded({archive,archiveSha256:d.archiveSha256,fixtureSha256:d.fixtureSha256})
   if([m.target.baseDeploymentId,'6ad456239aeb781a4f4d'].includes(result.deploymentId))fail();state.d1.phase='building';await save();return result
  }),
  activate:()=>serial(async()=>{
   within();if(closing||state.d1.phase!=='building'||!uid.test(state.deploymentId))fail();await frozen();if(await lease()!==true)fail();state.d1.phase='activating';await save()
   await api.activateGuarded();state.d1.phase='active';await save();return{deploymentId:state.deploymentId}
  }),
  health:action=>serial(async()=>{
   if(closing||state.d1.failed||state.d1.phase!=='active'||action!==actions[state.d1.healthAttempts.length])fail()
   try{
    within();if(await lease()!==true)fail();const current=await closed();if(current.function.deploymentId!==state.deploymentId)fail();await frozen()
    state.d1.healthAttempts.push(action);await save()
    const sender=createB7BrowserTransport({crypto:webcrypto,clock,windowState:async()=>({enabled:true,...state.window}),readSecret:()=>secretForHealth(),execute:async request=>{
     pendingHealth={body:request.body,async:false,path:request.xpath,method:'POST',headers:request.headers}
     const r=await controlled(m.target.endpoint+fn+'/executions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'X-Appwrite-Project':m.target.projectId,'X-Appwrite-Mode':'admin',Cookie:cliSession.cookie,'Content-Type':'application/json'},body:JSON.stringify(pendingHealth)})
     pendingHealth=undefined;if(!r.ok)fail();return r.json()
    }})
    const x=await sender({functionId:m.target.functionId,body:JSON.stringify({action}),async:false}),logs=[]
    for(const line of String(x.logs||'').split('\n')){try{const row=JSON.parse(line.slice(line.indexOf('{'),line.lastIndexOf('}')+1));if(['B7_D1_DIAGNOSTIC','B7_V3_PLATFORM_CONTRACT'].includes(row.tag))logs.push(row)}catch{/* no raw line leaves this boundary */}}
    const diag=logs.find(r=>r.tag==='B7_D1_DIAGNOSTIC'),platform=logs.find(r=>r.tag==='B7_V3_PLATFORM_CONTRACT'),body=JSON.parse(x.responseBody||'{}')
    const phases=['PASS','CONFIG','TIME','SECRET_SHAPE','BODY','HEADERS','SIGNATURE','PATH','IDENTITY','ACTION','INTERNAL','CONCURRENCY','LIMIT']
    const accepted=diag?.revision==='b7-d1-20261018.1'&&diag.phase==='PASS'&&diag.accepted===true
    const platformVerified=action!=='health'||platform?.signatureAndPathVerified===true&&platform.platformUidPresent===true&&platform.platformJwtPresent===true&&platform.customerEnabled===true&&platform.renewalWritesEnabled===true&&platform.preordersDisabled===true&&platform.manifestSha256===approvalProof.manifestSha256
    state.d1.lastResult={action,executionId:uid.test(x.$id||'')?x.$id:null,deploymentId:x.deploymentId===state.deploymentId?x.deploymentId:null,httpStatus:x.responseStatusCode,guardPhase:phases.includes(diag?.phase)?diag.phase:'UNVERIFIED',guardAccepted:accepted,platformVerified}
    await save()
    if(x.status!=='completed'||x.responseStatusCode!==200||body.ok!==true||x.deploymentId!==state.deploymentId||!accepted||!platformVerified||action==='renewal-health'&&(body.result?.enabled!==true||body.result.preordersEnabled!==false)||action==='customer-account-health'&&(body.result?.enabled!==true||body.result.ready!==true))fail()
    return structuredClone(state.d1.lastResult)
   }catch{state.d1.failed=true;await save();throw Error('B7_D1_HEALTH_FAILED')}
  })
 }
 function secretForHealth(){if(typeof healthSecret!=='string')fail();return healthSecret}
}
