import {useCustomerAccount} from '../lib/customer-account-context'
import type {Language} from '../lib/i18n'
export function CheckoutAccountPrompt({language,guest,onGuest}:{language:Language;guest:boolean;onGuest:(guest:boolean)=>void}) {
  const customer=useCustomerAccount(),t=(en:string,ko:string)=>language==='ko'?ko:en
  if(!customer.enabled)return null
  return <div className="customer-checkout-prompt">
    {customer.state.status==='authenticated'&&!guest?<><p>{t('Signed in as','로그인 계정:')} {customer.state.identity.loginEmail}</p><button type="button" onClick={()=>onGuest(true)}>{t('Continue as Guest','비회원으로 계속')}</button></>:<><p>{t('Save your details and see your new orders with an optional account.','선택형 계정으로 정보를 저장하고 새 주문을 확인하세요.')}</p><button type="button" onClick={event=>{onGuest(false);customer.openSignIn(event)}}>{t('Sign in','로그인')}</button>{!guest&&<button type="button" onClick={()=>onGuest(true)}>{t('Continue as Guest','비회원으로 계속')}</button>}</>}
    {customer.state.status==='unavailable'&&<p role="status">{t('Sign in is unavailable. Guest checkout is still available.','로그인할 수 없습니다. 비회원 주문은 계속할 수 있습니다.')}</p>}
  </div>
}
