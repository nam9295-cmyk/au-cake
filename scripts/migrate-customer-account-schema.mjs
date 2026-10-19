import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildCustomerAccountMigrationPlan} from './customer-account-schema.mjs'
import {resolveCustomerAccountResources,CUSTOMER_OWNER_ATTRIBUTE,CUSTOMER_OWNER_INDEX,assertCustomerOwnerAttribute,assertCustomerOwnerIndex,assertCustomerResourceInventory} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'

function target(env) {
  const url=new URL(env.APPWRITE_ENDPOINT)
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!/^\/v1\/?$/.test(url.pathname)||env.CUSTOMER_ACCOUNT_MIGRATION_MARKET!=='AU'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(env.APPWRITE_PROJECT_ID||'')) throw Error('CUSTOMER_ACCOUNT_INVALID_TARGET')
  return url.href.replace(/\/$/,'')
}
export function createCustomerMigrationClient(env,transport=fetch) {
  const endpoint=target(env)
  if(!env.APPWRITE_API_KEY) throw Error('CUSTOMER_ACCOUNT_MISSING_KEY')
  async function request(method,path,data) {
    const res=await transport(`${endpoint}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':env.APPWRITE_PROJECT_ID,'X-Appwrite-Key':env.APPWRITE_API_KEY,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})
    if(!res.ok) throw Object.assign(Error('CUSTOMER_ACCOUNT_METADATA_REQUEST_FAILED'),{code:res.status})
    return res.json()
  }
  const collection=t=>`/databases/${encodeURIComponent(t.databaseId)}/collections/${encodeURIComponent(t.collectionId)}`
  return {
    getVersion:()=>request('GET','/health/version'),
    getDatabase:t=>request('GET',`/databases/${encodeURIComponent(t.databaseId)}`),
    list:t=>request('GET',`/databases?${new URLSearchParams(t.queries.map(q=>['queries[]',q]))}`),
    listCollections:t=>request('GET',`/databases/${encodeURIComponent(t.databaseId)}/collections?${new URLSearchParams(t.queries.map(q=>['queries[]',q]))}`),
    getCollection:t=>request('GET',collection(t)),
    getAttribute:t=>request('GET',`${collection(t)}/attributes/${encodeURIComponent(t.key)}`),
    getIndex:t=>request('GET',`${collection(t)}/indexes/${encodeURIComponent(t.key)}`),
    createStringAttribute:({databaseId,collectionId,type,...data})=>{void type;return request('POST',`${collection({databaseId,collectionId})}/attributes/string`,data)},
    createIndex:({databaseId,collectionId,...data})=>request('POST',`${collection({databaseId,collectionId})}/indexes`,data),
  }
}
const optional=async fn=>{try{return await fn()}catch(error){if(error?.code===404)return null;throw error}}
export async function runCustomerAccountMigration({env,apply=false,client,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  target(env)
  const resources=resolveCustomerAccountResources({...env,MARKET:env.CUSTOMER_ACCOUNT_MIGRATION_MARKET})
  client ||= createCustomerMigrationClient(env)
  if((await client.getVersion()).version!=='1.8.1') throw Error('CUSTOMER_ACCOUNT_UNSUPPORTED_VERSION')
  for(const databaseId of new Set(resources.privacyAuditTargets.map(t=>t.databaseId))) await client.getDatabase({databaseId})
  await assertCustomerResourceInventory(client,env,resources)
  const metadata={collections:[],publicCollections:[],attribute:null,index:null}
  for(const t of resources.privacyAuditTargets) metadata.collections.push(await client.getCollection(t))
  for(const t of resources.publicReadTargets) metadata.publicCollections.push(await client.getCollection(t))
  const t=resources.ownershipTarget
  metadata.attribute=await optional(()=>client.getAttribute({...t,key:CUSTOMER_OWNER_ATTRIBUTE.key}))
  metadata.index=await optional(()=>client.getIndex({...t,key:CUSTOMER_OWNER_INDEX.key}))
  const plan=buildCustomerAccountMigrationPlan(env,metadata)
  if(!apply) return {mode:'dry-run',ready:metadata.attribute?.status==='available'&&metadata.index?.status==='available',...plan}
  async function wait(kind,definition,validate) {
    for(let attempt=0;attempt<30;attempt++) {
      const v=await client[kind]({...t,key:definition.key})
      validate(v,{pending:true})
      if(v.status==='available') return
      await sleep(1000)
    }
    throw Error('CUSTOMER_ACCOUNT_SCHEMA_TIMEOUT')
  }
  if(!metadata.attribute) await client.createStringAttribute({...t,...CUSTOMER_OWNER_ATTRIBUTE})
  await wait('getAttribute',CUSTOMER_OWNER_ATTRIBUTE,assertCustomerOwnerAttribute)
  if(!metadata.index) await client.createIndex({...t,...CUSTOMER_OWNER_INDEX})
  await wait('getIndex',CUSTOMER_OWNER_INDEX,assertCustomerOwnerIndex)
  return {mode:'apply',ready:true,...plan}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2)
  if(args.some(a=>!['--apply','--dry-run'].includes(a))||(args.includes('--apply')&&args.includes('--dry-run'))) throw Error('Use --dry-run (default) or --apply')
  try {console.log(JSON.stringify(await runCustomerAccountMigration({env:process.env,apply:args.includes('--apply')}),null,2))}
  catch {console.error('CUSTOMER_ACCOUNT_MIGRATION_FAILED: check target, metadata, ACL and schema; no ACL or existing data was changed.');process.exitCode=1}
}
