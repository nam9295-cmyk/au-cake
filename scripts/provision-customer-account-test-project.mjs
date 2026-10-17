import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {assertCustomerAccountTestTarget,assertCustomerAccountTestCredential,createCustomerAccountTestMetadataTransport} from './customer-account-test-target.mjs'
import {createCustomerMigrationClient,runCustomerAccountMigration} from './migrate-customer-account-schema.mjs'
import {validateAttributeDefinition,validateIndexDefinition,validateCollectionDefinition,assertCompleteExactAvailableKeySet} from './review-schema.mjs'

export const APPROVED_CUSTOMER_ACCOUNT_TEST_MANIFEST_SHA256='75e18834d1020a0279946169ddc3e9c9d1e58684c76104a6738d92c559f8ef94'
const fail=code=>{throw Error(`CUSTOMER_ACCOUNT_TEST_${code}`)}
const same=(a,b)=>{try{assert.deepEqual(a,b)}catch{fail('DEFINITION_MISMATCH')}}
const limit='?'+new URLSearchParams([['queries[]',JSON.stringify({method:'limit',values:[100]})]])
const dbPath=id=>`/databases/${id}`
const collectionPath=c=>`${dbPath(c.databaseId)}/collections/${c.collectionId}`
const attrData=({type,...data})=>{void type;return data}
function parseSchemaJson(text){
  // Node22/24 preserve int64 metadata bounds without introducing a transitive dependency.
  return JSON.parse(text,(_key,value,context)=>{
    if(typeof value==='number'&&!Number.isSafeInteger(value)&&/^-?\d+$/.test(context?.source||'')) return BigInt(context.source)
    return value
  })
}
export function assertCustomerAccountTestBudget(sample,{baselineOom,nowMs,highLoadSince}) {
  if(!sample||!Number.isFinite(sample.memoryAvailableBytes)||!Number.isFinite(sample.diskAvailableBytes)||!Number.isFinite(sample.load1)||!Number.isSafeInteger(sample.oomKills)||!Number.isSafeInteger(baselineOom)||sample.apiHealthy!==true||sample.memoryAvailableBytes<3*2**30||sample.diskAvailableBytes<30*2**30||sample.oomKills>baselineOom) fail('BUDGET_STOP')
  const since=sample.load1>=4?(highLoadSince??nowMs):null
  if(since!==null&&nowMs-since>=300000) fail('BUDGET_STOP')
  return {highLoadSince:since}
}
export function createCustomerAccountTestProvisioner({manifestBytes,target:input,credentials,transport=fetch,probe,sleep=ms=>new Promise(r=>setTimeout(r,ms)),onEvent=()=>{},clock=()=>new Date(),baselineOom=0}) {
  if(typeof manifestBytes!=='string'||createHash('sha256').update(manifestBytes).digest('hex')!==APPROVED_CUSTOMER_ACCOUNT_TEST_MANIFEST_SHA256) fail('MANIFEST_HASH_MISMATCH')
  const plan=JSON.parse(manifestBytes),target=assertCustomerAccountTestTarget(input)
  same(target,plan.target)
  if(typeof probe!=='function') fail('MISSING_RESOURCE_PROBE')
  const keys={}
  for(const role of ['metadata','bootstrap','fixtures']) {
    const key=credentials?.[role]
    const verified=assertCustomerAccountTestCredential(key,role,clock())
    if(typeof key.secret!=='string'||!key.secret||/[\r\n]/.test(key.secret)) fail('MISSING_CREDENTIAL')
    keys[role]={...verified,secret:key.secret}
  }
  const allowed=new Map(),attempted=new Set()
  const allow=(phase,role,path,data)=>allowed.set(`${phase}:${path}:${JSON.stringify(data)}`,role)
  for(const db of plan.creates.databases) allow('baseline','bootstrap','/databases',db)
  for(const c of plan.creates.collections){
    const {databaseId,attributes,indexes,...data}=c
    allow('baseline','bootstrap',`${dbPath(databaseId)}/collections`,data)
    for(const a of attributes)allow('baseline','bootstrap',`${collectionPath(c)}/attributes/${a.type}`,attrData(a))
    for(const i of indexes)allow('baseline','bootstrap',`${collectionPath(c)}/indexes`,i)
  }
  for(const f of plan.fixtures){const {databaseId,collectionId,...data}=f;allow('baseline','fixtures',`${collectionPath({databaseId,collectionId})}/documents`,data)}
  allow('owner-migration','bootstrap',`${collectionPath(plan.migration.target)}/attributes/string`,attrData(plan.migration.attribute))
  allow('owner-migration','bootstrap',`${collectionPath(plan.migration.target)}/indexes`,plan.migration.index)
  let started=false,phase='baseline',highLoadSince=null,ownerPermitted=false
  async function budget(){({highLoadSince}=assertCustomerAccountTestBudget(await probe(),{baselineOom,nowMs:+clock(),highLoadSince}))}
  const emit=data=>onEvent({phase,...data})
  const metadataTransport=createCustomerAccountTestMetadataTransport({target,credential:keys.metadata,secret:keys.metadata.secret,clock,transport})
  async function request(role,method,path,data){
    assertCustomerAccountTestCredential(keys[role],role,clock())
    if(method==='POST'){
      const signature=`${phase}:${path}:${JSON.stringify(data)}`
      if(allowed.get(signature)!==role||attempted.has(signature)||phase==='owner-migration'&&!ownerPermitted) fail('UNAPPROVED_WRITE')
      await budget()
      // An uncertain/failed write is never automatically retried, even on this instance.
      attempted.add(signature)
      emit({kind:'write',path,status:'attempted'})
    } else if(method!=='GET') fail('UNAPPROVED_METHOD')
    let response
    const options={method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':target.projectId,'X-Appwrite-Key':keys[role].secret,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}
    if(role==='metadata') response=await metadataTransport(target.endpoint+path,options)
    else {
      // Other roles receive only paths/payloads constructed from the pinned manifest above.
      response=await transport(target.endpoint+path,options)
      if(response.redirected||response.status>=300&&response.status<400||response.url&&response.url!==target.endpoint+path) fail('REDIRECT')
    }
    if(!response.ok)throw Object.assign(Error('CUSTOMER_ACCOUNT_TEST_REQUEST_FAILED'),{code:response.status})
    return parseSchemaJson(await response.text())
  }
  async function absent(role,path){
    try{await request(role,'GET',path)}catch(error){if(error.code===404)return;throw error}
    fail('EXISTING_RESOURCE')
  }
  const checkDatabase=(expected,actual)=>{same(actual.$id,expected.databaseId);same(actual.name,expected.name);same(actual.enabled,true)}
  const checkCollection=(expected,actual)=>{same(actual.$id,expected.collectionId);validateCollectionDefinition(expected.collectionId,actual,expected)}
  async function wait(c,kind,definition){
    const path=`${collectionPath(c)}/${kind}/${definition.key}`
    for(let attempt=0;attempt<30;attempt++){
      await budget()
      const value=await request('metadata','GET',path)
      if(!['available','processing'].includes(value.status))fail('SCHEMA_FAILED')
      if(kind==='attributes')validateAttributeDefinition(c.collectionId,definition,value)
      else validateIndexDefinition(c.collectionId,definition,value)
      if(value.status==='available'){emit({kind,databaseId:c.databaseId,collectionId:c.collectionId,key:definition.key,status:'available'});return}
      await sleep(1000)
    }
    fail('SCHEMA_TIMEOUT')
  }
  async function verifySchema(includeOwner){
    const all=await request('metadata','GET','/databases'+limit)
    if(!Array.isArray(all.databases)||all.total!==2||all.databases.length!==2)fail('INVENTORY_MISMATCH')
    same(all.databases.map(d=>d.$id).sort(),plan.creates.databases.map(d=>d.databaseId).sort())
    for(const db of plan.creates.databases){
      checkDatabase(db,await request('metadata','GET',dbPath(db.databaseId)))
      const values=await request('metadata','GET',`${dbPath(db.databaseId)}/collections${limit}`)
      const expected=plan.creates.collections.filter(c=>c.databaseId===db.databaseId)
      if(!Array.isArray(values.collections)||values.total!==expected.length||values.collections.length!==expected.length)fail('INVENTORY_MISMATCH')
      same(values.collections.map(c=>c.$id).sort(),expected.map(c=>c.collectionId).sort())
    }
    for(const c of plan.creates.collections){
      checkCollection(c,await request('metadata','GET',collectionPath(c)))
      const owned=includeOwner&&c.databaseId===plan.migration.target.databaseId&&c.collectionId===plan.migration.target.collectionId
      for(const [kind,definitions,validate] of [['attributes',[...c.attributes,...(owned?[plan.migration.attribute]:[])],validateAttributeDefinition],['indexes',[...c.indexes,...(owned?[plan.migration.index]:[])],validateIndexDefinition]]){
        const values=await request('metadata','GET',`${collectionPath(c)}/${kind}${limit}`)
        assertCompleteExactAvailableKeySet(`${c.collectionId}.${kind}`,definitions,values,kind)
        for(const definition of definitions)validate(c.collectionId,definition,values[kind].find(v=>v.key===definition.key))
      }
    }
  }
  const env={...plan.env,APPWRITE_API_KEY:keys.metadata.secret}
  const readClient=createCustomerMigrationClient(env,metadataTransport)
  return {async run({applyOwner=false}={}){
    if(started)fail('ALREADY_STARTED');started=true
    await budget()
    if((await request('metadata','GET','/health/version')).version!=='1.8.1')fail('UNSUPPORTED_VERSION')
    const inventory=await request('metadata','GET','/databases'+limit)
    if(!Array.isArray(inventory.databases)||inventory.total!==0||inventory.databases.length!==0)fail('INVENTORY_NOT_EMPTY')
    for(const db of plan.creates.databases){
      await absent('metadata',dbPath(db.databaseId))
      await request('bootstrap','POST','/databases',db)
      checkDatabase(db,await request('metadata','GET',dbPath(db.databaseId)))
      emit({kind:'database',databaseId:db.databaseId,status:'created'})
    }
    for(const c of plan.creates.collections){
      await absent('metadata',collectionPath(c))
      const {databaseId,attributes,indexes,...data}=c;void attributes;void indexes
      await request('bootstrap','POST',`${dbPath(databaseId)}/collections`,data)
      checkCollection(c,await request('metadata','GET',collectionPath(c)))
    }
    for(const c of plan.creates.collections)for(const a of c.attributes){
      await absent('metadata',`${collectionPath(c)}/attributes/${a.key}`)
      await request('bootstrap','POST',`${collectionPath(c)}/attributes/${a.type}`,attrData(a))
      await wait(c,'attributes',a)
    }
    for(const c of plan.creates.collections)for(const i of c.indexes){
      await absent('metadata',`${collectionPath(c)}/indexes/${i.key}`)
      await request('bootstrap','POST',`${collectionPath(c)}/indexes`,i)
      await wait(c,'indexes',i)
    }
    for(const f of plan.fixtures){
      const path=`${collectionPath(f)}/documents`,{databaseId,collectionId,...data}=f;void databaseId;void collectionId
      await absent('fixtures',`${path}/${f.documentId}`)
      await request('fixtures','POST',path,data)
      const value=await request('fixtures','GET',`${path}/${f.documentId}`)
      same(value.$id,f.documentId);same(value.$permissions,f.permissions)
      for(const [key,expected]of Object.entries(f.data))same(value[key],expected)
    }
    await verifySchema(false)
    const dryRun=await runCustomerAccountMigration({env,client:readClient})
    const expectedDry={mode:'dry-run',ready:false,ownershipTarget:plan.migration.target,changes:[{kind:'attribute',...plan.migration.attribute},{kind:'index',...plan.migration.index}]}
    try{assert.deepEqual(dryRun,expectedDry)}catch{fail('DRY_RUN_MISMATCH')}
    emit({kind:'migration-dry-run',changes:2,status:'verified'})
    let ownerApply=null
    if(applyOwner===true){
      phase='owner-migration';ownerPermitted=true
      let ownerAttributeCreated=false
      const client={...readClient,
        getCollection:async t=>{const value=await readClient.getCollection(t);const definition=plan.creates.collections.find(c=>c.databaseId===t.databaseId&&c.collectionId===t.collectionId);if(!definition)fail('UNAPPROVED_RESOURCE');checkCollection(definition,value);return value},
        createStringAttribute:async({databaseId,collectionId,...definition})=>{
          same({databaseId,collectionId},plan.migration.target);same(definition,plan.migration.attribute)
          await verifySchema(false)
          await absent('metadata',`${collectionPath(plan.migration.target)}/attributes/customerUserId`)
          await absent('metadata',`${collectionPath(plan.migration.target)}/indexes/customerUser_created_idx`)
          const value=await request('bootstrap','POST',`${collectionPath(plan.migration.target)}/attributes/string`,attrData(definition))
          ownerAttributeCreated=true
          return value
        },
        createIndex:async({databaseId,collectionId,...definition})=>{
          if(!ownerAttributeCreated)fail('DRY_RUN_RACE')
          same({databaseId,collectionId},plan.migration.target);same(definition,plan.migration.index)
          await absent('metadata',`${collectionPath(plan.migration.target)}/indexes/customerUser_created_idx`)
          return request('bootstrap','POST',`${collectionPath(plan.migration.target)}/indexes`,definition)
        },
      }
      ownerApply=await runCustomerAccountMigration({env,client,apply:true,sleep:async ms=>{await budget();await sleep(ms)}})
      same(ownerApply.changes,expectedDry.changes)
      await verifySchema(true)
      emit({kind:'migration',status:'available'})
    }
    await budget()
    return {manifestSha256:APPROVED_CUSTOMER_ACCOUNT_TEST_MANIFEST_SHA256,projectId:target.projectId,counts:{databases:2,collections:12,attributes:181+(ownerApply?1:0),indexes:37+(ownerApply?1:0),documents:1},dryRun,ownerApply,allSchemaAvailable:true,exactAclVerified:12}
  }}
}
