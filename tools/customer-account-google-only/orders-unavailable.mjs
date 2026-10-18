// Build-stage isolation only. Never call Functions or mint a JWT in this test.
export async function executeReservationApi(){throw Error('CUSTOMER_ACCOUNT_NOT_READY')}
