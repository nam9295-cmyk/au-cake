import {GOOGLE_ONLY_PLAN_SHA256,GOOGLE_ONLY_USERS,assertGoogleOnlyWindow} from '../tools/customer-account-google-only/contract.mjs'
import {semanticSettingsEvidence} from './customer-account-settings-fingerprint.mjs'
import {createHash} from 'node:crypto'
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

// Separate Google-only contract. No Function/DB/user/key/limit/auth-method writes.
export function createGoogleOnlyTestManager({target:input,cliSession,transport=fetch,clock=Date.now,expectedBaseline}){
 const target=assertGoogleTestTarget(input),root='/projects/'+target.projectId,functionRoot='/functions/ca-test-reservation-api',known=['ca-test-admin-m-20261017',...Object.values(GOOGLE_ONLY_USERS).map(u=>u.id)]
 if(cliSession?.endpoint!==target.endpoint||typeof cliSession.cookie!=='string'||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned===true)fail()
 let baseline=expectedBaseline?structuredClone(expectedBaseline):null,openAttempted=false
 const baselineSessions=new Set()
 if(baseline)for(const group of Object.values(baseline.sessions))for(const s of group)baselineSessions.add(s.id)
 function proofValid(proof,allowEnded=false){
  if(proof?.kind!=='GOOGLE_ONLY'||proof.startAuthorized!==true||proof.planSha256!==GOOGLE_ONLY_PLAN_SHA256)fail()
  assertGoogleOnlyWindow(proof.window,{origin:target.origin,now:allowEnded?proof.window?.startsAt:clock()})
 }
 async function call(method,path,data,consoleMode=false){
  const read=method==='GET'&&([root,root+'/platforms','/users',functionRoot,functionRoot+'/executions',functionRoot+'/variables',...known.map(id=>'/users/'+id+'/sessions')].includes(path))
  const write=method==='PATCH'&&path===root+'/service'&&data?.service==='account'&&typeof data.status==='boolean'||method==='DELETE'&&Object.values(GOOGLE_ONLY_USERS).some(u=>path.startsWith('/users/'+u.id+'/sessions/'))&&/^[-\w.]{1,36}$/.test(path.split('/').at(-1))
  if(!read&&!write)fail()
  try{
   const response=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(4500),headers:{'X-Appwrite-Project':consoleMode?'console':target.projectId,...(consoleMode?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})
   if(!response.ok||response.redirected||response.url&&response.url!==target.endpoint+path)fail()
   return response.status===204?null:await response.json()
  }catch{fail()}
 }
 async function inspect(){
  const [p,platforms,users,f,variables,executions,...sessions]=await Promise.all([call('GET',root,null,true),call('GET',root+'/platforms',null,true),call('GET','/users'),call('GET',functionRoot),call('GET',functionRoot+'/variables'),call('GET',functionRoot+'/executions'),...known.map(id=>call('GET','/users/'+id+'/sessions'))])
  if(p.$id!==target.projectId||p.teamId!=='69bf44eb000f319a38a2'||p.authLimit!==2||Object.values(fields).some(key=>p[key]!==false)||p.authSessionAlerts!==false||p.oAuthProviders?.find(x=>x.key==='google')?.enabled!==true||p.oAuthProviders.some(x=>x.key!=='google'&&x.enabled)||platforms.total!==1||platforms.platforms?.length!==1||platforms.platforms[0].hostname!==new URL(target.origin).hostname||platforms.platforms[0].type!=='web')fail()
  if(users.total!==3||users.users?.length!==3||JSON.stringify(users.users.map(u=>u.$id).sort())!==JSON.stringify([...known].sort())||users.users.some(u=>u.status!==true))fail()
  if(f.$id!=='ca-test-reservation-api'||f.enabled!==false||f.execute?.length!==0||f.deploymentId!=='6ad41e576cb7a8f346af'||f.runtime!=='node-22'||f.events?.length!==0||f.schedule!=='')fail()
  if(variables.total!==30||variables.variables?.length!==30||new Set(variables.variables.map(v=>v.key)).size!==30||['CUSTOMER_ACCOUNT_ENABLED','AU_RENEWAL_WRITES_ENABLED','AU_RENEWAL_PREORDERS_ENABLED'].some(key=>variables.variables?.find(v=>v.key===key)?.value!=='false'))fail()
  if(!Number.isInteger(executions.total)||!Array.isArray(executions.executions)||executions.total<0||sessions.some(s=>!Number.isInteger(s.total)||!Array.isArray(s.sessions)||s.total!==s.sessions.length))fail()
  const safeSessions=Object.fromEntries(known.map((id,i)=>[id,sessions[i].sessions.map(s=>({id:s.$id,userId:s.userId,provider:s.provider,createdAt:s.$createdAt,expire:s.expire}))]))
  const protectedProject=Object.fromEntries(Object.entries(p).filter(([key])=>key!=='serviceStatusForAccount'))
  const variableFingerprint=createHash('sha256').update(JSON.stringify(variables.variables.map(v=>({id:v.$id,key:v.key,value:v.value,secret:v.secret})).sort((a,b)=>a.key.localeCompare(b.key)))).digest('hex')
  const result={accountEnabled:p.serviceStatusForAccount,projectFingerprint:semanticSettingsEvidence(protectedProject).sha256,variableFingerprint,functionClosed:true,executionTotal:executions.total,executionIds:executions.executions.map(x=>x.$id).sort(),sessions:safeSessions}
  if(!baseline){baseline=structuredClone(result);for(const group of Object.values(safeSessions))for(const s of group)baselineSessions.add(s.id)}
  else if(result.executionTotal!==baseline.executionTotal||JSON.stringify(result.executionIds)!==JSON.stringify(baseline.executionIds)||result.projectFingerprint!==baseline.projectFingerprint||result.variableFingerprint!==baseline.variableFingerprint)fail()
  return result
 }
 return {
  inspect,
  async enable(proof){
   proofValid(proof)
   if(openAttempted||proof.httpsVerified!==true||proof.watchdogVerified!==true||proof.pagesUsed!==8||proof.closedReserved!==true)fail()
   const state=await inspect();if(state.accountEnabled!==false||Object.values(state.sessions).some(x=>x.length!==0))fail()
   openAttempted=true
   await call('PATCH',root+'/service',{service:'account',status:true},true)
   const after=await inspect();if(after.accountEnabled!==true)fail();return after
  },
  async stop(){
   // Do not make an initial successful read a prerequisite for the OFF request.
   await call('PATCH',root+'/service',{service:'account',status:false},true)
   const p=await call('GET',root,null,true);if(p.$id!==target.projectId||p.serviceStatusForAccount!==false)fail()
   return {accountEnabled:false}
  },
  async cleanupSession({userId,sessionId,intentAt,proof}){
   proofValid(proof,true)
   if(!baseline||!Object.values(GOOGLE_ONLY_USERS).some(u=>u.id===userId)||baselineSessions.has(sessionId)||!Number.isSafeInteger(intentAt)||intentAt<proof.window.startsAt||intentAt>=proof.window.endsAt)fail()
   const list=await call('GET','/users/'+userId+'/sessions'),s=list.sessions?.find(x=>x.$id===sessionId),created=Date.parse(s?.$createdAt)
   if(!s||s.userId!==userId||s.provider!=='google'||!Number.isFinite(created)||created<intentAt||created>proof.window.endsAt||created>clock())fail()
   await call('DELETE','/users/'+userId+'/sessions/'+sessionId)
   return {removed:true}
  },
 }
}
