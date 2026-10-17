export const CUSTOMER_AUTH_CHANGED_EVENT = 'verygood:auth-changed'
export const CUSTOMER_AUTH_NOTICE_KEY = 'verygood-au-auth-notice'
export function publishCustomerAuthChange() {
  if(typeof window==='undefined')return
  window.dispatchEvent(new Event(CUSTOMER_AUTH_CHANGED_EVENT))
  try{window.localStorage.setItem(CUSTOMER_AUTH_NOTICE_KEY,crypto.randomUUID())}catch{/* Focus refresh remains available. */}
}

export function resolveCustomerAccountConfig(input: {
  market: string; configured: boolean; frontendEnabled?: unknown; reservationApiMode: string
}): {enabled: boolean} {
  return {enabled: input.market === 'AU' && input.configured && input.frontendEnabled === 'true' && input.reservationApiMode === 'all'}
}
