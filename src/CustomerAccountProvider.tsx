import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {appwriteConfig} from './lib/appwrite'
import {createCustomerAuth,type CustomerAuth} from './lib/customer-auth'
import {CustomerAccountContext,disabledCustomerAccount} from './lib/customer-account-context'
import {CUSTOMER_AUTH_CHANGED_EVENT} from './lib/customer-account-config'
import {getCustomerAccountHealth} from './lib/customer-orders'
import type {CustomerAccountHealth,CustomerAuthState,CustomerProfile,CustomerCheckoutDraft} from './lib/customer-account-types'
import {saveCheckoutDraft,saveAccountReturn} from './lib/customer-checkout-draft'
import {CustomerSignInDialog} from './components/CustomerSignInDialog'
import type {Language} from './lib/i18n'
const defaultAuth=createCustomerAuth()
const authNoticeKey='verygood-au-auth-notice'
function bounded<T>(promise:Promise<T>):Promise<T> {
  let timer:ReturnType<typeof setTimeout>
  return Promise.race([promise,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_UNAVAILABLE')),10000)})]).finally(()=>clearTimeout(timer))
}
export function CustomerAccountProvider({children,enabled=appwriteConfig.customerAccountEnabled,auth=defaultAuth,health=getCustomerAccountHealth}:{children:ReactNode;enabled?:boolean;auth?:CustomerAuth;health?:()=>Promise<CustomerAccountHealth>}) {
  const [state,setState]=useState<CustomerAuthState>({status:enabled?'checking':'guest'}),[ready,setReady]=useState(false),[open,setOpen]=useState(false),[language,setLanguage]=useState<Language>('en'),[openingIntent,setOpeningIntent]=useState(0)
  const active=useRef(false),epoch=useRef(0),intent=useRef(0),identityUser=useRef<string|null>(null)
  const checkout=useRef<(()=>CustomerCheckoutDraft)|null>(null)
  const checkoutGuest=useRef<(()=>void)|undefined>(undefined)
  const registerCheckout=useCallback((capture:()=>CustomerCheckoutDraft,onGuest?:()=>void)=>{checkout.current=capture;checkoutGuest.current=onGuest;return ()=>{if(checkout.current===capture){checkout.current=null;checkoutGuest.current=undefined}}},[])
  const startGoogle=useCallback(async()=>{
    const draft=checkout.current?.()
    const flowId=draft?.flowId||crypto.randomUUID()
    let saved=false
    try{saved=draft?saveCheckoutDraft(sessionStorage,draft).ok:saveAccountReturn(sessionStorage,{flowId,savedAt:Date.now(),returnTo:'/account'})}catch{/* No leave without a recoverable flow. */}
    if(!saved)throw Error('AUTH_DRAFT_UNAVAILABLE')
    await auth.startGoogle({flowId})
  },[auth])
  const refresh=useCallback(async()=>{
    if(!enabled)return
    const generation=++epoch.current
    setState({status:'checking'})
    try {
      const status=await bounded(health())
      if(!active.current||epoch.current!==generation)return
      setReady(status.enabled&&status.ready)
      if(!status.enabled||!status.ready){setState({status:'unavailable'});return}
      const identity=await bounded(auth.restore())
      if(active.current&&epoch.current===generation){
        const nextUser=identity?.userId??null
        if(identityUser.current!==nextUser){intent.current++;identityUser.current=nextUser}
        setState(identity?{status:'authenticated',identity}:{status:'guest'})
      }
    } catch {if(active.current&&epoch.current===generation){setReady(false);setState({status:'unavailable'})}}
  },[enabled,auth,health])
  useEffect(()=>{
    active.current=true
    if(!enabled)return ()=>{active.current=false}
    let disposed=false
    const restoreEpoch=epoch,authIntent=intent
    queueMicrotask(()=>{if(!disposed)void refresh()})
    const changed=()=>{intent.current++;void refresh()}
    const focused=()=>void refresh()
    const stored=(event:StorageEvent)=>{if(event.key===authNoticeKey)changed()}
    window.addEventListener('focus',focused);window.addEventListener('pageshow',focused);window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.addEventListener('storage',stored)
    return ()=>{disposed=true;active.current=false;restoreEpoch.current++;authIntent.current++;window.removeEventListener('focus',focused);window.removeEventListener('pageshow',focused);window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.removeEventListener('storage',stored)}
  },[enabled,refresh])
  const notify=useCallback(()=>{
    window.dispatchEvent(new Event(CUSTOMER_AUTH_CHANGED_EVENT))
    try{localStorage.setItem(authNoticeKey,crypto.randomUUID())}catch{/* Focus refresh covers storage-restricted browsers. */}
  },[])
  const signOut=useCallback(async()=>{
    intent.current++;epoch.current++;identityUser.current=null;setOpen(false);setState({status:'guest'})
    try{await auth.signOut();if(active.current)notify()}
    catch(error){if(active.current)setState({status:'unavailable'});throw error}
  },[auth,notify])
  const saveProfile=useCallback(async(profile:CustomerProfile)=>{
    const generation=intent.current,identity=await auth.saveProfile(profile)
    if(!active.current||generation!==intent.current)throw Error('AUTH_CANCELLED')
    epoch.current++;setState({status:'authenticated',identity});return identity
  },[auth])
  const value=useMemo(()=>enabled?{enabled:true,ready,state,openSignIn(){
    const lang=document.documentElement.lang
    setLanguage(lang==='ko'?'ko':'en');setOpeningIntent(intent.current);setOpen(true)
    if(!ready)void refresh()
  },refresh,saveProfile,signOut,registerCheckout}:disabledCustomerAccount,[enabled,ready,state,refresh,saveProfile,signOut,registerCheckout])
  return <CustomerAccountContext.Provider value={value}>{children}{enabled&&open&&<CustomerSignInDialog auth={auth} language={language} available={ready} onClose={()=>setOpen(false)} onGuest={()=>checkoutGuest.current?.()} onAuthenticated={identity=>{
    if(active.current&&openingIntent===intent.current){epoch.current++;identityUser.current=identity.userId;setState({status:'authenticated',identity});setOpen(false);notify()}
  }} onGoogle={startGoogle}/>}</CustomerAccountContext.Provider>
}
