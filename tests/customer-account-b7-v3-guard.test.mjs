import {readFileSync} from 'node:fs'
const approvedManifestBytes=readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url))
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac,randomUUID} from 'node:crypto'
const api=await import('../tools/customer-account-b7-v3/function-entry.mjs').catch(()=>({}))
const hash=s=>createHash('sha256').update(s).digest('hex')
const G='6ad38e4e0ffd5f810e23',H='ca-test-customer-h-20261018'
const id='b7000003-0000-4000-8000-000000000003'
const body={action:'create-cake',customerAccount:'link',data:{requestId:id,customerPhone:'0400000001'}}
const fixtureBytes=Buffer.from(JSON.stringify({requestIds:[id],createBodies:[JSON.stringify(body)]}))
const now=Date.parse('2026-10-18T00:00:10Z')
function setup(inner){
 const env={APPWRITE_FUNCTION_PROJECT_ID:'verygood-au-account-test',APPWRITE_FUNCTION_ID:'ca-test-reservation-api',APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_ADMIN_USER_IDS:'ca-test-admin-m-20261017',CUSTOMER_ACCOUNT_ENABLED:'true',AU_RENEWAL_WRITES_ENABLED:'true',AU_RENEWAL_PREORDERS_ENABLED:'false',B7_TEST_RUN_ID:'20261018-b7-google-01',B7_TEST_STARTS_AT:String(now-1000),B7_TEST_ENDS_AT:String(now+899000),B7_TEST_HMAC_SECRET:Buffer.alloc(32,4).toString('base64url'),B7_TEST_FIXTURE_MANIFEST_SHA256:hash(fixtureBytes)}
 let calls=0,at=now;const logs=[]
 assert.equal(typeof api.createB7GuardedHandler,'function')
 const handler=api.createB7GuardedHandler({approvedManifestBytes,env,fixtureManifestBytes:fixtureBytes,clock:()=>at,verifyIdentity:async({id,jwt})=>{if(jwt!=='local-verified-jwt')throw Error('invalid');return {$id:id,status:true}},handler:async context=>{calls++;return inner?inner(context):{status:200}}})
 function context(payload=body,uid=G){const text=JSON.stringify(payload),timestamp=String(now),nonce=randomUUID(),mac=createHmac('sha256',Buffer.from(env.B7_TEST_HMAC_SECRET,'base64url')).update(['B7v3:1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',env.APPWRITE_FUNCTION_PROJECT_ID,env.APPWRITE_FUNCTION_ID,env.B7_TEST_RUN_ID,timestamp,nonce,hash(text)].join('\n')).digest('base64url');return {req:{path:`/b7/${timestamp}/${nonce}/${hash(text)}/${mac}`,bodyText:text,bodyJson:payload,headers:{'x-b7-timestamp':timestamp,'x-b7-nonce':nonce,'x-b7-signature':mac,'x-appwrite-user-id':uid,'x-appwrite-user-jwt':uid?'local-verified-jwt':''}},log:line=>logs.push(JSON.parse(line)),res:{json:(body,status)=>({body,status})}}}
 return {env,handler,context,logs,get calls(){return calls},set time(n){at=n}}
}
test('guard accepts signed exact body, refuses replay and fails closed when env changes',async()=>{
 const s=setup(),ctx=s.context();assert.equal((await s.handler(ctx)).status,200);assert.equal((await s.handler(ctx)).status,403);assert.equal(s.calls,1)
 s.env.CUSTOMER_ACCOUNT_ENABLED='false';assert.equal((await s.handler(s.context())).status,403);assert.equal(s.calls,1)
})
test('guard rejects unsigned, tampered, expired, unknown UID or invalid JWT before business',async()=>{
 for(const alter of [c=>delete c.req.headers['x-b7-signature'],c=>{c.req.bodyText+=' '},c=>{c.req.bodyJson={action:'health'}},c=>{c.req.headers['x-b7-timestamp']=String(now-31000)},c=>{c.req.headers['x-b7-nonce']='bad'},c=>{c.req.headers['x-appwrite-user-id']='other'},c=>{c.req.headers['x-appwrite-user-jwt']='bad'}]){
  const s=setup(),c=s.context();alter(c);assert.equal((await s.handler(c)).status,403);assert.equal(s.calls,0)
 }
 for(const at of [now-2000,now+899000]){const s=setup();s.time=at;assert.equal((await s.handler(s.context())).status,403);assert.equal(s.calls,0)}
})
test('guard rejects new IDs, changed writes, forbidden actions and wrong environment',async()=>{
 for(const payload of [{...body,data:{requestId:'unapproved'}},{...body,data:{requestId:id,customerUserId:H}},{action:'create-class'},{action:'calendar-login'}]){const s=setup();assert.equal((await s.handler(s.context(payload))).status,403);assert.equal(s.calls,0)}
 for(const change of [{APPWRITE_FUNCTION_PROJECT_ID:'verygood-au'},{APPWRITE_CAKE_DATABASE_ID:'production'},{APPWRITE_ADMIN_USER_IDS:G},{B7_TEST_FIXTURE_MANIFEST_SHA256:'wrong'},{B7_TEST_ENDS_AT:String(now+900000)}]){const s=setup();Object.assign(s.env,change);assert.equal((await s.handler(s.context())).status,403);assert.equal(s.calls,0)}
})
test('guard lets both approved customers reach core with foreign fixture detail/cursor/replay; guest reaches core auth refusal',async()=>{
 for(const uid of [G,H,''])for(const payload of [{action:'customer-order',data:{id}},{action:'customer-orders',data:{cursor:id}},body]){const s=setup();assert.equal((await s.handler(s.context(payload,uid))).status,200);assert.equal(s.calls,1)}
})

test('signed Owner preflight health is allowed while no Owner business request is allowed',async()=>{
 const s=setup()
 assert.equal((await s.handler(s.context({action:'health'},'console-owner'))).status,200)
 assert.equal((await s.handler(s.context(body,'console-owner'))).status,403)
})
test('guest lookup uses the product phone wire field',async()=>{
 const s=setup()
 assert.equal((await s.handler(s.context({action:'lookup-cake',data:{reservationNumber:'VG-C-AU-20261018-TEST',phone:'0400000001'}},''))).status,200)
})

test('real reservation handler, not wrapper, returns foreign detail/cursor404 and replay409',async()=>{
 const {createReservationHandler}=await import('../appwrite-functions/reservation-api/src/main.js')
 const {metadataDb}=await import('./fixtures/customer-account/metadata.mjs')
 const meta=metadataDb(),cake='ca_test_cake_au',kids='ca_test_kids_au'
 const db={...meta,
 list:async()=>({databases:[{$id:cake},{$id:kids}],total:2}),
 listCollections:async({databaseId})=>{
  const rows=await meta.listCollections({databaseId:databaseId===cake?'cake-db':'kids-db'})
  return {...rows,collections:rows.collections.map(c=>({...c,$permissions:['read("user:ca-test-admin-m-20261017")']}))}
 },
 getCollection:async()=>({enabled:true,documentSecurity:false,$permissions:['read("user:ca-test-admin-m-20261017")']}),
 getDocument:async()=>({$id:id,customerUserId:H,customerPhone:'0400000001'})}
 const s=setup(async c=>handler({...c,log(){},error(){}}))
 const handler=createReservationHandler({env:{...s.env,MARKET:'AU',REVIEW_COUPON_HMAC_SECRET:Buffer.alloc(32,8).toString('base64url')},servicesForRequest:req=>({databases:db,accountForJwt:async()=>({get:async()=>({$id:req.headers['x-appwrite-user-id'],status:true})})})})
 for(const payload of [{action:'customer-order',data:{id}},{action:'customer-orders',data:{cursor:id}}]){
  const r=await s.handler(s.context(payload));assert.equal(r.status,404);assert.equal(r.body.code,'CUSTOMER_ORDER_NOT_FOUND')
 }
 const replay=await s.handler(s.context(body));assert.equal(replay.status,409);assert.equal(replay.body.code,'REQUEST_ID_CONFLICT')
 const guest=await s.handler(s.context({action:'customer-order',data:{id}},''));assert.equal(guest.status,401);assert.equal(guest.body.code,'CUSTOMER_UNAUTHORIZED')
})
test('V3 guard refuses altered approved manifest and V2 signing domain',async()=>{
 assert.throws(()=>api.createB7GuardedHandler({approvedManifestBytes:Buffer.from('{}'),env:{},fixtureManifestBytes:fixtureBytes,verifyIdentity:async()=>({}),handler:async()=>({})}))
 const s=setup(),c=s.context(),h=c.req.headers
 const mac=createHmac('sha256',Buffer.from(s.env.B7_TEST_HMAC_SECRET,'base64url')).update(['B7v1',s.env.APPWRITE_FUNCTION_PROJECT_ID,s.env.APPWRITE_FUNCTION_ID,s.env.B7_TEST_RUN_ID,h['x-b7-timestamp'],h['x-b7-nonce'],hash(c.req.bodyText)].join('\n')).digest('base64url')
 h['x-b7-signature']=mac;c.req.path=`/b7/${h['x-b7-timestamp']}/${h['x-b7-nonce']}/${hash(c.req.bodyText)}/${mac}`
 assert.equal((await s.handler(c)).status,403);assert.equal(s.calls,0)
})
test('D1 logs only fixed phase diagnostics and keeps the identical public rejection',async()=>{
 const cases=[['CONFIG',s=>{s.env.CUSTOMER_ACCOUNT_ENABLED='false'}],['TIME',s=>{s.time=now+899000}],['SECRET_SHAPE',s=>{s.env.B7_TEST_HMAC_SECRET='B7_REVOKED'}],['BODY',(_s,c)=>{c.req.bodyJson={action:'changed'}}],['HEADERS',(_s,c)=>{delete c.req.headers['x-b7-signature']}],['SIGNATURE',s=>{s.env.B7_TEST_HMAC_SECRET=Buffer.alloc(32,9).toString('base64url')}],['PATH',(_s,c)=>{c.req.path='/wrong'}]]
 for(const[phase,change]of cases){const s=setup(),c=s.context({action:'health'},'console-owner');change(s,c);const r=await s.handler(c);assert.deepEqual(r,{body:{ok:false,code:'B7_GUARD_REJECTED'},status:403});assert.equal(s.calls,0);assert.deepEqual(s.logs,[{tag:'B7_D1_DIAGNOSTIC',revision:'b7-d1-20261018.1',phase,accepted:false}])}
})
test('D1 success and failure logs never contain input, environment values or credentials',async()=>{
 for(const fail of [false,true]){const s=setup(),c=s.context({action:'health'},'console-owner');const sensitive=[s.env.B7_TEST_HMAC_SECRET,c.req.headers['x-b7-signature'],c.req.headers['x-appwrite-user-jwt'],c.req.path];if(fail)c.req.path='/wrong';await s.handler(c);const text=JSON.stringify(s.logs);for(const value of sensitive)assert.equal(text.includes(value),false);assert.equal(s.logs.some(x=>x.tag==='B7_D1_DIAGNOSTIC'&&x.accepted===!fail),true);for(const row of s.logs)assert.ok(Object.values(row).every(v=>typeof v==='boolean'||['B7_D1_DIAGNOSTIC','B7_V3_PLATFORM_CONTRACT','b7-d1-20261018.1','PASS','PATH','1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'].includes(v)))}
})
test('diagnostic logger failures never turn rejection into acceptance or expose exceptions',async()=>{
 const s=setup(),c=s.context();c.req.path='/wrong';c.log=()=>{throw Error('synthetic-sensitive-error')};const r=await s.handler(c);assert.equal(r.status,403);assert.equal(s.calls,0)
})
