import {useEffect,useRef} from 'react'
import {checkoutCallbackTarget} from '../lib/customer-checkout-draft'
import {publishCustomerAuthStorageNotice} from '../lib/customer-account-config'
// This component intentionally does not call Account, including when flags changed during OAuth.
export function CustomerAuthCallback() {
  const handled=useRef(false)
  useEffect(()=>{
    if(handled.current)return
    handled.current=true
    const url=new URL(window.location.href),flowId=url.searchParams.get('flowId')||''
    window.history.replaceState(null,'',url.pathname)
    let target='/account'
    try {
      target=checkoutCallbackTarget(sessionStorage,flowId)
    }catch{/* Keep the callback free of provider errors, emails and credentials. */}
    publishCustomerAuthStorageNotice()
    window.location.replace(target)
  },[])
  return <main className="customer-account-page" role="status">Returning to your order… / 주문 화면으로 돌아가는 중…</main>
}
