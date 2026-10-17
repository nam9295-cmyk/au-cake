export const CUSTOMER_AUTH_CHANGED_EVENT = 'verygood:auth-changed'

export function resolveCustomerAccountConfig(input: {
  market: string; configured: boolean; frontendEnabled?: unknown; reservationApiMode: string
}): {enabled: boolean} {
  return {enabled: input.market === 'AU' && input.configured && input.frontendEnabled === 'true' && input.reservationApiMode === 'all'}
}
