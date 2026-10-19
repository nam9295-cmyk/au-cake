import {CART_STORAGE_KEY,addCartLine,parseCartLines,serializeCartLines,removeCartLine,updateCartLineQuantity,subtractSubmittedCartLines,type CartLine,type StorageLike} from './cart'
import {RENEWAL_CART_KEY,MOCHI_RESELECTION_KEY,inspectRenewalCart,addRenewalLines,removeRenewalLine,replaceRenewalLines,subtractRenewalSubmission} from './renewal-cart'
import {normalizeRenewalLines,priceRenewalOrder,type RenewalSelection} from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import {CUSTOMER_AUTH_NOTICE_KEY} from './customer-account-config'
import type {CustomerAuthState} from './customer-account-types'
import type {CakeDetailSelection} from './cake-detail'
export type CartOwner='guest'|`user:${string}`
export type CartStorage=StorageLike&Partial<Pick<Storage,'key'|'length'>>
export const CART_EVENT_PREFIX='verygood-au-cart-events-v1:'
export function customerCartOwner(state:CustomerAuthState,enabled:boolean):CartOwner|null {
 if(!enabled||state.status==='guest'||state.status==='unavailable')return 'guest'
 if(state.status==='authenticated'&&typeof state.identity.userId==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(state.identity.userId))return `user:${state.identity.userId}`
 return null
}
export function scopedCartKey(base:string,owner:CartOwner){return owner==='guest'?base:`${base}:${owner}`}
export type CartAction=
 |{type:'legacy-add';selection:CakeDetailSelection}|{type:'legacy-update';key:string;quantity:number}|{type:'legacy-remove';key:string}|{type:'legacy-submitted';lines:readonly CartLine[]}|{type:'legacy-clear'}
 |{type:'renewal-add';lines:RenewalSelection[]}|{type:'renewal-replace';id:string;lines:RenewalSelection[]}|{type:'renewal-update';id:string;quantity:number}|{type:'renewal-remove';id:string}|{type:'renewal-submitted';lines:readonly RenewalSelection[]}|{type:'renewal-clear'}
 |{type:'acknowledge-mochi'}|{type:'import-guest'}
type SavedAction=Exclude<CartAction,{type:'import-guest'}>|{type:'import-guest';signature:string;legacy:string;renewal:RenewalSelection[]}
type CartRecord={version:1;clock:number;id:string;action:SavedAction}
type Contents={lines:CartLine[];renewalLines:RenewalSelection[];mochiReselectionRequired:boolean;imports:string[]}
export type CustomerCartSnapshot=Contents&{owner:CartOwner|null;ready:boolean;epoch:number;canImportGuest:boolean;guestAlreadyImported:boolean;guestItemCount:number;guestSignature:string;storageError:boolean;changedInAnotherTab:boolean}
export type CartTicket={owner:CartOwner|null;epoch:number;notice:string|null}
const empty=():Contents=>({lines:[],renewalLines:[],mochiReselectionRequired:false,imports:[]})
const text=(storage:CartStorage,key:string)=>{try{return storage.getItem(key)}catch{return null}}
const guestChoiceKey=(owner:CartOwner)=>'verygood-au-cart-import-choice-v1:'+owner
export function hasDeclinedGuestImport(storage:Pick<Storage,'getItem'>|undefined,owner:CartOwner,signature:string):boolean {
 try{return owner!=='guest'&&!!signature&&storage?.getItem(guestChoiceKey(owner))===signature}catch{return false}
}
export function declineGuestImport(storage:Pick<Storage,'setItem'>|undefined,owner:CartOwner,signature:string):void {
 try{if(owner!=='guest'&&signature)storage?.setItem(guestChoiceKey(owner),signature)}catch{/* The choice still applies in this view; Guest goods are untouched. */}
}
function records(storage:CartStorage,owner:CartOwner,known:Iterable<string>=[]):CartRecord[]{
 const prefix=CART_EVENT_PREFIX+owner+':',keys=new Set(known),result:CartRecord[]=[]
 try{for(let i=0;i<(storage.length??0);i++){const k=storage.key?.(i);if(k?.startsWith(prefix))keys.add(k)}}catch{/* failed storage leaves the previous valid base untouched */}
 for(const k of keys){if(!k.startsWith(prefix))continue;try{const r=JSON.parse(text(storage,k)||'null');if(r?.version===1&&Number.isSafeInteger(r.clock)&&r.clock>=0&&typeof r.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(r.id)&&k===prefix+r.id&&r.action)result.push(r)}catch{/* malformed local cart entries are not orders */}}
 return result.sort((a,b)=>a.clock-b.clock||a.id.localeCompare(b.id))
}
function baseContents(storage:CartStorage,owner:CartOwner):Contents {
 const inspected=inspectRenewalCart(text(storage,scopedCartKey(RENEWAL_CART_KEY,owner)))
 let archived:{lines?:unknown[];acknowledged?:boolean}={}
 try{archived=JSON.parse(text(storage,scopedCartKey(MOCHI_RESELECTION_KEY,owner))||'{}')}catch{/* keep active selections */}
 return {lines:parseCartLines(text(storage,scopedCartKey(CART_STORAGE_KEY,owner))),renewalLines:inspected.lines,mochiReselectionRequired:inspected.retiredMochi.length>0||(Array.isArray(archived?.lines)&&archived.lines.length>0&&archived.acknowledged!==true),imports:[]}
}
function uniqueIncoming(current:readonly RenewalSelection[],incoming:RenewalSelection[],id:string){
 const aliases=new Map(incoming.filter(l=>current.some(c=>c.lineId===l.lineId)).map((l,i)=>[l.lineId,`${id.slice(0,24)}-${i}`]))
 return incoming.map(l=>({...l,lineId:aliases.get(l.lineId)||l.lineId,...(l.parentLineId?{parentLineId:aliases.get(l.parentLineId)||l.parentLineId}:{})}))
}
function cleanIncoming(current:readonly RenewalSelection[],incoming:RenewalSelection[],id:string){
 const prepared=uniqueIncoming(current,incoming,id),ids=new Set(prepared.map(l=>l.lineId))
 return normalizeRenewalLines([...current,...prepared]).filter(l=>ids.has(l.lineId))
}
function apply(current:Contents,action:SavedAction,id:string):Contents {
 const s={...current}
 switch(action.type){
  case 'legacy-add': {const safe=parseCartLines(JSON.stringify({version:1,lines:[action.selection]}));if(!safe.length)throw Error('INVALID_CART_SELECTION');s.lines=addCartLine(s.lines,safe[0].selection);break}
  case 'legacy-update':s.lines=updateCartLineQuantity(s.lines,action.key,action.quantity);break
  case 'legacy-remove':s.lines=removeCartLine(s.lines,action.key);break
  case 'legacy-submitted':s.lines=subtractSubmittedCartLines(s.lines,parseCartLines(serializeCartLines(action.lines)));break
  case 'legacy-clear':s.lines=[];break
  case 'renewal-add':s.renewalLines=addRenewalLines(s.renewalLines,uniqueIncoming(s.renewalLines,action.lines,id));break
  case 'renewal-replace':s.renewalLines=replaceRenewalLines(s.renewalLines,action.id,uniqueIncoming(removeRenewalLine(s.renewalLines,action.id),action.lines,id));break
  case 'renewal-update':s.renewalLines=s.renewalLines.map(l=>l.lineId===action.id?{...l,quantity:action.quantity}:l);if(s.renewalLines.length)priceRenewalOrder(s.renewalLines,{localPreview:true});break
  case 'renewal-remove':s.renewalLines=removeRenewalLine(s.renewalLines,action.id);break
  case 'renewal-submitted':s.renewalLines=subtractRenewalSubmission(s.renewalLines,action.lines);break
  case 'renewal-clear':s.renewalLines=[];break
  case 'acknowledge-mochi':s.mochiReselectionRequired=false;break
  case 'import-guest':if(!s.imports.includes(action.signature)){s.lines=parseCartLines(serializeCartLines([...s.lines,...parseCartLines(action.legacy)]));if(action.renewal.length)s.renewalLines=addRenewalLines(s.renewalLines,uniqueIncoming(s.renewalLines,action.renewal,id));s.imports=[...s.imports,action.signature]}break
  default:throw Error('INVALID_CART_ACTION')
 }
 return s
}
export function readCustomerCart(storage:CartStorage,owner:CartOwner,known:Iterable<string>=[]):Contents {
 let current=baseContents(storage,owner)
 for(const r of records(storage,owner,known))try{current=apply(current,r.action,r.id)}catch{/* retain valid selections when an entry is corrupt */}
 return current
}
export function scopedCartSignature(storage:CartStorage,kind:'legacy'|'renewal',owner:CartOwner):string {
 const base=storage.getItem(scopedCartKey(kind==='legacy'?CART_STORAGE_KEY:RENEWAL_CART_KEY,owner))||''
 const ops=records(storage,owner)
 // Keep existing Guest drafts compatible when the Guest cart has not changed.
 const current=ops.length?readCustomerCart(storage,owner):null
 return (owner==='guest'?'':owner+'\n')+(current?(kind==='legacy'?serializeCartLines(current.lines):JSON.stringify({version:1,lines:current.renewalLines})):base)
}
export function createCustomerCartStore({storage,owner:initialOwner,authFence=true}:{storage:CartStorage;owner:CartOwner|null;authFence?:boolean}){
 let owner=initialOwner,lastOwner=initialOwner,epoch=0,notice=text(storage,CUSTOMER_AUTH_NOTICE_KEY),storageError=false,changedInAnotherTab=false
 const known=new Set<string>(),listeners=new Set<()=>void>()
 const guestSignature=()=>{const guest=readCustomerCart(storage,'guest',known);return JSON.stringify({legacy:serializeCartLines(guest.lines),renewal:guest.renewalLines})}
 const snapshot=():CustomerCartSnapshot=>{
  const contents=owner?readCustomerCart(storage,owner,known):empty(),guest=owner?.startsWith('user:')?readCustomerCart(storage,'guest',known):empty()
  const signature=owner?.startsWith('user:')?guestSignature():''
  return {...contents,owner,ready:owner!==null,epoch,storageError,changedInAnotherTab,guestSignature:signature,guestItemCount:guest.lines.reduce((n,l)=>n+l.selection.quantity,0)+guest.renewalLines.reduce((n,l)=>n+l.quantity,0),guestAlreadyImported:!!owner?.startsWith('user:')&&(guest.lines.length+guest.renewalLines.length)>0&&contents.imports.includes(signature),canImportGuest:!!owner?.startsWith('user:')&&(guest.lines.length+guest.renewalLines.length)>0&&!contents.imports.includes(signature)}
 }
 let value=snapshot()
 const publish=()=>{const next=snapshot();if(JSON.stringify(next)!==JSON.stringify(value)){value=next;for(const fn of listeners)fn()}}
 const valid=(ticket:CartTicket)=>ticket.owner!==null&&ticket.owner===owner&&ticket.epoch===epoch&&(!authFence||ticket.notice===text(storage,CUSTOMER_AUTH_NOTICE_KEY))
 const suspend=()=>{owner=null;epoch++;publish()}
 return {
  getSnapshot:()=>value,
  subscribe:(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn)}},
  ticket:():CartTicket=>({owner,epoch,notice}),
  selectOwner(next:CartOwner|null,fence=authFence){const now=text(storage,CUSTOMER_AUTH_NOTICE_KEY);if((next!==null&&next!==lastOwner)||now!==notice||fence!==authFence){epoch++;changedInAnotherTab=false}owner=next;if(next!==null)lastOwner=next;notice=now;authFence=fence;publish()},
  suspend,
  isCurrent:valid,
  refresh:()=>{changedInAnotherTab=true;publish()},
  mutate(ticket:CartTicket,input:CartAction):boolean {
   if(!valid(ticket)){if(authFence&&notice!==text(storage,CUSTOMER_AUTH_NOTICE_KEY))suspend();return false}
   const current=readCustomerCart(storage,owner!,known),id=crypto.randomUUID(),entries=records(storage,owner!,known)
   if((input.type==='legacy-update'||input.type==='renewal-update')&&(typeof input.quantity!=='number'||!Number.isFinite(input.quantity)))throw Error('INVALID_CART_QUANTITY')
   let action:SavedAction
   if(input.type==='import-guest'){
    if(owner==='guest')return false
    const guest=readCustomerCart(storage,'guest',known)
    action={type:'import-guest',signature:guestSignature(),legacy:serializeCartLines(guest.lines),renewal:guest.renewalLines}
   }else if(input.type==='legacy-add'){
    const normalized=addCartLine([],input.selection),clean=JSON.parse(serializeCartLines(normalized)).lines[0]
    if(!clean)return false
    action={type:'legacy-add',selection:clean}
   }else if(input.type==='renewal-add')action={type:input.type,lines:cleanIncoming(current.renewalLines,input.lines,id)}
   else if(input.type==='renewal-replace')action={type:input.type,id:input.id,lines:cleanIncoming(removeRenewalLine(current.renewalLines,input.id),input.lines,id)}
   else if(input.type==='legacy-submitted')action={type:input.type,lines:parseCartLines(serializeCartLines(input.lines))}
   else if(input.type==='renewal-submitted')action={type:input.type,lines:input.lines.length?addRenewalLines([],[...input.lines]):[]}
   else if(input.type==='legacy-update')action={type:input.type,key:input.key,quantity:input.quantity}
   else if(input.type==='legacy-remove')action={type:input.type,key:input.key}
   else if(input.type==='renewal-update')action={type:input.type,id:input.id,quantity:input.quantity}
   else if(input.type==='renewal-remove')action={type:input.type,id:input.id}
   else action={type:input.type}
   // Validate before persisting. Each operation has its own key: concurrent tabs
   // cannot overwrite each other's snapshot, even without Web Locks.
   apply(current,action,id)
   if(!valid(ticket)){suspend();return false}
   const record:CartRecord={version:1,id,clock:Math.max(Date.now(),...entries.map(r=>r.clock+1)),action}
   const key=CART_EVENT_PREFIX+owner+':'+id
   try{storage.setItem(key,JSON.stringify(record));known.add(key);storageError=false}catch{storageError=true;publish();return false}
   changedInAnotherTab=false;publish();return true
  },
 }
}
