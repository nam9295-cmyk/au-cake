import {functions,account} from '../../src/lib/appwrite'
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
await windowState()
setInterval(()=>{void windowState().then(s=>{status.textContent=s.enabled&&s.endsAt!==null&&Date.now()<s.endsAt?'B7 test window — synthetic data only':'B7 test only — closed. No payment or email.';if(!s.enabled||s.endsAt===null||Date.now()>=s.endsAt)clearSecret()})},5000)
await import('../../src/main.tsx')
