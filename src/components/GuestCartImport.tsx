import {useState} from 'react'
import {useCart} from '../CartProvider'
export function GuestCartImport({language}:{language:'en'|'ko'}){
 const cart=useCart(),[error,setError]=useState(''),ko=language==='ko'
 if(!cart.canImportGuest&&!cart.storageError)return null
 return <div className="checkout-account-prompt">
  {cart.canImportGuest&&<><p>{ko?'비회원 장바구니가 별도로 보관되어 있습니다. 가져오기를 선택하면 이 회원 장바구니에 추가됩니다.':'Your guest bag is saved separately. Import it to add its items to this account.'}</p><button type="button" onClick={()=>{try{cart.importGuest();setError('')}catch{setError(ko?'상품 수량을 확인한 뒤 다시 가져와 주세요.':'Check the item quantities before importing again.')}}}>{ko?'비회원 장바구니 가져오기':'Import guest bag'}</button></>}
  {(error||cart.storageError)&&<p role="alert">{error||(ko?'장바구니를 저장하지 못했습니다. 기존 상품은 보존되어 있습니다.':'Your bag could not be saved. Existing items have been kept.')}</p>}
 </div>
}
