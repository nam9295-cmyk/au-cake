// Test-only server code: imported by the diagnostic Function and server-side Pages relay.
export const MEMBER_TARGET=Object.freeze({endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',functionId:'ca-test-reservation-api',origin:'https://au-account-test.verygood-chocolate.com',fixtureId:'unused'})
export const MEMBER_USERS=Object.freeze({G:'6ad38e4e0ffd5f810e23',H:'ca-test-customer-h-20261018'})
const t=MEMBER_TARGET,encoder=new TextEncoder(),uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const actorFor=id=>Object.keys(MEMBER_USERS).find(k=>MEMBER_USERS[k]===id)
export async function memberHash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
const message=(c,time,nonce,hash,identityHash)=>['CA-MEMBER-CREATE-v1',t.projectId,t.functionId,c.runId,time,nonce,hash,identityHash].join('\n')
const jwtPresent=value=>typeof value==='string'&&value.length>0&&value.length<=8192&&!/\s/.test(value)
async function signature(c,time,nonce,hash,identityHash,secret){const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message(c,time,nonce,hash,identityHash)))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function memberBodyAllowed(body,config,readOnly=false){
 if(!readOnly&&JSON.stringify(body)===JSON.stringify(config.createBody))return true
 if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='action,data'||!body.data||Array.isArray(body.data))return false
 if(body.action==='customer-orders')return Object.keys(body.data).join(',')==='limit'&&body.data.limit===25
 return body.action==='customer-order'&&Object.keys(body.data).join(',')==='id'&&body.data.id===config.createBody.data.requestId
}
export async function signMemberExecution({config,text,jwt,uid,time=Date.now(),nonce=crypto.randomUUID()}){
 const stamp=String(time),hash=await memberHash(text),identityHash=await memberHash(uid+'\n'+jwt),sig=await signature(config,stamp,nonce,hash,identityHash,config.secret)
 return {path:`/ca-member-create/${stamp}/${nonce}/${hash}/${identityHash}/${sig}`,headers:{'x-ca-time':stamp,'x-ca-nonce':nonce,'x-ca-signature':sig,'x-ca-customer-jwt':jwt}}
}
export function createMemberGuard({config,env,handler,clock=Date.now}){
 let busy=false,count=0,createAttempted=false;const seen=new Set(),limit=config.executionsMax??3
 return async context=>{
  let phase='CONFIG'
  const log=row=>{try{context.log?.(JSON.stringify({tag:'CA_MEMBER_CREATE',runId:config.runId,...row}))}catch{/* never echo exceptions */}}
  const reject=()=>{log({stage:'REJECTED',phase});return context.res.json({ok:false,code:'CA_MEMBER_CREATE_REJECTED'},403,{'Cache-Control':'no-store'})}
  if(!Number.isInteger(limit)||limit<1||limit>3)return reject()
  if(busy||count>=limit){phase='LIMIT';return reject()}busy=true
  try{
   const secret=env.B7_TEST_HMAC_SECRET
   if(env.APPWRITE_FUNCTION_PROJECT_ID!==t.projectId||env.APPWRITE_FUNCTION_ID!==t.functionId||env.APPWRITE_CAKE_DATABASE_ID!=='ca_test_cake_au'||env.APPWRITE_KIDS_DATABASE_ID!=='ca_test_kids_au'||env.APPWRITE_ADMIN_USER_IDS!=='ca-test-admin-m-20261017'||env.CUSTOMER_ACCOUNT_ENABLED!=='true'||env.AU_RENEWAL_WRITES_ENABLED!=='true'||env.AU_RENEWAL_PREORDERS_ENABLED!=='false'||env.B7_TEST_RUN_ID!==config.runId||env.B7_TEST_STARTS_AT!==String(config.startedAt)||env.B7_TEST_ENDS_AT!=='manual'||env.B7_TEST_FIXTURE_MANIFEST_SHA256!==config.scopeSha256||!/^[A-Za-z0-9_-]{43}$/.test(secret||'')||await memberHash(secret)!==config.secretSha256)return reject()
   phase='TIME';const now=clock();if(!Number.isSafeInteger(now)||now<config.startedAt)return reject()
   phase='BODY';const {req}=context,text=req.bodyText;if(typeof text!=='string'||encoder.encode(text).length>3000)return reject();const body=JSON.parse(text);if(!memberBodyAllowed(body,config)||JSON.stringify(body)!==JSON.stringify(req.bodyJson))return reject()
   const headers=req.headers||{},uid=headers['x-appwrite-user-id'],actor=actorFor(uid),forwardedJwt=headers['x-ca-customer-jwt']
   log({stage:'IDENTITY_INPUT',platformUidAllowed:Boolean(actor),platformJwtPresent:jwtPresent(headers['x-appwrite-user-jwt']),forwardedJwtPresent:jwtPresent(forwardedJwt)})
   phase='IDENTITY_UID';if(actor!=='G')return reject()
   phase='IDENTITY_JWT';if(!jwtPresent(forwardedJwt))return reject()
   phase='SIGNATURE';const time=headers['x-ca-time'],nonce=headers['x-ca-nonce'],sig=headers['x-ca-signature'];if(!/^\d{13}$/.test(time||'')||now-Number(time)>30000||Number(time)-now>5000||!uuid.test(nonce||'')||seen.has(nonce)||!/^[A-Za-z0-9_-]{43}$/.test(sig||''))return reject()
   const hash=await memberHash(text),identityHash=await memberHash(uid+'\n'+forwardedJwt),key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('HMAC',key,bytes(sig),encoder.encode(message(config,time,nonce,hash,identityHash))))return reject()
   phase='CREATE_LIMIT';if(body.action==='create-cake'&&createAttempted)return reject();
   phase='PATH';if(req.path!==`/ca-member-create/${time}/${nonce}/${hash}/${identityHash}/${sig}`)return reject();seen.add(nonce);count++;if(body.action==='create-cake')createAttempted=true
   log({stage:'ACCEPTED',actor,action:body.action,sourceSha256:config.sourceSha256,node:process.version});const began=clock()
   // The original product handler independently verifies JWT and derives the owner UID.
   const res={...context.res,json:(response,status,headers)=>{
    log({stage:'RESPONSE',actor,action:body.action,httpStatus:status,handlerMs:clock()-began,code:response?.ok===false&&/^[A-Z_]+$/.test(response.code||'')?response.code:undefined,...(body.action==='customer-orders'&&response?.ok===true?{orderCount:response.result?.orders?.length,newOrderListed:response.result?.orders?.some(o=>o.id===config.createBody.data.requestId)===true}:{}),...(body.action==='customer-order'&&response?.ok===true?{fixtureMatched:response.result?.id===config.createBody.data.requestId,cancelled:response.result?.status==='취소'}:{})});return context.res.json(response,status,headers)
   }}
   // Appwrite 1.8.1 may leave its generated JWT empty on JWT-only executions.
   // The original handler still validates this signed user JWT via Account.get()
   // and requires its UID to equal Appwrite's platform UID before reading orders.
   phase='HANDLER';return await handler({...context,res,req:{...req,headers:{...headers,'x-appwrite-user-jwt':forwardedJwt}}})
  }catch{return reject()}finally{busy=false}
 }
}
export function createMemberRelay({config,transport=fetch,clock=Date.now}){
 let busy=false,count=0;const limit=config.executionsMax??3
 const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})
 return async request=>{
  const url=new URL(request.url)
  if(url.origin!==t.origin||url.pathname!=='/__acceptance/orders'||request.method!=='POST'||request.headers.get('Origin')!==t.origin)return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
  const authorization=request.headers.get('Authorization')||'',jwt=authorization.startsWith('Bearer ')?authorization.slice(7):''
  if(!jwtPresent(jwt))return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
  if(busy)return json({ok:false,code:'TEST_QUERY_BUSY'},409)
  if(!Number.isInteger(limit)||limit<1||limit>3)return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
  if(count>=limit)return json({ok:false,code:'TEST_QUERY_LIMIT'},429)
  busy=true
  try{
   if(clock()<config.startedAt||!/^[A-Za-z0-9_-]{43}$/.test(config.secret||''))throw Error()
   const text=await request.text();if(encoder.encode(text).length>3000)return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
   const body=JSON.parse(text);if(!memberBodyAllowed(body,config,true))return json({ok:false,code:'TEST_ROUTE_DENIED'},403)
   // Workers supports manual redirects; never follow one carrying a customer JWT.
   const authHeaders={'X-Appwrite-Project':t.projectId,'X-Appwrite-JWT':jwt},userResponse=await transport(t.endpoint+'/account',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(5000),headers:authHeaders})
   if(userResponse.redirected||(userResponse.status>=300&&userResponse.status<400))return json({ok:false,code:'CUSTOMER_ORDERS_UNAVAILABLE'},503)
   if(!userResponse.ok)return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
   const user=await userResponse.json();if(user.status!==true||user.$id!==MEMBER_USERS.G)return json({ok:false,code:'CUSTOMER_UNAUTHORIZED'},401)
   const time=String(clock()),nonce=crypto.randomUUID(),hash=await memberHash(text),identityHash=await memberHash(user.$id+'\n'+jwt),sig=await signature(config,time,nonce,hash,identityHash,config.secret)
   // No Owner credential or cookie is present. Only the JWT verified above is
   // forwarded, bound by HMAC to the body and Appwrite-derived user ID.
   count++;const began=clock(),r=await transport(t.endpoint+'/functions/'+t.functionId+'/executions',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({body:text,async:false,method:'POST',path:`/ca-member-create/${time}/${nonce}/${hash}/${identityHash}/${sig}`,headers:{'x-ca-time':time,'x-ca-nonce':nonce,'x-ca-signature':sig,'x-ca-customer-jwt':jwt}})})
   if(r.redirected||!r.ok)return json({ok:false,code:'CUSTOMER_ORDERS_UNAVAILABLE'},503)
   const execution=await r.json();if(execution.status!=='completed'||!Number.isInteger(execution.responseStatusCode)||execution.responseStatusCode<200||execution.responseStatusCode>599)throw Error()
   const result=JSON.parse(execution.responseBody);if(typeof result?.ok!=='boolean')throw Error()
   return json(result,execution.responseStatusCode,{'X-CA-Upstream-Ms':String(clock()-began),'X-CA-Execution-Ms':String(Math.round(Number(execution.duration||0)*1000))})
  }catch{return json({ok:false,code:'CUSTOMER_ORDERS_UNAVAILABLE'},503)}finally{busy=false}
 }
}
// Test-only notification/egress boundary. No operating resource or external mail transport is reachable.
export function createMemberTransport({config,transport=fetch,internalEndpoint}){
 let writeAttempted=false
 const origins=new Set([MEMBER_TARGET.endpoint,...(internalEndpoint?[internalEndpoint]:[])])
 return async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase(),headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined))
  const endpoint=[...origins].find(e=>url.href.startsWith(e+'/'))
  if(!endpoint||headers.get('x-appwrite-project')!==MEMBER_TARGET.projectId)throw Error('TEST_TRANSPORT_DENIED')
  const path=url.pathname.slice(new URL(endpoint).pathname.length),db=path.match(/^\/databases\/([^/]+)/)?.[1]
  if(method==='GET'&&(path==='/account'||path==='/databases'||['ca_test_cake_au','ca_test_kids_au'].includes(db)))return transport(input,options)
  if(method==='POST'&&path==='/databases/ca_test_cake_au/collections/reservations/documents'&&!writeAttempted){
   const row=JSON.parse(options.body);if(row.documentId===config.createBody.data.requestId&&row.data?.customerUserId===MEMBER_USERS.G){writeAttempted=true;return transport(input,options)}
  }
  throw Error('TEST_TRANSPORT_DENIED')
 }
}
