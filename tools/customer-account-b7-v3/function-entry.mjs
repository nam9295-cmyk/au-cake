// Test archive only. Production reservation handler is injected without changing its policy.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
const digest=s=>createHash('sha256').update(s).digest('hex')
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const customers=['6ad38e4e0ffd5f810e23','ca-test-customer-h-20261018']
export function createB7GuardedHandler({handler,env,fixtureManifestBytes,clock=Date.now,verifyIdentity,approvedManifestBytes}) {
 if(!Buffer.isBuffer(approvedManifestBytes)||digest(approvedManifestBytes)!=='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90')throw Error('B7_V3_MANIFEST_REJECTED')
 if(typeof handler!=='function'||typeof verifyIdentity!=='function'||!Buffer.isBuffer(fixtureManifestBytes))throw Error('B7_CONFIGURATION_REJECTED')
 const frozen=JSON.parse(fixtureManifestBytes),fixtureDigest=digest(fixtureManifestBytes)
 const ids=new Set(frozen.requestIds),bodies=new Set(frozen.createBodies)
 if(!ids.size||ids.size>6||ids.size!==frozen.requestIds.length||[...ids].some(id=>!uuid.test(id))||!bodies.size)throw Error('B7_FIXTURES_REJECTED')
 let busy=false,count=0
 const seen=new Set()
 return async context=>{
  const emit=row=>{try{context.log?.(JSON.stringify(row))}catch{/* never echo logging exceptions */}}
  const diagnostic=(phase,accepted)=>emit({tag:'B7_D1_DIAGNOSTIC',revision:'b7-d1-20261018.1',phase,accepted})
  const reject=phase=>{diagnostic(phase,false);return context.res.json({ok:false,code:'B7_GUARD_REJECTED'},403,{'Cache-Control':'no-store'})}
  if(busy||count>=120)return reject(busy?'CONCURRENCY':'LIMIT')
  busy=true
  let phase='CONFIG'
  try {
   const at=clock(),start=Number(env.B7_TEST_STARTS_AT),end=Number(env.B7_TEST_ENDS_AT)
   if(env.APPWRITE_FUNCTION_PROJECT_ID!=='verygood-au-account-test'||env.APPWRITE_FUNCTION_ID!=='ca-test-reservation-api'||env.APPWRITE_CAKE_DATABASE_ID!=='ca_test_cake_au'||env.APPWRITE_KIDS_DATABASE_ID!=='ca_test_kids_au'||env.APPWRITE_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||env.CUSTOMER_ACCOUNT_ENABLED!=='true'||env.AU_RENEWAL_WRITES_ENABLED!=='true'||env.AU_RENEWAL_PREORDERS_ENABLED!=='false'||env.B7_TEST_RUN_ID!=='20261018-b7-google-01'||env.B7_TEST_FIXTURE_MANIFEST_SHA256!==fixtureDigest)return reject(phase)
   phase='TIME'
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>900000||!Number.isFinite(at)||at<start||at>=end)return reject(phase)
   phase='SECRET_SHAPE'
   const secret=env.B7_TEST_HMAC_SECRET
   if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(secret)||Buffer.from(secret,'base64url').length!==32)return reject(phase)
   phase='BODY'
   const {req}=context,text=req.bodyText,headers=req.headers||{}
   if(typeof text!=='string'||Buffer.byteLength(text)>20000)return reject(phase)
   const body=JSON.parse(text)
   if(!body||Array.isArray(body)||!isDeepStrictEqual(body,req.bodyJson))return reject(phase)
   phase='HEADERS'
   const timestamp=headers['x-b7-timestamp'],nonce=headers['x-b7-nonce'],signature=headers['x-b7-signature']
   if(typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||at-Number(timestamp)>30000||Number(timestamp)-at>5000||!uuid.test(nonce||'')||seen.has(nonce)||typeof signature!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(signature))return reject(phase)
   phase='SIGNATURE'
   const expected=createHmac('sha256',Buffer.from(secret,'base64url')).update(['B7v3:1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',env.APPWRITE_FUNCTION_PROJECT_ID,env.APPWRITE_FUNCTION_ID,env.B7_TEST_RUN_ID,timestamp,nonce,digest(text)].join('\n')).digest()
   const actual=Buffer.from(signature,'base64url')
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reject(phase)
   phase='PATH'
   if(req.path!==`/b7/${timestamp}/${nonce}/${digest(text)}/${signature}`)return reject(phase)
   seen.add(nonce);count++
   const uid=headers['x-appwrite-user-id'],jwt=headers['x-appwrite-user-jwt']
   const health=['health','renewal-health','customer-account-health'].includes(body.action)
   phase='IDENTITY'
   if(!health&&(uid||jwt)){
    // Official Owner preflight may call health only; no customer/business privilege.
    if(!customers.includes(uid))return reject(phase)
    const user=await verifyIdentity({id:uid,jwt})
    if(user?.$id!==uid||user.status!==true)return reject(phase)
   }
   phase='ACTION'
   if(health){if(Object.keys(body).some(k=>!['action','data'].includes(k))||body.data&&Object.keys(body.data).length)return reject(phase)}
   else if(body.action==='create-cake'){if(!ids.has(body.data?.requestId)||!bodies.has(text))return reject(phase)}
   else if(body.action==='customer-order'){if(!ids.has(body.data?.id))return reject(phase)}
   else if(body.action==='customer-orders'){if(body.data?.cursor!==undefined&&!ids.has(body.data.cursor))return reject(phase)}
   else if(body.action==='lookup-cake'){
    if(!/^VG-C-AU-[A-Z0-9-]{1,40}$/.test(body.data?.reservationNumber||'')||!['0400000001','0400000002','0400000011','0400000012','0400000099'].includes(body.data?.phone))return reject(phase)
   } else return reject(phase)
   if(health&&body.action==='health')emit({tag:'B7_V3_PLATFORM_CONTRACT',manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',signatureAndPathVerified:true,platformUidPresent:typeof uid==='string'&&uid.length>0,platformJwtPresent:typeof jwt==='string'&&jwt.length>0,customerEnabled:env.CUSTOMER_ACCOUNT_ENABLED==='true',renewalWritesEnabled:env.AU_RENEWAL_WRITES_ENABLED==='true',preordersDisabled:env.AU_RENEWAL_PREORDERS_ENABLED==='false'})
   if(health)diagnostic('PASS',true)
   // Do not select fixtures by caller owner. Core must reject cross-customer reads/replays.
   phase='INTERNAL'
   return await handler(context)
  } catch {return reject(phase)} finally {busy=false}
 }
}
