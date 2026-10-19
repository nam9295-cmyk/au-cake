import {useState} from 'react'
import {useCart} from '../CartProvider'
import {useCustomerAccount} from '../lib/customer-account-context'
import {hasDeclinedGuestImport,declineGuestImport,type CartOwner} from '../lib/customer-cart-storage'
function session(){try{return sessionStorage}catch{return undefined}}
function ImportChoice({cart,language}:{cart:ReturnType<typeof useCart>;language:'en'|'ko'}){
 const owner=cart.owner as CartOwner,ko=language==='ko'
 const [declined,setDeclined]=useState(()=>hasDeclinedGuestImport(session(),owner,cart.guestSignature)),[error,setError]=useState('')
 return <>
  {declined?<><p>{ko?'비회원으로 담은 상품은 따로 보관되어 있어요.':'Your guest items are still saved separately.'}</p><button type="button" onClick={()=>setDeclined(false)}>{ko?'담아둔 상품 다시 보기':'Review guest items'}</button></>:<><p>{ko?`로그인 전에 담은 상품 ${cart.guestItemCount}개가 있어요. 이 계정의 장바구니에 추가할까요?`:`You have ${cart.guestItemCount} ${cart.guestItemCount===1?'item':'items'} in your guest bag. Add them to this account?`}</p><div className="customer-cart-actions"><button type="button" onClick={()=>{try{cart.importGuest();setError('')}catch{setError(ko?'상품 수량을 확인한 뒤 다시 가져와 주세요.':'Check the item quantities before importing again.')}}}>{ko?'담은 상품 가져오기':'Import guest bag'}</button><button type="button" onClick={()=>{declineGuestImport(session(),owner,cart.guestSignature);setDeclined(true)}}>{ko?'회원 장바구니만 보기':'Use my account bag'}</button></div></>}
  {error&&<p role="alert">{error}</p>}
 </>
}
export function GuestCartImport({language}:{language:'en'|'ko'}){
 const cart=useCart(),customer=useCustomerAccount(),ko=language==='ko'
 if(!customer.enabled||!cart.ready)return null
 const guest=customer.state.status==='guest'
 if(!guest&&!cart.canImportGuest&&!cart.guestAlreadyImported&&!cart.storageError)return null
 return <div className="customer-checkout-prompt">
  {guest&&<><p>{ko?'로그인하면 다음 주문에 정보를 자동입력할 수 있어요. 비회원으로도 계속 이용할 수 있습니다.':'Sign in to save your details for your next order. You can also continue as a guest.'}</p><button type="button" onClick={customer.openSignIn}>{ko?'로그인':'Sign in'}</button></>}
  {cart.guestAlreadyImported&&<p>{ko?'비회원 상품은 이미 이 계정에 가져온 상태입니다. 회원 장바구니와 비회원 장바구니는 각각 따로 저장됩니다.':'Your guest items were already copied to this account. Your account bag and guest bag are saved separately.'}</p>}
  {cart.canImportGuest&&<ImportChoice key={cart.owner+'\n'+cart.guestSignature} cart={cart} language={language}/>}
  {cart.storageError&&<p role="alert">{ko?'장바구니를 저장하지 못했습니다. 기존 상품은 보존되어 있습니다.':'Your bag could not be saved. Existing items have been kept.'}</p>}
 </div>
}
