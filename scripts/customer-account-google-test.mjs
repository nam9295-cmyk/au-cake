export const GOOGLE_TEST_TARGET=Object.freeze({endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',origin:'https://au-account-test.verygood-chocolate.com',pagesProject:'au-cake-account-test',cloudflareAccountId:'f10bef6fa6f6abc7982d3792e250a9bc'})
export const GOOGLE_TEST_CALLBACK=GOOGLE_TEST_TARGET.endpoint+'/account/sessions/oauth2/callback/google/'+GOOGLE_TEST_TARGET.projectId
const fields={'email-password':'authEmailPassword',phone:'authPhone','magic-url':'authUsersAuthMagicURL','email-otp':'authEmailOtp',anonymous:'authAnonymous',invites:'authInvites',jwt:'authJWT'}
const fail=()=>{throw Error('CUSTOMER_ACCOUNT_GOOGLE_TEST_REJECTED')}
export function assertGoogleTestTarget(input){if(!input||Object.entries(GOOGLE_TEST_TARGET).some(([k,v])=>input[k]!==v))fail();return GOOGLE_TEST_TARGET}
export function createGoogleTestManager({target:input,cliSession,transport=fetch}){
 const target=assertGoogleTestTarget(input),root='/projects/'+target.projectId,attempted=new Set()
 if(!cliSession||cliSession.endpoint!==target.endpoint||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned===true)fail()
 async function call(method,path,data){
  const permitted=method==='GET'&&[root,root+'/platforms'].includes(path)||method==='POST'&&path===root+'/platforms'||method==='PATCH'&&(path===root+'/oauth2'||path===root+'/service'||path===root+'/auth/limit'||Object.keys(fields).some(k=>path===root+'/auth/'+k))
  if(!permitted)fail()
  if(method!=='GET'&&path!==root+'/service'){const signature=method+path;if(attempted.has(signature))fail();attempted.add(signature)}
  let r;try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':'console',Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})}catch{fail()}
  if(!r.ok||r.redirected||r.url&&r.url!==target.endpoint+path)fail()
  try{return await r.json()}catch{fail()}
 }
 async function read(){const p=await call('GET',root);if(p.$id!==target.projectId||p.teamId!=='69bf44eb000f319a38a2')fail();return p}
 const off=p=>{if(p.serviceStatusForAccount!==false)fail()}
 const methodsOff=p=>{if(Object.values(fields).some(f=>p[f]!==false))fail()}
 const safe=p=>({projectId:p.$id,accountEnabled:p.serviceStatusForAccount,userLimit:p.authLimit,methods:Object.fromEntries(Object.entries(fields).map(([method,f])=>[method,p[f]])),providers:p.oAuthProviders?.map(({key,enabled})=>({key,enabled}))})
 return {
  async inspect(){return safe(await read())},
  async disableOtherMethods(){off(await read());for(const method of Object.keys(fields))await call('PATCH',root+'/auth/'+method,{status:false});const p=await read();off(p);methodsOff(p);return safe(p)},
  async addPlatform(){off(await read());const inventory=await call('GET',root+'/platforms');if(inventory.total!==0||inventory.platforms?.length!==0)fail();const p=await call('POST',root+'/platforms',{type:'web',name:'VERYGOOD AU Account TEST Web',hostname:new URL(target.origin).hostname});if(p.type!=='web'||p.hostname!==new URL(target.origin).hostname||!p.$id)fail();return {platformId:p.$id,hostname:p.hostname,type:p.type}},
  async configureGoogle(credential){
   const c=credential?.web
   if(c?.project_id!=='verygood-au-account-test'||!/^[-\w]+\.apps\.googleusercontent\.com$/.test(c.client_id||'')||typeof c.client_secret!=='string'||!c.client_secret||/[\r\n]/.test(c.client_secret)||c.redirect_uris?.length!==1||c.redirect_uris[0]!==GOOGLE_TEST_CALLBACK||!Array.isArray(c.javascript_origins)||c.javascript_origins.some(v=>v!==target.origin))fail()
   const p=await read();off(p);methodsOff(p)
   await call('PATCH',root+'/oauth2',{provider:'google',appId:c.client_id,secret:c.client_secret,enabled:true})
   const updated=await read();if(updated.oAuthProviders?.find(v=>v.key==='google')?.enabled!==true||updated.oAuthProviders.some(v=>v.key!=='google'&&v.enabled))fail();off(updated);return safe(updated)
  },
  async setUserLimit(){const p=await read();off(p);methodsOff(p);await call('PATCH',root+'/auth/limit',{limit:2});const after=await read();off(after);if(after.authLimit!==2)fail();return safe(after)},
  async enable(proof){
   // Google Testing does not enforce its user list for basic Sign in with Google.
   // This bounded experiment requires separate informed approval, a cap and an armed OFF watchdog.
   if(proof?.httpsVerified!==true||proof.googleProjectId!=='verygood-au-account-test'||proof.googleTesting!==true||proof.testUsers?.length!==1||proof.testUsers[0]!=='nam9295@gmail.com'||proof.limitedWindowApproved!==true||proof.watchdogArmed!==true||!(Date.parse(proof.endsAt)>Date.now()&&Date.parse(proof.endsAt)-Date.now()<=15*60000))fail()
   const p=await read();off(p);methodsOff(p)
   if(p.authLimit!==2)fail()
   if(p.oAuthProviders?.find(v=>v.key==='google')?.enabled!==true||p.oAuthProviders.some(v=>v.key!=='google'&&v.enabled))fail()
   const platforms=await call('GET',root+'/platforms');if(platforms.total!==1||platforms.platforms?.length!==1||platforms.platforms[0].type!=='web'||platforms.platforms[0].hostname!==new URL(target.origin).hostname)fail()
   await call('PATCH',root+'/service',{service:'account',status:true});const after=await read();if(after.serviceStatusForAccount!==true)fail();return safe(after)
  },
  // Fixed OFF request remains possible even when a preceding read/validation fails.
  async stop(){await call('PATCH',root+'/service',{service:'account',status:false});const p=await read();off(p);return safe(p)},
 }
}
