// Read-only diagnostic archive entry. Never shipped by production deploy scripts.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
const manifest='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'
const hash=x=>createHash('sha256').update(x).digest('hex')
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
export function createReadinessProbe({handler,env,fixtureSha256,sourceSha256,clock=Date.now}){
 if(typeof handler!=='function'||![fixtureSha256,sourceSha256].every(x=>/^[a-f\d]{64}$/.test(x)))throw Error('READINESS_PROBE_CONFIGURATION')
 let used=false
 return async context=>{
  const emit=x=>{try{context.log?.(JSON.stringify({tag:'CUSTOMER_READINESS_FIVE',...x}))}catch{/* no raw errors */}}
  let phase='CONFIG'
  const reject=()=>{emit({phase,accepted:false});return context.res.json({ok:false,code:'READINESS_PROBE_REJECTED'},403,{'Cache-Control':'no-store'})}
  try{
   if(env.APPWRITE_FUNCTION_PROJECT_ID!=='verygood-au-account-test'||env.APPWRITE_FUNCTION_ID!=='ca-test-reservation-api'||env.APPWRITE_CAKE_DATABASE_ID!=='ca_test_cake_au'||env.APPWRITE_KIDS_DATABASE_ID!=='ca_test_kids_au'||env.APPWRITE_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||env.CUSTOMER_ACCOUNT_ENABLED!=='true'||env.AU_RENEWAL_WRITES_ENABLED!=='false'||env.AU_RENEWAL_PREORDERS_ENABLED!=='false'||env.B7_TEST_RUN_ID!=='readiness-five-20261018'||env.B7_TEST_FIXTURE_MANIFEST_SHA256!==fixtureSha256)return reject()
   phase='TIME';const at=clock(),start=Number(env.B7_TEST_STARTS_AT),end=Number(env.B7_TEST_ENDS_AT)
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>300000||!Number.isFinite(at)||at<start||at>=end)return reject()
   phase='SECRET_SHAPE';const secret=env.B7_TEST_HMAC_SECRET
   if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(secret)||Buffer.from(secret,'base64url').length!==32)return reject()
   phase='BODY';const {req}=context,text=req.bodyText
   if(typeof text!=='string'||text!==JSON.stringify({action:'customer-account-health'})||!isDeepStrictEqual(JSON.parse(text),req.bodyJson))return reject()
   phase='HEADERS';const h=req.headers||{},timestamp=h['x-b7-timestamp'],nonce=h['x-b7-nonce'],signature=h['x-b7-signature']
   if(!/^\d{13}$/.test(timestamp||'')||at-Number(timestamp)>30000||Number(timestamp)-at>5000||!uuid.test(nonce||'')||!/^[A-Za-z0-9_-]{43}$/.test(signature||'')||typeof h['x-appwrite-user-id']!=='string'||!h['x-appwrite-user-id']||typeof h['x-appwrite-user-jwt']!=='string'||!h['x-appwrite-user-jwt'])return reject()
   phase='SIGNATURE'
   const expected=createHmac('sha256',Buffer.from(secret,'base64url')).update(['B7v3:'+manifest,env.APPWRITE_FUNCTION_PROJECT_ID,env.APPWRITE_FUNCTION_ID,env.B7_TEST_RUN_ID,timestamp,nonce,hash(text)].join('\n')).digest(),actual=Buffer.from(signature,'base64url')
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reject()
   phase='PATH';if(req.path!==`/b7/${timestamp}/${nonce}/${hash(text)}/${signature}`)return reject()
   phase='LIMIT';if(used)return reject();used=true
   emit({phase:'PASS',accepted:true,sourceSha256,manifestSha256:manifest,node:process.version,windowSeconds:(end-start)/1000,customerEnabled:true,renewalWritesDisabled:true,preordersDisabled:true,platformUidPresent:true,platformJwtPresent:true})
   phase='HANDLER';const began=clock()
   try{return await handler(context)}finally{emit({phase:'HANDLER_FINISHED',handlerElapsedMs:Math.max(0,clock()-began)})}
  }catch{return reject()}
 }
}
