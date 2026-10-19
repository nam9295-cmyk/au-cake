// Fixed schema only. Never serialize an Error, API response, URL, ID, body or credential.
const stages=new Set(['unknown','probe','worker','lease','journal','account-state','session-attribution','manager.inspect','project.get','project.account-off','project.account-on','platforms.get','users.get','function.get','function.variables.get','function.executions.get','sessions.M.get','sessions.G.get','sessions.H.get','session.delete','resource','resource.metrics','resource.api-version','accountOff','cleanup','siteClosed','verifyClosed'])
const codes=new Set(['OK','UNVERIFIED','MANUAL_STOP','STOP_MARKER','STOP_MARKER_READ_FAILED','SIGNAL_STOP','DEADLINE','CLOCK_INVALID','WINDOW_NOT_STARTED','PROBE_TIMEOUT','PROBE_EXCEPTION','PROBE_UNSAFE','WORKER_EXCEPTION','DIAGNOSTICS_FAILED','STEP_FAILED','API_NETWORK_EXCEPTION','API_TIMEOUT','API_HTTP_ERROR','OWNER_AUTH_DENIED','API_RESPONSE_INVALID','REQUEST_REJECTED','AUTH_POLICY_DRIFT','PLATFORM_DRIFT','AUTH_USERS_DRIFT','FUNCTION_DRIFT','FUNCTION_FLAGS_DRIFT','FUNCTION_VARIABLE_DRIFT','FUNCTION_EXECUTION_DRIFT','PROJECT_SETTINGS_DRIFT','SESSION_METADATA_INVALID','JOURNAL_INVALID','ACCOUNT_STATE_MISMATCH','SESSION_USER_NOT_ALLOWED','SESSION_USER_MISMATCH','SESSION_PROVIDER_MISMATCH','SESSION_TIMESTAMP_INVALID','SESSION_OUTSIDE_WINDOW','SESSION_LOGIN_INTENT_MISSING','METRICS_READ_FAILED','API_VERSION_UNHEALTHY','RESOURCE_MEMORY','RESOURCE_DISK','RESOURCE_OOM','RESOURCE_LOAD','LEASE_FRESH','LEASE_CONFIG_INVALID','LEASE_WINDOW_INVALID','LEASE_STOPPED','LEASE_HEARTBEAT_INVALID','LEASE_HEARTBEAT_STALE','LEASE_PROBE_STALE','LEASE_CLOCK_INVALID','LEASE_WORKER_DEAD'])
const numbers=['durationMs','status','limitMs','heartbeatAgeMs','probeAgeMs']
export function safeGoogleOnlyReason(input){
 const result={code:codes.has(input?.code)?input.code:'UNVERIFIED',stage:stages.has(input?.stage)?input.stage:'unknown'}
 for(const key of numbers)if(Number.isFinite(input?.[key]))result[key]=input[key]
 return result
}
export function googleOnlyDiagnosticError(code,stage,extra={}){
 const diagnostic=safeGoogleOnlyReason({...extra,code,stage}),error=Error(diagnostic.code)
 error.diagnostic=diagnostic;return error
}
export function googleOnlyErrorReason(error,fallback){return safeGoogleOnlyReason(error?.diagnostic||fallback)}
export function googleOnlyNetworkError(error,stage){return googleOnlyDiagnosticError(['TimeoutError','AbortError'].includes(error?.name)?'API_TIMEOUT':'API_NETWORK_EXCEPTION',stage)}
export function googleOnlyResponseError(error,stage){return ['TimeoutError','AbortError','TypeError'].includes(error?.name)?googleOnlyNetworkError(error,stage):googleOnlyDiagnosticError('API_RESPONSE_INVALID',stage)}
export function createGoogleOnlyDiagnostics({clock=Date.now,onDiagnostic=()=>{}}={}){
 let healthy=true
 function record(input){
  const event={...safeGoogleOnlyReason(input),phase:['start','pass','fail','stop'].includes(input?.phase)?input.phase:'fail'}
  const at=clock();if(Number.isFinite(at))event.at=at
  try{onDiagnostic(Object.freeze(event))}catch{healthy=false}
  return healthy
 }
 async function measure(stage,work,fallback='STEP_FAILED',{mustRun=false}={}){
  const start=clock();record({stage,code:'OK',phase:'start'})
  try{
   if(!healthy&&!mustRun)throw googleOnlyDiagnosticError('DIAGNOSTICS_FAILED',stage)
   const value=await work();record({stage,code:'OK',phase:'pass',durationMs:Math.max(0,clock()-start)})
   if(!healthy)throw googleOnlyDiagnosticError('DIAGNOSTICS_FAILED',stage)
   return value
  }catch(error){
   const reason=googleOnlyErrorReason(error,{code:fallback,stage})
   record({...reason,phase:'fail',durationMs:Math.max(0,clock()-start)})
   throw googleOnlyDiagnosticError(reason.code,reason.stage,reason)
  }
 }
 return {record,measure,healthy:()=>healthy}
}
