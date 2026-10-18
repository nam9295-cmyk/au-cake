import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=await import('../scripts/customer-account-b7-v3-runner.mjs').catch(()=>({}))
const manifestBytes=readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),manifest=JSON.parse(manifestBytes)
const approvalProof={manifestVersion:3,manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',approved:true,residualPublicInvocationRiskAccepted:true,allowAutoExtend:false}
const project={$id:manifest.target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,authEmailOtp:false,authEmailPassword:false,authUsersAuthMagicURL:false,authPhone:false,authAnonymous:false,authInvites:false,authJWT:false,smtpEnabled:true,oAuthProviders:[{key:'google',enabled:true}]}
const fn={timeout:20,logging:true,entrypoint:'src/main.js',commands:'npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22',installationId:'',providerRepositoryId:'',providerBranch:'',providerSilentMode:false,providerRootDirectory:'',$id:manifest.target.functionId,enabled:false,execute:[],deploymentId:manifest.target.baseDeploymentId,runtime:'node-22',events:[],schedule:'',specification:'s-1vcpu-1gb'}
function setup(changes={}){const calls=[];const transport=async(url,o)=>{calls.push({url,...o});return Response.json(url.includes('/projects/')?project:fn)};const args={manifestBytes,approvalProof,target:manifest.target,cliSession:{endpoint:manifest.target.endpoint,cookie:'local-fake-owner'},transport,clock:()=>1792281600000,persist:async()=>{},state:{attempts:{}},...changes};return {calls,args}}
test('runner rejects wrong approval/target/key credentials before network',()=>{
 assert.equal(typeof api.createB7Runner,'function')
 for(const changes of [{target:{...manifest.target,projectId:'verygood-au'}},{approvalProof:{...approvalProof,approved:false}},{cliSession:{endpoint:manifest.target.endpoint,cookie:'x',key:'not-allowed'}}]){const s=setup(changes);assert.throws(()=>api.createB7Runner(s.args));assert.equal(s.calls.length,0)}
})
test('runner cannot activate without independent watchdog and complete local gates',async()=>{
 assert.equal(typeof api.createB7Runner,'function')
 const s=setup(),r=api.createB7Runner(s.args)
 await assert.rejects(r.open({}));assert.equal(s.calls.length,0)
})
test('fixed emergency OFF requests work without healthy metadata and never broaden permission',async()=>{
 const s=setup(),r=api.createB7Runner(s.args)
 await r.accountOff();await r.functionOff()
 assert.deepEqual(s.calls.map(c=>[new URL(c.url).pathname,JSON.parse(c.body)]),[
 ['/v1/projects/verygood-au-account-test/service',{service:'account',status:false}],
 ['/v1/functions/ca-test-reservation-api',{name:'CA TEST Reservation API B6',runtime:'node-22',events:[],schedule:'',timeout:20,logging:true,entrypoint:'src/main.js',commands:'npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22',installationId:'',providerRepositoryId:'',providerBranch:'',providerSilentMode:false,providerRootDirectory:'',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write'],specification:'s-1vcpu-1gb',enabled:false,execute:[]}]
 ])
 assert.ok(s.calls.every(c=>c.redirect==='error'))
})
test('caller mutation cannot redirect an already authorized Owner request',async()=>{
 const target=structuredClone(manifest.target),s=setup({target}),r=api.createB7Runner(s.args)
 target.endpoint='https://wrong-target.invalid/v1';target.projectId='verygood-au'
 await r.accountOff()
 assert.equal(s.calls[0].url,'https://api.verygood-chocolate.com/v1/projects/verygood-au-account-test/service')
})
test('guard deployment is one-shot, uses multipart Node22 native build, and refuses wrong source before writes',async()=>{
 const {createHash}=await import('node:crypto'),archive=Buffer.from('synthetic-test-archive'),archiveSha256=createHash('sha256').update(archive).digest('hex')
 const s=setup();s.args.transport=async(url,o)=>{s.calls.push({url,...o});if(o.method==='POST')return Response.json({$id:'guarded-deployment'});return Response.json(url.includes('/projects/')?project:{...fn,name:'CA TEST Reservation API B6',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']})}
 const r=api.createB7Runner(s.args)
 await assert.rejects(r.deployGuarded({archive,archiveSha256:'bad',fixtureSha256:'a'.repeat(64)}));assert.equal(s.calls.length,0)
 await assert.rejects(r.deployGuarded({archive,archiveSha256,fixtureSha256:'a'.repeat(64)}));assert.equal(s.calls.length,0)
 const {packageB7Function}=await import('../scripts/customer-account-b7-v3-runtime.mjs'),{b7Inputs}=await import('./fixtures/customer-account/b7.mjs'),{freezeB7Fixtures}=await import('../scripts/customer-account-b7-contract.mjs'),{mkdtemp}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
 const packed=await packageB7Function({directory:await mkdtemp(join(tmpdir(),'b7-deploy-test-')),fixtureManifestBytes:freezeB7Fixtures(b7Inputs())})
 await r.deployGuarded({archive:packed.archive,archiveSha256:packed.archiveSha256,fixtureSha256:packed.fixtureSha256})
 const post=s.calls.find(c=>c.method==='POST');assert.ok(post.url.endsWith('/ca-test-reservation-api/deployments'));assert.equal(post.body.get('activate'),'false');assert.equal(post.body.get('entrypoint'),'src/b7-entry.mjs');assert.match(post.body.get('commands'),/--linux-node22/)
 const count=s.calls.length;await assert.rejects(r.deployGuarded({archive,archiveSha256,fixtureSha256:'a'.repeat(64)}));assert.equal(s.calls.length,count)
})
test('expiry during read-only preflight prevents every activation write',async()=>{
 const now=1792281600000,window={startsAt:now,endsAt:now+900000};let time=now,writes=0
 const s=setup({clock:()=>time,state:{attempts:{},deploymentId:'guarded-deployment',window},activationLease:async()=>true})
 s.args.transport=async(url,o)=>{
  if(o.method!=='GET'){writes++;throw Error('must not write')}
  if(url.includes('/users?')){time=window.endsAt;return Response.json({total:3,users:manifest.requiredBeforeOpen.exactUsers.map($id=>({$id}))})}
  return Response.json(url.includes('/projects/')?{...project,authLimit:3}:{...fn,name:'CA TEST Reservation API B6',deploymentId:'guarded-deployment',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']})
 }
 const r=api.createB7Runner(s.args),proof=Object.fromEntries(['allLocalTestsGreen','guardNegativeTestsGreen','browserMockGreen','secretScanGreen','manualRecoveryVerified','watchdogArmedAndTested','schemaAclUnchanged','platformHeaderVerified','runtimeFlagsVerified'].map(k=>[k,true]))
 await assert.rejects(r.open({...proof,window,deploymentId:'guarded-deployment'}));assert.equal(writes,0)
})
test('deadline reached after Function enable prevents Account ON and performs emergency OFF',async()=>{
 const now=1792281600000,window={startsAt:now,endsAt:now+900000};let time=now,accountOn=0
 const s=setup({clock:()=>time,state:{attempts:{},deploymentId:'guarded-deployment',window},activationLease:async()=>true})
 s.args.transport=async(url,o)=>{
  if(o.method==='GET'&&url.includes('/users?'))return Response.json({total:3,users:manifest.requiredBeforeOpen.exactUsers.map($id=>({$id}))})
  if(o.method==='PUT'){const body=JSON.parse(o.body);if(body.enabled===true)time=window.endsAt}
  if(o.method==='PATCH'&&JSON.parse(o.body).status===true)accountOn++
  return Response.json(url.includes('/projects/')?{...project,authLimit:3}:{...fn,name:'CA TEST Reservation API B6',deploymentId:'guarded-deployment',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']})
 }
 const r=api.createB7Runner(s.args),proof=Object.fromEntries(['allLocalTestsGreen','guardNegativeTestsGreen','browserMockGreen','secretScanGreen','manualRecoveryVerified','watchdogArmedAndTested','schemaAclUnchanged','platformHeaderVerified','runtimeFlagsVerified'].map(k=>[k,true]))
 await assert.rejects(r.open({...proof,window,deploymentId:'guarded-deployment'}));assert.equal(accountOn,0)
})
test('unprepared V3 variables stop arming before any write',async()=>{
 const now=1792281600000,s=setup({clock:()=>now,state:{attempts:{},fixtureSha256:'a'.repeat(64)}});let writes=0
 s.args.transport=async(url,o)=>{
  if(o.method!=='GET'){writes++;throw Error('not approved')}
  if(url.endsWith('/variables'))return Response.json({total:1,variables:[{$id:'customer-flag',key:'CUSTOMER_ACCOUNT_ENABLED',value:'false',secret:false}]})
  return Response.json(url.includes('/projects/')?project:{...fn,name:'CA TEST Reservation API B6',scopes:['databases.read','databases.write','collections.read','attributes.read','indexes.read','documents.read','documents.write']})
 }
 await assert.rejects(api.createB7Runner(s.args).configureGuard({window:{startsAt:now,endsAt:now+900000},secret:Buffer.alloc(32,3).toString('base64url'),fixtureSha256:'a'.repeat(64)}));assert.equal(writes,0)
})
