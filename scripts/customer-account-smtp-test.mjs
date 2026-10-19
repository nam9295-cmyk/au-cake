import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import suppliedManifest from '../docs/customer-account-b4-smtp-manifest.json' with {type:'json'}
import {assertCustomerAccountTestTarget} from './customer-account-test-target.mjs'

const manifest=structuredClone(suppliedManifest)
const reject=()=>{throw Error('CUSTOMER_ACCOUNT_SMTP_TEST_REJECTED')}
const methods=['authEmailPassword','authPhone','authUsersAuthMagicURL','authEmailOtp','authAnonymous','authInvites','authJWT']
const email=s=>typeof s==='string'&&/^[^\s<>@,;]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)
const fingerprint=p=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(p).filter(k=>/^(auth|serviceStatusFor|oAuthProviders|teamId|\$id$)/.test(k)).sort().map(k=>[k,p[k]])))).digest('hex')
function paused(p){
 if(p.serviceStatusForAccount!==false||p.authLimit!==2||methods.some(k=>p[k]!==false)||!Array.isArray(p.oAuthProviders)||p.oAuthProviders.find(x=>x.key==='google')?.enabled!==true||p.oAuthProviders.some(x=>x.key!=='google'&&x.enabled))reject()
}
export function assertNewSmtpDnsRecord(record,inventory){
 const expected=manifest.dnsRecords.find(r=>isDeepStrictEqual(r,record))
 if(!expected||inventory?.complete!==true||!Array.isArray(inventory.records)||inventory.records.some(r=>typeof r.name!=='string'||r.name.toLowerCase().replace(/\.$/,'')===record.name))reject()
 return Object.freeze({...expected})
}
// Scope/domain provenance is an operator attestation from the official Resend UI.
// It is not cryptographic introspection of a sending-only key. Never probe with an operating key.
export function createSmtpTestManager({target:input,cliSession,credential,domain,approvedRecipient,claim,transport=fetch}){
 const target=assertCustomerAccountTestTarget({...input,resources:{databaseIds:[],functionIds:[]}})
 if(!cliSession||cliSession.endpoint!==target.endpoint||typeof cliSession.cookie!=='string'||!cliSession.cookie||/[\r\n]/.test(cliSession.cookie)||cliSession.key||cliSession.selfSigned===true)reject()
 if(credential?.consoleVerified!==true||credential.permission!=='sending_access'||credential.domainId!==manifest.domainId||!/^[-\w]{1,64}$/.test(credential.keyId||'')||!/^re_[A-Za-z0-9_-]{20,}$/.test(credential.secret||''))reject()
 if(domain?.id!==manifest.domainId||domain.name!=='auth-test.verygood-chocolate.com'||domain.status!=='verified'||!email(approvedRecipient)||typeof claim!=='function')reject()
 const root='/projects/'+target.projectId,config={...manifest.smtp,password:credential.secret}
 if(config.host!=='smtp.resend.com'||config.port!==465||config.secure!=='ssl'||config.username!=='resend'||config.senderEmail!=='customer-test@auth-test.verygood-chocolate.com'||config.replyTo!==config.senderEmail||config.enabled!==true)reject()
 let configureAttempted=false,sendAttempted=false,protectedSnapshot=null
 async function call(method,path,body){
  if(!(method==='GET'&&path===root||method==='PATCH'&&path===root+'/smtp'||method==='POST'&&path===root+'/smtp/tests'))reject()
  let r;try{r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{'X-Appwrite-Project':'console',Cookie:cliSession.cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}catch{throw Error('CUSTOMER_ACCOUNT_SMTP_TEST_STOPPED')}
  if(!r.ok||r.redirected||r.url&&r.url!==target.endpoint+path)throw Error('CUSTOMER_ACCOUNT_SMTP_TEST_STOPPED')
  if(method==='POST'){if(r.status!==204)reject();return null}
  try{return await r.json()}catch{throw Error('CUSTOMER_ACCOUNT_SMTP_TEST_STOPPED')}
 }
 async function read(){const p=await call('GET',root);if(p.$id!==target.projectId||p.teamId!=='69bf44eb000f319a38a2')reject();const f=fingerprint(p);if(protectedSnapshot&&f!==protectedSnapshot)reject();protectedSnapshot=f;return p}
 const smtp=p=>Object.fromEntries(Object.keys(manifest.smtp).map(k=>[k,p['smtp'+k[0].toUpperCase()+k.slice(1)]]))
 const safe=p=>({projectId:p.$id,accountEnabled:p.serviceStatusForAccount,smtp:smtp(p),passwordPresent:typeof p.smtpPassword==='string'&&p.smtpPassword.length>0,protectedFingerprint:fingerprint(p)})
 function configured(p){paused(p);if(!isDeepStrictEqual(smtp(p),manifest.smtp)||p.smtpPassword!==credential.secret)reject()}
 return {
  async inspect(){return safe(await read())},
  async configure(){
   if(configureAttempted)reject();configureAttempted=true
   const before=await read();paused(before);if(before.smtpEnabled!==false)reject()
   await call('PATCH',root+'/smtp',config)
   const after=await read();configured(after);return safe(after)
  },
  async sendTest({recipient,sampleApproved}={}){
   if(sendAttempted||sampleApproved!==true||recipient!==approvedRecipient)reject();sendAttempted=true
   configured(await read())
   // Exclusive durable claim must be committed before the only POST. A timeout is unknown;
   // neither this instance nor another process may retry the test message.
   try{if(await claim()!==true)reject()}catch{throw Error('CUSTOMER_ACCOUNT_SMTP_TEST_ALREADY_CLAIMED')}
   const body={...config};delete body.enabled
   await call('POST',root+'/smtp/tests',{emails:[approvedRecipient],...body})
   return {accepted:true,recipientCount:1}
  },
 }
}
