import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createReservationHandler} from '../appwrite-functions/reservation-api/src/main.js'
import {accountEnv,metadataDb} from './fixtures/customer-account/metadata.mjs'
import {AppwriteException} from './reservation-sdk.mjs'
const api=await import('../tools/customer-account-integrated/server.mjs').catch(()=>({}))
const at=1792368000000,secret=Buffer.alloc(32,61).toString('base64url'),hash=x=>createHash('sha256').update(x).digest('hex')
const config={runId:'ca-integration-20261019',startedAt:at,secret,scopeSha256:'a'.repeat(64)}
function context(body={action:'customer-orders',data:{limit:25}},actor='G',jwt=actor==='G'?'jwt-g':'jwt-h'){
 const userId=actor==='G'?'6ad38e4e0ffd5f810e23':'ca-test-customer-h-20261018',identityHash=hash(userId+'\n'+jwt)
 const text=JSON.stringify(body),timestamp=String(at),nonce=randomUUID(),signature=createHmac('sha256',Buffer.from(secret,'base64url')).update(['CA-INTEGRATED-JWT-v2','verygood-au-account-test','ca-test-reservation-api',config.runId,timestamp,nonce,hash(text),identityHash].join('\n')).digest('base64url')
 return {req:{bodyText:text,bodyJson:body,path:`/ca-integrated-jwt/${timestamp}/${nonce}/${hash(text)}/${identityHash}/${signature}`,headers:{'x-ca-time':timestamp,'x-ca-nonce':nonce,'x-ca-signature':signature,'x-appwrite-user-id':userId,'x-appwrite-user-jwt':'','x-ca-customer-jwt':jwt}},res:{json:(body,status)=>({body,status})},log(){}}
}
function env(){return {APPWRITE_FUNCTION_PROJECT_ID:'verygood-au-account-test',APPWRITE_FUNCTION_ID:'ca-test-reservation-api',APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_ADMIN_USER_IDS:'ca-test-admin-m-20261017',CUSTOMER_ACCOUNT_ENABLED:'true',AU_RENEWAL_WRITES_ENABLED:'false',AU_RENEWAL_PREORDERS_ENABLED:'false',B7_TEST_RUN_ID:config.runId,B7_TEST_STARTS_AT:String(at),B7_TEST_ENDS_AT:'manual',B7_TEST_HMAC_SECRET:secret,B7_TEST_FIXTURE_MANIFEST_SHA256:config.scopeSha256}}
test('read-only guard passes H request for G fixture to original ownership code; preserves original 404',async()=>{
 assert.equal(typeof api.createIntegratedGuard,'function');let calls=0
 const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:async c=>{calls++;return c.res.json({ok:false,code:'CUSTOMER_ORDER_NOT_FOUND'},404)}})
 assert.equal((await guard(context({action:'customer-order',data:{id:'ca-myorders-g-read-20261019'}},'H'))).status,404);assert.equal(calls,1)
})
test('guard rejects writes/health, stale runtime, signatures, replay and concurrency without touching core',async()=>{
 assert.equal(typeof api.createIntegratedGuard,'function')
 for(const mutate of [c=>{c.req.bodyJson.action='health';c.req.bodyText=JSON.stringify(c.req.bodyJson)},c=>c.req.path='/',c=>c.req.headers['x-ca-signature']='A'.repeat(43),c=>c.req.headers['x-appwrite-user-id']='unknown',c=>delete c.req.headers['x-ca-customer-jwt']]){
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
 for(const call of calls)assert.equal(call.o.redirect,'manual')
 const wire=JSON.parse(calls[1].o.body);assert.match(wire.path,/^\/ca-integrated-jwt\//);assert.equal(wire.headers['x-ca-customer-jwt'],'synthetic-jwt');assert.equal(text.includes(secret),false);assert.equal(text.includes(wire.headers['x-ca-signature']),false);assert.equal(text.includes('synthetic-jwt'),false)
})
test('relay rejects arbitrary origins/actions and enforces ten dispatches with no retry',async()=>{
 assert.equal(typeof api.createIntegratedRelay,'function');let executions=0
 const relay=api.createIntegratedRelay({config,clock:()=>at,transport:async url=>url.endsWith('/account')?Response.json({$id:'ca-test-customer-h-20261018',status:true}):(executions++,Response.json({status:'completed',responseStatusCode:404,responseBody:JSON.stringify({ok:false,code:'CUSTOMER_ORDER_NOT_FOUND'})},{status:201}))})
 const req=(action='customer-order',origin='https://au-account-test.verygood-chocolate.com')=>new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:origin,Authorization:'Bearer synthetic-jwt'},body:JSON.stringify({action,data:{id:'ca-myorders-g-read-20261019'}})})
 assert.equal((await relay(req('create-cake'))).status,403);assert.equal((await relay(req('customer-order','https://evil.invalid'))).status,403);assert.equal(executions,0)
 for(let i=0;i<10;i++)assert.equal((await relay(req())).status,404)
 assert.equal((await relay(req())).status,429);assert.equal(executions,10)
})
test('an upstream authentication redirect fails closed without executing or following a different origin',async()=>{
 assert.equal(typeof api.createIntegratedRelay,'function');const requests=[]
 const relay=api.createIntegratedRelay({config,clock:()=>at,transport:async(url,options)=>{requests.push({url,options});return Response.redirect('https://unapproved.invalid/',302)}})
 const request=new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:'https://au-account-test.verygood-chocolate.com',Authorization:'Bearer synthetic-jwt'},body:JSON.stringify({action:'customer-orders',data:{limit:25}})})
 const r=await relay(request);assert.equal(r.status,503);assert.equal(requests.length,1);assert.equal(requests[0].url.endsWith('/account'),true);assert.equal(requests[0].options.redirect,'manual')
})
test('an execution redirect is rejected with no retry and no JWT or signing material in the response',async()=>{
 const calls=[]
 const relay=api.createIntegratedRelay({config,clock:()=>at,transport:async(url,options)=>{calls.push({url,options});return url.endsWith('/account')?Response.json({$id:'6ad38e4e0ffd5f810e23',status:true}):Response.redirect('https://unapproved.invalid/',307)}})
 const request=new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:'https://au-account-test.verygood-chocolate.com',Authorization:'Bearer synthetic-jwt'},body:JSON.stringify({action:'customer-orders',data:{limit:25}})})
 const r=await relay(request),text=await r.text();assert.equal(r.status,503);assert.equal(calls.length,2)
 for(const call of calls)assert.equal(call.options.redirect,'manual')
 assert.equal(text.includes('synthetic-jwt'),false);assert.equal(text.includes(secret),false);assert.equal(text.includes('unapproved.invalid'),false)
})
test('JWT-only platform execution reaches the original JWT and owner checks for G/H list/detail',async()=>{
 const fullEnv={...accountEnv,...env()},admin='ca-test-admin-m-20261017',fixture=JSON.parse(readFileSync(new URL('./fixtures/customer-account/orders.json',import.meta.url),'utf8'))[0]
 const row={...fixture,$id:'ca-myorders-g-read-20261019',customerUserId:api.INTEGRATED_USERS.G},verified=[],reads=[]
 const meta=metadataDb({getCollection:async()=>({enabled:true,documentSecurity:false,$permissions:[`read("user:${admin}")`,`update("user:${admin}")`]})})
 const db={...meta,list:async()=>({databases:[{$id:'ca_test_cake_au'},{$id:'ca_test_kids_au'}],total:2}),
  listCollections:args=>meta.listCollections({...args,databaseId:args.databaseId==='ca_test_cake_au'?'cake-db':'kids-db'}),
  listDocuments:async args=>{const q=args.queries.map(JSON.parse).find(q=>q.method==='equal');assert.equal(q.attribute,'customerUserId');reads.push(q.values[0]);return {documents:q.values[0]===api.INTEGRATED_USERS.G?[row]:[]}},
  getDocument:async({documentId})=>{if(documentId!==row.$id)throw new AppwriteException('missing',404);return row},
 }
 const core=createReservationHandler({env:fullEnv,servicesForRequest:()=>({databases:db,accountForJwt:async token=>({get:async()=>{verified.push(token);if(!['jwt-g','jwt-h'].includes(token))throw Error('expired');return {$id:token==='jwt-g'?api.INTEGRATED_USERS.G:api.INTEGRATED_USERS.H,status:true}}})})})
 const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:fullEnv,clock:()=>at,handler:core})
 const invoke=(actor,detail=false,jwt)=>guard({...context(detail?{action:'customer-order',data:{id:row.$id}}:{action:'customer-orders',data:{limit:25}},actor,jwt),error(){}})
 const gList=await invoke('G');assert.equal(gList.status,200);assert.equal(gList.body.result.orders.length,1)
 assert.equal((await invoke('G',true)).status,200)
 const hList=await invoke('H');assert.equal(hList.status,200);assert.equal(hList.body.result.orders.length,0)
 assert.equal((await invoke('H',true)).status,404)
 assert.equal((await invoke('G',false,'jwt-h')).status,401)
 assert.equal((await invoke('G',false,'expired-jwt')).status,401)
 assert.deepEqual(reads,[api.INTEGRATED_USERS.G,api.INTEGRATED_USERS.H]);assert.deepEqual(verified,['jwt-g','jwt-g','jwt-h','jwt-h','jwt-h','expired-jwt'])
})
test('identity diagnostics distinguish UID and forwarded JWT failures without exposing credential values',async()=>{
 for(const [mutate,expected]of [[c=>delete c.req.headers['x-appwrite-user-id'],'IDENTITY_UID'],[c=>delete c.req.headers['x-ca-customer-jwt'],'IDENTITY_JWT']]){
  const logs=[],c=context();mutate(c);const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:()=>assert.fail('core must not run')})
  assert.equal((await guard({...c,log:s=>logs.push(JSON.parse(s))})).status,403);assert.equal(logs.at(-1).phase,expected)
  const text=JSON.stringify(logs);for(const credential of [secret,'jwt-g',c.req.headers['x-ca-signature']])assert.equal(text.includes(credential),false)
 }
})
test('changing either forwarded JWT or platform UID invalidates the signature before core access',async()=>{
 for(const mutate of [c=>c.req.headers['x-ca-customer-jwt']='jwt-h',c=>c.req.headers['x-appwrite-user-id']=api.INTEGRATED_USERS.H]){
  const c=context();mutate(c);const logs=[],guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:()=>assert.fail('core must not run')})
  assert.equal((await guard({...c,log:s=>logs.push(JSON.parse(s))})).status,403);assert.equal(logs.at(-1).phase,'SIGNATURE')
 }
})
test('old protocol, oversized/whitespace credentials and missing platform UID remain rejected',async()=>{
 for(const mutate of [c=>{const h=c.req.headers,mac=createHmac('sha256',Buffer.from(secret,'base64url')).update(['CA-INTEGRATED-v1','verygood-au-account-test','ca-test-reservation-api',config.runId,h['x-ca-time'],h['x-ca-nonce'],hash(c.req.bodyText)].join('\n')).digest('base64url');h['x-ca-signature']=mac;c.req.path=`/ca-integrated/${h['x-ca-time']}/${h['x-ca-nonce']}/${hash(c.req.bodyText)}/${mac}`},c=>c.req.headers['x-ca-customer-jwt']='a'.repeat(8193),c=>c.req.headers['x-ca-customer-jwt']='jwt g',c=>delete c.req.headers['x-appwrite-user-id']]){
  const c=context();mutate(c);const guard=api.createIntegratedGuard({config:{...config,secretSha256:hash(secret)},env:env(),clock:()=>at,handler:()=>assert.fail('core must not run')});assert.equal((await guard(c)).status,403)
 }
})
test('the remaining nine-call budget and single active request are enforced before core dispatch',async()=>{
 const options={config:{...config,secretSha256:hash(secret),executionsMax:9},env:env(),clock:()=>at};let calls=0
 const guard=api.createIntegratedGuard({...options,handler:async c=>{calls++;return c.res.json({ok:true},200)}})
 for(let i=0;i<9;i++)assert.equal((await guard(context())).status,200)
 assert.equal((await guard(context())).status,403);assert.equal(calls,9)
 let done;const blocker=new Promise(r=>{done=r}),serial=api.createIntegratedGuard({...options,handler:async c=>{await blocker;return c.res.json({ok:true},200)}})
 const pending=serial(context());await new Promise(r=>setImmediate(r));assert.equal((await serial(context())).status,403);done();assert.equal((await pending).status,200)
 const relay=api.createIntegratedRelay({config:{...config,executionsMax:9},clock:()=>at,transport:async url=>url.endsWith('/account')?Response.json({$id:api.INTEGRATED_USERS.G,status:true}):Response.json({status:'completed',responseStatusCode:200,responseBody:'{"ok":true,"result":{}}'},{status:201})})
 const req=()=>new Request('https://au-account-test.verygood-chocolate.com/__acceptance/orders',{method:'POST',headers:{Origin:'https://au-account-test.verygood-chocolate.com',Authorization:'Bearer jwt-g'},body:'{"action":"customer-orders","data":{"limit":25}}'})
 for(let i=0;i<9;i++)assert.equal((await relay(req())).status,200)
 assert.equal((await relay(req())).status,429)
})
