import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createB7Runner} from '../scripts/customer-account-b7-runner.mjs'
const manifestBytes=await readFile(new URL('../docs/customer-account-b7-execution-manifest-v2.json',import.meta.url)),m=JSON.parse(manifestBytes)
const approvalProof={approved:true,allowAutoExtend:false,residualPublicInvocationRiskAccepted:true,manifestSha256:'2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41'}
function setup(){
 const calls=[],vars=Object.keys(m.restoreState.serverFlags).map((key,i)=>({$id:'flag-'+i,key,value:'true',secret:false})).concat({$id:'signing-key',key:'B7_TEST_HMAC_SECRET',secret:true,value:''})
 const p={$id:m.target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:true,authLimit:3,smtpEnabled:true,oAuthProviders:[{key:'google',enabled:true}],...Object.fromEntries(['authEmailOtp','authEmailPassword','authUsersAuthMagicURL','authPhone','authAnonymous','authInvites','authJWT'].map(k=>[k,false]))}
 const f={$id:m.target.functionId,name:'CA TEST Reservation API B6',enabled:true,execute:['any'],deploymentId:'guarded-deployment',runtime:'node-22',specification:'s-1vcpu-1gb',events:[],schedule:'',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']}
 const sessions={[m.actors.G.uid]:['before-G','created-G'],[m.actors.H.uid]:['created-H']}
 const state={attempts:{},sessionBaseline:{[m.actors.G.uid]:['before-G'],[m.actors.H.uid]:[]},createdSessionIds:{[m.actors.G.uid]:['created-G'],[m.actors.H.uid]:['created-H']}}
 const transport=async(url,o)=>{
  const path=new URL(url).pathname.replace('/v1','');const body=o.body?JSON.parse(o.body):null;calls.push({path,method:o.method,body})
  if(path==='/account')return Response.json({}, {status:p.serviceStatusForAccount?401:403})
  if(path.endsWith('/service'))p.serviceStatusForAccount=body.status
  else if(path.endsWith('/auth/limit'))p.authLimit=body.limit
  else if(path.includes('/deployments/'))f.deploymentId=path.split('/').at(-1)
  else if(path.endsWith('/variables'))return Response.json({total:vars.length,variables:vars})
  else if(path.includes('/variables/')){Object.assign(vars.find(v=>v.$id===path.split('/').at(-1)),body)}
  else if(path.startsWith('/users/')){
   const [, ,uid,,id]=path.split('/')
   if(o.method==='DELETE'){sessions[uid]=sessions[uid].filter(s=>s!==id);return new Response(null,{status:204})}
   return Response.json({sessions:sessions[uid].map($id=>({$id}))})
  }else if(path.startsWith('/functions/')){if(body)Object.assign(f,body);return Response.json(f)}
  return Response.json(p)
 }
 const runner=createB7Runner({manifestBytes,approvalProof,target:m.target,cliSession:{endpoint:m.target.endpoint,cookie:'synthetic-owner'},state,persist:async()=>{},transport})
 return {runner,calls,p,f,vars,sessions,state,transport}
}
test('real recovery adapter composes exact OFF routes, flags, signing invalidation, B6 restore and only run session cleanup',async()=>{
 const s=setup()
 for(const op of ['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','restoreAuthLimit','cleanupRunSessions'])await s.runner[op]()
 assert.equal(await s.runner.verifyClosed(),true);assert.equal(s.f.deploymentId,m.target.baseDeploymentId);assert.deepEqual(s.f.execute,[])
 assert.equal(s.vars.find(v=>v.key==='B7_TEST_HMAC_SECRET').value,'B7_REVOKED');assert.ok(s.vars.find(v=>v.key==='B7_TEST_HMAC_SECRET').secret)
 assert.deepEqual(s.sessions[m.actors.G.uid],['before-G']);assert.deepEqual(s.sessions[m.actors.H.uid],[])
 assert.ok(s.calls.filter(c=>c.method==='DELETE').every(c=>c.path.startsWith('/users/'+m.actors.G.uid+'/sessions/created-')||c.path.startsWith('/users/'+m.actors.H.uid+'/sessions/created-')))
})
test('session cleanup refuses unknown sessions and never deletes a baseline session',async()=>{
 for(const mutate of [s=>s.sessions[m.actors.G.uid].push('unattributed'),s=>s.state.createdSessionIds[m.actors.G.uid].push('before-G')]){
 const s=setup();mutate(s);await assert.rejects(s.runner.cleanupRunSessions());assert.equal(s.calls.filter(c=>c.method==='DELETE').length,0)
 }
})
test('live watchdog refuses missing authorization before reading credentials or performing a request',async()=>{
 const {createB7LiveWatchdogAdapters}=await import('../scripts/customer-account-b7-watchdog-adapters.mjs');let calls=0
 await assert.rejects(createB7LiveWatchdogAdapters({liveExecutionAuthorized:false},{transport:async()=>{calls++}}));assert.equal(calls,0)
})

test('live watchdog wiring polls only metadata, detects an unsigned execution, and uses explicit private files',async()=>{
 const {createB7LiveWatchdogAdapters}=await import('../scripts/customer-account-b7-watchdog-adapters.mjs'),{createHash}=await import('node:crypto')
 const s=setup(),directory=await mkdtemp(join(tmpdir(),'b7-adapters-test-')),now=Date.now(),window={startsAt:now-1000,endsAt:now+899000};let unexpected=false
 s.vars.find(v=>v.key==='AU_RENEWAL_PREORDERS_ENABLED').value='false'
 s.state.window=window;s.state.deploymentId='guarded-deployment';s.state.phase='open';s.state.fixtureSha256='a'.repeat(64)
 for(const [key,value] of Object.entries({B7_TEST_RUN_ID:m.runId,B7_TEST_STARTS_AT:String(window.startsAt),B7_TEST_ENDS_AT:String(window.endsAt),B7_TEST_FIXTURE_MANIFEST_SHA256:s.state.fixtureSha256}))s.vars.push({$id:key,key,value,secret:false})
 const file=async(name,data)=>{const p=join(directory,name);await writeFile(p,JSON.stringify(data),{mode:0o600});return p}
 const operatingProjectFingerprints=Object.fromEntries(['verygood-main','verygood-au','69cb27ef002b63e77c53','69db3ae20026cdc0c7fe'].map(id=>[id,createHash('sha256').update(JSON.stringify({$id:id,authEmailOtp:true})).digest('hex')]))
 const config={liveExecutionAuthorized:true,manifestPath:new URL('../docs/customer-account-b7-execution-manifest-v2.json',import.meta.url),approvalProofPath:await file('approval.json',approvalProof),cliSessionPath:await file('cli.json',{endpoint:m.target.endpoint,cookie:'synthetic-owner'}),statePath:await file('state.json',s.state),directory,endsAt:window.endsAt,baselineOom:0,signingSecret:Buffer.alloc(32,9).toString('base64url'),executionBaselineIds:[],operatingProjectFingerprints}
 const transport=async(url,options)=>{
  const p=new URL(url).pathname.replace('/v1','')
  if(p==='/health/version')return Response.json({version:'1.8.1'})
  if(p==='/users')return Response.json({total:3,users:m.requiredBeforeOpen.exactUsers.map($id=>({$id,status:true}))})
  if(p.endsWith('/executions'))return Response.json({executions:unexpected?[{$id:'unknown',requestPath:'/',requestMethod:'POST'}]:[]})
  if(p.startsWith('/projects/')&&!p.includes(m.target.projectId))return Response.json({$id:p.split('/').at(-1),authEmailOtp:true})
  return s.transport(url,options)
 }
 const adapter=await createB7LiveWatchdogAdapters(config,{transport,readMetrics:async()=>({memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0}),siteOff:async()=>{}})
 const good=await adapter.probe();assert.equal(good.metadataChanged,false);assert.equal(good.unexpectedExecutions,0);assert.equal(good.unexpectedUsers,false)
 unexpected=true;assert.equal((await adapter.probe()).unexpectedExecutions,1)
 assert.ok(s.calls.every(c=>c.method==='GET'))
})
