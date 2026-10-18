import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CustomerAccountProvider} from '../../src/CustomerAccountProvider'
import {AccountPage} from '../../src/pages/AccountPage'
import {CustomerAuthCallback} from '../../src/components/CustomerAuthCallback'
import {createCustomerAuth} from '../../src/lib/customer-auth'
import {account} from '../../src/lib/appwrite'
import type {CustomerAuth} from '../../src/lib/customer-auth'
import type {CustomerOrderService} from '../../src/lib/customer-account-types'
import {useCustomerAccount} from '../../src/lib/customer-account-context'
import {assertGoogleOnlyWindow,createGoogleOnlyAuth,checkGoogleOnlySession} from './contract.mjs'
import '../../src/index.css'
import './google-only.css'

// Test-only adapter: no Function/DB request, no cached orders or success assertion.
const orderService:CustomerOrderService={async list(){throw Error('CUSTOMER_ACCOUNT_NOT_READY')},async detail(){throw Error('CUSTOMER_ACCOUNT_NOT_READY')}}
async function readWindow(){
 const response=await fetch('/test-window.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)})
 if(!response.ok)throw Error('AUTH_UNAVAILABLE')
 return assertGoogleOnlyWindow(await response.json(),{origin:location.origin,now:Date.now()})
}
const root=createRoot(document.getElementById('root')!)
function closed(){root.render(<main className="customer-account-page"><h1>Test CLOSED</h1><p>Customer authentication testing is closed.</p></main>)}
const auth:CustomerAuth=createGoogleOnlyAuth({base:createCustomerAuth(),readWindow,storage:sessionStorage,origin:()=>location.origin})
function SessionCheck(){
 const [result,setResult]=useState('')
 async function checkSession(){
  try{
   const evidence=await checkGoogleOnlySession({account,readWindow})
   setResult('signedOut' in evidence?'Signed out — Account/session denied (401)':evidence.user+' — Account and Google session verified')
  }catch{setResult('Session unavailable')}
 }
 return <section className="customer-account-page" aria-label="Session check"><button type="button" onClick={()=>void checkSession()}>Check account and session</button><p role="status">{result}</p></section>
}
export function GoogleOnlyPage(){
 const [language,setLanguage]=useState<'en'|'ko'>('en'),{state}=useCustomerAccount()
 const key=state.status==='authenticated'?state.identity.userId:state.status
 return <>
  <nav className="customer-account-page" aria-label="Test language"><button type="button" onClick={()=>{setLanguage('en');document.documentElement.lang='en'}}>EN</button> <button type="button" onClick={()=>{setLanguage('ko');document.documentElement.lang='ko'}}>한국어</button></nav>
  <AccountPage language={language}/><SessionCheck key={key}/>
 </>
}
async function start(){
 try{
  const windowConfig=await readWindow()
  document.documentElement.lang='en'
  root.render(<CustomerAccountProvider auth={auth} orderService={orderService}>{location.pathname==='/account/auth/callback'?<CustomerAuthCallback/>:<GoogleOnlyPage/>}</CustomerAccountProvider>)
  const deadline=setTimeout(()=>{clearInterval(poll);closed()},Math.max(0,windowConfig.endsAt-Date.now()))
  const poll=setInterval(()=>{void readWindow().catch(()=>{clearInterval(poll);clearTimeout(deadline);closed()})},2000)
 }catch{closed()}
}
void start()
