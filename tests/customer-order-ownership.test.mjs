import assert from 'node:assert/strict'
import test from 'node:test'
import {createHmac} from 'node:crypto'
import * as identity from '../appwrite-functions/reservation-api/src/customer-identity.js'
import {createReservationHandler,createCake} from '../appwrite-functions/reservation-api/src/main.js'
import {AppwriteException} from './reservation-sdk.mjs'
import {accountEnv,metadataDb} from './fixtures/customer-account/metadata.mjs'

const now=new Date('2026-10-20T00:00:00Z')
const request={contractVersion:'au-renewal.2026-10.v2',customerName:'Order Contact',customerPhone:'0412345678',customerEmail:'contact@example.test',pickupDate:'2026-10-23',pickupTime:'09:00',requestNote:'Keep snapshot',promoCode:'',privacyConsent:true,requestId:'11111111-1111-4111-8111-111111111111',website:'',orderLines:[{lineId:'line-a',offerId:'pave-cake',size:'8in',quantity:1}]}
const env={...accountEnv,AU_RENEWAL_WRITES_ENABLED:'true',REVIEW_COUPON_HMAC_SECRET:Buffer.alloc(32,1).toString('base64url')}
const runtimeConfig={cakeDatabaseId:'cake-db',cakeReservationsId:'reservations',reviewCouponsId:'review_coupons',reviewCouponHmacSecret:env.REVIEW_COUPON_HMAC_SECRET}
function database({coupon=false,ambiguous=false}={}) {
  const rows=new Map();let writes=0
  let ledger=coupon?{$id:'coupon-1',codeHash:createHmac('sha256',Buffer.from(env.REVIEW_COUPON_HMAC_SECRET,'base64url')).update('FOXKIWI7Q2MK').digest('hex'),status:'active',scope:'cake',codeLast4:'Q2MK',rewardPercent:5,expiresAt:'2099-01-01T00:00:00Z'}:null
  return {...metadataDb(),rows,get writes(){return writes},
    getDocument:async({documentId,collectionId})=>{if(collectionId==='review_coupons')return ledger;const row=rows.get(documentId);if(!row)throw new AppwriteException('missing',404);return row},
    listDocuments:async({collectionId})=>({documents:collectionId==='review_coupons'&&ledger?[ledger]:[]}),
    createDocument:async({data,documentId})=>{writes++;if(rows.has(documentId))throw new AppwriteException('exists',409);const row={...data,$id:documentId};rows.set(documentId,row);return row},
    createTransaction:async()=>({$id:'tx'}),updateDocument:async({data})=>(ledger={...ledger,...data}),
    updateTransaction:async({commit})=>{if(commit&&ambiguous)throw Error('ambiguous commit');return {$id:'tx'}},
  }
}
async function call(db,{userId='customer-a',jwt='valid-token',record,body,environment=env}={}) {
  const handler=createReservationHandler({env:environment,now:()=>now,servicesForRequest:()=>({databases:db,accountForJwt:async supplied=>{
    if(supplied!=='valid-token')throw Error('expired');return {get:async()=>record||{$id:userId,status:true,email:'login@example.test'}}
  }})})
  return handler({req:{headers:{'x-appwrite-user-id':userId,'x-appwrite-user-jwt':jwt},bodyJson:body||{action:'create-cake',data:request,customerAccount:'link'}},res:{json:(value,status,headers)=>({value,status,headers})},log(){},error(){}})
}
test('JWT proof must match platform ID; missing, forged, blocked and expired identities fail',async()=>{
  assert.equal(typeof identity.resolveCustomerIdentity,'function')
  for(const input of [{headers:{}},{headers:{'x-appwrite-user-id':'a'}},{headers:{'x-appwrite-user-id':'forged','x-appwrite-user-jwt':'jwt'},record:{$id:'real',status:true}},{headers:{'x-appwrite-user-id':'a','x-appwrite-user-jwt':'jwt'},record:{$id:'a',status:false}}]) {
    await assert.rejects(identity.resolveCustomerIdentity({...input,env,accountForJwt:async()=>({get:async()=>input.record})}),/CUSTOMER_UNAUTHORIZED/)
  }
})
test('real handler creates owner atomically, preserves contact email, and rejects foreign replays',async()=>{
  const db=database();const first=await call(db)
  assert.equal(first.status,200,JSON.stringify(first))
  assert.equal(db.rows.get(request.requestId).customerUserId,'customer-a')
  assert.equal(db.rows.get(request.requestId).customerEmail,'contact@example.test')
  assert.equal(JSON.stringify(first.value).includes('customerUserId'),false)
  assert.deepEqual((await call(db)).value,first.value)
  const b=await call(db,{userId:'customer-b'})
  assert.equal(b.status,409);assert.equal(b.value.code,'REQUEST_ID_CONFLICT');assert.equal(db.writes,1)
})
test('guest paths avoid identity and readiness; later authenticated replay never adopts guest order',async()=>{
  const db=database(),safeList=db.listCollections;db.listCollections=async()=>{throw Error('guest must skip readiness')}
  const guest=await call(db,{body:{action:'create-cake',data:request}})
  assert.equal(guest.status,200,JSON.stringify(guest));assert.equal(Object.hasOwn(db.rows.get(request.requestId),'customerUserId'),false)
  db.listCollections=safeList
  const replay=await call(db)
  assert.equal(replay.status,200);assert.equal(Object.hasOwn(db.rows.get(request.requestId),'customerUserId'),false)
})
test('member failures before writes include disabled, unsafe ACL, invalid JWT/body owner and request ID',async()=>{
  for(const options of [
    {environment:{...env,CUSTOMER_ACCOUNT_ENABLED:'false'}},{userId:''},{jwt:'expired'},{record:{$id:'different',status:true}},
    {record:{$id:'customer-a',status:false}},{body:{action:'create-cake',customerAccount:'link',data:{...request,customerUserId:'forged'}}},
    {body:{action:'create-cake',customerAccount:'link',data:{...request,requestId:undefined}}},
  ]) {
    const db=database(),response=await call(db,options)
    assert.ok(response.status>=400,JSON.stringify(options));assert.equal(db.writes,0)
  }
  const unsafe=database(),safeList=unsafe.listCollections
  unsafe.listCollections=async args=>{
    const rows=await safeList(args)
    return {...rows,collections:rows.collections.map(c=>c.$id==='reservations'?{...c,$permissions:['read("users")']}:c)}
  }
  assert.equal((await call(unsafe)).value.code,'CUSTOMER_ACCOUNT_NOT_READY');assert.equal(unsafe.writes,0)
})
test('legacy general orders retain fingerprints and persist verified owner',async()=>{
  const db=database(),input={...request};delete input.contractVersion
  input.orderLines=[{productId:'pave-cake',cakeSize:'6in',quantity:1}]
  const response=await call(db,{environment:{...env,AU_RENEWAL_WRITES_ENABLED:'false'},body:{action:'create-cake',data:input,customerAccount:'link'}})
  assert.equal(response.status,200);assert.equal(db.rows.get(request.requestId).customerUserId,'customer-a')
})
test('concurrent A/B creation permits only winning owner; same request fingerprint remains independent of identity',async()=>{
  const db=database();const [a,b]=await Promise.all([call(db),call(db,{userId:'customer-b'})])
  assert.deepEqual([a.status,b.status].sort(),[200,409])
  assert.equal(db.rows.size,1)
})
test('shared legacy claim replay checks final reservation owner without changing claim wire',async()=>{
  const db=database()
  const gate={beforeNew:async()=>{},identity:()=>({wire:'cake-request-v1'}),createPlain:async(_identity,create)=>{
    await create('tx');db.rows.get(request.requestId).customerUserId='customer-b';return {reservationNumber:'cached-claim'}
  }}
  await assert.rejects(createCake(db,request,{runtimeConfig,now,renewalPolicy:{enabled:true},verifiedCustomerUserId:'customer-a',legacyGate:gate}),/REQUEST_ID_CONFLICT/)
})
test('ambiguous coupon commit returns only the verified final owner',async()=>{
  const db=database({coupon:true,ambiguous:true})
  const input={...request,promoCode:'FOXKIWI7Q2MK'}
  const first=await call(db,{body:{action:'create-cake',data:input,customerAccount:'link'}})
  assert.equal(first.status,200,JSON.stringify(first));assert.equal(db.rows.get(request.requestId).customerUserId,'customer-a')
  const race=database({coupon:true,ambiguous:true});const commit=race.updateTransaction
  race.updateTransaction=async args=>{if(args.commit)race.rows.get(request.requestId).customerUserId='customer-b';return commit(args)}
  assert.equal((await call(race,{body:{action:'create-cake',data:input,customerAccount:'link'}})).status,409)
})
