import {createHash} from 'node:crypto'
import {assertCustomerAccountTestTarget,assertCustomerAccountTestCredential,CUSTOMER_ACCOUNT_TEST_KEY_POLICIES} from './customer-account-test-target.mjs'
const fail=()=>{throw Error('CUSTOMER_ACCOUNT_TEST_OWNER_REJECTED')}
const equalSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&a.every(v=>b.includes(v))
// Authenticated official Owner REST, using the user's newly created CLI session only.
// No browser storage/cookie access, API key auth, redirects, update/delete or generic route input.
export function createCustomerAccountTestOwnerManager({target:input,cliSession,expectedEmailSha256,teamId,transport=fetch,clock=()=>new Date(),saveCredential,metadataSmoke,existingMetadata=null}) {
 const target=assertCustomerAccountTestTarget(input)
 if(!cliSession||cliSession.endpoint!==target.endpoint||typeof cliSession.cookie!=='string'||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.selfSigned===true||cliSession.key||!/^[a-f0-9]{64}$/.test(expectedEmailSha256)||!/^[-\w.]{1,36}$/.test(teamId)||typeof saveCredential!=='function'||typeof metadataSmoke!=='function')fail()
 const root=`/projects/${target.projectId}`,created={},attempted=new Set()
 let verified=false,stopped=false,sessionExpire=0
 async function request(method,path,data){
  const allowed=method==='GET'&&['/account','/account/sessions/current',`/teams/${teamId}/memberships`,root,`${root}/keys`,...Object.values(created).map(k=>`${root}/keys/${k.keyId}`)].includes(path)||method==='POST'&&path===`${root}/keys`
  if(!allowed)fail()
  let r
  try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':'console',Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})})}catch{fail()}
  if(!r.ok||r.redirected||r.status>=300&&r.status<400||r.url&&r.url!==target.endpoint+path)fail()
  try{return await r.json()}catch{fail()}
 }
 function verifyKey(value,role,expiresAt,keyId){
  if(!value||value.$id!==keyId||value.name!==`ca-test-${role}-20261017-b2`||Date.parse(value.expire)!==Date.parse(expiresAt)||typeof value.secret!=='string'||!value.secret||/[\r\n]/.test(value.secret)||!equalSet(value.scopes,CUSTOMER_ACCOUNT_TEST_KEY_POLICIES[role].scopes))fail()
  return assertCustomerAccountTestCredential({endpoint:target.endpoint,projectId:target.projectId,keyId:value.$id,consoleVerified:true,verifiedVia:'official-owner-api-cli-session',issuedAt:value.$createdAt,expiresAt:value.expire,scopes:value.scopes,secret:value.secret},role,clock())
 }
 return {
  async verify(){
   if(verified||stopped)fail()
   try{
    const a=await request('GET','/account'),s=await request('GET','/account/sessions/current')
    if(createHash('sha256').update(a.email||'').digest('hex')!==expectedEmailSha256||s.userId!==a.$id||s.current!==true||!Number.isFinite(Date.parse(s.expire))||Date.parse(s.expire)<=+clock())fail()
    sessionExpire=Date.parse(s.expire)
    const members=await request('GET',`/teams/${teamId}/memberships`)
    if(!members.memberships?.some(m=>m.userId===a.$id&&m.confirm===true&&m.roles?.includes('owner')))fail()
    const p=await request('GET',root)
    if(p.$id!==target.projectId||p.teamId!==teamId||p.serviceStatusForAccount!==false)fail()
    const keys=await request('GET',`${root}/keys`)
    if(!Array.isArray(keys.keys))fail()
    if(existingMetadata){
     const credential=verifyKey(existingMetadata,'metadata',existingMetadata.expire,existingMetadata.$id)
     if(keys.total!==1||keys.keys.length!==1||keys.keys[0].$id!==credential.keyId)fail()
     created.metadata={keyId:credential.keyId}
     const scoped=verifyKey(await request('GET',`${root}/keys/${credential.keyId}`),'metadata',credential.expiresAt,credential.keyId)
     if(scoped.secret!==credential.secret)fail()
     await saveCredential('metadata',scoped);await metadataSmoke(scoped)
     created.metadata={...scoped,smokeVerified:true};attempted.add('metadata')
    }else if(keys.total!==0||keys.keys.length!==0)fail()
    verified=true
    return {ownerIdentityMatched:true,ownerRoleVerified:true,sessionExpire:s.expire,projectId:p.$id,accountEnabled:false,keysBefore:keys.total,metadataResumed:!!existingMetadata}
   }catch{stopped=true;fail()}
  },
  async issue(role){
   if(!verified||stopped||+clock()>=sessionExpire||!['metadata','bootstrap','fixtures'].includes(role)||attempted.has(role)||role!=='metadata'&&!created.metadata?.smokeVerified)fail()
   attempted.add(role)
   try{
    const p=await request('GET',root)
    if(p.$id!==target.projectId||p.teamId!==teamId||p.serviceStatusForAccount!==false)fail()
    const expiresAt=new Date(+clock()+CUSTOMER_ACCOUNT_TEST_KEY_POLICIES[role].maxAgeHours*3600000-300000).toISOString()
    const value=await request('POST',`${root}/keys`,{name:`ca-test-${role}-20261017-b2`,scopes:[...CUSTOMER_ACCOUNT_TEST_KEY_POLICIES[role].scopes],expire:expiresAt})
    // Preserve a possibly issued secret privately before validation; never retry uncertain creates.
    await saveCredential(role,{unverified:true,response:value})
    if(!/^[-\w.]{1,36}$/.test(value.$id||''))fail()
    created[role]={keyId:value.$id}
    const first=verifyKey(value,role,expiresAt,value.$id)
    const scoped=await request('GET',`${root}/keys/${value.$id}`)
    const credential=verifyKey(scoped,role,expiresAt,value.$id)
    if(credential.secret!==first.secret)fail()
    await saveCredential(role,credential)
    if(role==='metadata')await metadataSmoke(credential)
    created[role]={...credential,smokeVerified:role==='metadata'}
    const {secret,...safe}=credential;void secret
    return safe
   }catch{stopped=true;fail()}
  },
  credentials(){if(stopped||Object.keys(created).length!==3||!created.metadata?.smokeVerified)fail();return {...created}},
 }
}
// Console Owner admin mode for exactly one synthetic Auth user, never a Console role.
export async function createCustomerAccountTestAdmin({target:input,cliSession,transport=fetch}){
 const target=assertCustomerAccountTestTarget(input)
 if(!cliSession||cliSession.endpoint!==target.endpoint||typeof cliSession.cookie!=='string'||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned===true)fail()
 const id='ca-test-admin-m-20261017',name='CA TEST Admin M'
 async function call(method,path,data){
  let r
  try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId,'X-Appwrite-Mode':'admin',Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})}catch{fail()}
  if(!r.ok||r.redirected||r.url&&r.url!==target.endpoint+path)fail()
  try{return await r.json()}catch{fail()}
 }
 const inventory=await call('GET','/users')
 if(inventory.total!==0||inventory.users?.length!==0)fail()
 const valid=user=>{if(user.$id!==id||user.name!==name||user.email||user.phone||user.passwordUpdate||user.labels?.length)fail();return user}
 valid(await call('POST','/users',{userId:id,name}))
 return valid(await call('GET',`/users/${id}`))
}
