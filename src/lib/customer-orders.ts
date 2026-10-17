import {executeReservationApi} from './repository'
import type {CustomerAccountHealth,CustomerOrderDetail,CustomerOrdersPage,CustomerOrderSummary,CustomerOrderView} from './customer-account-types'

function invalid():never { throw new Error('INVALID_CUSTOMER_RESPONSE') }
function object(v:unknown):Record<string,unknown> { if(!v || typeof v!=='object'||Array.isArray(v)) invalid(); return v as Record<string,unknown> }
function keys(v:Record<string,unknown>,allowed:readonly string[]) { if(Object.keys(v).some(k=>!allowed.includes(k))) invalid() }
function text(v:unknown):string { if(typeof v!=='string'||v.length>10000) invalid(); return v }
const summaryKeys=['id','reservationNumber','createdAt','pickupDate','pickupTime','status','paymentStatus','totalPriceCents']
function summary(v:unknown):CustomerOrderSummary {
  const r=object(v); keys(r,summaryKeys)
  for(const k of summaryKeys.filter(k=>k!=='totalPriceCents')) text(r[k])
  if(!r.id || !r.reservationNumber || !Number.isFinite(Date.parse(String(r.createdAt))) || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.pickupDate))) invalid()
  if(r.totalPriceCents!==null && (!Number.isSafeInteger(r.totalPriceCents)||Number(r.totalPriceCents)<0)) invalid()
  return r as CustomerOrderSummary
}
export function parseCustomerAccountHealth(v:unknown):CustomerAccountHealth {
  const r=object(v); keys(r,['enabled','ready'])
  if(typeof r.enabled!=='boolean'||typeof r.ready!=='boolean'||(!r.enabled&&r.ready)) invalid()
  return {enabled:r.enabled,ready:r.ready}
}
export function parseCustomerOrdersPage(v:unknown):CustomerOrdersPage {
  const r=object(v); keys(r,['orders','nextCursor'])
  if(!Array.isArray(r.orders)||r.orders.length>25||(r.nextCursor!==null&&(typeof r.nextCursor!=='string'||!r.nextCursor))) invalid()
  return {orders:r.orders.map(summary),nextCursor:r.nextCursor as string|null}
}
const legacyKeys=['format','reservationNumber','productId','cakeSize','chocolateType','poundAddon','cupcakeFinish','chocolateIcingCount','vanillaCreamCount','partyDecorationCount','vanillaCakeSheet','vanillaCakeFlavor','vanillaCakePointColor','individualPackaging','quantity','pickupDate','pickupTime','cacaoPercent','status','paymentStatus','orderLines','orderLineCount','orderItemCount','subtotalCents','discountBasisCents','discountPercent','discountCents','totalPriceCents','individualPackagingPieces','individualPackagingFeeCents','chocolateExtra','brownieCreamOption']
const renewalKeys=['format','contractVersion','productId','quantity','orderLines','subtotalCents','discountCents','discountBasisCents','discountPercent','totalPriceCents','individualPackagingPieces','individualPackagingFeeCents','orderLineCount','orderItemCount']
const lineKeys=['selection','productId','quantity','productName','unitPriceCents','subtotalCents','physicalQuantity','flavourTotals','priceStatus','policyVersion','individualPackaging','individualPackagingPieces','individualPackagingFeeCents','packagingUnitCents','packagingMode','giftBoxCount','discountPercent','discountCents','totalPriceCents','lineId','cakeSize','chocolateType','poundAddon','cacaoPercent','cupcakeFinish','cupcakeFinishCounts','chocolateIcingCount','vanillaCreamCount','partyDecorationCount','vanillaCakeSheet','vanillaCakeFlavor','vanillaCakePointColor','chocolateExtra','brownieCreamOption','optionLabel','productLabel','unitPrice','totalPrice']
function view(v:unknown):CustomerOrderView {
  const r=object(v)
  if(r.format!=='legacy'&&r.format!=='renewal') invalid()
  keys(r,r.format==='renewal'?renewalKeys:legacyKeys)
  if(r.orderLines!==undefined) {
    if(!Array.isArray(r.orderLines)||r.orderLines.length>100) invalid()
    for(const line of r.orderLines) {
      const l=object(line); keys(l,lineKeys)
      if(l.selection) {
        const s=object(l.selection); keys(s,['lineId','offerId','quantity','size','finish','chocolateType','individualPackaging','mode','flavourCounts','parentLineId'])
        if(s.flavourCounts) keys(object(s.flavourCounts),['strawberry','green_grape','mandarin','banana','butter_redbean','nama_chocolate'])
      }
      for(const [k,value] of Object.entries(l)) if(k!=='selection'&&k!=='flavourTotals'&&typeof value==='object') invalid()
    }
  }
  for(const [k,value] of Object.entries(r)) if(k!=='orderLines'&&value!==null&&typeof value==='object') invalid()
  if(r.format==='renewal'&&(!Array.isArray(r.orderLines)||typeof r.contractVersion!=='string')) invalid()
  return r as CustomerOrderView
}
export function parseCustomerOrderDetail(v:unknown):CustomerOrderDetail {
  const r=object(v); keys(r,[...summaryKeys,'contact','requestNote','view'])
  const s=summary(Object.fromEntries(summaryKeys.map(k=>[k,r[k]])))
  const c=object(r.contact); keys(c,['name','phone','email'])
  return {...s,contact:{name:text(c.name),phone:text(c.phone),email:text(c.email)},requestNote:text(r.requestNote),view:view(r.view)}
}
export async function getCustomerAccountHealth(execute=executeReservationApi):Promise<CustomerAccountHealth> {
  return execute('customer-account-health',undefined,parseCustomerAccountHealth)
}
