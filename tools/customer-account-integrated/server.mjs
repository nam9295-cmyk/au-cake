// Test-only server code: imported by the diagnostic Function and server-side Pages relay.
export const INTEGRATED_TARGET=Object.freeze({endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',functionId:'ca-test-reservation-api',origin:'https://au-account-test.verygood-chocolate.com',fixtureId:'ca-myorders-g-read-20261019'})
export const INTEGRATED_USERS=Object.freeze({G:'6ad38e4e0ffd5f810e23',H:'ca-test-customer-h-20261018'})
const t=INTEGRATED_TARGET,encoder=new TextEncoder(),uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const actorFor=id=>Object.keys(INTEGRATED_USERS).find(k=>INTEGRATED_USERS[k]===id)
export async function integratedHash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
const message=(c,time,nonce,hash)=>['CA-INTEGRATED-v1',t.projectId,t.functionId,c.runId,time,nonce,hash].join('\n')
async function signature(c,time,nonce,hash,secret){const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message(c,time,nonce,hash)))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function integratedBodyAllowed(body){
 if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='action,data'||!body.data||Array.isArray(body.data))return false
 if(body.action==='customer-orders')return Object.keys(body.data).join(',')==='limit'&&body.data.limit===25
 return body.action==='customer-order'&&Object.keys(body.data).join(',')==='id'&&body.data.id===t.fixtureId
}
export function createIntegratedGuard({config,env,handler,clock=Date.now}){
 let busy=false,count=0;const seen=new Set()
 return async context=>{
  let phase='CONFIG'
  const log=row=>{try{context.log?.(JSON.stringify({tag:'CA_INTEGRATED',runId:config.runId,...row}))}catch{/* never echo exceptions */}}
  const reject=()=>{log({stage:'REJECTED',phase});return context.res.json({ok:false,code:'CA_INTEGRATED_REJECTED'},403,{'Cache-Control':'no-store'})}
  if(busy||count>=10){phase='LIMIT';return reject()}busy=true
  try{
   const secret=env.B7_TEST_HMAC_SECRET
   if(env.APPWRITE_FUNCTION_PROJECT_ID!==t.projectId||env.APPWRITE_FUNCTION_ID!==t.functionId||env.APPWRITE_CAKE_DATABASE_ID!=='ca_test_cake_au'||env.APPWRITE_KIDS_DATABASE_ID!=='ca_test_kids_au'||env.APPWRITE_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||env.CUSTOMER_ACCOUNT_ENABLED!=='true'||env.AU_RENEWAL_WRITES_ENABLED!=='false'||env.AU_RENEWAL_PREORDERS_ENABLED!=='false'||env.B7_TEST_RUN_ID!==config.runId||env.B7_TEST_STARTS_AT!==String(config.startedAt)||env.B7_TEST_ENDS_AT!=='manual'||env.B7_TEST_FIXTURE_MANIFEST_SHA256!==config.scopeSha256||!/^[A-Za-z0-9_-]{43}$/.test(secret||'')||await integratedHash(secret)!==config.secretSha256)return reject()
   phase='TIME';const now=clock();if(!Number.isSafeInteger(now)||now<config.startedAt)return reject()
   phase='BODY';const {req}=context,text=req.bodyText;if(typeof text!=='string'||encoder.encode(text).length>3000)return reject();const body=JSON.parse(text);if(!integratedBodyAllowed(body)||JSON.stringify(body)!==JSON.stringify(req.bodyJson))return reject()
   phase='IDENTITY';const headers=req.headers||{},actor=actorFor(headers['x-appwrite-user-id']);if(!actor||typeof headers['x-appwrite-user-jwt']!=='string'||!headers['x-appwrite-user-jwt'])return reject()
   phase='SIGNATURE';const time=headers['x-ca-time'],nonce=headers['x-ca-nonce'],sig=headers['x-ca-signature'];if(!/^\d{13}$/.test(time||'')||now-Number(time)>30000||Number(time)-now>5000||!uuid.test(nonce||'')||seen.has(nonce)||!/^[A-Za-z0-9_-]{43}$/.test(sig||''))return reject()
   const hash=await integratedHash(text),key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('HMAC',key,bytes(sig),encoder.encode(message(config,time,nonce,hash))))return reject()
   phase='PATH';if(req.path!==`/ca-integrated/${time}/${nonce}/${hash}/${sig}`)return reject();seen.add(nonce);count++
   log({stage:'ACCEPTED',actor,action:body.action,sourceSha256:config.sourceSha256,node:process.version});const began=clock()
   // Never pre-decide order ownership. H's G-order request reaches the original JWT/owner checks.
   const res={...context.res,json:(response,status,headers)=>{
    log({stage:'RESPONSE',actor,action:body.action,httpStatus:status,handlerMs:clock()-began,code:response?.ok===false&&/^[A-Z_]+$/.test(response.code||'')?response.code:undefined,...(body.action==='customer-orders'&&response?.ok===true?{orderCount:response.result?.orders?.length}:{}),...(body.action==='customer-order'&&response?.ok===true?{fixtureMatched:response.result?.id===t.fixtureId,cancelled:response.result?.status==='취소'}:{})});return context.res.json(response,status,headers)
   }}
   phase='HANDLER';return await handler({...context,res})
  }catch{return reject()}finally{busy=false}
 }
}
export function createIntegratedRelay({config,transport=fetch,clock=Date.now}){
 let busy=false,count=0
 const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})
 return async request=>{
  const url=new URL(request.url)
  if(url.origin!==t.origin||url.pathname!=='/__acceptance/orders'||request.method!=='POST'||request.headers.get('Origin')!==t.origin)return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
  const authorization=request.headers.get('Authorization')||'',jwt=authorization.startsWith('Bearer ')?authorization.slice(7):''
  if(!jwt)return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
  if(busy)return json({ok:false,code:'TEST_QUERY_BUSY'},409)
  if(count>=10)return json({ok:false,code:'TEST_QUERY_LIMIT'},429)
  busy=true
  try{
   if(clock()<config.startedAt||!/^[A-Za-z0-9_-]{43}$/.test(config.secret||''))throw Error()
   const text=await request.text();if(encoder.encode(text).length>3000)return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
   const body=JSON.parse(text);if(!integratedBodyAllowed(body))return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
   const authHeaders={'X-Appwrite-Project':t.projectId,'X-Appwrite-JWT':jwt},userResponse=await transport(t.endpoint+'/account',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:authHeaders})
   if(!userResponse.ok)return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
   const user=await userResponse.json();if(user.status!==true||!actorFor(user.$id))return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
   const time=String(clock()),nonce=crypto.randomUUID(),hash=await integratedHash(text),sig=await signature(config,time,nonce,hash,config.secret)
   // No Owner credential is present here. Appwrite derives platform user headers from this JWT.
   count++;const began=clock(),r=await transport(t.endpoint+'/functions/'+t.functionId+'/executions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({body:text,async:false,method:'POST',path:`/ca-integrated/${time}/${nonce}/${hash}/${sig}`,headers:{'x-ca-time':time,'x-ca-nonce':nonce,'x-ca-signature':sig}})})
   if(!r.ok)return json({ok:false,code:'CUSTOMER_ORDERS_UNAVAILABLE'},503)
   const execution=await r.json();if(execution.status!=='completed'||!Number.isInteger(execution.responseStatusCode)||execution.responseStatusCode<200||execution.responseStatusCode>599)throw Error()
   const result=JSON.parse(execution.responseBody);if(typeof result?.ok!=='boolean')throw Error()
   return json(result,execution.responseStatusCode,{'X-CA-Upstream-Ms':String(clock()-began),'X-CA-Execution-Ms':String(Math.round(Number(execution.duration||0)*1000))})
  }catch{return json({ok:false,code:'CUSTOMER_ORDERS_UNAVAILABLE'},503)}finally{busy=false}
 }
}
