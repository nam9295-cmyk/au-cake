import {spawn} from 'node:child_process'
import {assertCustomerAccountTestTarget} from './customer-account-test-target.mjs'
import {createGoogleOnlyDiagnostics,googleOnlyDiagnosticError,googleOnlyNetworkError,googleOnlyErrorReason,googleOnlyResponseError} from './customer-account-google-only-diagnostics.mjs'
const remoteMetrics=`import json,os
mem={l.split(':')[0]:int(l.split()[1])*1024 for l in open('/proc/meminfo') if l.startswith('MemAvailable:')}
vm={l.split()[0]:int(l.split()[1]) for l in open('/proc/vmstat')}
disk=os.statvfs('/')
print(json.dumps({'memoryAvailableBytes':mem['MemAvailable'],'diskAvailableBytes':disk.f_bavail*disk.f_frsize,'load1':os.getloadavg()[0],'oomKills':vm['oom_kill']}))
`
function readServerMetrics(){
 return new Promise((resolve,reject)=>{
  const child=spawn('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','very','python3 -'],{stdio:['pipe','pipe','pipe'],timeout:12000})
  let data='';child.stdout.on('data',chunk=>{data+=chunk;if(data.length>8192)child.kill()});child.stderr.resume()
  child.on('error',()=>reject(Error('CUSTOMER_ACCOUNT_TEST_MONITOR_FAILED')))
  child.on('close',code=>{try{if(code!==0)throw Error();resolve(JSON.parse(data))}catch{reject(Error('CUSTOMER_ACCOUNT_TEST_MONITOR_FAILED'))}})
  child.stdin.on('error',()=>{});child.stdin.end(remoteMetrics)
 })
}
// Only public version + host aggregate metrics; no env, customer data or Docker mutations.
export function createCustomerAccountTestProbe({target:input,readMetrics=readServerMetrics,transport=fetch,clock=Date.now,onSample=()=>{},onDiagnostic}){
 const target=assertCustomerAccountTestTarget(input)
 const diagnostics=createGoogleOnlyDiagnostics({clock,onDiagnostic})
 let cached=null,sampledAt=-Infinity
 return async()=>{
  if(cached&&clock()-sampledAt>=0&&clock()-sampledAt<5000)return cached
  const metrics=await diagnostics.measure('resource.metrics',async()=>{try{return await readMetrics()}catch{throw googleOnlyDiagnosticError('METRICS_READ_FAILED','resource.metrics')}})
  let apiHealthy=false,reason
  try{await diagnostics.measure('resource.api-version',async()=>{
   let r;try{r=await transport(target.endpoint+'/health/version',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId}})}catch(error){throw googleOnlyNetworkError(error,'resource.api-version')}
   if(!r.ok||r.redirected)throw googleOnlyDiagnosticError('API_HTTP_ERROR','resource.api-version',{status:r.status})
   let body;try{body=await r.json()}catch(error){throw googleOnlyResponseError(error,'resource.api-version')}
   if(body.version!=='1.8.1')throw googleOnlyDiagnosticError('API_VERSION_UNHEALTHY','resource.api-version')
   apiHealthy=true
  })}catch(error){apiHealthy=false;reason=googleOnlyErrorReason(error,{code:'API_VERSION_UNHEALTHY',stage:'resource.api-version'})}
  cached={memoryAvailableBytes:metrics.memoryAvailableBytes,diskAvailableBytes:metrics.diskAvailableBytes,load1:metrics.load1,oomKills:metrics.oomKills,apiHealthy,...(reason?{reason}:{})}
  sampledAt=clock();onSample({time:new Date(sampledAt).toISOString(),...cached});return cached
 }
}
