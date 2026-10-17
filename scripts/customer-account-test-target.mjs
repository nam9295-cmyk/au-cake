// Explicit inputs only: never import dotenv or inherit process.env target/key values.
export const CUSTOMER_ACCOUNT_TEST_ENDPOINT = 'https://api.verygood-chocolate.com/v1'
export const CUSTOMER_ACCOUNT_TEST_PROJECT = 'verygood-au-account-test'
export const CUSTOMER_ACCOUNT_TEST_COLLECTIONS = Object.freeze({
  ca_test_cake_au: Object.freeze(['reservations','cake_pickup_openings','settings','review_invites','reviews','review_coupons','manual_coupons','review_photo_cleanup','email_deliveries','email_delivery_retry_claims']),
  ca_test_kids_au: Object.freeze(['class_reservations','class_booked_dates']),
})
const functionIds = ['ca-test-reservation-api'] // Future B6 identity only; no Function writes here.
const metadataScopes = ['databases.read','collections.read','attributes.read','indexes.read']
export const CUSTOMER_ACCOUNT_TEST_KEY_POLICIES = Object.freeze({
  metadata: Object.freeze({scopes:Object.freeze(metadataScopes),maxAgeHours:24}),
  bootstrap: Object.freeze({scopes:Object.freeze([...metadataScopes,'databases.write','collections.write','attributes.write','indexes.write']),maxAgeHours:2}),
  fixtures: Object.freeze({scopes:Object.freeze(['documents.read','documents.write']),maxAgeHours:2}),
})
const fail = () => { throw Error('CUSTOMER_ACCOUNT_TEST_GUARD_REJECTED') }
const list = (values,allowed) => {
  if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(v=>!allowed.includes(v))) fail()
  return Object.freeze([...values])
}
export function assertCustomerAccountTestTarget(input) {
  if(!input||input.endpoint!==CUSTOMER_ACCOUNT_TEST_ENDPOINT||input.projectId!==CUSTOMER_ACCOUNT_TEST_PROJECT||!input.resources) fail()
  return Object.freeze({endpoint:input.endpoint,projectId:input.projectId,resources:Object.freeze({
    databaseIds:list(input.resources.databaseIds,Object.keys(CUSTOMER_ACCOUNT_TEST_COLLECTIONS)),
    functionIds:list(input.resources.functionIds,functionIds),
  })})
}
export function withCustomerAccountTestTarget(input,operation) {
  return operation(assertCustomerAccountTestTarget(input))
}
export function assertCustomerAccountTestResource(input,resource) {
  const target=assertCustomerAccountTestTarget(input)
  if(!resource||Object.keys(resource).some(k=>!['databaseId','collectionId','functionId'].includes(k))) fail()
  if(resource.functionId!==undefined) {
    if(resource.databaseId!==undefined||resource.collectionId!==undefined||!target.resources.functionIds.includes(resource.functionId)) fail()
  } else {
    if(!target.resources.databaseIds.includes(resource.databaseId)) fail()
    if(resource.collectionId!==undefined&&!CUSTOMER_ACCOUNT_TEST_COLLECTIONS[resource.databaseId].includes(resource.collectionId)) fail()
  }
  return target
}
// Console provenance is an explicit operator attestation, not cryptographic proof of a secret.
// Never probe production with a key to discover its project. Missing provenance means no network.
export function assertCustomerAccountTestCredential(value,role,now=new Date()) {
  const policy=CUSTOMER_ACCOUNT_TEST_KEY_POLICIES[role]
  if(!policy||!value||value.consoleVerified!==true||value.endpoint!==CUSTOMER_ACCOUNT_TEST_ENDPOINT||value.projectId!==CUSTOMER_ACCOUNT_TEST_PROJECT||!/^[-\w.]{1,36}$/.test(value.keyId||'')) fail()
  const issued=Date.parse(value.issuedAt),expires=Date.parse(value.expiresAt),at=+now
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||!Number.isFinite(at)||issued>at||expires<=at||expires<=issued||expires-issued>policy.maxAgeHours*3600000) fail()
  if(!Array.isArray(value.scopes)||value.scopes.length!==policy.scopes.length||new Set(value.scopes).size!==value.scopes.length||value.scopes.some(s=>!policy.scopes.includes(s))) fail()
  return Object.freeze({...value,scopes:Object.freeze([...value.scopes])})
}
// Intentionally read-only. Baseline apply is unavailable until the next explicit approval.
// This transport can wrap createCustomerMigrationClient for a test-only GET dry-run.
export function createCustomerAccountTestMetadataTransport({target:input,credential,secret,clock=()=>new Date(),transport=fetch}) {
  const target=assertCustomerAccountTestTarget(input)
  const key=assertCustomerAccountTestCredential(credential,'metadata',clock())
  if(typeof secret!=='string'||!secret||/[\r\n]/.test(secret)) fail()
  return async function metadataTransport(url,options={}) {
    assertCustomerAccountTestCredential(key,'metadata',clock())
    if(options.method!=='GET'||options.body!==undefined||typeof url!=='string'||!url.startsWith(target.endpoint+'/')) fail()
    const path=url.slice(target.endpoint.length)
    const match=/^\/databases\/([A-Za-z0-9._-]+)(?:\/collections(?:\/([A-Za-z0-9._-]+)(?:\/(attributes|indexes)(?:\/([A-Za-z0-9_$.-]+))?)?)?)?(?:\?[^#]*)?$/.exec(path)
    if(match) assertCustomerAccountTestResource(target,{databaseId:match[1],...(match[2]?{collectionId:match[2]}:{})})
    else if(!/^\/databases(?:\?[^#]*)?$/.test(path)&&path!=='/health/version') fail()
    const response=await transport(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId,'X-Appwrite-Key':secret,'Content-Type':'application/json'}})
    if(response.redirected||response.status>=300&&response.status<400||response.url&&response.url!==url) fail()
    return response
  }
}
