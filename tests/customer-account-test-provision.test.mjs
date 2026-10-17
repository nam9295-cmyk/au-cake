import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
const provision=await import('../scripts/provision-customer-account-test-project.mjs').catch(()=>({}))
const manifestBytes=readFileSync(new URL('../docs/customer-account-b2-resource-manifest.json',import.meta.url),'utf8')
const plan=JSON.parse(manifestBytes)
const at=new Date('2026-10-17T13:00:00Z')
const healthy={memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0.5,oomKills:0,apiHealthy:true}
function keys(){return Object.fromEntries(Object.entries({metadata:['databases.read','collections.read','attributes.read','indexes.read'],bootstrap:['databases.read','collections.read','attributes.read','indexes.read','databases.write','collections.write','attributes.write','indexes.write'],fixtures:['documents.read','documents.write']}).map(([role,scopes])=>[role,{endpoint:plan.target.endpoint,projectId:plan.target.projectId,keyId:`test-${role}`,consoleVerified:true,issuedAt:'2026-10-17T12:59:00Z',expiresAt:'2026-10-17T14:00:00Z',scopes,secret:`synthetic-${role}`}]))}
// Emulates only test DB metadata and a synthetic settings document; never a product API.
function appwrite({existing=false,pending=false,raceOwner=false,lateOwner=false,lateIndex=false,unsafeAcl=false,failCreate=false}={}){
 const db=new Map(),collections=new Map(),attributes=new Map(),indexes=new Map(),documents=new Map(),requests=[]
 let awaiting=null,active=0,maxActive=0,baselineOwnerReads=0,ownerIndexReads=0
 if(existing)db.set('unexpected',{$id:'unexpected',enabled:true,name:'unexpected'})
 const response=(body,status=200)=>new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?`int64:${v}`:v).replace(/"int64:(-?\d+)"/g,'$1'),{status})
 const transport=async(url,o)=>{
  active++;maxActive=Math.max(maxActive,active)
  try{
   assert.equal(o.redirect,'error');assert.equal(o.headers['X-Appwrite-Project'],'verygood-au-account-test')
   const u=new URL(url),parts=u.pathname.slice(4).split('/').filter(Boolean),body=o.body?JSON.parse(o.body):null
   requests.push({method:o.method,path:u.pathname,body})
   if(o.method==='POST'){
    assert.equal(awaiting,null,'next mutation before previous attribute/index available')
    if(failCreate)return response({type:'synthetic_create_failure'},503)
    if(parts.length===1){const d={$id:body.databaseId,name:body.name,enabled:body.enabled};db.set(d.$id,d);return response(d,201)}
    const id=`${parts[1]}/${parts[3]}`
    if(parts.length===3){const c={$id:body.collectionId,name:body.name,enabled:body.enabled,documentSecurity:body.documentSecurity,$permissions:body.permissions};collections.set(`${parts[1]}/${body.collectionId}`,c);return response(c,201)}
    if(parts[4]==='attributes'){
     const {type,...a}=body;void type
     const value={...a,type:parts[5]==='enum'?'string':parts[5],format:parts[5]==='enum'?'enum':'',status:'processing',default:body.default??null,array:false,encrypt:false}
     if(value.type==='integer'){value.min??=-9223372036854775808n;value.max??=9223372036854775807n}
     attributes.set(`${id}/${a.key}`,value);awaiting={kind:'attributes',id:`${id}/${a.key}`,reads:0};return response(value,202)
    }
    if(parts[4]==='indexes'){const v={...body,status:'processing'};indexes.set(`${id}/${body.key}`,v);awaiting={kind:'indexes',id:`${id}/${body.key}`,reads:0};return response(v,202)}
    if(parts[4]==='documents'){const v={...body.data,$id:body.documentId,$permissions:body.permissions};documents.set(`${id}/${body.documentId}`,v);return response(v,201)}
    throw Error('unexpected create route')
   }
   assert.equal(o.method,'GET','update/delete is never allowed')
   if(parts[0]==='health')return response({version:'1.8.1'})
   if(parts.length===1)return response({databases:[...db.values()],total:db.size})
   if(parts.length===2)return db.has(parts[1])?response(db.get(parts[1])):response({},404)
   const id=`${parts[1]}/${parts[3]}`
   if(parts.length===3){const values=[...collections.entries()].filter(([k])=>k.startsWith(parts[1]+'/')).map(([,v])=>v);return response({collections:values,total:values.length})}
   if(parts.length===4){const c=collections.get(id);if(!c)return response({},404);return response(unsafeAcl?{...c,$permissions:['read("any")']}:c)}
   const store=parts[4]==='attributes'?attributes:parts[4]==='indexes'?indexes:parts[4]==='documents'?documents:null
   assert.ok(store,'unexpected GET route')
   if(parts.length===5){const values=[...store.entries()].filter(([k])=>k.startsWith(id+'/')).map(([,v])=>v);return response({[parts[4]]:values,total:values.length})}
   const key=`${id}/${parts[5]}`
   if((raceOwner||lateOwner)&&parts[4]==='attributes'&&parts[5]==='customerUserId'&&!attributes.has(key)){
    baselineOwnerReads++
    // Existing owner appears only when the genuine migration inspects it.
    if(raceOwner||baselineOwnerReads>=2)return response({...plan.migration.attribute,default:null,status:'available'})
   }
   if(lateIndex&&parts[4]==='indexes'&&parts[5]==='customerUser_created_idx'&&!indexes.has(key)){ownerIndexReads++;if(ownerIndexReads>=2)return response({...plan.migration.index,status:'available'})}
   const value=store.get(key)
   if(!value)return response({},404)
   if(awaiting&&awaiting.id===key&&awaiting.kind===parts[4]){
    awaiting.reads++
    if(awaiting.reads>=2&&!pending){value.status='available';awaiting=null}
   }
   return response(value)
  } finally {active--}
 }
 return {transport,requests,db,collections,attributes,indexes,documents,get maxActive(){return maxActive},get ownerReads(){return baselineOwnerReads}}
}
function factory(server,changes={}){
 assert.equal(typeof provision.createCustomerAccountTestProvisioner,'function')
 return provision.createCustomerAccountTestProvisioner({manifestBytes,target:plan.target,credentials:keys(),clock:()=>at,transport:server.transport,probe:async()=>healthy,sleep:async()=>{},...changes})
}
test('approved manifest, exact target and all three credentials must pass before any network/probe',()=>{
 const server=appwrite();let probes=0
 const make=changes=>factory(server,{probe:async()=>{probes++;return healthy},...changes})
 for(const changes of [{manifestBytes:manifestBytes+'\n'},{target:{...plan.target,projectId:'verygood-au'}},{target:{...plan.target,resources:{databaseIds:['ca_test_cake_au','verygood_cake_au'],functionIds:[]}}},{credentials:{...keys(),bootstrap:{...keys().bootstrap,consoleVerified:false}}},{credentials:{...keys(),fixtures:{...keys().fixtures,scopes:['documents.read','documents.write','users.write']}}}]) assert.throws(()=>make(changes))
 assert.equal(server.requests.length,0);assert.equal(probes,0)
})
test('all baseline creates are sequential and available before the exact conditional owner migration',async()=>{
 const server=appwrite(),events=[]
 const result=await factory(server,{onEvent:e=>events.push(e)}).run({applyOwner:true})
 assert.deepEqual(result.counts,{databases:2,collections:12,attributes:182,indexes:38,documents:1})
 assert.equal(result.dryRun.changes.length,2);assert.equal(result.ownerApply.ready,true)
 assert.equal(server.maxActive,1)
 assert.equal(server.requests.filter(r=>r.method==='POST').length,235)
 assert.ok(server.requests.every(r=>r.method==='GET'||r.method==='POST'))
 assert.ok(server.requests.every(r=>!r.path.includes('verygood-au/')&&!r.path.includes('class_reservations/attributes/string/customerUserId')))
 assert.ok(events.some(e=>e.phase==='owner-migration'&&e.status==='available'))
 assert.ok(!JSON.stringify(result).includes('synthetic-bootstrap'))
 const d=[...server.documents.values()][0];assert.equal(d.bankAccount,'TEST ONLY - DO NOT PAY')
 assert.ok(server.requests.filter(r=>r.path.includes('/documents')).every(r=>r.path.includes('/ca_test_cake_au/collections/settings/documents')))
})
test('existing project resources cause zero writes and no customer document lookup',async()=>{
 const server=appwrite({existing:true})
 await assert.rejects(factory(server).run({applyOwner:true}),/INVENTORY/)
 assert.equal(server.requests.filter(r=>r.method!=='GET').length,0)
 assert.ok(server.requests.every(r=>!r.path.includes('/documents')))
})
test('dry-run without explicit owner apply never writes ownership schema',async()=>{
 const server=appwrite(),result=await factory(server).run()
 assert.equal(result.counts.attributes,181);assert.equal(result.counts.indexes,37)
 assert.equal(result.ownerApply,null);assert.equal(result.dryRun.ready,false)
 assert.equal(server.requests.filter(r=>r.method==='POST').length,233)
})
test('unexpected migration missing set refuses owner writes',async()=>{
 const server=appwrite({raceOwner:true})
 await assert.rejects(factory(server).run({applyOwner:true}),/DRY_RUN/)
 assert.ok(server.ownerReads>0)
 assert.ok(!server.requests.some(r=>r.method==='POST'&&(r.body?.key==='customerUserId'||r.body?.key==='customerUser_created_idx')))
})
test('unsafe ACL, failed create and processing timeout stop without rollback or write retries',async()=>{
 for(const options of [{unsafeAcl:true},{failCreate:true},{pending:true}]){
  const server=appwrite(options),runner=factory(server)
  await assert.rejects(runner.run({applyOwner:true}))
  const n=server.requests.length
  await assert.rejects(runner.run({applyOwner:true}),/ALREADY_STARTED/)
  assert.equal(server.requests.length,n)
  assert.ok(server.requests.every(r=>r.method==='GET'||r.method==='POST'))
  if(options.failCreate)assert.equal(server.requests.filter(r=>r.method==='POST').length,1)
  if(options.pending)assert.equal(server.requests.filter(r=>r.method==='POST'&&r.path.includes('/attributes')).length,1)
 }
})
test('low RAM/disk, API failure, new OOM and sustained high load block the next mutation',async()=>{
 assert.equal(typeof provision.assertCustomerAccountTestBudget,'function')
 for(const change of [{memoryAvailableBytes:3*2**30-1},{diskAvailableBytes:30*2**30-1},{apiHealthy:false},{oomKills:1}]){
  const server=appwrite()
  await assert.rejects(factory(server,{probe:async()=>({...healthy,...change})}).run())
  assert.equal(server.requests.filter(r=>r.method==='POST').length,0)
 }
 const first=provision.assertCustomerAccountTestBudget({...healthy,load1:4},{baselineOom:0,nowMs:1000,highLoadSince:null})
 assert.equal(first.highLoadSince,1000)
 assert.throws(()=>provision.assertCustomerAccountTestBudget({...healthy,load1:4},{baselineOom:0,nowMs:301000,highLoadSince:1000}),/BUDGET/)
 assert.doesNotThrow(()=>provision.assertCustomerAccountTestBudget({...healthy,memoryAvailableBytes:3*2**30,diskAvailableBytes:30*2**30},{baselineOom:0,nowMs:301000,highLoadSince:1000}))
})

test('schema racing after dry-run cannot cause a partial owner apply',async()=>{
 for(const option of [{lateOwner:true},{lateIndex:true}]){
  const server=appwrite(option)
  await assert.rejects(factory(server).run({applyOwner:true}))
  assert.ok(!server.requests.some(r=>r.method==='POST'&&(r.body?.key==='customerUserId'||r.body?.key==='customerUser_created_idx')))
 }
})
