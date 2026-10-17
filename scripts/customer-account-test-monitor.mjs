import {spawn} from 'node:child_process'
import {assertCustomerAccountTestTarget} from './customer-account-test-target.mjs'
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
export function createCustomerAccountTestProbe({target:input,readMetrics=readServerMetrics,transport=fetch,clock=Date.now,onSample=()=>{}}){
 const target=assertCustomerAccountTestTarget(input)
 let cached=null,sampledAt=-Infinity
 return async()=>{
  if(cached&&clock()-sampledAt>=0&&clock()-sampledAt<5000)return cached
  const metrics=await readMetrics()
  let apiHealthy=false
  try{const r=await transport(target.endpoint+'/health/version',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId}});apiHealthy=r.ok&&!r.redirected&&(await r.json()).version==='1.8.1'}catch{/* budget rejects unavailable health */}
  cached={memoryAvailableBytes:metrics.memoryAvailableBytes,diskAvailableBytes:metrics.diskAvailableBytes,load1:metrics.load1,oomKills:metrics.oomKills,apiHealthy}
  sampledAt=clock();onSample({time:new Date(sampledAt).toISOString(),...cached});return cached
 }
}
