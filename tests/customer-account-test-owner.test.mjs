import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
const owner=await import('../scripts/customer-account-test-owner.mjs').catch(()=>({}))
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',resources:{databaseIds:['ca_test_cake_au','ca_test_kids_au'],functionIds:[]}}
const now=new Date('2026-10-17T14:00:00Z')
function harness({wrongScopes=false,unlimited=false,failedCreate=false,notOwner=false,accountOn=false,serverDateFormat=false,existingMetadata=null}={}){
 const calls=[],saved=[],keys=new Map(existingMetadata?[[existingMetadata.$id,existingMetadata]]:[])
 const transport=async(url,options)=>{
  const path=url.slice(target.endpoint.length);calls.push({path,options})
  assert.equal(options.headers['X-Appwrite-Project'],'console');assert.equal(options.headers['X-Appwrite-Mode'],undefined);assert.equal(options.headers.Cookie,'synthetic-cli-session');assert.equal(options.redirect,'error')
  let body
  if(path==='/account')body={$id:'owner-id',email:'owner@example.test'}
  else if(path==='/account/sessions/current')body={userId:'owner-id',current:true,expire:unlimited?'':new Date(+now+86400000).toISOString()}
  else if(path==='/teams/team-id/memberships')body={total:1,memberships:[{userId:'owner-id',confirm:true,roles:[notOwner?'developer':'owner']}]}
  else if(path==='/projects/verygood-au-account-test')body={$id:target.projectId,teamId:'team-id',serviceStatusForAccount:accountOn}
  else if(path==='/projects/verygood-au-account-test/keys'&&options.method==='GET')body={total:keys.size,keys:[...keys.values()]}
  else if(path==='/projects/verygood-au-account-test/keys'&&options.method==='POST'){
   if(failedCreate)return new Response('{}',{status:503})
   const data=JSON.parse(options.body);body={$id:`key-${keys.size}`,$createdAt:now.toISOString(),name:data.name,scopes:wrongScopes?['tables.read']:data.scopes,expire:serverDateFormat?data.expire.replace('Z','+00:00'):data.expire,secret:`private-${keys.size}`};keys.set(body.$id,body)
  }else if(path.startsWith('/projects/verygood-au-account-test/keys/'))body=keys.get(path.split('/').at(-1))
  else throw Error('Unexpected Owner route')
  return new Response(JSON.stringify(body),{status:options.method==='POST'?201:200})
 }
 let smoke=0
 const make=(changes={})=>{assert.equal(typeof owner.createCustomerAccountTestOwnerManager,'function');return owner.createCustomerAccountTestOwnerManager({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-cli-session',selfSigned:false},expectedEmailSha256:createHash('sha256').update('owner@example.test').digest('hex'),teamId:'team-id',transport,clock:()=>now,saveCredential:async(role,value)=>saved.push({role,value}),metadataSmoke:async credential=>{smoke++;assert.equal(credential.projectId,'verygood-au-account-test')},...changes})}
 return {calls,saved,make,get smoke(){return smoke}}
}
test('wrong target or insecure/non-session credentials reject before any Owner request',()=>{
 const h=harness();assert.equal(typeof owner.createCustomerAccountTestOwnerManager,'function')
 for(const changes of [{target:{...target,projectId:'verygood-au'}},{target:{...target,endpoint:target.endpoint+'/'}},{cliSession:{endpoint:target.endpoint,cookie:'x',selfSigned:true}},{cliSession:{endpoint:target.endpoint,cookie:'x',key:'global-key'}}])assert.throws(()=>h.make(changes))
 assert.equal(h.calls.length,0)
})
test('only verified finite Owner session and Account OFF permit metadata first, then exact legacy keys',async()=>{
 const h=harness(),m=h.make();await assert.rejects(m.issue('metadata'));assert.equal(h.calls.length,0)
 await m.verify();await assert.rejects(m.issue('bootstrap'));assert.equal(h.calls.filter(c=>c.options.method==='POST').length,0)
 const first=await m.issue('metadata');assert.equal(first.projectId,target.projectId);assert.equal(first.verifiedVia,'official-owner-api-cli-session');assert.ok(!JSON.stringify(first).includes('private-'));assert.equal(h.smoke,1)
 await m.issue('bootstrap');await m.issue('fixtures')
 const posts=h.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body))
 assert.deepEqual(posts.map(p=>p.scopes),[['databases.read','collections.read','attributes.read','indexes.read'],['databases.read','collections.read','attributes.read','indexes.read','databases.write','collections.write','attributes.write','indexes.write'],['documents.read','documents.write']])
 assert.deepEqual(posts.map(p=>p.name),['ca-test-metadata-20261017-b2','ca-test-bootstrap-20261017-b2','ca-test-fixtures-20261017-b2'])
 assert.ok(Date.parse(posts[0].expire)-now<=86400000);assert.ok(posts.slice(1).every(p=>Date.parse(p.expire)-now<=7200000));assert.equal(h.saved.length,6);assert.equal(h.saved.filter(v=>v.value.consoleVerified===true).length,3)
 assert.ok(h.calls.some(c=>c.path==='/projects/verygood-au-account-test/keys/key-0'&&c.options.method==='GET'))
 assert.equal(Object.keys(m.credentials()).length,3)
})
test('non-Owner, unbounded session, wrong identity or enabled Account cannot create keys',async()=>{
 for(const options of [{notOwner:true},{unlimited:true},{accountOn:true}]){const h=harness(options);await assert.rejects(h.make().verify());assert.equal(h.calls.filter(c=>c.options.method==='POST').length,0)}
 const h=harness();await assert.rejects(h.make({expectedEmailSha256:'0'.repeat(64)}).verify());assert.equal(h.calls.filter(c=>c.options.method==='POST').length,0)
})
test('unexpected scopes or uncertain create stop all further key issuance without retries',async()=>{
 for(const options of [{wrongScopes:true},{failedCreate:true}]){const h=harness(options),m=h.make();await m.verify();await assert.rejects(m.issue('metadata'));await assert.rejects(m.issue('metadata'));await assert.rejects(m.issue('bootstrap'));assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(h.smoke,0)}
})

test('Appwrite UTC offset serialization is the same expiry instant and does not cause duplicate keys',async()=>{
 const h=harness({serverDateFormat:true}),m=h.make();await m.verify();const value=await m.issue('metadata');assert.equal(h.smoke,1);assert.ok(value.expiresAt.endsWith('+00:00'));assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1)
})
test('resume verifies the already issued metadata key by scoped GET and smoke before other keys, with no metadata POST',async()=>{
 const existingMetadata={$id:'existing-key',$createdAt:'2026-10-17T13:59:00+00:00',name:'ca-test-metadata-20261017-b2',scopes:['databases.read','collections.read','attributes.read','indexes.read'],expire:'2026-10-18T13:55:00+00:00',secret:'original-private-secret'}
 const h=harness({existingMetadata}),m=h.make({existingMetadata});await m.verify();assert.equal(h.smoke,1);await assert.rejects(m.issue('metadata'));await m.issue('bootstrap');assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(h.saved.filter(v=>v.role==='metadata'&&v.value.consoleVerified===true).length,1)
 const bad=harness({existingMetadata}),n=bad.make({existingMetadata:{...existingMetadata,scopes:['tables.read']}});await assert.rejects(n.verify());assert.equal(bad.calls.filter(c=>c.options.method==='POST').length,0)
})
test('test Auth admin creation is one fixed UID with no login identifiers, role or password',async()=>{
 assert.equal(typeof owner.createCustomerAccountTestAdmin,'function')
 const calls=[]
 const user={$id:'ca-test-admin-m-20261017',name:'CA TEST Admin M',email:'',phone:'',passwordUpdate:'',labels:[]}
 const transport=async(url,o)=>{calls.push({url,o});assert.equal(o.headers['X-Appwrite-Project'],'verygood-au-account-test');assert.equal(o.headers['X-Appwrite-Mode'],'admin');return new Response(JSON.stringify(o.method==='POST'||url.endsWith('/ca-test-admin-m-20261017')?user:{total:0,users:[]}),{status:o.method==='POST'?201:200})}
 const run=changes=>owner.createCustomerAccountTestAdmin({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-cli-session'},transport,...changes})
 await assert.rejects(run({target:{...target,projectId:'verygood-au'}}));assert.equal(calls.length,0)
 assert.equal((await run()).$id,user.$id)
 assert.deepEqual(JSON.parse(calls.find(c=>c.o.method==='POST').o.body),{userId:'ca-test-admin-m-20261017',name:'CA TEST Admin M'})
 const existing=[];await assert.rejects(run({transport:async(_url,o)=>{existing.push(o.method);return new Response('{"total":1,"users":[{}]}')}}));assert.deepEqual(existing,['GET'])
})
