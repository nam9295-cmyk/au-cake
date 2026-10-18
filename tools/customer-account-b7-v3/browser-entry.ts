import {functions,account} from '../../src/lib/appwrite'
import {ExecutionMethod} from 'appwrite'
import {saveCheckoutDraft} from '../../src/lib/customer-checkout-draft'
import type {CustomerCheckoutDraft} from '../../src/lib/customer-account-types'
import {createB7BrowserTransport} from './browser-transport.mjs'
import './google-only.css'
import {nativeCheckoutWireBody} from './native-checkout.mjs'
declare global { interface Window { __b7Capture?: ()=>CustomerCheckoutDraft } }
type WindowState={enabled:boolean;startsAt:number|null;endsAt:number|null}
const secretName='b7-signing-key',closed:WindowState={enabled:false,startsAt:null,endsAt:null}
let current=closed
function clearSecret(){sessionStorage.removeItem(secretName)}
async function windowState():Promise<WindowState>{
 try {const r=await fetch('/test-window.json',{cache:'no-store',redirect:'error'});if(!r.ok)throw Error();current=await r.json() as WindowState;return current}catch{current=closed;return closed}
}
const execute=functions.createExecution.bind(functions)
functions.createExecution=createB7BrowserTransport({crypto:window.crypto,windowState,readSecret:()=>sessionStorage.getItem(secretName)||'',execute}) as typeof functions.createExecution
account.createEmailToken=async()=>{throw Error('B7_EMAIL_DISABLED')}
account.createSession=async()=>{throw Error('B7_EMAIL_DISABLED')}
const oauth=account.createOAuth2Session.bind(account)
account.createOAuth2Session=((...args:Parameters<typeof oauth>)=>{
 const first:unknown=args[0]
 const provider=first&&typeof first==='object'&&'provider' in first?first.provider:first
 if(provider!=='google')throw Error('B7_GOOGLE_ONLY')
 if(!current.enabled||current.startsAt===null||current.endsAt===null||Date.now()<current.startsAt||Date.now()>=current.endsAt||!sessionStorage.getItem(secretName))throw Error('B7_CLOSED')
 return oauth(...args)
}) as typeof account.createOAuth2Session
const panel=document.createElement('section');panel.id='b7-controls'
const status=document.createElement('p');status.textContent='B7 test only — closed. No payment or email.'
const label=document.createElement('label');label.textContent='Test signing key '
const input=document.createElement('input');input.type='password';input.autocomplete='off';input.setAttribute('aria-label','Test signing key');label.append(input)
const unlock=document.createElement('button');unlock.textContent='Use key in this tab';unlock.type='button'
unlock.onclick=async()=>{await windowState();if(!/^[A-Za-z0-9_-]{43}$/.test(input.value))return;sessionStorage.setItem(secretName,input.value);input.value='';window.dispatchEvent(new Event('focus'))}
const capture=document.createElement('button');capture.textContent='Read native Checkout draft';capture.type='button'
const output=document.createElement('textarea');output.readOnly=true;output.setAttribute('aria-label','Synthetic Checkout draft')
capture.onclick=()=>{try{const draft=window.__b7Capture?.();output.value=draft?JSON.stringify(draft):'No Checkout draft'}catch{output.value='Draft unavailable'}}
const wire=document.createElement('button');wire.textContent='Read native member wire body';wire.type='button'
wire.onclick=()=>{try{output.value=nativeCheckoutWireBody(window.__b7Capture?.())}catch{output.value='Draft unavailable'}}
const reload=document.createElement('button');reload.textContent='Preserve draft and reload';reload.type='button'
reload.onclick=()=>{const draft=window.__b7Capture?.();if(draft&&saveCheckoutDraft(sessionStorage,draft).ok)location.assign(draft.returnTo+'?customerResume='+encodeURIComponent(draft.flowId))}
panel.append(status,label,unlock,capture,wire,reload,output);document.body.prepend(panel)
const approved=document.createElement('textarea');approved.setAttribute('aria-label','Approved B7 request')
const result=document.createElement('textarea');result.readOnly=true;result.setAttribute('aria-label','B7 result')
// Local-only import: file contents never enter the public bundle or an upload API.
const runFile=document.createElement('input');runFile.type='file';runFile.accept='application/json';runFile.setAttribute('aria-label','Protected B7 run file')
const fixture=document.createElement('select');fixture.setAttribute('aria-label','Approved fixture');fixture.disabled=true
let createBodies:string[]=[]
fixture.onchange=()=>{approved.value=createBodies[Number(fixture.value)]||''}
runFile.onchange=async()=>{
 try{
  const file=runFile.files?.[0];if(!file||file.size>150000)throw Error()
  const payload=JSON.parse(await file.text())
  if(Object.keys(payload).sort().join(',')!=='createBodies,key,manifestSha256'||payload.manifestSha256!=='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'||!/^[A-Za-z0-9_-]{43}$/.test(payload.key)||!Array.isArray(payload.createBodies)||payload.createBodies.length!==6)throw Error()
  const ids=new Set<string>()
  for(const text of payload.createBodies){
   if(typeof text!=='string'||text.length>20000)throw Error()
   const body=JSON.parse(text),id=body?.data?.requestId
   if(body?.action!=='create-cake'||typeof id!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id)||ids.has(id))throw Error()
   ids.add(id)
  }
  createBodies=payload.createBodies;input.value=payload.key
  fixture.replaceChildren(...['G cake','G chocolate','H cake','H chocolate','Guest cake','Guest chocolate'].map((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=name;return option}))
  fixture.disabled=false;approved.value=createBodies[0];result.value='Protected run file loaded'
 }catch{clearSecret();input.value='';approved.value='';createBodies=[];fixture.replaceChildren();fixture.disabled=true;result.value='B7_RUN_FILE_REJECTED'}finally{runFile.value=''}
}
const identify=document.createElement('button');identify.type='button';identify.textContent='Read test identity'
identify.onclick=async()=>{try{const user=await account.get();result.value=JSON.stringify({userId:user.$id,status:user.status})}catch{result.value=JSON.stringify({signedOut:true})}}
const send=document.createElement('button');send.type='button';send.textContent='Execute approved request'
send.onclick=async()=>{
 if(send.disabled)return;send.disabled=true;result.value=''
 try{
  const text=approved.value,body=JSON.parse(text)
  if(text.length>20000||!['health','renewal-health','customer-account-health','create-cake','lookup-cake','customer-orders','customer-order'].includes(body?.action))throw Error()
  const response=await functions.createExecution({functionId:'ca-test-reservation-api',body:text,async:false,xpath:'/',method:ExecutionMethod.POST,headers:{}})
  result.value=JSON.stringify({status:response.responseStatusCode,response:JSON.parse(response.responseBody)})
 }catch{result.value=JSON.stringify({error:'B7_TEST_REQUEST_FAILED'})}finally{send.disabled=false}
}
panel.append(runFile,fixture,approved,send,identify,result)
await windowState()
setInterval(()=>{void windowState().then(s=>{status.textContent=s.enabled&&s.endsAt!==null&&Date.now()<s.endsAt?'B7 test window — synthetic data only':'B7 test only — closed. No payment or email.';if(!s.enabled||s.endsAt===null||Date.now()>=s.endsAt)clearSecret()})},5000)
await import('../../src/main.tsx')
