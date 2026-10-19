import {createHmac,timingSafeEqual} from 'node:crypto'
// Appwrite 1.8.1 stores requestPath but filters custom requestHeaders. Path contains
// only an expiring MAC, nonce, timestamp and body digest; never JWT or signing key.
export function createB7ExecutionMonitor({secret,startsAt,endsAt,baselineIds=[]}) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret||'')||!Number.isSafeInteger(startsAt)||!Number.isSafeInteger(endsAt)||endsAt<=startsAt||endsAt-startsAt>900000)throw Error('B7_MONITOR_REJECTED')
 const baseline=new Set(baselineIds),ids=new Map(),nonces=new Map();let failed=false
 return {observe(executions){
  if(!Array.isArray(executions)||executions.length>120)failed=true
  for(const x of Array.isArray(executions)?executions:[]) {
   if(baseline.has(x.$id))continue
   if(typeof x.$id!=='string'){failed=true;continue}
   const match=/^\/b7\/(\d{13})\/([a-f\d-]{36})\/([a-f\d]{64})\/([A-Za-z0-9_-]{43})$/.exec(x.requestPath||'')
   if(!match||x.requestMethod!=='POST'){failed=true;continue}
   const [,timestamp,nonce,bodyHash,signature]=match
   const expected=createHmac('sha256',Buffer.from(secret,'base64url')).update(['B7v1','verygood-au-account-test','ca-test-reservation-api','20261018-b7-google-01',timestamp,nonce,bodyHash].join('\n')).digest()
   const created=Date.parse(x.$createdAt),signedAt=Number(timestamp),actual=Buffer.from(signature,'base64url')
   if(!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(nonce)||!Number.isFinite(created)||signedAt<startsAt||signedAt>=endsAt||created<signedAt-5000||created-signedAt>30000||actual.length!==expected.length||!timingSafeEqual(actual,expected))failed=true
   if(nonces.has(nonce)&&nonces.get(nonce)!==x.$id)failed=true
   if(ids.has(x.$id)&&ids.get(x.$id)!==x.requestPath)failed=true
   nonces.set(nonce,x.$id);ids.set(x.$id,x.requestPath)
   if(x.status==='failed'||x.responseBody&&String(x.responseBody).includes('B7_GUARD_REJECTED'))failed=true
  }
  if(ids.size>120)failed=true
  return {unexpectedExecutions:failed?1:0,executions:ids.size,budgetReached:ids.size>=120}
 }}
}
