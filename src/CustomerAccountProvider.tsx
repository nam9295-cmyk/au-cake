import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {appwriteConfig} from './lib/appwrite'
import {createCustomerAuth,type CustomerAuth} from './lib/customer-auth'
import {CustomerAccountContext,disabledCustomerAccount} from './lib/customer-account-context'
import {CUSTOMER_AUTH_CHANGED_EVENT,CUSTOMER_AUTH_NOTICE_KEY,publishCustomerAuthChange,publishCustomerAuthStorageNotice} from './lib/customer-account-config'
import {getCustomerOrders,getCustomerOrder} from './lib/customer-orders'
import type {CustomerAuthState,CustomerProfile,CustomerCheckoutDraft,CustomerOrdersStatus,CustomerOrderService} from './lib/customer-account-types'
import {saveCustomerSignInReturn} from './lib/customer-checkout-draft'
import {CustomerSignInDialog} from './components/CustomerSignInDialog'
import type {Language} from './lib/i18n'
const defaultAuth=createCustomerAuth()
const defaultOrderService:CustomerOrderService={list:getCustomerOrders,detail:getCustomerOrder}
const authNoticeKey=CUSTOMER_AUTH_NOTICE_KEY
function bounded<T>(promise:Promise<T>,code='AUTH_UNAVAILABLE'):Promise<T> {
  let timer:ReturnType<typeof setTimeout>
  return Promise.race([promise,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error(code)),10000)})]).finally(()=>clearTimeout(timer))
}
export function CustomerAccountProvider({children,enabled=appwriteConfig.customerAccountEnabled,auth=defaultAuth,orderService=defaultOrderService}:{children:ReactNode;enabled?:boolean;auth?:CustomerAuth;orderService?:CustomerOrderService}) {
  const [state,setState]=useState<CustomerAuthState>({status:enabled?'checking':'guest'}),[ordersStatus,setOrdersStatus]=useState<CustomerOrdersStatus>('idle'),[open,setOpen]=useState(false),[language,setLanguage]=useState<Language>('en'),[openingIntent,setOpeningIntent]=useState(0)
  const active=useRef(false),epoch=useRef(0),intent=useRef(0),identityUser=useRef<string|null>(null),authChecking=useRef(true),ordersEpoch=useRef(0)
  const checkout=useRef<(()=>CustomerCheckoutDraft)|null>(null)
  const checkoutGuest=useRef<(()=>void)|undefined>(undefined)
  const registerCheckout=useCallback((capture:()=>CustomerCheckoutDraft,onGuest?:()=>void)=>{checkout.current=capture;checkoutGuest.current=onGuest;return ()=>{if(checkout.current===capture){checkout.current=null;checkoutGuest.current=undefined}}},[])
  const resetOrders=useCallback(()=>{ordersEpoch.current++;setOrdersStatus('idle')},[])
  const startGoogle=useCallback(async()=>{
    const draft=checkout.current?.()
    const flowId=draft?.flowId||crypto.randomUUID()
    let saved=false
    try{saved=saveCustomerSignInReturn(sessionStorage,{flowId,savedAt:Date.now(),pathname:window.location.pathname,draft})}catch{/* No leave without a recoverable flow. */}
    if(!saved)throw Error('AUTH_DRAFT_UNAVAILABLE')
    await auth.startGoogle({flowId})
  },[auth])
  const refresh=useCallback(async()=>{
    if(!enabled)return
    const generation=++epoch.current
    authChecking.current=true
    setState(current=>{
      const previousIdentity=current.status==='authenticated'?current.identity:current.status==='checking'?current.previousIdentity:undefined
      return {status:'checking',...(previousIdentity?{previousIdentity}:{})}
    })
    try {
      const identity=await bounded(auth.restore())
      if(active.current&&epoch.current===generation){
        authChecking.current=false
        const nextUser=identity?.userId??null
        if(identityUser.current!==nextUser){intent.current++;identityUser.current=nextUser;resetOrders();publishCustomerAuthStorageNotice()}
        setState(identity?{status:'authenticated',identity}:{status:'guest'})
      }
    } catch {if(active.current&&epoch.current===generation){authChecking.current=false;intent.current++;identityUser.current=null;resetOrders();setState({status:'unavailable'})}}
  },[enabled,auth,resetOrders])
  useEffect(()=>{
    active.current=true
    if(!enabled)return ()=>{active.current=false}
    let disposed=false
    const restoreEpoch=epoch,authIntent=intent
    queueMicrotask(()=>{if(!disposed)void refresh()})
    // An explicit auth change ends the old session view, even when a UID is reused.
    const changed=()=>{intent.current++;resetOrders();setState({status:'checking'});void refresh()}
    const focused=()=>void refresh()
    const stored=(event:StorageEvent)=>{if(event.key===authNoticeKey)changed()}
    window.addEventListener('focus',focused);window.addEventListener('pageshow',focused);window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.addEventListener('storage',stored)
    return ()=>{disposed=true;active.current=false;restoreEpoch.current++;authIntent.current++;window.removeEventListener('focus',focused);window.removeEventListener('pageshow',focused);window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.removeEventListener('storage',stored)}
  },[enabled,refresh,resetOrders])
  const notify=useCallback(()=>{
    publishCustomerAuthChange()
  },[])
  const invalidateSession=useCallback(()=>{intent.current++;epoch.current++;identityUser.current=null;authChecking.current=false;resetOrders();setOpen(false);setState({status:'unavailable'})},[resetOrders])
  const orderRequest=useCallback(async <T,>(operation:()=>Promise<T>):Promise<T>=>{
    if(!enabled)throw Error('CUSTOMER_ACCOUNT_DISABLED')
    const user=identityUser.current,generation=intent.current,orderGeneration=++ordersEpoch.current
    if(!active.current||!user||authChecking.current)throw Error('CUSTOMER_UNAUTHORIZED')
    const current=()=>active.current&&intent.current===generation&&identityUser.current===user
    setOrdersStatus('checking')
    try {
      // The actual API still checks readiness, JWT, private ACL and order owner.
      const result=await bounded(operation(),'CUSTOMER_ORDERS_UNAVAILABLE')
      if(!current())throw Error('AUTH_CANCELLED')
      if(ordersEpoch.current===orderGeneration)setOrdersStatus('ready')
      return result
    } catch(error) {
      if(current()) {
        if(error instanceof Error&&error.message==='CUSTOMER_UNAUTHORIZED')invalidateSession()
        else if(ordersEpoch.current===orderGeneration)setOrdersStatus(error instanceof Error&&error.message==='CUSTOMER_ORDER_NOT_FOUND'?'ready':'unavailable')
        throw error
      }
    }
    // Discard private diagnostics from a response belonging to an older session.
    throw Error('AUTH_CANCELLED')
  },[enabled,invalidateSession])
  const getOrders=useCallback((options?:{cursor?:string})=>orderRequest(()=>orderService.list(options)),[orderRequest,orderService])
  const getOrder=useCallback((id:string)=>orderRequest(()=>orderService.detail(id)),[orderRequest,orderService])
  const signOut=useCallback(async()=>{
    intent.current++;epoch.current++;identityUser.current=null;authChecking.current=false;resetOrders();setOpen(false);setState({status:'guest'})
    try{await auth.signOut();if(active.current)notify()}
    catch(error){if(active.current)setState({status:'unavailable'});throw error}
  },[auth,notify,resetOrders])
  const saveProfile=useCallback(async(profile:CustomerProfile)=>{
    const expectedUserId=identityUser.current
    if(!expectedUserId)throw Error('AUTH_SESSION_CHANGED')
    const generation=intent.current,refreshGeneration=epoch.current,identity=await auth.saveProfile(profile,expectedUserId)
    if(!active.current||generation!==intent.current||refreshGeneration!==epoch.current||identity.userId!==expectedUserId)throw Error('AUTH_CANCELLED')
    epoch.current++;setState({status:'authenticated',identity});return identity
  },[auth])
  const authAvailable=state.status==='guest'||state.status==='authenticated'
  const value=useMemo(()=>enabled?{enabled:true,ordersStatus,state,getOrders,getOrder,openSignIn(event?:{currentTarget:HTMLElement}){
    // Safari does not focus mouse-clicked buttons; capture the actual invoker before the dialog opens.
    event?.currentTarget.focus()
    const lang=document.documentElement.lang
    setLanguage(lang==='ko'?'ko':'en');setOpeningIntent(intent.current);setOpen(true)
    if(!authAvailable)void refresh()
  },refresh,saveProfile,signOut,registerCheckout,invalidateSession}:disabledCustomerAccount,[enabled,ordersStatus,state,getOrders,getOrder,authAvailable,refresh,saveProfile,signOut,registerCheckout,invalidateSession])
  return <CustomerAccountContext.Provider value={value}>{children}{enabled&&open&&<CustomerSignInDialog auth={auth} language={language} available={authAvailable} onClose={()=>setOpen(false)} onGuest={()=>checkoutGuest.current?.()} onAuthenticated={identity=>{
    if(active.current&&openingIntent===intent.current){epoch.current++;authChecking.current=false;identityUser.current=identity.userId;resetOrders();setState({status:'authenticated',identity});setOpen(false);notify()}
  }} onGoogle={startGoogle}/>}</CustomerAccountContext.Provider>
}
