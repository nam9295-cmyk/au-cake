import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CartProvider,useCart} from '../../src/CartProvider'
import {CustomerAccountProvider} from '../../src/CustomerAccountProvider'
import {createCustomerAuth,type CustomerAuth} from '../../src/lib/customer-auth'
import {useCustomerAccount} from '../../src/lib/customer-account-context'
import {AuLanguageContext} from '../../src/lib/au-language'
import {AuRenewalShop} from '../../src/pages/AuRenewalShop'
import {CustomerAuthCallback} from '../../src/components/CustomerAuthCallback'
import type {CustomerOrderService} from '../../src/lib/customer-account-types'
import {assertManualCartMode,createManualCartAuth,createManualCartFetch} from './contract.mjs'
import '../../src/index.css'
import '../../src/styles/au-renewal.css'
import './manual-cart.css'

window.fetch=createManualCartFetch({origin:location.origin,transport:window.fetch.bind(window)})
const root=createRoot(document.getElementById('root')!)
async function readMode(){
 const response=await fetch('/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)})
 if(!response.ok)throw Error('MANUAL_CART_UNAVAILABLE')
 return assertManualCartMode(await response.json(),{origin:location.origin})
}
const auth:CustomerAuth=createManualCartAuth({base:createCustomerAuth(),readMode,origin:()=>location.origin})
const orders:CustomerOrderService={async list(){throw Error('MANUAL_CART_ORDERS_DISABLED')},async detail(){throw Error('MANUAL_CART_ORDERS_DISABLED')}}
export function ManualCartPage(){
 const customer=useCustomerAccount(),cart=useCart(),[language,setLanguage]=useState<'en'|'ko'>('en'),[error,setError]=useState('')
 const path=location.pathname.replace(/\/+$/,'')||'/'
 const signedIn=customer.state.status==='authenticated'
 async function logout(){try{await customer.signOut()}catch{setError('Sign out could not be confirmed. Stop and tell Codex.')}}
 return <AuLanguageContext.Provider value={{language,setLanguage}}>
  <header className="renewal-page manual-cart-nav">
   <p>VERYGOOD AU · Cart test · 주문·결제 불가</p>
   <nav aria-label="Cart test">{signedIn?<a href="/account">ACCOUNT</a>:<button type="button" onClick={customer.openSignIn}>SIGN IN</button>} <a href="/cakes/pave-chocolate-cake">케이크</a> <a href="/chocolates/pave-chocolate">초콜릿</a> <a href="/cart">Bag ({cart.itemCount})</a></nav>
   <p>{signedIn?customer.state.status==='authenticated'&&customer.state.identity.loginEmail:customer.state.status==='checking'?'Checking session…':'Signed out'}</p>
   {signedIn&&<button type="button" onClick={()=>void logout()}>Sign out / 로그아웃</button>}
   <p role="status">{error}</p><p id="manual-cart-connection" role="status"/>
  </header>
  {path==='/account/auth/callback'?<CustomerAuthCallback/>:path==='/account'||path==='/'?<main className="renewal-page"><h1>계정 전환 · 장바구니 테스트</h1>{!signedIn&&<button type="button" onClick={customer.openSignIn}>Continue with Google</button>}<p><a href="/cakes/pave-chocolate-cake">케이크 담기</a> · <a href="/chocolates/pave-chocolate">초콜릿 담기</a> · <a href="/cart">장바구니 보기</a></p></main>:<AuRenewalShop path={path}/>}
 </AuLanguageContext.Provider>
}
async function start(){
 try{
  await readMode()
  root.render(<CustomerAccountProvider auth={auth} orderService={orders}><CartProvider><ManualCartPage/></CartProvider></CustomerAccountProvider>)
  // No expiry or deadline. Explicit CLOSED removes the UI; transient GET failure only warns.
  const poll=setInterval(()=>{void readMode().then(()=>{const e=document.getElementById('manual-cart-connection');if(e)e.textContent=''}).catch(async()=>{
   try{const response=await fetch('/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});const value=await response.json();if(value.enabled===false){clearInterval(poll);root.render(<main><h1>Test CLOSED</h1></main>);return}}catch{/* keep local bag visible; auth gate refuses network failures */}
   const e=document.getElementById('manual-cart-connection');if(e)e.textContent='Connection check unavailable. Tell Codex; your local bag is preserved.'
  })},10000)
 }catch{root.render(<main><h1>Test CLOSED</h1></main>)}
}
void start()
