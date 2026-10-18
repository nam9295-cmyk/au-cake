import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=await import('../scripts/customer-account-b7-v3-execution-contract.mjs').catch(()=>({}))
const runner=await import('../scripts/customer-account-b7-v3-runner.mjs').catch(()=>({}))
const bytes=readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),m=JSON.parse(bytes)
const hash='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',proof={manifestSha256:hash,manifestVersion:3,approved:true,residualPublicInvocationRiskAccepted:true,allowAutoExtend:false}
export const v3Proof=proof
test('native G Checkout default options are frozen byte-for-byte without permitting price-changing options',async()=>{
 const {b7Inputs}=await import('./fixtures/customer-account/b7.mjs'),rows=b7Inputs()
 for(const row of rows.slice(0,2))Object.assign(row.data.orderLines[0],{finish:'basic',individualPackaging:false})
 const frozen=JSON.parse(api.freezeB7Fixtures(rows))
 assert.equal(frozen.createBodies[0],JSON.stringify(rows[0]));assert.equal(frozen.createBodies[1],JSON.stringify(rows[1]))
 for(const patch of [{finish:'extra-chocolate'},{individualPackaging:true},{unknownOption:false}]){
  const changed=structuredClone(rows);Object.assign(changed[0].data.orderLines[0],patch);assert.throws(()=>api.freezeB7Fixtures(changed))
 }
})
test('V3 execution rejects every older proof or manifest and wrong target before network',()=>{
 assert.equal(typeof api.assertB7Run,'function')
 const input={manifestBytes:bytes,approvalProof:proof,target:m.target,phase:'prepare',now:Date.now()}
 assert.equal(api.assertB7Run(input).manifest.manifestVersion,3)
 for(const change of [{approvalProof:{...proof,manifestSha256:'2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41'}},{approvalProof:{...proof,manifestVersion:2}},{manifestBytes:readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v2.json',import.meta.url))},{target:{...m.target,projectId:'verygood-au'}}])assert.throws(()=>api.assertB7Run({...input,...change}))
})
const project={$id:m.target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,authEmailOtp:false,authEmailPassword:false,authUsersAuthMagicURL:false,authPhone:false,authAnonymous:false,authInvites:false,authJWT:false,smtpEnabled:true,oAuthProviders:[{key:'google',enabled:true}]}
const fn={timeout:20,logging:true,entrypoint:'src/main.js',commands:'npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22',installationId:'',providerRepositoryId:'',providerBranch:'',providerSilentMode:false,providerRootDirectory:'',$id:m.target.functionId,name:'CA TEST Reservation API B6',enabled:false,execute:[],deploymentId:m.target.baseDeploymentId,runtime:'node-22',events:[],schedule:'',specification:'s-1vcpu-1gb',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']}
function setup(alter=()=>{}){
 const vars=[{$id:'customer',key:'CUSTOMER_ACCOUNT_ENABLED',value:'false',secret:false},...Array.from({length:22},(_,i)=>({$id:'base'+i,key:'BASE_'+i,value:'existing',secret:false}))],calls=[],state={attempts:{},fixtureSha256:'a'.repeat(64)}
 alter(vars)
 const transport=async(url,o)=>{calls.push({url,...o});if(url.endsWith('/variables')){if(o.method==='POST'){const body=JSON.parse(o.body),row={$id:'new'+vars.length,...body};vars.push(row);return Response.json(row)}return Response.json({total:vars.length,variables:vars})}if(o.method==='PUT'&&url.includes('/variables/')){const row=vars.find(x=>x.$id===url.split('/').at(-1));Object.assign(row,JSON.parse(o.body));return Response.json(row)}return Response.json(url.includes('/projects/')?project:fn)}
 const args={manifestBytes:bytes,approvalProof:proof,target:m.target,cliSession:{endpoint:m.target.endpoint,cookie:'synthetic-local-owner'},transport,state,persist:async()=>{}}
 return {vars,calls,state,args}
}
test('V3 prepares exactly seven variables with explicit OFF and correct secret metadata, create-only once',async()=>{
 assert.equal(typeof runner.createB7Runner,'function')
 const s=setup(),r=runner.createB7Runner(s.args),secret=Buffer.alloc(32,6).toString('base64url')
 await r.prepareGuardVariables({secret,fixtureSha256:s.state.fixtureSha256})
 const added=s.calls.filter(c=>c.method==='POST').map(c=>JSON.parse(c.body))
 assert.equal(added.length,7);assert.deepEqual(added.map(x=>x.key),m.newFunctionVariableNames)
 for(const key of ['AU_RENEWAL_WRITES_ENABLED','AU_RENEWAL_PREORDERS_ENABLED'])assert.deepEqual(added.find(v=>v.key===key),{key,value:'false',secret:false})
 assert.equal(added.find(v=>v.key==='B7_TEST_HMAC_SECRET').secret,true);assert.equal(s.vars.length,30)
 const n=s.calls.length;await assert.rejects(r.prepareGuardVariables({secret,fixtureSha256:s.state.fixtureSha256}));assert.equal(s.calls.length,n)
 const now=Date.now(),window={startsAt:now,endsAt:now+900000}
 await r.configureGuard({window,secret,fixtureSha256:s.state.fixtureSha256})
 assert.equal(s.calls.filter(c=>c.method==='POST').length,7)
 assert.equal(s.vars.find(v=>v.key==='AU_RENEWAL_WRITES_ENABLED').value,'true');assert.equal(s.vars.find(v=>v.key==='AU_RENEWAL_PREORDERS_ENABLED').value,'false')
 await r.flagsOff();assert.ok(Object.keys(m.restoreState.serverFlags).every(k=>s.vars.find(v=>v.key===k).value==='false'))
})
test('V3 variable collision or unexpected baseline count produces zero writes',async()=>{
 for(const alter of [v=>v.push({$id:'extra',key:'EXTRA',value:'x',secret:false}),v=>{v[1].key='B7_TEST_RUN_ID'}]){
  const s=setup(alter),r=runner.createB7Runner(s.args)
  await assert.rejects(r.prepareGuardVariables({secret:Buffer.alloc(32,6).toString('base64url'),fixtureSha256:s.state.fixtureSha256}))
  assert.equal(s.calls.filter(c=>c.method!=='GET').length,0)
 }
})
test('V3 HTTPS overlay has bounded original-SDK request and UID-only controls without logging credentials',async()=>{
 const {readFile}=await import('node:fs/promises'),s=await readFile(new URL('../tools/customer-account-b7-v3/browser-entry.ts',import.meta.url),'utf8')
 assert.ok(s.includes('Approved B7 request'));assert.ok(s.includes('Read test identity'));assert.ok(s.includes('Execute approved request'))
 assert.doesNotMatch(s,/console\.(log|error)|createJWT|readSecret\(\).*textContent/)
})
test('V3 emergency Function update explicitly preserves Appwrite1.8.1 scopes, commands, timeout and spec',async()=>{
 const s=setup(),r=runner.createB7Runner(s.args);await r.functionOff()
 const body=JSON.parse(s.calls.find(c=>c.method==='PUT').body)
 assert.deepEqual(body.scopes,fn.scopes);assert.equal(body.timeout,20);assert.equal(body.runtime,'node-22');assert.equal(body.specification,'s-1vcpu-1gb');assert.equal(body.entrypoint,'src/main.js');assert.match(body.commands,/--linux-node22/)
 assert.deepEqual(body.events,[]);assert.equal(body.schedule,'');assert.equal(body.logging,true);assert.equal(body.providerRepositoryId,'')
})
