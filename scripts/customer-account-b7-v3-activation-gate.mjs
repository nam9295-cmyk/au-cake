// Read-only activation observation. Does not open, deploy, arm, extend, or discover credentials.
import {performance} from 'node:perf_hooks'
import {B7_MANIFEST_SHA256} from './customer-account-b7-v3-execution-contract.mjs'
const origin='https://au-account-test.verygood-chocolate.com'
const pass=value=>value?'PASS':'FAIL'
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null
async function jsonBody(response){
 const reader=response.body?.getReader();if(!reader)throw Error()
 const parts=[];let size=0
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096)throw Error();parts.push(Buffer.from(value))}return JSON.parse(Buffer.concat(parts).toString('utf8'))}finally{await reader.cancel().catch(()=>{})}
}
async function siteSnapshot(transport,timeoutMs,clock){
 const checks={},details={requestStartedAt:clock()};let retryable=false
 try{
  const r=await transport(origin+'/test-window.json',{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)})
  details.status=r.status;details.redirectLocationPresent=r.headers.has('location')
  checks.noRedirect=pass(!r.redirected&&!(r.status>=300&&r.status<400)&&(!r.url||r.url===origin+'/test-window.json'))
  checks.httpStatus=pass(r.status===200)
  const cache=r.headers.get('cf-cache-status');details.cacheStatus=['HIT','MISS','EXPIRED','STALE','BYPASS','DYNAMIC','REVALIDATED','UPDATING'].includes(cache)?cache:cache===null?null:'OTHER'
  const age=r.headers.get('age');details.cacheAgeSeconds=age!==null&&/^\d{1,9}$/.test(age)?Number(age):null
  const date=Date.parse(r.headers.get('date'));details.serverDateMs=Number.isFinite(date)?date:null
  const mime=r.headers.get('content-type')?.split(';')[0].trim().toLowerCase();details.contentType=mime==='application/json'?'application/json':mime==='text/html'?'text/html':'OTHER'
  if(checks.noRedirect==='PASS'&&r.status===200){
   let body;try{body=await jsonBody(r);checks.jsonBody='PASS'}catch{checks.jsonBody='FAIL'}
   details.enabled=typeof body?.enabled==='boolean'?body.enabled:null
   details.startsAt=number(body?.startsAt);details.endsAt=number(body?.endsAt)
   retryable=body?.enabled===false
  }else retryable=checks.noRedirect==='PASS'&&[404,503].includes(r.status)
 }catch{checks.response='FAIL'}
 details.requestFinishedAt=clock();details.requestDurationMs=details.requestFinishedAt-details.requestStartedAt
 if(details.serverDateMs!==null&&details.serverDateMs!==undefined)details.serverClockOffsetMs=details.serverDateMs-(details.requestStartedAt+details.requestFinishedAt)/2
 return {checks,details,retryable}
}
export async function waitForB7ActivationGate({siteOrigin,manifestSha256,window:inputWindow,inspectLease,record,transport=fetch,clock=Date.now,monotonic=()=>performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),maxAttempts=5,retryIntervalMs=1000}={}){
 const window=inputWindow?{startsAt:inputWindow.startsAt,endsAt:inputWindow.endsAt}:null,startedAt=clock(),monoStart=monotonic()
 if(siteOrigin!==origin||manifestSha256!==B7_MANIFEST_SHA256||typeof inspectLease!=='function'||typeof record!=='function'||!Number.isSafeInteger(window?.startsAt)||!Number.isSafeInteger(window?.endsAt)||window.endsAt<=window.startsAt||window.endsAt-window.startsAt>900000||!Number.isFinite(startedAt)||startedAt<window.startsAt||startedAt>=window.endsAt||!Number.isFinite(monoStart)||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5||!Number.isInteger(retryIntervalMs)||retryIntervalMs<1000||retryIntervalMs>3000)throw Error('B7_GATE_CONFIGURATION_REJECTED')
 const limit=Math.min(window.endsAt,startedAt+30000)
 const lease=async()=>{try{return await inspectLease()}catch{return {pass:false,checks:{inspection:'FAIL'},details:{}}}}
 let previous=startedAt
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const before=clock(),leaseBefore=await lease();let site=null,leaseAfter=null
  if(leaseBefore.pass===true&&before<limit){site=await siteSnapshot(transport,Math.max(1,Math.min(3000,limit-before)),clock);leaseAfter=await lease()}
  const now=clock(),elapsed=monotonic()-monoStart,delta=now-startedAt-elapsed
  const timing={remainingMs:window.endsAt-now,elapsedMs:now-startedAt,clockDeltaMs:delta,checks:{beforeDeadline:pass(now<window.endsAt),withinReadBudget:pass(now<limit),clockContinuous:pass(Number.isFinite(now)&&Number.isFinite(elapsed)&&now>=previous&&Math.abs(delta)<=1000)}}
  previous=now
  if(site){site.checks.enabled=pass(site.details.enabled===true);site.checks.startsAtExact=pass(site.details.startsAt===window.startsAt);site.checks.endsAtExact=pass(site.details.endsAt===window.endsAt);site.checks.windowExact=pass(site.details.startsAt===window.startsAt&&site.details.endsAt===window.endsAt);site.details.serverRemainingMs=site.details.serverDateMs===null||site.details.serverDateMs===undefined?null:window.endsAt-site.details.serverDateMs}
  const leaseOk=leaseBefore.pass===true&&leaseAfter?.pass===true,timeOk=Object.values(timing.checks).every(x=>x==='PASS'),siteOk=site&&Object.values(site.checks).every(x=>x==='PASS')
  const ready=Boolean(leaseOk&&timeOk&&siteOk),retryable=Boolean(!ready&&leaseOk&&timeOk&&site?.retryable)
  const event={manifestSha256,attempt,window:{...window},observedAt:now,site,leaseBefore,leaseAfter,timing,retryable,ready}
  try{await record(event)}catch{throw Error('B7_GATE_EVIDENCE_UNAVAILABLE')}
  if(ready)return {ready:true,reason:'READY',attempts:attempt}
  const reason=!leaseOk?'LEASE_FAILED':!timeOk?'TIME_FAILED':'SITE_NOT_READY'
  if(!retryable||attempt===maxAttempts||clock()+retryIntervalMs>=limit)return {ready:false,reason,attempts:attempt}
  await sleep(retryIntervalMs)
 }
}
