import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore,type PropsWithChildren} from 'react'
import {marketConfig} from './lib/market'
import {getCartTotalQuantity,type CartLine} from './lib/cart'
import type {CakeDetailSelection} from './lib/cake-detail'
import type {RenewalSelection} from '../appwrite-functions/reservation-api/src/au-renewal.js'
import {useCustomerAccount} from './lib/customer-account-context'
import {CUSTOMER_AUTH_CHANGED_EVENT,CUSTOMER_AUTH_NOTICE_KEY} from './lib/customer-account-config'
import {CART_EVENT_PREFIX,createCustomerCartStore,customerCartOwner,type CartOwner,type CartAction,type CartStorage} from './lib/customer-cart-storage'

type CartContextValue={
 owner:CartOwner|null;checkoutOwner:CartOwner;ready:boolean;isCurrent:()=>boolean;canImportGuest:boolean;importGuest:()=>void;storageError:boolean;changedInAnotherTab:boolean
 mochiReselectionRequired:boolean;acknowledgeMochiReselection:()=>void
 replaceRenewal:(id:string,lines:RenewalSelection[])=>void;renewalLines:readonly RenewalSelection[]
 addRenewal:(lines:RenewalSelection[])=>void;removeRenewal:(id:string)=>void;updateRenewal:(id:string,quantity:number)=>void
 removeRenewalSubmitted:(lines:readonly RenewalSelection[])=>void;clearRenewal:()=>void
 lines:readonly CartLine[];itemCount:number;add:(selection:CakeDetailSelection)=>void
 update:(lineKey:string,quantity:number)=>void;remove:(lineKey:string)=>void;removeSubmitted:(lines:readonly CartLine[])=>void;clear:()=>void
}
const CartContext=createContext<CartContextValue|null>(null)
function getBrowserStorage():CartStorage {
 if(typeof window!=='undefined')try{return window.localStorage}catch{/* use a separate in-memory cart per owner for this page */}
 const data=new Map<string,string>()
 return {get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v)}}
}
export function CartProvider({children}:PropsWithChildren){
 const customer=useCustomerAccount(),owner=customerCartOwner(customer.state,customer.enabled)
 const [store]=useState(()=>createCustomerCartStore({storage:getBrowserStorage(),owner,authFence:customer.enabled}))
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot)
 useLayoutEffect(()=>{store.selectOwner(owner,customer.enabled)},[store,owner,customer.enabled,customer.state])
 useEffect(()=>{
  const changed=()=>{if(customer.enabled)store.suspend()}
  const stored=(event:StorageEvent)=>{if(event.key===CUSTOMER_AUTH_NOTICE_KEY)changed();else if(event.key===null||event.key.startsWith(CART_EVENT_PREFIX)||event.key.startsWith('verygood-au-'))store.refresh()}
  window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.addEventListener('storage',stored)
  return ()=>{window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.removeEventListener('storage',stored)}
 },[store,customer.enabled])
 const ready=owner!==null&&snapshot.owner===owner&&snapshot.ready
 const ticket=useMemo(()=>({notice:store.ticket().notice,owner:snapshot.owner,epoch:snapshot.epoch}),[store,snapshot.epoch,snapshot.owner])
 const commit=useCallback((action:CartAction)=>{if(ready&&ticket.owner===owner)store.mutate(ticket,action)},[ready,ticket,owner,store])
 const isCurrent=useCallback(()=>ready&&ticket.owner===owner&&store.isCurrent(ticket),[ready,ticket,owner,store])
 const checkoutOwner=customer.state.status==='checking'&&customer.state.previousIdentity?customerCartOwner({status:'authenticated',identity:customer.state.previousIdentity},customer.enabled)||'guest':owner||'guest'
 const lines=useMemo(()=>ready?snapshot.lines:[],[ready,snapshot.lines])
 const renewalLines=useMemo(()=>ready&&marketConfig.market==='AU'?snapshot.renewalLines:[],[ready,snapshot.renewalLines])
 const add=useCallback((selection:CakeDetailSelection)=>commit({type:'legacy-add',selection}),[commit])
 const update=useCallback((key:string,quantity:number)=>commit({type:'legacy-update',key,quantity}),[commit])
 const remove=useCallback((key:string)=>commit({type:'legacy-remove',key}),[commit])
 const removeSubmitted=useCallback((submitted:readonly CartLine[])=>commit({type:'legacy-submitted',lines:submitted}),[commit])
 const clear=useCallback(()=>commit({type:'legacy-clear'}),[commit])
 const addRenewal=useCallback((incoming:RenewalSelection[])=>commit({type:'renewal-add',lines:incoming}),[commit])
 const replaceRenewal=useCallback((id:string,incoming:RenewalSelection[])=>commit({type:'renewal-replace',id,lines:incoming}),[commit])
 const removeRenewal=useCallback((id:string)=>commit({type:'renewal-remove',id}),[commit])
 const updateRenewal=useCallback((id:string,quantity:number)=>commit({type:'renewal-update',id,quantity}),[commit])
 const removeRenewalSubmitted=useCallback((submitted:readonly RenewalSelection[])=>commit({type:'renewal-submitted',lines:submitted}),[commit])
 const clearRenewal=useCallback(()=>commit({type:'renewal-clear'}),[commit])
 const acknowledgeMochiReselection=useCallback(()=>commit({type:'acknowledge-mochi'}),[commit])
 const importGuest=useCallback(()=>commit({type:'import-guest'}),[commit])
 const itemCount=getCartTotalQuantity(lines)+renewalLines.reduce((n,l)=>n+l.quantity,0)
 const value=useMemo<CartContextValue>(()=>({owner:ready?owner:null,checkoutOwner,ready,isCurrent,canImportGuest:ready&&snapshot.canImportGuest,importGuest,storageError:snapshot.storageError,changedInAnotherTab:snapshot.changedInAnotherTab,
  mochiReselectionRequired:ready&&snapshot.mochiReselectionRequired,acknowledgeMochiReselection,replaceRenewal,renewalLines,addRenewal,removeRenewal,updateRenewal,clearRenewal,removeRenewalSubmitted,
  lines,itemCount,add,update,remove,removeSubmitted,clear}),[ready,owner,checkoutOwner,isCurrent,snapshot.canImportGuest,snapshot.storageError,snapshot.changedInAnotherTab,snapshot.mochiReselectionRequired,importGuest,acknowledgeMochiReselection,replaceRenewal,renewalLines,addRenewal,removeRenewal,updateRenewal,clearRenewal,removeRenewalSubmitted,lines,itemCount,add,update,remove,removeSubmitted,clear])
 return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useCart(){const context=useContext(CartContext);if(!context)throw Error('useCart must be used within CartProvider');return context}
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalCart(){return useContext(CartContext)}
