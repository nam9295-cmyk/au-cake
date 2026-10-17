import {Account,Client} from 'node-appwrite'
import {resolveReservationAppwriteEndpoint} from './appwrite-endpoint.js'
import {ReservationApiError} from './reservation-error.js'
const fail=()=>{throw new ReservationApiError('CUSTOMER_UNAUTHORIZED',401)}
export async function resolveCustomerIdentity({headers,env,accountForJwt}) {
  const id=headers?.['x-appwrite-user-id'],jwt=headers?.['x-appwrite-user-jwt']
  if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id)||typeof jwt!=='string'||!jwt||jwt.length>8192) fail()
  try {
    const account=accountForJwt?await accountForJwt(jwt):new Account(new Client().setEndpoint(resolveReservationAppwriteEndpoint(env)).setProject(env.APPWRITE_FUNCTION_PROJECT_ID).setJWT(jwt))
    const user=await account.get()
    if(user.$id!==id||user.status!==true) fail()
    return {userId:user.$id}
  } catch { fail() }
}
export function assertCustomerOrderReplayOwner(document,verifiedUserId) {
  // A guest replay stays a guest forever. Never infer ownership from contact data.
  if(verifiedUserId&&document.customerUserId&&document.customerUserId!==verifiedUserId) throw new ReservationApiError('REQUEST_ID_CONFLICT',409)
}
