import type {CustomerCheckoutDraft,CustomerProfile} from './customer-account-types'
import {MARKET} from './market'
import {scopedCartSignature,type CartOwner} from './customer-cart-storage'
export type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export const CUSTOMER_DRAFT_PREFIX='verygood-au-customer-checkout-v1:'
const returnPrefix='verygood-au-customer-return-v1:'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const ttl=30*60*1000,maxBytes=65536
const renewalForm=['name','phone','email','date','time','note','promo','privacy']
const legacyForm=['productId','cacaoPercent','cakeSize','chocolateType','poundAddon','chocolateExtra','brownieCreamOption','cupcakeFinish','chocolateIcingCount','vanillaCreamCount','partyDecorationCount','vanillaCakeSheet','vanillaCakeFlavor','vanillaCakePointColor','individualPackaging','pickupDate','pickupTime','quantity','customerName','customerPhone','customerEmail','requestNote','promoCode','privacy','website']
function safeTree(value:unknown,depth=0):boolean {
  if(depth>12)return false
  if(value===null||typeof value==='boolean')return true
  if(typeof value==='string')return value.length<=maxBytes
  if(typeof value==='number')return Number.isFinite(value)
  if(Array.isArray(value))return value.length<=100&&value.every(v=>safeTree(v,depth+1))
  if(typeof value==='object')return Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype','customerUserId','token','jwt','secret'].includes(k)&&safeTree(v,depth+1))
  return false
}
function validReturn(v:{version?:unknown;flowId?:unknown;savedAt?:unknown;returnTo?:unknown},now:number) {
  return v?.version===1&&typeof v.flowId==='string'&&uuid.test(v.flowId)&&typeof v.savedAt==='number'&&Number.isFinite(v.savedAt)&&now>=v.savedAt&&now-v.savedAt<=ttl&&['/account','/cart','/reserve'].includes(String(v.returnTo))
}
function validDraft(d:CustomerCheckoutDraft,now:number) {
  if(!validReturn(d,now)||!['renewal','legacy'].includes(d.kind)||!uuid.test(d.requestId)||!['/cart','/reserve'].includes(d.returnTo)||!d.form||typeof d.form!=='object'||Array.isArray(d.form)||!Array.isArray(d.dirtyFields)||!Array.isArray(d.cartSnapshot)||typeof d.cartSignature!=='string'||!d.checkoutContext||Array.isArray(d.checkoutContext)||typeof d.checkoutContext!=='object'||!safeTree(d))return false
  if(Object.keys(d).some(k=>!['version','kind','cartOwner','flowId','savedAt','returnTo','requestId','form','dirtyFields','checkoutContext','cartSnapshot','cartSignature'].includes(k)))return false
  if(d.cartOwner!==undefined&&d.cartOwner!=='guest'&&!/^user:[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(d.cartOwner))return false
  const allowed=d.kind==='renewal'?renewalForm:legacyForm
  if(Object.entries(d.form).some(([k,v])=>!allowed.includes(k)||!['string','number','boolean'].includes(typeof v))||d.dirtyFields.some(k=>typeof k!=='string'||!allowed.includes(k)))return false
  return Object.keys(d.checkoutContext).every(k=>['initialProductId','initialSelection','initialOrderLines','initialPromoCode','initialRewardPercent','reviewRewardHandoff','cartOrigin'].includes(k))
}
export function saveAccountReturn(storage:DraftStorage,value:{flowId:string;savedAt:number;returnTo:string}):boolean {
  const flow={version:1,flowId:value.flowId,savedAt:value.savedAt,returnTo:value.returnTo}
  try{if(!validReturn(flow,value.savedAt))return false;storage.setItem(returnPrefix+flow.flowId,JSON.stringify(flow));return true}catch{return false}
}
export function readAccountReturn(storage:DraftStorage,flowId:string,now=Date.now()):{returnTo:string}|null {
  try{if(!uuid.test(flowId))return null;const flow=JSON.parse(storage.getItem(returnPrefix+flowId)||'null');return flow?.flowId===flowId&&validReturn(flow,now)?{returnTo:flow.returnTo}:null}catch{return null}
}
export function saveCheckoutDraft(storage:DraftStorage,draft:CustomerCheckoutDraft):{ok:true}|{ok:false} {
  try {
    const text=JSON.stringify(draft)
    if(new TextEncoder().encode(text).length>maxBytes||!validDraft(JSON.parse(text),draft.savedAt))return {ok:false}
    storage.setItem(CUSTOMER_DRAFT_PREFIX+draft.flowId,text)
    if(!saveAccountReturn(storage,draft))throw Error('storage')
    return {ok:true}
  }catch{return {ok:false}}
}
export type CheckoutResume={status:'missing'|'invalid'|'owner-changed'}|{status:'restored'|'cart-changed';draft:CustomerCheckoutDraft}
export function restoreCheckoutDraft(storage:DraftStorage,{flowId,now,cartSignature,cartOwner}:{flowId:string;now:number;cartSignature:string;cartOwner?:CartOwner}):CheckoutResume {
  try {
    if(!uuid.test(flowId))return {status:'invalid'}
    const text=storage.getItem(CUSTOMER_DRAFT_PREFIX+flowId)
    if(text===null)return {status:'missing'}
    if(new TextEncoder().encode(text).length>maxBytes)return {status:'invalid'}
    const draft=JSON.parse(text)
    if(draft.flowId!==flowId||!validDraft(draft,now))return {status:'invalid'}
    if(cartOwner!==undefined&&draft.cartOwner&&draft.cartOwner!=='guest'&&draft.cartOwner!==cartOwner)return {status:'owner-changed'}
    return {status:draft.cartSignature===cartSignature?'restored':'cart-changed',draft}
  } catch{return {status:'invalid'}}
}
export function clearCheckoutDraft(storage:DraftStorage,flowId:string) {if(!uuid.test(flowId))return;try{storage.removeItem(CUSTOMER_DRAFT_PREFIX+flowId);storage.removeItem(returnPrefix+flowId)}catch{/* No navigation or order write on storage failure. */}}
export function checkoutCallbackTarget(storage:DraftStorage,flowId:string,now=Date.now()):string {
  const flow=readAccountReturn(storage,flowId,now)
  if(!flow||flow.returnTo==='/account')return '/account'
  // Callback only validates and routes. The authenticated destination checks the
  // actual cart owner before applying fields, and acknowledges after review.
  const result=restoreCheckoutDraft(storage,{flowId,now,cartSignature:''})
  return 'draft'in result&&result.draft.returnTo===flow.returnTo?`${flow.returnTo}?customerResume=${encodeURIComponent(flowId)}`:'/account'
}
export function fillUntouchedContact<T extends {customerName:string;customerPhone:string;customerEmail:string}>(form:T,dirtyFields:readonly string[],profile:CustomerProfile):T {
  const next={...form}
  for(const [field,key] of [['customerName','name'],['customerPhone','phone'],['customerEmail','contactEmail']] as const)if(!dirtyFields.includes(field)&&!form[field])next[field]=profile[key]
  return next
}
export function checkoutCartSignature(kind:'renewal'|'legacy',owner:CartOwner='guest'):string {
  try{return scopedCartSignature(localStorage,kind,owner)}catch{throw Error('AUTH_DRAFT_UNAVAILABLE')}
}
export function readCheckoutResume(kind:'renewal'|'legacy',owner:CartOwner='guest'):CheckoutResume {
  if(typeof window==='undefined'||MARKET!=='AU')return {status:'missing'}
  try {
    const flowId=new URL(window.location.href).searchParams.get('customerResume')
    if(!flowId)return {status:'missing'}
    const result=restoreCheckoutDraft(sessionStorage,{flowId,now:Date.now(),cartSignature:checkoutCartSignature(kind,owner),cartOwner:owner})
    return 'draft'in result&&result.draft.kind!==kind?{status:'invalid'}:result
  }catch{return {status:'invalid'}}
}
export function acknowledgeCheckoutResume(draft:CustomerCheckoutDraft) {
  try{clearCheckoutDraft(sessionStorage,draft.flowId);const url=new URL(window.location.href);if(url.searchParams.get('customerResume')===draft.flowId){url.searchParams.delete('customerResume');window.history.replaceState(null,'',url.pathname+url.search+url.hash)}}catch{/* The form is already restored; retry acknowledgement on a later mount. */}
}
export function restoreCheckoutForm<T extends Record<string,string|number|boolean>>(defaults:T,draft?:CustomerCheckoutDraft):T {
  const next={...defaults}
  if(draft)for(const k of Object.keys(defaults))if(typeof draft.form[k]===typeof defaults[k])next[k as keyof T]=draft.form[k] as T[keyof T]
  return next
}
