import type { PublicReservation } from './types'
import type { RenewalLine } from '../../appwrite-functions/reservation-api/src/au-renewal'

export type CustomerProfile = {version:1; name:string; contactEmail:string; phone:string; language:'en'|'ko'}
export type CustomerIdentity = {userId:string; loginEmail:string; profile:CustomerProfile}
export type CustomerAccountHealth = {enabled:boolean; ready:boolean}
export type CustomerAuthState = {status:'checking'|'guest'|'unavailable'} | {status:'authenticated'; identity:CustomerIdentity}
export type CustomerOrderSummary = {
  id:string; reservationNumber:string; createdAt:string; pickupDate:string; pickupTime:string
  status:string; paymentStatus:string; totalPriceCents:number|null
}
export type CustomerOrderView =
  | ({format:'legacy'} & Partial<PublicReservation>)
  | {format:'renewal'; contractVersion:string; productId:string; quantity:number; orderLines:RenewalLine[];
    subtotalCents:number; discountCents:number; discountBasisCents:number; discountPercent:number;
    totalPriceCents:number; individualPackagingPieces:number; individualPackagingFeeCents:number; orderLineCount:number; orderItemCount:number}
export type CustomerOrderDetail = CustomerOrderSummary & {
  contact:{name:string; phone:string; email:string}; requestNote:string; view:CustomerOrderView
}
export type CustomerOrdersPage = {orders:CustomerOrderSummary[]; nextCursor:string|null}
