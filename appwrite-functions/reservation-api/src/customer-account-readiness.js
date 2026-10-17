import {Query} from 'node-appwrite'
export const CUSTOMER_OWNER_ATTRIBUTE = Object.freeze({key:'customerUserId',type:'string',size:36,required:false})
export const CUSTOMER_OWNER_INDEX = Object.freeze({key:'customerUser_created_idx',type:'key',attributes:['customerUserId','$createdAt'],orders:['ASC','DESC']})
const resourceId=/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
function id(value) { if(!resourceId.test(value||'')) throw Error('CUSTOMER_ACCOUNT_INVALID_RESOURCE');return value }

// Same input/normalization as scripts/review-schema.mjs:parseAdminUserIds.
export function customerAdminUserIds(env) {
  const ids=[...new Set(String(env.APPWRITE_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean))]
  if(!ids.length||ids.some(v=>!resourceId.test(v))) throw Error('CUSTOMER_ACCOUNT_INVALID_ADMIN_IDS')
  return ids
}
export function resolveCustomerAccountResources(env) {
  if(env.MARKET!=='AU') throw Error('CUSTOMER_ACCOUNT_INVALID_MARKET')
  const cake=id(env.APPWRITE_CAKE_DATABASE_ID),kids=id(env.APPWRITE_KIDS_DATABASE_ID)
  const ownershipTarget={databaseId:cake,collectionId:id(env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID||'reservations')}
  const privacyAuditTargets=[ownershipTarget,{databaseId:kids,collectionId:id(env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID||'class_reservations')}]
  for(const [key,fallback] of Object.entries({REVIEW_INVITES:'review_invites',REVIEWS:'reviews',REVIEW_COUPONS:'review_coupons',MANUAL_COUPONS:'manual_coupons',REVIEW_PHOTO_CLEANUP:'review_photo_cleanup',EMAIL_DELIVERIES:'email_deliveries',EMAIL_DELIVERY_RETRY_CLAIMS:'email_delivery_retry_claims'})) privacyAuditTargets.push({databaseId:cake,collectionId:id(env[`APPWRITE_${key}_TABLE_ID`]||fallback)})
  const customActive=Boolean(env.APPWRITE_CUSTOM_CAKE_DATABASE_ID)||Object.entries(env).some(([key,v])=>key.startsWith('CUSTOM_CAKE_')&&key.endsWith('_ENABLED')&&v==='true')
  if(customActive) {
    const databaseId=id(env.APPWRITE_CUSTOM_CAKE_DATABASE_ID)
    for(const key of ['CLAIMS','SNAPSHOTS','SESSIONS','PHOTOS','QUOTAS','OUTBOX','COMMITS','CHUNKS','HISTORIES','RATELIMITS']) privacyAuditTargets.push({databaseId,collectionId:id(env[`APPWRITE_CUSTOM_CAKE_${key}_TABLE_ID`])})
  }
  return {ownershipTarget,privacyAuditTargets:[...new Map(privacyAuditTargets.map(t=>[`${t.databaseId}/${t.collectionId}`,t])).values()],adminUserIds:customerAdminUserIds(env)}
}
export function assertCustomerPrivateAcl(collection,adminUserIds) {
  if(!collection||collection.documentSecurity!==false||collection.enabled!==true||!Array.isArray(collection.$permissions)) throw Error('CUSTOMER_ACCOUNT_UNSAFE_ACL')
  const allowed=new Set(adminUserIds.flatMap(id=>['read','create','update','delete'].map(action=>`${action}("user:${id}")`)))
  if(collection.$permissions.some(permission=>!allowed.has(permission))) throw Error('CUSTOMER_ACCOUNT_UNSAFE_ACL')
}
export async function assertCustomerResourceInventory(databases,env,resources) {
  const classified=new Set(resources.privacyAuditTargets.map(t=>`${t.databaseId}/${t.collectionId}`))
  const cake=resources.ownershipTarget.databaseId,kids=env.APPWRITE_KIDS_DATABASE_ID
  for(const [databaseId,collectionId] of [[cake,env.APPWRITE_SETTINGS_TABLE_ID||'settings'],[cake,env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID||'cake_pickup_openings'],[kids,env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID||'class_booked_dates']]) classified.add(`${databaseId}/${id(collectionId)}`)
  for(const databaseId of new Set(resources.privacyAuditTargets.map(t=>t.databaseId))) {
    const list=await databases.listCollections({databaseId,queries:[Query.limit(100)]})
    if(!Array.isArray(list.collections)||!Number.isSafeInteger(list.total)||list.total!==list.collections.length||list.total>100||list.collections.some(c=>!classified.has(`${databaseId}/${c.$id}`))) throw Error('CUSTOMER_ACCOUNT_UNCLASSIFIED_RESOURCE')
  }
}
export function assertCustomerOwnerAttribute(value,{pending=false}={}) {
  if(!value||value.key!==CUSTOMER_OWNER_ATTRIBUTE.key||value.type!=='string'||value.size!==36||value.required!==false||value.array===true||(value.default!==undefined&&value.default!==null)||(value.status!=='available'&&!(pending&&value.status==='processing'))) throw Error('CUSTOMER_ACCOUNT_OWNER_SCHEMA_MISMATCH')
}
export function assertCustomerOwnerIndex(value,{pending=false}={}) {
  if(!value||value.key!==CUSTOMER_OWNER_INDEX.key||value.type!=='key'||JSON.stringify(value.attributes)!==JSON.stringify(CUSTOMER_OWNER_INDEX.attributes)||JSON.stringify(value.orders)!==JSON.stringify(CUSTOMER_OWNER_INDEX.orders)||(value.status!=='available'&&!(pending&&value.status==='processing'))) throw Error('CUSTOMER_ACCOUNT_OWNER_INDEX_MISMATCH')
}
export async function checkCustomerAccountReadiness(databases,env) {
  if(env.CUSTOMER_ACCOUNT_ENABLED!=='true') return {enabled:false,ready:false}
  try {
    const resources=resolveCustomerAccountResources(env)
    await assertCustomerResourceInventory(databases,env,resources)
    for(const target of resources.privacyAuditTargets) assertCustomerPrivateAcl(await databases.getCollection(target),resources.adminUserIds)
    assertCustomerOwnerAttribute(await databases.getAttribute({...resources.ownershipTarget,key:CUSTOMER_OWNER_ATTRIBUTE.key}))
    assertCustomerOwnerIndex(await databases.getIndex({...resources.ownershipTarget,key:CUSTOMER_OWNER_INDEX.key}))
    return {enabled:true,ready:true}
  } catch { return {enabled:true,ready:false} }
}
