import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac,randomUUID} from 'node:crypto'
const api=await import('../tools/customer-account-readiness-probe.mjs').catch(()=>({}))
const manifest='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'
const hash=x=>createHash('sha256').update(x).digest('hex'),now=1792334400000
function setup(change={}){
 assert.equal(typeof api.createReadinessProbe,'function')
 const env={APPWRITE_FUNCTION_PROJECT_ID:'verygood-au-account-test',APPWRITE_FUNCTION_ID:'ca-test-reservation-api',APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_ADMIN_USER_IDS:'ca-test-admin-m-20261017',CUSTOMER_ACCOUNT_ENABLED:'true',AU_RENEWAL_WRITES_ENABLED:'false',AU_RENEWAL_PREORDERS_ENABLED:'false',B7_TEST_RUN_ID:'readiness-five-20261018',B7_TEST_STARTS_AT:String(now),B7_TEST_ENDS_AT:String(now+300000),B7_TEST_HMAC_SECRET:Buffer.alloc(32,29).toString('base64url'),B7_TEST_FIXTURE_MANIFEST_SHA256:'a'.repeat(64)}
 let at=now,calls=0;const logs=[]
 const handler=api.createReadinessProbe({handler:async c=>{calls++;return c.res.json({ok:true,result:{enabled:true,ready:true}},200)},env,fixtureSha256:env.B7_TEST_FIXTURE_MANIFEST_SHA256,sourceSha256:'b'.repeat(64),clock:()=>at})
 const bodyText=JSON.stringify({action:'customer-account-health'}),timestamp=String(now),nonce=randomUUID()
 const signature=createHmac('sha256',Buffer.from(env.B7_TEST_HMAC_SECRET,'base64url')).update(['B7v3:'+manifest,env.APPWRITE_FUNCTION_PROJECT_ID,env.APPWRITE_FUNCTION_ID,env.B7_TEST_RUN_ID,timestamp,nonce,hash(bodyText)].join('\n')).digest('base64url')
 const req={bodyText,bodyJson:JSON.parse(bodyText),headers:{'x-b7-timestamp':timestamp,'x-b7-nonce':nonce,'x-b7-signature':signature,'x-appwrite-user-id':'owner','x-appwrite-user-jwt':'synthetic-platform-jwt'},path:`/b7/${timestamp}/${nonce}/${hash(bodyText)}/${signature}`}
 change.mutate?.({env,req})
 return {run:()=>handler({req,res:{json:(body,status)=>({body,status})},log:line=>logs.push(JSON.parse(line))}),get calls(){return calls},logs,set at(x){at=x},env,req}
}
test('readiness probe delegates only signed customer health with writes OFF and emits safe runtime timing',async()=>{
 const s=setup(),r=await s.run();assert.equal(r.status,200);assert.equal(s.calls,1)
 assert.equal(s.logs[0].phase,'PASS');assert.equal(s.logs.at(-1).handlerElapsedMs,0)
 const text=JSON.stringify(s.logs);for(const secret of [s.env.B7_TEST_HMAC_SECRET,s.req.headers['x-b7-signature'],'synthetic-platform-jwt',s.req.path])assert.equal(text.includes(secret),false)
 assert.equal((await s.run()).status,403);assert.equal(s.calls,1)
})
test('readiness probe rejects target/flag/secret/time/body/header/signature/path mutations before original handler',async()=>{
 const cases=[
  ['CONFIG',({env})=>env.APPWRITE_FUNCTION_PROJECT_ID='verygood-au'],
  ['CONFIG',({env})=>env.AU_RENEWAL_WRITES_ENABLED='true'],
  ['CONFIG',({env})=>env.CUSTOMER_ACCOUNT_ENABLED='false'],
  ['CONFIG',({env})=>env.B7_TEST_FIXTURE_MANIFEST_SHA256='c'.repeat(64)],
  ['TIME',({env})=>env.B7_TEST_ENDS_AT=String(now+300001)],
  ['SECRET_SHAPE',({env})=>env.B7_TEST_HMAC_SECRET='B7_REVOKED'],
  ['BODY',({req})=>{req.bodyText=JSON.stringify({action:'create-cake'});req.bodyJson=JSON.parse(req.bodyText)}],
  ['BODY',({req})=>req.bodyJson.data={}],
  ['HEADERS',({req})=>delete req.headers['x-appwrite-user-jwt']],
  ['SIGNATURE',({req})=>req.headers['x-b7-signature']='A'.repeat(43)],
  ['PATH',({req})=>req.path='/'],
 ]
 for(const [phase,mutate] of cases){const s=setup({mutate});assert.equal((await s.run()).status,403,phase);assert.equal(s.logs[0].phase,phase);assert.equal(s.calls,0)}
 const expired=setup();expired.at=now+300000;assert.equal((await expired.run()).status,403);assert.equal(expired.logs[0].phase,'TIME')
})
