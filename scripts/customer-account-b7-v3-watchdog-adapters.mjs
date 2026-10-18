import {readFile,lstat} from 'node:fs/promises'
import {semanticSettingsEvidence} from './customer-account-settings-fingerprint.mjs'
import {createB7Runner} from './customer-account-b7-v3-runner.mjs'
import {createCustomerAccountTestProbe} from './customer-account-test-monitor.mjs'
import {createB7ExecutionMonitor} from './customer-account-b7-v3-execution-monitor.mjs'
import {createB7ClosedSiteAdapter} from './customer-account-b7-pages.mjs'
import {assertB7D1Approval,d1VariablesDigest} from './customer-account-b7-d1.mjs'
import {sha256} from './customer-account-b7-v3-execution-contract.mjs'
const endpoint='https://api.verygood-chocolate.com/v1',projectId='verygood-au-account-test',functionId='ca-test-reservation-api'
async function privateJson(path){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.uid!==process.getuid())throw Error('B7_PRIVATE_FILE_REQUIRED');return JSON.parse(await readFile(path,'utf8'))}
export async function createB7LiveWatchdogAdapters(config,{transport=fetch,readMetrics,siteOff:providedSiteOff}={}){
 if(config.liveExecutionAuthorized!==true)throw Error('B7_LIVE_PROCESS_NOT_AUTHORIZED')
 const manifestBytes=await readFile(config.manifestPath),manifest=JSON.parse(manifestBytes),approvalProof=await privateJson(config.approvalProofPath),cliSession=await privateJson(config.cliSessionPath),state=await privateJson(config.statePath)
 const diagnostic=config.diagnosticMode==='d1'
 if(config.diagnosticMode!==undefined&&!diagnostic)throw Error('B7_DIAGNOSTIC_MODE_REJECTED')
 if(diagnostic){
  assertB7D1Approval({manifestBytes,approvalProof})
  if(config.closedPreflight===true||config.priorExecutionCount!==7||config.executionBaselineIds?.length!==17||state.d1?.kind!=='B7_D1'||!state.d1.variablesDigest||state.fixtureSha256!==approvalProof.diagnostic.fixtureSha256||!state.window||state.window.endsAt-state.window.startsAt>300000)throw Error('B7_D1_WATCHDOG_REJECTED')
 }
 if(state.window?.endsAt!==config.endsAt||!config.operatingProjectFingerprints||typeof config.testProtectedSettingsFingerprint!=='string'||config.baselineOom===undefined)throw Error('B7_BASELINE_REQUIRED')
 const runner=createB7Runner({manifestBytes,approvalProof,target:manifest.target,cliSession,transport,persist:async()=>{throw Error('B7_WATCHDOG_CANNOT_OPEN')},state})
 if(state.continuation&&config.priorExecutionCount!==state.continuation.priorExecutions)throw Error('B7_BASELINE_REQUIRED')
 const monitor=createB7ExecutionMonitor({secret:config.signingSecret,startsAt:state.window.startsAt,endsAt:state.window.endsAt,baselineIds:config.executionBaselineIds,previousExecutions:config.priorExecutionCount??0})
 const resources=createCustomerAccountTestProbe({target:{endpoint,projectId,resources:{databaseIds:manifest.target.databaseIds,functionIds:[functionId]}},transport,readMetrics})
 const deployClosed=diagnostic?async()=>{throw Error('B7_D1_PAGES_FORBIDDEN')}:providedSiteOff||createB7ClosedSiteAdapter({directory:config.directory,pagesAttemptSlotsUsed:config.pagesAttemptSlotsUsed,wranglerPath:config.wranglerPath,budgetApprovalProof:config.pagesBudgetApprovalProof})
 const siteOff=async()=>{
  const latest=await privateJson(config.statePath)
  if(diagnostic&&latest.attempts?.pagesOpen===true)throw Error('B7_D1_PAGES_FORBIDDEN')
  if(diagnostic||state.continuation&&latest.attempts?.pagesOpen!==true){
   const r=await transport(manifest.target.siteOrigin+'/test-window.json',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),cache:'no-store'})
   if(!r.ok||(await r.json()).enabled!==false)throw Error('B7_CLOSED_SITE_UNVERIFIED')
   return {entryEnabled:false,deploymentSkipped:true}
  }
  return deployClosed()
 }
 const get=async(path,consoleProject=false)=>{
  const r=await transport(endpoint+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'X-Appwrite-Project':consoleProject?'console':projectId,...(consoleProject?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie}})
  if(!r.ok||r.redirected)throw Error('B7_MONITOR_GET_FAILED');return r.json()
 }
 return {
  operations:{accountOff:runner.accountOff,functionOff:runner.functionOff,flagsOff:runner.flagsOff,invalidateSigningKey:runner.invalidateSigningKey,restoreB6:runner.restoreB6,restoreAuthLimit:runner.restoreAuthLimit,siteOff,cleanupRunSessions:async()=>{
   // Read the current journal to include only sessions positively attributed to this run.
   const journal=await privateJson(config.statePath);state.sessionBaseline=journal.sessionBaseline;state.createdSessionIds=journal.createdSessionIds;return runner.cleanupRunSessions()
  }},
  verifyClosed:async()=>{
   if(!await runner.verifyClosed())return false
   const r=await transport(manifest.target.siteOrigin+'/test-window.json',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),cache:'no-store'})
   if(!r.ok||(await r.json()).enabled!==false)return false
   const users=await get('/users?queries%5B%5D='+encodeURIComponent(JSON.stringify({method:'limit',values:[4]})))
   return users.total===3&&JSON.stringify(users.users.map(x=>x.$id).sort())===JSON.stringify([...manifest.requiredBeforeOpen.exactUsers].sort())
  },
  probe:async()=>{
   const result=await resources(),current=await runner.inspect()
   const users=await get('/users?queries%5B%5D='+encodeURIComponent(JSON.stringify({method:'limit',values:[4]})))
   const queries=[{method:'greaterThanEqual',attribute:'$createdAt',values:[new Date(state.window.startsAt-5000).toISOString()]},{method:'limit',values:[121]}].map(x=>'queries%5B%5D='+encodeURIComponent(JSON.stringify(x))).join('&')
   const executions=await get('/functions/'+functionId+'/executions?'+queries),executionState=monitor.observe(executions.executions)
   const journal=await privateJson(config.statePath)
   const rows=await get('/functions/'+functionId+'/variables')
   const closed=config.closedPreflight===true
   let metadataChanged=current.function.deploymentId!==(closed?manifest.target.baseDeploymentId:state.deploymentId)||current.project.authLimit!==(closed?2:3)||journal.window?.endsAt!==state.window.endsAt
   if(diagnostic){
    const phase=journal.d1?.phase,id=journal.deploymentId
    const allowed=phase==='active'?[id]:phase==='activating'?[manifest.target.baseDeploymentId,id]:['configured','deploying','building'].includes(phase)?[manifest.target.baseDeploymentId]:[]
    const freshExecutions=executions.executions.filter(x=>!config.executionBaselineIds.includes(x.$id)),bodyHashes=['health','renewal-health','customer-account-health'].map(action=>sha256(JSON.stringify({action})))
    metadataChanged=!allowed.includes(current.function.deploymentId)||current.project.authLimit!==2||current.project.serviceStatusForAccount!==false||current.function.enabled!==false||current.function.execute?.length!==0||journal.window?.endsAt!==state.window.endsAt||journal.window?.startsAt!==state.window.startsAt||journal.d1?.failed===true||journal.d1?.variablesDigest!==state.d1.variablesDigest||d1VariablesDigest(rows.variables)!==state.d1.variablesDigest||journal.attempts?.pagesOpen===true||freshExecutions.length>3||executionState.executions>10||freshExecutions.length>(journal.d1?.healthAttempts?.length??0)||freshExecutions.some(x=>x.deploymentId!==id||!bodyHashes.includes(x.requestPath?.split('/')[4]))
   }
   if(closed&&(current.project.serviceStatusForAccount!==false||current.function.enabled!==false||current.function.execute?.length!==0))metadataChanged=true
   const protectedTest=Object.fromEntries(Object.entries(current.project).filter(([key])=>!['authLimit','serviceStatusForAccount'].includes(key)))
   if(semanticSettingsEvidence(protectedTest).sha256!==config.testProtectedSettingsFingerprint)metadataChanged=true
   const mailQueue=await get('/databases/ca_test_cake_au/collections/email_deliveries/documents?queries%5B%5D='+encodeURIComponent(JSON.stringify({method:'limit',values:[1]})))
   if(mailQueue.total!==0||mailQueue.documents?.length!==0)metadataChanged=true
   if(!closed&&journal.phase==='open'&&(current.function.enabled!==true||JSON.stringify(current.function.execute)!=='["any"]'||current.project.serviceStatusForAccount!==true))metadataChanged=true
   const expected={...(closed?manifest.restoreState.serverFlags:manifest.proposedTemporaryState.serverFlags),B7_TEST_RUN_ID:manifest.runId,B7_TEST_STARTS_AT:String(state.window.startsAt),B7_TEST_ENDS_AT:String(state.window.endsAt),B7_TEST_FIXTURE_MANIFEST_SHA256:state.fixtureSha256}
   if(rows.total!==30||Object.entries(expected).some(([key,value])=>rows.variables?.find(x=>x.key===key)?.value!==value)||rows.variables?.find(x=>x.key==='B7_TEST_HMAC_SECRET')?.secret!==true||manifest.newFunctionVariableNames.some(key=>rows.variables?.find(x=>x.key===key)?.$id!==state.guardVariableIds?.[key]))metadataChanged=true
   for(const id of ['verygood-main','verygood-au','69cb27ef002b63e77c53','69db3ae20026cdc0c7fe']){
    const p=await get('/projects/'+id,true)
    if(semanticSettingsEvidence(p).sha256!==config.operatingProjectFingerprints[id])metadataChanged=true
   }
   return {...result,...executionState,metadataChanged,unexpectedUsers:users.users?.some(x=>x.status!==true)||users.total!==3||JSON.stringify(users.users?.map(x=>x.$id).sort())!==JSON.stringify([...manifest.requiredBeforeOpen.exactUsers].sort())}
  }
 }
}
