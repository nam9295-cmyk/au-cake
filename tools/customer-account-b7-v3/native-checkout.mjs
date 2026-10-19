// Read-only projection of the original Renewal submit contract. Never replace its UUID.
export function nativeCheckoutWireBody(draft,{member=true}={}){
 if(draft?.kind!=='renewal'||draft.version!==1||!Array.isArray(draft.cartSnapshot)||!draft.form)throw Error('B7_NATIVE_DRAFT_REJECTED')
 const f=draft.form
 return JSON.stringify({action:'create-cake',data:{contractVersion:'au-renewal.2026-10.v2',customerName:f.name,customerPhone:f.phone,customerEmail:f.email,pickupDate:f.date,pickupTime:f.time,requestNote:f.note,promoCode:f.promo,privacyConsent:f.privacy===true,website:'',requestId:draft.requestId,orderLines:draft.cartSnapshot},...(member?{customerAccount:'link'}:{})})
}
