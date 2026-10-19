// B7 Owner API boundary. No env/session discovery, global API keys or arbitrary routes.
import {verifyB7Archive} from './customer-account-b7-runtime.mjs'
import {FUNCTION_SCOPES} from './reservation-api-deploy-config.mjs'
import {B6_BUILD_COMMAND} from './customer-account-test-function.mjs'
import {sha256} from './customer-account-b7-contract.mjs'
import {assertB7Run} from './customer-account-b7-contract.mjs'
const fail=()=>{throw Error('B7_RUNNER_REJECTED')}
export function createB7Runner({manifestBytes,approvalProof,target:inputTarget,cliSession,transport=fetch,clock=Date.now,persist,state,activationLease=async()=>false}) {
 const checked=assertB7Run({manifestBytes,approvalProof,target:inputTarget,phase:'prepare',now:clock()}),manifest=checked.manifest,target=checked.target
 if(cliSession?.endpoint!==target.endpoint||typeof cliSession.cookie!=='string'||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned||typeof persist!=='function'||!state?.attempts)fail()
 const project='/projects/'+target.projectId,fn='/functions/'+target.functionId
 const functionName='CA TEST Reservation API B6'
 let busy=false
 async function call(method,path,data){
  const form=data instanceof FormData
  const r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':path.startsWith(project)?'console':target.projectId,...(path.startsWith(project)?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie,...(form?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:form?data:JSON.stringify(data)})})
  if(!r.ok||r.redirected||r.url&&r.url!==target.endpoint+path)fail()
  if(r.status===204)return null
  return r.json()
 }
 async function serial(operation){if(busy)fail();busy=true;try{return await operation()}finally{busy=false}}
 async function inspect(){
  const p=await call('GET',project),f=await call('GET',fn)
  if(p.$id!==target.projectId||p.teamId!=='69bf44eb000f319a38a2'||f.$id!==target.functionId||f.name!==functionName||JSON.stringify([...(f.scopes||[])].sort())!==JSON.stringify([...FUNCTION_SCOPES].sort())||f.runtime!=='node-22'||f.specification!=='s-1vcpu-1gb'||f.events?.length!==0||f.schedule!=='')fail()
  if(['authEmailOtp','authEmailPassword','authUsersAuthMagicURL','authPhone','authAnonymous','authInvites','authJWT'].some(k=>p[k]!==false)||p.oAuthProviders?.some(x=>x.key!=='google'&&x.enabled===true)||p.smtpEnabled!==true||p.oAuthProviders?.find(x=>x.key==='google')?.enabled!==true)fail()
  return {project:p,function:f}
 }
 async function assertClosed(){const s=await inspect();if(s.project.serviceStatusForAccount!==false||s.function.enabled!==false||s.function.execute?.length!==0)fail();return s}
 async function accountOff(){return call('PATCH',project+'/service',{service:'account',status:false})}
 async function functionOff(){return call('PUT',fn,{name:functionName,enabled:false,execute:[]})}
 async function variables(){const result=await call('GET',fn+'/variables');if(!Array.isArray(result.variables)||result.total!==result.variables.length)fail();return result.variables}
 async function setExisting(key,value,secret){
  const rows=await variables(),v=rows.find(x=>x.key===key)
  if(!v||v.secret!==secret||!/^[-\w.]{1,36}$/.test(v.$id))fail()
  return call('PUT',fn+'/variables/'+v.$id,{key,value,secret})
 }
 async function flagsOff(){let failed=false;for(const key of Object.keys(manifest.restoreState.serverFlags)){try{await setExisting(key,'false',false)}catch{failed=true}}if(failed)fail()}
 async function invalidateSigningKey(){const v=(await variables()).find(x=>x.key==='B7_TEST_HMAC_SECRET');if(v)await setExisting(v.key,'B7_REVOKED',true)}
 async function restoreB6(){await functionOff();await call('PATCH',fn+'/deployments/'+target.baseDeploymentId);const f=await call('GET',fn);if(f.deploymentId!==target.baseDeploymentId||f.enabled!==false||f.execute.length)fail()}
 async function restoreAuthLimit(){await call('PATCH',project+'/auth/limit',{limit:2})}
 async function cleanupRunSessions(){
  if(!state.sessionBaseline||!state.createdSessionIds)fail()
  for(const uid of [manifest.actors.G.uid,manifest.actors.H.uid]){
   const before=state.sessionBaseline[uid],created=state.createdSessionIds[uid]
   if(!Array.isArray(before)||!Array.isArray(created)||created.some(id=>before.includes(id)||!/^[-\w.]{1,36}$/.test(id)))fail()
   const listing=await call('GET','/users/'+uid+'/sessions')
   // Any unaccounted session is an incident, never permission to delete it.
   if(listing.sessions.some(x=>!before.includes(x.$id)&&!created.includes(x.$id)))fail()
   for(const id of created)if(listing.sessions.some(x=>x.$id===id))await call('DELETE','/users/'+uid+'/sessions/'+id)
  }
 }
 async function verifyClosed(){
  const s=await assertClosed(),rows=await variables()
  if(s.function.deploymentId!==target.baseDeploymentId||s.project.authLimit!==2)return false
  if(Object.keys(manifest.restoreState.serverFlags).some(key=>rows.find(x=>x.key===key)?.value!=='false'))return false
  const r=await transport(target.endpoint+'/account',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId}})
  return r.status===403
 }

 return {
  inspect:()=>serial(inspect),accountOff,functionOff,flagsOff,invalidateSigningKey,restoreB6,restoreAuthLimit,cleanupRunSessions,verifyClosed,
  async deployGuarded({archive,archiveSha256,fixtureSha256}){
   if(!Buffer.isBuffer(archive)||archive.length===0||archive.length>2*1024*1024||sha256(archive)!==archiveSha256||!/^[a-f\d]{64}$/.test(fixtureSha256)||state.attempts.deployment)fail()
   return serial(async()=>{
    await verifyB7Archive(archive,fixtureSha256)
    const before=await assertClosed();if(before.function.deploymentId!==target.baseDeploymentId)fail()
    state.attempts.deployment=true;state.archiveSha256=archiveSha256;state.fixtureSha256=fixtureSha256;await persist(structuredClone(state))
    const data=new FormData();data.set('code',new Blob([archive],{type:'application/gzip'}),'code.tar.gz');data.set('activate','false');data.set('entrypoint','src/b7-entry.mjs');data.set('commands',B6_BUILD_COMMAND)
    const d=await call('POST',fn+'/deployments',data)
    if(!/^[-\w.]{1,36}$/.test(d.$id))fail()
    state.deploymentId=d.$id;await persist(structuredClone(state));return {deploymentId:d.$id}
   })
  },
  async activateGuarded(){return serial(async()=>{
   if(!state.deploymentId||!state.attempts.deployment)fail()
   await assertClosed();const d=await call('GET',fn+'/deployments/'+state.deploymentId);if(d.status!=='ready')fail()
   await call('PATCH',fn+'/deployments/'+state.deploymentId);const after=await assertClosed();if(after.function.deploymentId!==state.deploymentId)fail()
   return {ready:true,deploymentId:state.deploymentId}
  })},
  async configureGuard({window,secret,fixtureSha256}){return serial(async()=>{
   assertB7Run({manifestBytes,approvalProof,target,phase:'armed',now:clock(),window})
   if(state.window||state.attempts.variables||!/^[A-Za-z0-9_-]{43}$/.test(secret||'')||fixtureSha256!==state.fixtureSha256)fail()
   await assertClosed()
   const rows=await variables()
   if(rows.some(x=>manifest.newGuardVariableNames.includes(x.key)))fail()
   for(const key of Object.keys(manifest.proposedTemporaryState.serverFlags))if(!rows.some(x=>x.key===key&&x.secret===false))fail()
   state.attempts.variables=true;state.window={...window};await persist(structuredClone(state))
   const values={B7_TEST_RUN_ID:manifest.runId,B7_TEST_STARTS_AT:String(window.startsAt),B7_TEST_ENDS_AT:String(window.endsAt),B7_TEST_HMAC_SECRET:secret,B7_TEST_FIXTURE_MANIFEST_SHA256:fixtureSha256}
   for(const key of manifest.newGuardVariableNames)await call('POST',fn+'/variables',{key,value:values[key],secret:key==='B7_TEST_HMAC_SECRET'})
   for(const [key,value] of Object.entries(manifest.proposedTemporaryState.serverFlags))await setExisting(key,value,false)
   return {configured:true,endsAt:window.endsAt}
  })},
  async open(proof){
   // Adapter safety state is explicit; no absent proof may reach the network.
   for(const key of ['allLocalTestsGreen','guardNegativeTestsGreen','browserMockGreen','secretScanGreen','manualRecoveryVerified','watchdogArmedAndTested','schemaAclUnchanged','platformHeaderVerified','runtimeFlagsVerified'])if(proof?.[key]!==true)fail()
   assertB7Run({manifestBytes,approvalProof,target,phase:'open',now:clock(),window:proof.window})
   if(state.attempts.open||!state.deploymentId||proof.deploymentId!==state.deploymentId)fail()
   return serial(async()=>{
    const s=await assertClosed()
    const users=await call('GET','/users?queries%5B%5D='+encodeURIComponent(JSON.stringify({method:'limit',values:[4]})))
    const expected=[...manifest.requiredBeforeOpen.exactUsers].sort(),actual=users.users?.map(u=>u.$id).sort()
    if(users.total!==3||JSON.stringify(actual)!==JSON.stringify(expected)||s.project.authLimit!==3||s.function.deploymentId!==state.deploymentId)fail()
    assertB7Run({manifestBytes,approvalProof,target,phase:'open',now:clock(),window:proof.window})
    if(!state.window||JSON.stringify(state.window)!==JSON.stringify(proof.window))fail()
    state.attempts.open=true;state.window={...proof.window};await persist(structuredClone(state))
    try{
     if(await activationLease()!==true)fail()
     assertB7Run({manifestBytes,approvalProof,target,phase:'open',now:clock(),window:proof.window})
     await call('PUT',fn,{name:functionName,enabled:true,execute:['any']})
     if(await activationLease()!==true)fail()
     assertB7Run({manifestBytes,approvalProof,target,phase:'open',now:clock(),window:proof.window})
     await call('PATCH',project+'/service',{service:'account',status:true})
     const after=await inspect();if(after.project.serviceStatusForAccount!==true||after.function.enabled!==true||JSON.stringify(after.function.execute)!=='["any"]')fail()
     if(await activationLease()!==true)fail()
     assertB7Run({manifestBytes,approvalProof,target,phase:'open',now:clock(),window:proof.window})
     state.phase='open';await persist(structuredClone(state))
     return {opened:true,endsAt:state.window.endsAt}
    }catch{await Promise.allSettled([accountOff(),functionOff()]);throw Error('B7_OPEN_FAILED_VERIFY_RECOVERY_REQUIRED')}
   })
  },
 }
}
