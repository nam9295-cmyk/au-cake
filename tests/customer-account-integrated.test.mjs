import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac,randomUUID} from 'node:crypto'
const api=await import('../tools/customer-account-integrated/server.mjs').catch(()=>({}))
const at=1792368000000,secret=Buffer.alloc(32,61).toString('base64url'),hash=x=>createHash('sha256').update(x).digest('hex')
const config={runId:'ca-integration-20261019',startedAt:at,secret,scopeSha256:'a'.repeat(64)}
function context(body={action:'customer-orders',data:{limit:25}},actor='G'){
 const text=JSON.stringify(body),timestamp=String(at),nonce=randomUUID(),signature=createHmac('sha256',Buffer.from(secret,'base64url')).update(['CA-INTEGRATED-v1','verygood-au-account-test','ca-test-reservation-api',config.runId,timestamp,nonce,hash(text)].join('\n')).digest('base64url')
 return {req:{bodyText:text,bodyJson:body,path:`/ca-integrated/${timestamp}/${nonce}/${hash(text)}/${signature}`,headers:{'x-ca-time':timestamp,'x-ca-nonce':nonce,'x-ca-signature':signature,'x-appwrite-user-id':actor==='G'?'6ad38e4e0ffd5f810e23':'ca-test-customer-h-20261018','x-appwrite-user-jwt':'synthetic-jwt'}},res:{json:(body,status)=>({body,status})},log(){}}
}
function env(){return {APPWRITE_FUNCTION_PROJECT_ID:'verygood-au-account-test',APPWRITE_FUNCTION_ID:'ca-test-reservation-api',APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_ADMIN_USER_IDS:'ca-test-admin-m-20261017',CUSTOMER_ACCOUNT_ENABLED:'true',AU_RENEWAL_WRITES_ENABLED:'false',AU_RENEWAL_PREORDERS_ENABLED:'false',B7_TEST_RUN_ID:config.runId,B7_TEST_STARTS_AT:String(at),B7_TEST_ENDS_AT:'manual',B7_TEST_HMAC_SECRET:secret,B7_TEST_FIXTURE_MANIFEST_SHA256:config.scopeSha256}}
test('read-only guard passes H request for G fixture to original ownership code; preserves original 404',async()=>{
 assert.equal(typeof api.createIntegratedGuard,'function');let calls=0
 const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:async c=>{calls++;return c.res.json({ok:false,code:'CUSTOMER_ORDER_NOT_FOUND'},404)}})
 assert.equal((await guard(context({action:'customer-order',data:{id:'ca-myorders-g-read-20261019'}},'H'))).status,404);assert.equal(calls,1)
})
test('guard rejects writes/health, stale runtime, signatures, replay and concurrency without touching core',async()=>{
 assert.equal(typeof api.createIntegratedGuard,'function')
 for(const mutate of [c=>{c.req.bodyJson.action='health';c.req.bodyText=JSON.stringify(c.req.bodyJson)},c=>c.req.path='/',c=>c.req.headers['x-ca-signature']='A'.repeat(43),c=>c.req.headers['x-appwrite-user-id']='unknown',c=>delete c.req.headers['x-appwrite-user-jwt']]){
  let calls=0;const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:()=>{calls++}}),c=context();mutate(c);assert.equal((await guard(c)).status,403);assert.equal(calls,0)
 }
 let calls=0;const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:async c=>{calls++;return c.res.json({ok:true,result:{orders:[]}},200)}}),c=context()
 assert.equal((await guard(c)).status,200);assert.equal((await guard(c)).status,403);assert.equal(calls,1)
 const wrong=env();wrong.B7_TEST_HMAC_SECRET=Buffer.alloc(32,62).toString('base64url');const stale=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:wrong,clock:()=>at,handler:()=>{calls++}});assert.equal((await stale(context())).status,403);assert.equal(calls,1)
})
test('relay keeps signing material server-side and forwards actual user JWT; unauthenticated query is 401 without execution',async()=>{
 assert.equal(typeof api.createIntegratedRelay,'function');const calls=[]
 const relay=api.createIntegratedRelay({config,clock:()=>at,transport:async(url,o)=>{calls.push({url,o});if(url.endsWith('/account'))return Response.json({$id:'6ad38e4e0ffd5f810e23',status:true});return Response.json({status:'completed',responseStatusCode:200,responseBody:JSON.stringify({ok:true,result:{orders:[],nextCursor:null}}),duration:0.1},{status:201})}})
 const request=(jwt)=>new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:'https://au-account-test.verygood-chocolate.com','Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({action:'customer-orders',data:{limit:25}})})
 assert.equal((await relay(request())).status,401);assert.equal(calls.length,0)
 const r=await relay(request('synthetic-jwt')),text=await r.text();assert.equal(r.status,200);assert.equal(calls.length,2);assert.equal(calls[1].o.headers['X-Appwrite-JWT'],'synthetic-jwt');assert.equal(calls[1].o.headers.Cookie,undefined)
 const wire=JSON.parse(calls[1].o.body);assert.match(wire.path,/^\/ca-integrated\//);assert.equal(text.includes(secret),false);assert.equal(text.includes(wire.headers['x-ca-signature']),false);assert.equal(text.includes('synthetic-jwt'),false)
})
test('relay rejects arbitrary origins/actions and enforces ten dispatches with no retry',async()=>{
 assert.equal(typeof api.createIntegratedRelay,'function');let executions=0
 const relay=api.createIntegratedRelay({config,clock:()=>at,transport:async url=>url.endsWith('/account')?Response.json({$id:'ca-test-customer-h-20261018',status:true}):(executions++,Response.json({status:'completed',responseStatusCode:404,responseBody:JSON.stringify({ok:false,code:'CUSTOMER_ORDER_NOT_FOUND'})},{status:201}))})
 const req=(action='customer-order',origin='https://au-account-test.verygood-chocolate.com')=>new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:origin,Authorization:'Bearer synthetic-jwt'},body:JSON.stringify({action,data:{id:'ca-myorders-g-read-20261019'}})})
 assert.equal((await relay(req('create-cake'))).status,403);assert.equal((await relay(req('customer-order','https://evil.invalid'))).status,403);assert.equal(executions,0)
 for(let i=0;i<10;i++)assert.equal((await relay(req())).status,404)
 assert.equal((await relay(req())).status,429);assert.equal(executions,10)
})
