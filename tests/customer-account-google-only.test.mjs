import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm,writeFile,chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {ownerAttribute,ownerIndex} from './fixtures/customer-account/metadata.mjs'
const contract=await import('../tools/customer-account-google-only/contract.mjs').catch(()=>({}))
const manager=await import('../scripts/customer-account-google-test.mjs')
const watchdog=await import('../scripts/customer-account-google-only-watchdog.mjs').catch(()=>({}))
const builder=await import('../scripts/build-customer-account-google-only.mjs').catch(()=>({}))
const live=await import('../scripts/customer-account-google-only-live.mjs').catch(()=>({}))
const now=Date.parse('2026-10-18T10:00:00Z'),window={enabled:true,startsAt:now,endsAt:now+900000,runId:'google-only-20261018-a'}
const origin='https://au-account-test.verygood-chocolate.com'
const G='6ad38e4e0ffd5f810e23',H='ca-test-customer-h-20261018'
const identity={userId:G,loginEmail:'nam9295@gmail.com',profile:{version:1,name:'Google Test G',contactEmail:'g-contact@example.invalid',phone:'',language:'ko'}}
test('Google-only window is exact-origin, bounded, not-started/expired/closed fail-closed',()=>{
 assert.equal(typeof contract.assertGoogleOnlyWindow,'function')
 assert.deepEqual(contract.assertGoogleOnlyWindow(window,{now,origin}),window)
 for(const [w,o,t] of [[{...window,enabled:false},origin,now],[window,origin+'.evil',now],[window,origin,now-1],[window,origin,window.endsAt],[{...window,endsAt:window.endsAt+1},origin,now],[{...window,extra:true},origin,now]])assert.throws(()=>contract.assertGoogleOnlyWindow(w,{now:t,origin:o}))
})
function authHarness(){
 const calls=[],storage=new Map(),base={async restore(){calls.push('restore');return identity},async startGoogle(){calls.push('google')},async saveProfile(p,uid){calls.push(['save',uid]);return {...identity,profile:p}},async signOut(){calls.push('logout')}}
 let w=window
 const auth=()=>{assert.equal(typeof contract.createGoogleOnlyAuth,'function');return contract.createGoogleOnlyAuth({base,storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},readWindow:async()=>w,origin:()=>origin,clock:()=>now})}
 return {calls,base,auth,close:()=>{w={enabled:false,startsAt:null,endsAt:null}}}
}
test('real auth adapter preserves profile methods while email and order operations never run',async()=>{
 const h=authHarness(),a=h.auth();assert.deepEqual(await a.restore(),identity)
 await a.startGoogle({flowId:'11111111-1111-4111-8111-111111111111'});await a.saveProfile(identity.profile,G);await a.signOut()
 await assert.rejects(a.sendEmail('other@example.test'));await assert.rejects(a.verifyEmail({userId:G,code:'123456'}))
 assert.deepEqual(h.calls,['restore','google',['save',G],'logout'])
})
test('only existing G/H identities and synthetic profiles, two writes each across remounts',async()=>{
 const h=authHarness(),a=h.auth()
 await a.saveProfile(identity.profile,G);await h.auth().saveProfile(identity.profile,G)
 await assert.rejects(a.saveProfile(identity.profile,G));assert.equal(h.calls.filter(x=>Array.isArray(x)).length,2)
 for(const p of [{...identity.profile,contactEmail:'other@example.test'},{...identity.profile,phone:'0412345678'},{...identity.profile,name:'Real Name'}])await assert.rejects(a.saveProfile(p,H))
 h.base.restore=async()=>({...identity,userId:'unknown'});await assert.rejects(a.restore())
})
test('closed window denies account/Google/prefs before SDK, explicit logout remains available',async()=>{
 const h=authHarness(),a=h.auth();h.close()
 await assert.rejects(a.restore());await assert.rejects(a.startGoogle({}));await assert.rejects(a.saveProfile(identity.profile,G));assert.equal(h.calls.length,0)
 await a.signOut();assert.deepEqual(h.calls,['logout'])
})
test('session evidence retains only fixed booleans and rejects wrong UID/provider/expiry',()=>{
 assert.equal(typeof contract.googleOnlySessionEvidence,'function')
 const user={$id:G,email:identity.loginEmail,status:true,secret:'must-not-leave'},session={userId:G,provider:'google',current:true,expire:new Date(now+10000).toISOString(),providerAccessToken:'must-not-leave'}
 const result=contract.googleOnlySessionEvidence(user,session,now)
 assert.deepEqual(result,{user:'G',uidMatched:true,googleSession:true,sessionValid:true});assert.ok(!JSON.stringify(result).includes('must-not-leave'))
 for(const change of [{userId:H},{provider:'email'},{expire:new Date(now).toISOString()},{current:false}])assert.throws(()=>contract.googleOnlySessionEvidence(user,{...session,...change},now))
})
test('logout check requests Account and current session independently; both must deny with 401',async()=>{
 assert.equal(typeof contract.checkGoogleOnlySession,'function');const calls=[]
 const account={async get(){calls.push('account');throw {code:401}},async getSession(){calls.push('session');throw {code:401}}}
 assert.deepEqual(await contract.checkGoogleOnlySession({account,readWindow:async()=>window,clock:()=>now}),{signedOut:true,accountDenied401:true,sessionDenied401:true})
 assert.deepEqual(calls,['account','session'])
})
test('SDK-only compiled artifact has hard routes/CSP, no B7 panel/checkout/operating env',async()=>{
 assert.equal(typeof builder.buildGoogleOnlySite,'function')
 const dir=await mkdtemp(join(tmpdir(),'google-only-artifact-'))
 try{
  const result=await builder.buildGoogleOnlySite({directory:dir})
  for(const path of ['index.html','account/index.html','account/auth/callback/index.html','404.html','_headers','test-window.json'])assert.ok((await readFile(join(result.directory,path))).length)
  const windowConfig=JSON.parse(await readFile(join(result.directory,'test-window.json')));assert.equal(windowConfig.enabled,false)
  assert.ok(!result.inputs.some(x=>/AuRenewalShop|src\/main|b7-v3\/|b7\/|repository\.ts/.test(x)))
  assert.ok(result.inputs.some(x=>x.endsWith('/src/CustomerAccountProvider.tsx')))
  const headers=await readFile(join(result.directory,'_headers'),'utf8');assert.match(headers,/frame-ancestors 'none'/)
  const entry=await readFile('tools/customer-account-google-only/entry.tsx','utf8');assert.ok(!/createExecution\(|createJWT\(|console\./.test(entry));assert.match(entry,/orderService/)
  const browserContract=await readFile('tools/customer-account-google-only/contract.mjs','utf8');assert.ok(!browserContract.includes('nam9295@gmail.com')&&!browserContract.includes('verygoutchocolate@gmail.com'))
  assert.ok(!result.inputs.some(x=>x.endsWith('.env')))
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('CLOSED restoration contains no app JS and consumes only reserved ninth slot',async()=>{
 assert.equal(typeof builder.googleOnlyClosedFiles,'function')
 const files=builder.googleOnlyClosedFiles();assert.equal(JSON.parse(files['test-window.json']).enabled,false)
 assert.ok(!Object.keys(files).some(x=>/\.js$/.test(x)));assert.match(files['account/index.html'],/CLOSED/);assert.match(files['_headers'],/script-src 'none'/)
})
test('Pages budget rejects unstarted/old approval before command; OPEN8/CLOSED9 are exclusive',async()=>{
 assert.equal(typeof builder.createGoogleOnlyPages,'function')
 const dir=await mkdtemp(join(tmpdir(),'google-only-pages-')),calls=[]
 try{
  const artifact=await builder.buildGoogleOnlySite({directory:join(dir,'artifact')})
  const pages=builder.createGoogleOnlyPages({directory:dir,artifactDirectory:artifact.directory,wranglerPath:'/synthetic/wrangler.mjs',clock:()=>now,run:async(_cmd,args)=>{calls.push(args);return {status:0}}})
  const p={...proof,priorPagesUsed:7,openSlot:8,closedSlot:9}
  await assert.rejects(pages.open({...p,startAuthorized:false}));await assert.rejects(pages.open({...p,planSha256:'old-v3'}));assert.equal(calls.length,0)
  await pages.open(p);await assert.rejects(pages.open(p));await pages.closed(p);await pages.closed(p)
  assert.equal(calls.length,2);assert.ok(calls.every(args=>args.includes('au-cake-account-test')&&args.includes('b3-google-test')))
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('actual compiled local HTTP returns route/script/CSS MIME and hard 404 without SPA fallback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'google-only-http-'))
 let server
 try{
  assert.equal(typeof builder.buildGoogleOnlySite,'function');const result=await builder.buildGoogleOnlySite({directory:dir})
  server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path==='/'||path.endsWith('/'))path+='index.html';else if(!path.split('/').at(-1).includes('.'))path+='/index.html';const body=await readFile(join(result.directory,path));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body)}catch{res.statusCode=404;res.end('Not found')}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port
  for(const path of ['/account','/account/auth/callback']){const r=await fetch(url+path);assert.equal(r.status,200);const html=await r.text();for(const [,asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g)){const a=await fetch(url+asset);assert.equal(a.status,200);assert.match(a.headers.get('Content-Type'),asset.endsWith('.css')?/text\/css/:/javascript/)}}
  assert.equal((await fetch(url+'/not-approved')).status,404)
 }finally{await new Promise(resolve=>server?server.close(resolve):resolve());await rm(dir,{recursive:true,force:true})}
})
const target=manager.GOOGLE_TEST_TARGET
function managementHarness(){
 const project={$id:target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,authEmailPassword:false,authPhone:false,authUsersAuthMagicURL:false,authEmailOtp:false,authAnonymous:false,authInvites:false,authJWT:false,authSessionAlerts:false,oAuthProviders:[{key:'google',enabled:true}]},calls=[]
 const f={$id:'ca-test-reservation-api',enabled:false,execute:[],deploymentId:'6ad41e576cb7a8f346af',runtime:'node-22',events:[],schedule:''}
 const sessions={[G]:[],[H]:[],'ca-test-admin-m-20261017':[]},userIds=['ca-test-admin-m-20261017',G,H],executions={total:18,executions:[]}
 const variables=['CUSTOMER_ACCOUNT_ENABLED','AU_RENEWAL_WRITES_ENABLED','AU_RENEWAL_PREORDERS_ENABLED',...Array.from({length:27},(_,i)=>'EXISTING_'+i)].map(key=>({$id:key,key,value:'false',secret:false}))
 const transport=async(url,o)=>{const path=new URL(url).pathname.slice(3);calls.push({method:o.method,path,body:o.body});let value
  if(path==='/projects/'+target.projectId){value=project}
  else if(path.endsWith('/platforms'))value={total:1,platforms:[{hostname:new URL(origin).hostname,type:'web'}]}
  else if(path==='/users')value={total:userIds.length,users:userIds.map($id=>({$id,status:true}))}
  else if(path.match(/^\/users\/[^/]+\/sessions$/))value={total:sessions[path.split('/')[2]].length,sessions:sessions[path.split('/')[2]]}
  else if(path.endsWith('/executions'))value=executions
  else if(path==='/functions/'+f.$id)value=f
  else if(path.endsWith('/variables'))value={total:30,variables}
  else if(path.endsWith('/service')&&o.method==='PATCH'){project.serviceStatusForAccount=JSON.parse(o.body).status;value=project}
  else if(path.startsWith('/users/')&&o.method==='DELETE'){const parts=path.split('/');sessions[parts[2]]=sessions[parts[2]].filter(s=>s.$id!==parts[4]);return new Response(null,{status:204})}
  else throw Error('unapproved request')
  return new Response(JSON.stringify(value))
 }
 const make=(patch={})=>{assert.equal(typeof manager.createGoogleOnlyTestManager,'function');return manager.createGoogleOnlyTestManager({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-owner'},transport,clock:()=>now,...patch})}
 return {project,calls,f,sessions,userIds,variables,executions,transport,make}
}
const proof={kind:'GOOGLE_ONLY',startAuthorized:true,planSha256:'9a938d7a5b86af5f17c12a61baddf73748565a9c4c7c9bb86ce41883046708ab',window,httpsVerified:true,watchdogVerified:true,pagesUsed:8,closedReserved:true}
test('management wrong target rejects before any request; no new user/key/limit/function writes',async()=>{
 const h=managementHarness()
 for(const patch of [{projectId:'verygood-au'},{endpoint:target.endpoint+'/'},{pagesProject:'au-cake-next'}])assert.throws(()=>h.make({target:{...target,...patch}}))
 assert.equal(h.calls.length,0);const m=h.make();await m.inspect();await m.enable(proof);await m.stop()
 assert.ok(h.calls.filter(c=>c.method!=='GET').every(c=>c.method==='PATCH'&&c.path==='/projects/verygood-au-account-test/service'))
 assert.equal(h.project.authLimit,2);assert.equal(h.f.enabled,false)
})
test('activation rejects missing start, wrong proof, extra provider, OTP, alerts, missing H or enabled Function',async()=>{
 for(const change of ['start','proof','pages','watchdog','provider','otp','alerts','function','limit','missing-H']){
  const h=managementHarness(),m=h.make(),p=structuredClone(proof)
  if(change==='start')p.startAuthorized=false;if(change==='proof')p.planSha256='old-v3';if(change==='pages')p.pagesUsed=7;if(change==='watchdog')p.watchdogVerified=false
  if(change==='provider')h.project.oAuthProviders.push({key:'github',enabled:true});if(change==='otp')h.project.authEmailOtp=true;if(change==='alerts')h.project.authSessionAlerts=true;if(change==='function')h.f.enabled=true;if(change==='limit')h.project.authLimit=3
  if(change==='missing-H')h.userIds.pop()
  await assert.rejects(m.enable(p));assert.equal(h.calls.filter(c=>c.method!=='GET').length,0)
 }
})
test('fresh manager inherits the baseline; unexpected execution or variable drift cannot become normal',async()=>{
 const h=managementHarness(),baseline=await h.make().inspect()
 h.executions.total++
 await assert.rejects(h.make({expectedBaseline:baseline}).inspect())
 h.executions.total--;h.variables[29].value='changed'
 await assert.rejects(h.make({expectedBaseline:baseline}).inspect())
 h.variables.pop();await assert.rejects(h.make().inspect())
})
test('OFF still attempts exact Account stop after inspection fails and redacts transport errors',async()=>{
 const h=managementHarness(),writes=[];const m=h.make({transport:async(url,o)=>{if(o.method==='PATCH'){writes.push(new URL(url).pathname);return new Response('{}')}throw Error('cookie=must-not-leave')}})
 await assert.rejects(m.inspect(),e=>!e.message.includes('must-not-leave'))
 await assert.rejects(m.stop(),e=>!e.message.includes('must-not-leave'));assert.deepEqual(writes,['/v1/projects/verygood-au-account-test/service'])
})
test('session cleanup only permits positively attributed G/H sessions, never M/baseline/unverified',async()=>{
 const h=managementHarness(),m=h.make({clock:()=>now+2000});await m.inspect()
 h.sessions[G].push({$id:'new-session',userId:G,provider:'google',$createdAt:new Date(now+1000).toISOString()})
 for(const change of [{userId:'ca-test-admin-m-20261017',sessionId:'new-session',intentAt:now},{userId:G,sessionId:'missing',intentAt:now},{userId:G,sessionId:'new-session',intentAt:now+2000}])await assert.rejects(m.cleanupSession({...change,proof}))
 assert.equal(h.calls.filter(c=>c.method==='DELETE').length,0)
 await m.cleanupSession({userId:G,sessionId:'new-session',intentAt:now,proof});assert.equal(h.sessions[G].length,0)
})
test('watchdog closes on deadline, unexpected execution, auth failure, resources and clock reversal',async()=>{
 assert.equal(typeof watchdog.createGoogleOnlyWatchdog,'function')
 for(const failure of ['deadline','execution','users','probe','resource','clock']){
  let at=now,closed=0;const wd=watchdog.createGoogleOnlyWatchdog({window,clock:()=>at,probe:async()=>{if(failure==='probe')throw Error('secret');return {safe:!['execution','users'].includes(failure),memoryAvailableBytes:failure==='resource'?0:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0}},off:async()=>{closed++},siteOff:async()=>{},cleanup:async()=>{},verify:async()=>true})
  if(failure==='deadline')at=window.endsAt
  if(failure==='clock'){await wd.tick();at--}
  const result=await wd.tick();assert.equal(result.closed,true);assert.equal(result.verified,true);assert.equal(closed,1)
 }
})
test('watchdog failed OFF is not successful recovery, other safe stop steps still run',async()=>{
 assert.equal(typeof watchdog.createGoogleOnlyWatchdog,'function');const steps=[]
 const wd=watchdog.createGoogleOnlyWatchdog({window,clock:()=>window.endsAt,probe:async()=>({}),off:async()=>{throw Error('secret')},cleanup:async()=>{steps.push('cleanup')},siteOff:async()=>{steps.push('closed')},verify:async()=>false})
 const result=await wd.tick();assert.equal(result.verified,false);assert.deepEqual(steps,['cleanup','closed']);assert.ok(!JSON.stringify(result).includes('secret'))
})
test('watchdog exposes an OFF-only manual recovery path without invoking Account ON',()=>{
 assert.equal(typeof watchdog.recoverGoogleOnly,'function')
})
test('live adapter refuses preparation proof without any remote request',async()=>{
 assert.equal(typeof live.createGoogleOnlyLiveAdapters,'function');let calls=0
 await assert.rejects(live.createGoogleOnlyLiveAdapters({kind:'GOOGLE_ONLY',startAuthorized:false},{transport:async()=>{calls++}}))
 assert.equal(calls,0)
})
test('closed verification rejects stale OPEN HTML even if the window JSON is already CLOSED',async()=>{
 const h=managementHarness(),state=await h.make().inspect(),base='/tmp/google-only-no-side-effects',j={kind:'GOOGLE_ONLY',runId:window.runId,phase:'prepared',accountOn:false,loginIntents:[]}
 const config={kind:'GOOGLE_ONLY',startAuthorized:true,planSha256:proof.planSha256,window,directory:base,artifactDirectory:base+'/artifact',wranglerPath:'/synthetic/wrangler.mjs',approvalProofPath:'proof',cliSessionPath:'cli',baselinePath:'baseline',journalPath:'journal'}
 const data={proof,cli:{endpoint:target.endpoint,cookie:'synthetic-owner'},baseline:{ownerVerified:true,functionExecutionsUsed:8,pagesUsed:7,state},journal:j}
 let html='<script src="app.js"></script>'
 const transport=async(url,o)=>{
  if(url===origin+'/test-window.json')return new Response(JSON.stringify({enabled:false}))
  if(url===origin+'/')return new Response(html)
  if(url===target.endpoint+'/account')return new Response(JSON.stringify({type:'general_service_disabled'}),{status:403})
  return h.transport(url,o)
 }
 const adapter=await live.createGoogleOnlyLiveAdapters(config,{transport,readJson:async p=>data[p],clock:()=>now})
 assert.equal(await adapter.verify(),false)
 html='<h1>Test CLOSED</h1>';assert.equal(await adapter.verify(),true)
})
test('Account activation transition is explicit and bounded without relaxing heartbeat/deadline',()=>{
 assert.equal(typeof live.googleOnlyAccountStateSafe,'function')
 assert.equal(live.googleOnlyAccountStateSafe(false,{phase:'prepared',accountOn:false},window,now),true)
 assert.equal(live.googleOnlyAccountStateSafe(true,{phase:'prepared',accountOn:false},window,now),false)
 const j={phase:'opening',activationRequestedAt:now}
 assert.equal(live.googleOnlyAccountStateSafe(false,j,window,now+1),true);assert.equal(live.googleOnlyAccountStateSafe(true,j,window,now+1),true)
 assert.equal(live.googleOnlyAccountStateSafe(true,j,window,now+8001),false)
 assert.equal(live.googleOnlyAccountStateSafe(false,{phase:'open',accountOn:true},window,now),false)
 assert.equal(live.googleOnlyAccountStateSafe(true,{phase:'open',accountOn:true},window,window.endsAt),false)
})
test('schema checkpoint recognizes Appwrite string/enum representation while retaining exact fields',()=>{
 assert.equal(typeof live.assertGoogleOnlyAttributeDefinition,'function')
 const expected={key:'status',type:'enum',required:true,elements:['Pending','Complete']},actual={...expected,type:'string',format:'enum'}
 assert.doesNotThrow(()=>live.assertGoogleOnlyAttributeDefinition(actual,expected))
 for(const patch of [{format:'email'},{type:'integer'},{elements:['Complete','Pending']},{required:false}])assert.throws(()=>live.assertGoogleOnlyAttributeDefinition({...actual,...patch},expected))
})
test('webhook metadata uses official project Console GET and refuses any configured webhook',async()=>{
 assert.equal(typeof live.assertGoogleOnlyWebhooksEmpty,'function');const calls=[]
 const options={cliSession:{endpoint:target.endpoint,cookie:'synthetic-owner'},transport:async(url,o)=>{calls.push({url,...o});return new Response(JSON.stringify({total:0,webhooks:[]}))}}
 await live.assertGoogleOnlyWebhooksEmpty(options)
 assert.equal(calls[0].url,target.endpoint+'/projects/verygood-au-account-test/webhooks');assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers['X-Appwrite-Project'],'console')
 await assert.rejects(live.assertGoogleOnlyWebhooksEmpty({...options,transport:async()=>new Response(JSON.stringify({total:1,webhooks:[{}]}))}))
})
test('complete closed checkpoint uses exact official metadata contracts and zero writes',async()=>{
 const manifestBytes=await readFile('docs/customer-account-b2-resource-manifest.json'),manifest=JSON.parse(manifestBytes),h=managementHarness(),calls=[]
 const transport=async(url,o)=>{
  assert.equal(o.method,'GET');calls.push(new URL(url).pathname)
  if(url===origin+'/test-window.json')return new Response(JSON.stringify({enabled:false}))
  if(url===origin+'/')return new Response('<h1>Test closed</h1>')
  const path=new URL(url).pathname.slice(3),project=o.headers['X-Appwrite-Project'];let data
  if(project==='console'){
   if(path==='/account')data={$id:'owner'}
   else if(path==='/account/sessions/current')data={userId:'owner',current:true,expire:'2099-01-01T00:00:00Z'}
   else if(path.endsWith('/memberships'))data={memberships:[{userId:'owner',confirm:true,roles:['owner']}]}
   else if(path.endsWith('/webhooks'))data={total:0,webhooks:[]}
   else if(path.endsWith('/platforms'))data={total:1,platforms:[{hostname:new URL(origin).hostname,type:'web'}]}
   else if(path.startsWith('/projects/'))data={...h.project,$id:path.split('/')[2]}
  }else if(project!==target.projectId&&path==='/functions')data={total:0,functions:[]}
  else if(path==='/account')return new Response(JSON.stringify({type:'general_service_disabled'}),{status:403})
  else if(path==='/health/version')data={version:'1.8.1'}
  else if(path==='/databases')data={total:2,databases:manifest.creates.databases.map(x=>({$id:x.databaseId}))}
  else if(path.startsWith('/databases/')){
   const parts=path.split('/'),db=parts[2],id=parts[4],defs=manifest.creates.collections.filter(x=>x.databaseId===db),c=defs.find(x=>x.collectionId===id)
   if(!id)data={total:defs.length,collections:defs.map(x=>({$id:x.collectionId,$permissions:x.permissions,enabled:true,documentSecurity:false}))}
   else if(parts[5]==='attributes'){const list=c.attributes.map(x=>({...x,...(x.type==='enum'?{type:'string',format:'enum'}:{}),status:'available'}));if(id==='reservations')list.push(ownerAttribute);data={total:list.length,attributes:list}}
   else if(parts[5]==='indexes'){const list=c.indexes.map(x=>({...x,status:'available'}));if(id==='reservations')list.push(ownerIndex);data={total:list.length,indexes:list}}
  }
  if(data===undefined)return h.transport(url,o)
  return new Response(JSON.stringify(data))
 }
 const result=await live.captureGoogleOnlyCheckpoint({cliSession:{endpoint:target.endpoint,cookie:'synthetic-owner'},manifestBytes,transport,readMetrics:async()=>({memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0})})
 assert.equal(result.ownerVerified,true);assert.equal(result.accountOff403,true);assert.equal(result.siteClosed,true);assert.equal(result.schema.collections,12);assert.equal(result.schema.attributes,182);assert.equal(result.schema.indexes,38)
 assert.ok(!calls.some(x=>x.includes('/documents')||x.includes('/executions/')))
})
test('lease rejects missing/future/stale probe and binds exact run; worker death and stop marker close it',async()=>{
 assert.equal(typeof watchdog.inspectGoogleOnlyLease,'function')
 const directory=await mkdtemp(join(tmpdir(),'google-only-lease-'));await chmod(directory,0o700)
 try{
  const configPath=join(directory,'config.json'),config={kind:'GOOGLE_ONLY',planSha256:proof.planSha256,mode:'live',startAuthorized:true,directory,adapterPath:'/synthetic/adapter.mjs',window}
  await writeFile(configPath,JSON.stringify(config),{mode:0o600})
  const h={closed:false,pid:process.pid,at:now,checkedAt:now,startsAt:window.startsAt,endsAt:window.endsAt,runId:window.runId}
  for(const change of [{}, {checkedAt:undefined},{checkedAt:now+1},{checkedAt:now-5001},{runId:'other'},{startsAt:now-1},{pid:2147483647}]){
   await writeFile(join(directory,'heartbeat.json'),JSON.stringify({...h,...change}),{mode:0o600})
   assert.equal(await watchdog.inspectGoogleOnlyLease({configPath,clock:()=>now}),Object.keys(change).length===0)
  }
  await writeFile(join(directory,'heartbeat.json'),JSON.stringify(h),{mode:0o600});await writeFile(join(directory,'stop.request'),'stop',{mode:0o600})
  assert.equal(await watchdog.inspectGoogleOnlyLease({configPath,clock:()=>now}),false)
 }finally{await rm(directory,{recursive:true,force:true})}
})
test('independent self-test worker actually reaches verified CLOSED on deadline without credentials',async()=>{
 assert.equal(typeof watchdog.startGoogleOnlyWatchdog,'function')
 const directory=await mkdtemp(join(tmpdir(),'google-only-worker-'));await chmod(directory,0o700);let pid
 try{
  const t=Date.now(),configPath=join(directory,'config.json')
  await writeFile(configPath,JSON.stringify({kind:'GOOGLE_ONLY',planSha256:proof.planSha256,mode:'self-test',directory,window:{...window,startsAt:t,endsAt:t+600}}),{mode:0o600})
  ;({pid}=await watchdog.startGoogleOnlyWatchdog({configPath}))
  let result
  for(let i=0;i<40;i++){try{result=JSON.parse(await readFile(join(directory,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,100))}}
  assert.equal(result?.closed,true);assert.equal(result.verified,true);assert.deepEqual(result.failedSteps,[])
 }finally{if(pid){try{process.kill(pid,'SIGTERM')}catch{/* finished */}}await rm(directory,{recursive:true,force:true})}
})
