export async function renewalCapabilities(){return {enabled:false,preordersEnabled:false,weekendApproved:true}}
export async function createRenewalOrder(){throw Error('MANUAL_CART_ORDERS_DISABLED')}
export async function executeReservationApi(){throw Error('MANUAL_CART_ORDERS_DISABLED')}
