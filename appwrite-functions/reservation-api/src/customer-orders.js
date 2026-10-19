import {Query} from 'node-appwrite'
import {ReservationApiError} from './reservation-error.js'
import {publicCakeReservation,parseStoredOrderLines} from './business.js'
import {isRenewalDocument,readRenewalDocument} from './au-renewal-reader.js'
const invalid=()=>{throw new ReservationApiError('INVALID_CUSTOMER_REQUEST',400)}
const unavailable=()=>{throw new ReservationApiError('CUSTOMER_ORDERS_UNAVAILABLE',503)}
const missing=()=>{throw new ReservationApiError('CUSTOMER_ORDER_NOT_FOUND',404)}
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(v)
export function validateCustomerOrderRequest(action,input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)) invalid()
  const allowed=action==='customer-order'?['id']:['cursor','limit']
  if(Object.keys(input).some(k=>!allowed.includes(k))) invalid()
  if(action==='customer-order'&&!validId(input.id)) invalid()
  if(input.cursor!==undefined&&!validId(input.cursor)) invalid()
  if(input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>25)) invalid()
  return input
}
function stored(document) {
  try { return isRenewalDocument(document)?readRenewalDocument(document):parseStoredOrderLines(document) }
  catch { unavailable() }
}
export function customerOrderSummary(document) {
  const quote=stored(document)
  const total=quote?.totalPriceCents??document.totalPriceCents??(typeof document.totalPrice==='number'?Math.round(document.totalPrice*100):null)
  const createdAt=document.$createdAt||document.createdAt
  if(!validId(document.$id)||typeof document.reservationNumber!=='string'||!Number.isFinite(Date.parse(createdAt))||!/^\d{4}-\d{2}-\d{2}$/.test(document.pickupDate)||typeof document.pickupTime!=='string'||typeof document.status!=='string'||typeof document.paymentStatus!=='string'||(total!==null&&(!Number.isSafeInteger(total)||total<0))) unavailable()
  return {id:document.$id,reservationNumber:document.reservationNumber,createdAt,pickupDate:document.pickupDate,pickupTime:document.pickupTime,status:document.status,paymentStatus:document.paymentStatus,totalPriceCents:total}
}
function pick(source,keys) {return Object.fromEntries(keys.filter(k=>source[k]!==undefined).map(k=>[k,source[k]]))}
const legacyKeys=['reservationNumber','productId','cakeSize','chocolateType','poundAddon','cupcakeFinish','chocolateIcingCount','chocolateExtra','brownieCreamOption','vanillaCreamCount','partyDecorationCount','vanillaCakeSheet','vanillaCakeFlavor','vanillaCakePointColor','individualPackaging','quantity','pickupDate','pickupTime','cacaoPercent','status','paymentStatus','orderLines','orderLineCount','orderItemCount','subtotalCents','discountBasisCents','discountPercent','discountCents','totalPriceCents','individualPackagingPieces','individualPackagingFeeCents']
export function projectCustomerOrderDetail(document) {
  const summary=customerOrderSummary(document)
  let view
  try {
    if(isRenewalDocument(document)) {
      const q=readRenewalDocument(document)
      view={format:'renewal',contractVersion:q.policyVersion,productId:document.productId,quantity:document.quantity,orderLines:q.lines,
        subtotalCents:q.subtotalCents,discountCents:q.discountCents,discountBasisCents:q.discountBasisCents,discountPercent:q.discountPercent,totalPriceCents:q.totalPriceCents,
        individualPackagingPieces:q.individualPackagingPieces,individualPackagingFeeCents:q.individualPackagingFeeCents,orderLineCount:q.lines.length,orderItemCount:q.orderItemCount}
    } else view={format:'legacy',...pick(publicCakeReservation(document),legacyKeys)}
  } catch { unavailable() }
  const contact={name:document.customerName,phone:document.customerPhone,email:document.customerEmail||''}
  if(Object.values(contact).some(v=>typeof v!=='string')||typeof (document.requestNote||'')!=='string') unavailable()
  return {...summary,contact,requestNote:document.requestNote||'',view}
}
async function owned(databases,resources,id,userId) {
  let doc
  try {doc=await databases.getDocument({...resources.ownershipTarget,documentId:id})}
  catch(error) {if(error?.code===404)missing();unavailable()}
  if(doc.customerUserId!==userId) missing()
  return doc
}
export async function listCustomerOrders(databases,{userId,cursor,limit=25},resources) {
  validateCustomerOrderRequest('customer-orders',{...(cursor!==undefined?{cursor}:{}),limit})
  if(cursor)await owned(databases,resources,cursor,userId)
  try {
    const result=await databases.listDocuments({...resources.ownershipTarget,queries:[Query.equal('customerUserId',userId),Query.orderDesc('$createdAt'),Query.limit(limit+1),...(cursor?[Query.cursorAfter(cursor)]:[])],total:false})
    if(!Array.isArray(result.documents)||result.documents.length>limit+1||result.documents.some(d=>d.customerUserId!==userId)) unavailable()
    const orders=result.documents.slice(0,limit).map(customerOrderSummary)
    return {orders,nextCursor:result.documents.length>limit?orders.at(-1).id:null}
  } catch { unavailable() }
}
export async function getCustomerOrder(databases,{userId,id},resources) {
  validateCustomerOrderRequest('customer-order',{id})
  return projectCustomerOrderDetail(await owned(databases,resources,id,userId))
}
