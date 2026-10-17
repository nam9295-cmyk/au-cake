import {useEffect,useRef} from 'react'
import {readAccountReturn,restoreCheckoutDraft,checkoutCartSignature} from '../lib/customer-checkout-draft'
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
      const flow=readAccountReturn(sessionStorage,flowId)
      if(flow?.returnTo==='/account')target='/account'
      else if(flow) {
        // Validate without consuming. Checkout acknowledges only after applying its fields.
        const first=restoreCheckoutDraft(sessionStorage,{flowId,now:Date.now(),cartSignature:checkoutCartSignature('renewal')})
        if('draft'in first)target=`${flow.returnTo}?customerResume=${encodeURIComponent(flowId)}`
      }
    }catch{/* Keep the callback free of provider errors, emails and credentials. */}
    window.location.replace(target)
  },[])
  return <main className="customer-account-page" role="status">Returning to your order… / 주문 화면으로 돌아가는 중…</main>
}
