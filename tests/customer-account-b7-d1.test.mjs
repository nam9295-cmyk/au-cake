import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {packageB7Function} from '../scripts/customer-account-b7-v3-runtime.mjs'
import {B7_MANIFEST_SHA256,freezeB7Fixtures,sha256} from '../scripts/customer-account-b7-v3-execution-contract.mjs'
import {b7Inputs} from './fixtures/customer-account/b7.mjs'
import {FUNCTION_SCOPES} from '../scripts/reservation-api-deploy-config.mjs'
import {B6_BUILD_COMMAND} from '../scripts/customer-account-test-function.mjs'
import {createB7GuardedHandler} from '../tools/customer-account-b7-v3/function-entry.mjs'
const api=await import('../scripts/customer-account-b7-d1.mjs').catch(()=>({}))
const manifestBytes=await readFile(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),m=JSON.parse(manifestBytes),fixtureManifestBytes=freezeB7Fixtures(b7Inputs()),now=1792310400000,secret=Buffer.alloc(32,12).toString('base64url')
const artifact=await packageB7Function({directory:await mkdtemp(join(tmpdir(),'b7-d1-tests-')),fixtureManifestBytes})
function inputs(){const priorStateBytes=Buffer.from(JSON.stringify({deploymentId:'6ad456239aeb781a4f4d',initialVariableCount:23,fixtureSha256:artifact.fixtureSha256,guardVariableIds:Object.fromEntries(m.newFunctionVariableNames.map((key,i)=>[key,'var-'+i])),sessionBaseline:{[m.actors.G.uid]:[],[m.actors.H.uid]:[]},attempts:{deployment:true,prepareVariables:true,configure:true}}));return {manifestBytes,priorStateBytes,approvalProof:{manifestVersion:3,manifestSha256:B7_MANIFEST_SHA256,approved:true,allowAutoExtend:false,residualPublicInvocationRiskAccepted:true,diagnostic:{kind:'B7_D1',approved:true,priorJournalSha256:sha256(priorStateBytes),priorExecutions:7,priorPages:7,deploymentMax:1,healthMax:3,windowSecondsMax:300,accountMayOpen:false,pagesMayDeploy:false,archiveSha256:artifact.archiveSha256,fixtureSha256:artifact.fixtureSha256}}}}
function setup(changes={}){
 assert.equal(typeof api.createB7D1State,'function');assert.equal(typeof api.createB7D1Runner,'function')
 const input=inputs(),state=api.createB7D1State(input),calls=[],vars=[{key:'CUSTOMER_ACCOUNT_ENABLED',$id:'customer-flag',value:'false',secret:false},...m.newFunctionVariableNames.map((key,i)=>({key,$id:'var-'+i,value:key.startsWith('AU_')?'false':'0',secret:key==='B7_TEST_HMAC_SECRET'})),...Array.from({length:22},(_,i)=>({key:'BASE_'+i,$id:'base-'+i,value:'existing',secret:false}))].map(v=>({...v,$updatedAt:new Date(now).toISOString()}))
 const p={$id:m.target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,smtpEnabled:true,oAuthProviders:[{key:'google',enabled:true}],...Object.fromEntries(['authEmailOtp','authEmailPassword','authUsersAuthMagicURL','authPhone','authAnonymous','authInvites','authJWT'].map(k=>[k,false]))}
 const f={$id:m.target.functionId,name:'CA TEST Reservation API B6',runtime:'node-22',timeout:20,logging:true,entrypoint:'src/main.js',commands:B6_BUILD_COMMAND,scopes:[...FUNCTION_SCOPES],installationId:'',providerRepositoryId:'',providerBranch:'',providerSilentMode:false,providerRootDirectory:'',specification:'s-1vcpu-1gb',events:[],schedule:'',enabled:false,execute:[],deploymentId:m.target.baseDeploymentId}
 let at=now,tick=0,guardFailure=false,missingLog=false,newId='d1-new-deployment',createdAt=new Date(now+100).toISOString()
 const transport=async(url,o)=>{const path=new URL(url).pathname.slice(3),data=o.body instanceof FormData?o.body:typeof o.body==='string'?JSON.parse(o.body):null;calls.push({path,method:o.method,data})
  if(path==='/account')return Response.json({}, {status:p.serviceStatusForAccount?401:403})
  if(path.endsWith('/service')){p.serviceStatusForAccount=data.status;return Response.json(p)}
  if(path.endsWith('/auth/limit')){p.authLimit=data.limit;return Response.json(p)}
  if(path.startsWith('/projects/'))return Response.json(p)
  if(path.endsWith('/variables'))return Response.json({total:vars.length,variables:vars.map(v=>({...v,value:v.secret?'':v.value}))})
  if(path.includes('/variables/')){const v=vars.find(v=>v.$id===path.split('/').at(-1));Object.assign(v,data,{$updatedAt:new Date(now+ ++tick).toISOString()});return Response.json({...v,value:v.secret?'':v.value})}
  if(path.endsWith('/deployments')&&o.method==='POST')return Response.json({$id:newId,$createdAt:createdAt,status:'processing'})
  if(path.includes('/deployments/')){if(o.method==='PATCH')f.deploymentId=path.split('/').at(-1);return Response.json({$id:path.split('/').at(-1),$createdAt:new Date(now+100).toISOString(),status:'ready',entrypoint:'src/b7-entry.mjs',resourceId:m.target.functionId})}
  if(path.endsWith('/executions')&&o.method==='POST'){
   const env={...Object.fromEntries(vars.map(v=>[v.key,v.value])),APPWRITE_FUNCTION_PROJECT_ID:m.target.projectId,APPWRITE_FUNCTION_ID:m.target.functionId,APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_ADMIN_USER_IDS:m.actors.M.uid};if(guardFailure)env.CUSTOMER_ACCOUNT_ENABLED='false'
   const logs=[],guard=createB7GuardedHandler({approvedManifestBytes:manifestBytes,fixtureManifestBytes,env,clock:()=>at,verifyIdentity:async()=>{throw Error('health must not impersonate customer')},handler:async()=>({status:200,body:{ok:true,result:{enabled:true,ready:true,preordersEnabled:false}}})})
   const result=await guard({req:{path:data.path,bodyText:data.body,bodyJson:JSON.parse(data.body),headers:{...data.headers,'x-appwrite-user-id':'synthetic-owner','x-appwrite-user-jwt':'synthetic-platform-jwt'}},res:{json:(body,status)=>({body,status})},log:line=>logs.push(line)})
   return Response.json({$id:'execution-'+calls.length,deploymentId:f.deploymentId,status:'completed',responseStatusCode:result.status,responseBody:JSON.stringify(result.body),logs:missingLog?'':logs.join('\n')})
  }
  if(path.startsWith('/users/'))return Response.json({sessions:[],total:0})
  if(data)Object.assign(f,data);return Response.json(f)
 }
 const runner=api.createB7D1Runner({...input,state,cliSession:{endpoint:m.target.endpoint,cookie:'synthetic-owner'},transport,persist:async()=>{},clock:()=>at,lease:async()=>true,...changes})
 return {runner,state,calls,p,f,vars,set at(n){at=n},set guardFailure(x){guardFailure=x},set missingLog(x){missingLog=x},set newId(x){newId=x},set createdAt(x){createdAt=x}}
}
async function ready(s){await s.runner.configure({window:{startsAt:now,endsAt:now+300000},secret});await s.runner.deploy({archive:artifact.archive});await s.runner.activate()}
test('D1 state preserves old journal and resource IDs, carries seven used executions and zero Pages writes',()=>{
 assert.equal(typeof api.createB7D1State,'function');const i=inputs(),before=i.priorStateBytes.toString(),s=api.createB7D1State(i);assert.equal(i.priorStateBytes.toString(),before);assert.equal(s.continuation.priorExecutions,7);assert.equal(s.d1.healthAttempts.length,0);assert.equal(s.attempts.deployment,undefined);assert.equal(s.attempts.prepareVariables,true);assert.equal(s.window,undefined);assert.equal(s.guardVariableIds.B7_TEST_HMAC_SECRET,'var-3')
 for(const change of [x=>x.approvalProof.diagnostic.deploymentMax=2,x=>x.approvalProof.diagnostic.priorExecutions=0,x=>x.approvalProof.diagnostic.accountMayOpen=true,x=>x.approvalProof.diagnostic.windowSecondsMax=900,x=>x.priorStateBytes=Buffer.from('{}')]){const x=inputs();change(x);assert.throws(()=>api.createB7D1State(x))}
})
test('D1 requires exact explicit approval and cannot expose open, fixture creation or Pages methods',()=>{
 const s=setup();assert.equal(s.runner.open,undefined);assert.equal(s.runner.prepareGuardVariables,undefined)
 let calls=0;const i=inputs();i.approvalProof.diagnostic.approved=false;assert.throws(()=>api.createB7D1Runner({...i,state:s.state,cliSession:{endpoint:m.target.endpoint,cookie:'test'},persist:async()=>{},transport:async()=>{calls++}}));assert.equal(calls,0)
})
test('D1 freezes variables before one deployment, keeps Account/execute closed and accepts only three ordered signed health requests',async()=>{
 const s=setup();await ready(s)
 for(const a of ['health','renewal-health','customer-account-health'])assert.equal((await s.runner.health(a)).httpStatus,200)
 assert.equal(s.state.d1.healthAttempts.length,3);assert.equal(s.p.serviceStatusForAccount,false);assert.equal(s.f.enabled,false);assert.deepEqual(s.f.execute,[])
 await assert.rejects(s.runner.health('health'));await assert.rejects(s.runner.deploy({archive:artifact.archive}));await assert.rejects(s.runner.configure({window:{startsAt:now,endsAt:now+300000},secret}))
 assert.equal(s.calls.filter(x=>x.method==='POST'&&x.path.endsWith('/deployments')).length,1);assert.equal(s.calls.filter(x=>x.method==='POST'&&x.path.endsWith('/executions')).length,3)
 const firstDeploy=s.calls.findIndex(x=>x.method==='POST'&&x.path.endsWith('/deployments'));assert.ok(s.calls.filter(x=>x.path.includes('/variables/')&&x.method==='PUT').every(x=>s.calls.indexOf(x)<firstDeploy))
})
test('D1 rejects expired/oversized window, old deployment and post-freeze variable drift before health writes',async()=>{
 const s=setup();await assert.rejects(s.runner.configure({window:{startsAt:now,endsAt:now+300001},secret}));assert.equal(s.calls.length,0)
 const t=setup();await ready(t);t.vars[0].value='false';await assert.rejects(t.runner.health('health'));assert.equal(t.calls.filter(c=>c.path.endsWith('/executions')).length,0)
 const u=setup();await ready(u);u.at=now+300000;await assert.rejects(u.runner.health('health'));assert.equal(u.calls.filter(c=>c.path.endsWith('/executions')).length,0)
 const v=setup();await v.runner.configure({window:{startsAt:now,endsAt:now+300000},secret});v.newId='6ad456239aeb781a4f4d';await assert.rejects(v.runner.deploy({archive:artifact.archive}));assert.equal(v.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/deployments')).length,1)
})
test('D1 stops after first guard failure or missing diagnostics and never attempts the second health',async()=>{
 for(const missing of [false,true]){const s=setup();await ready(s);s.guardFailure=!missing;s.missingLog=missing;await assert.rejects(s.runner.health('health'));await assert.rejects(s.runner.health('renewal-health'));assert.equal(s.state.d1.healthAttempts.length,1);assert.equal(s.calls.filter(c=>c.path.endsWith('/executions')).length,1);assert.equal(s.state.d1.failed,true);if(!missing)assert.equal(s.state.d1.lastResult.guardPhase,'CONFIG')}
})
test('D1 recovery can run after expiry and restores OFF flags/revoked key/B6 without deployment or public execute changes',async()=>{
 const s=setup();await ready(s);s.at=now+300001
 for(const name of ['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','restoreAuthLimit','cleanupRunSessions'])await s.runner.operations[name]()
 assert.equal(await s.runner.verifyClosed(),true);assert.equal(s.f.deploymentId,m.target.baseDeploymentId);assert.equal(s.vars.find(v=>v.key==='B7_TEST_HMAC_SECRET').value,'B7_REVOKED');assert.equal(s.p.serviceStatusForAccount,false);assert.deepEqual(s.f.execute,[])
})
test('D1 requires a live watchdog lease before deployment and rejects a response created before the frozen window',async()=>{
 const s=setup({lease:async()=>false});await s.runner.configure({window:{startsAt:now,endsAt:now+300000},secret});await assert.rejects(s.runner.deploy({archive:artifact.archive}));assert.equal(s.calls.filter(c=>c.method==='POST').length,0)
 const t=setup();await t.runner.configure({window:{startsAt:now,endsAt:now+300000},secret});t.createdAt=new Date(now-10000).toISOString();await assert.rejects(t.runner.deploy({archive:artifact.archive}));assert.equal(t.calls.filter(c=>c.method==='POST').length,1)
})
test('D1 refuses arbitrary health actions and secret metadata drift without executing a Function',async()=>{
 const s=setup();await ready(s);await assert.rejects(s.runner.health('create-cake'));assert.equal(s.calls.filter(c=>c.path.endsWith('/executions')).length,0)
 s.vars.find(v=>v.key==='B7_TEST_HMAC_SECRET').$updatedAt=new Date(now+1000).toISOString();await assert.rejects(s.runner.health('health'));assert.equal(s.calls.filter(c=>c.path.endsWith('/executions')).length,0)
})
