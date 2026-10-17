import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../docs/customer-account-b4-smtp-manifest.json' with {type:'json'}
const api=await import('../scripts/customer-account-smtp-test.mjs').catch(()=>({}))
const target={endpoint:manifest.endpoint,projectId:manifest.projectId}
const smtpPayload={...manifest.smtp};delete smtpPayload.enabled
const fields=['authEmailPassword','authPhone','authUsersAuthMagicURL','authEmailOtp','authAnonymous','authInvites','authJWT']
const credential={keyId:'11111111-1111-4111-8111-111111111111',domainId:manifest.domainId,permission:'sending_access',consoleVerified:true,secret:'re_synthetic_test_credential_1234567890'}
const domain={id:manifest.domainId,name:manifest.domain,status:'verified'}
function harness(){
 const project={$id:target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authLimit:2,oAuthProviders:[{key:'google',enabled:true,secret:'synthetic-google-secret'}],...Object.fromEntries(fields.map(k=>[k,false])),smtpEnabled:false},calls=[]
 let claims=0
 const transport=async(url,o)=>{calls.push({url,...o});assert.equal(o.redirect,'error');assert.equal(o.headers['X-Appwrite-Project'],'console');assert.equal(o.headers.Cookie,'synthetic-owner');const body=o.body?JSON.parse(o.body):null
  if(o.method==='GET')return new Response(JSON.stringify(project))
  if(o.method==='PATCH'){assert.equal(url,target.endpoint+'/projects/'+target.projectId+'/smtp');assert.deepEqual(body,{...manifest.smtp,password:credential.secret});for(const[k,v]of Object.entries(body))project['smtp'+k[0].toUpperCase()+k.slice(1)]=v;return new Response(JSON.stringify(project))}
  if(o.method==='POST'){assert.equal(url,target.endpoint+'/projects/'+target.projectId+'/smtp/tests');assert.deepEqual(body,{emails:['owner@example.test'],...smtpPayload,password:credential.secret});return new Response(null,{status:204})}
  throw Error('Unexpected request')
 }
 const claim=async()=>{if(claims++)throw Error('Already claimed');return true}
 const make=(patch={})=>{assert.equal(typeof api.createSmtpTestManager,'function');return api.createSmtpTestManager({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-owner'},credential,domain,approvedRecipient:'owner@example.test',claim,transport,...patch})}
 return {project,calls,make,get claims(){return claims}}
}
test('B4 rejects operating/variant targets, wrong domain/key permissions and absent approval before HTTP',()=>{
 const h=harness()
 assert.equal(typeof api.createSmtpTestManager,'function')
 for(const patch of [{target:{...target,projectId:'verygood-au'}},{target:{...target,endpoint:target.endpoint+'/'}},{credential:{...credential,domainId:'operating-domain'}},{credential:{...credential,permission:'full_access'}},{credential:{...credential,consoleVerified:false}},{domain:{...domain,status:'pending'}},{approvedRecipient:'one@example.test,two@example.test'},{approvedRecipient:'owner@example.test\n'},{credential:{...credential,secret:credential.secret+'\n'}},{claim:undefined}])assert.throws(()=>h.make(patch))
 assert.equal(h.calls.length,0)
})
test('B4 applies exact TLS SMTP once, preserves Auth, sends one approved sample and never returns secrets',async()=>{
 const h=harness(),m=h.make();const before=await m.inspect();const configured=await m.configure();assert.equal(configured.smtp.enabled,true);assert.equal(configured.protectedFingerprint,before.protectedFingerprint);await assert.rejects(m.configure())
 const sent=await m.sendTest({recipient:'owner@example.test',sampleApproved:true});assert.deepEqual(sent,{accepted:true,recipientCount:1});await assert.rejects(m.sendTest({recipient:'owner@example.test',sampleApproved:true}));assert.equal(h.calls.filter(c=>c.method==='POST').length,1);assert.equal(h.claims,1)
 assert.ok(!JSON.stringify(configured).includes(credential.secret));assert.ok(!JSON.stringify(configured).includes('synthetic-google-secret'));assert.equal(h.project.serviceStatusForAccount,false)
})
test('B4 blocks wrong/multiple/unapproved recipients before claim or POST and refuses Account ON',async()=>{
 const h=harness(),m=h.make();await m.configure()
 for(const options of [{recipient:'foreign@example.test',sampleApproved:true},{recipient:['owner@example.test'],sampleApproved:true},{recipient:'owner@example.test',sampleApproved:false}])await assert.rejects(m.sendTest(options))
 assert.equal(h.claims,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,0)
 h.project.serviceStatusForAccount=true;await assert.rejects(m.sendTest({recipient:'owner@example.test',sampleApproved:true}));assert.equal(h.claims,0)
})
test('B4 ambiguous POST consumes durable claim and cannot retry even from a new manager',async()=>{
 const h=harness(),m=h.make();await m.configure();let postCount=0;const baseTransport=async(url,o)=>{if(o.method==='POST'){postCount++;throw Error('Synthetic transport timeout')}return new Response(JSON.stringify(h.project))};const one=h.make({transport:baseTransport});await assert.rejects(one.sendTest({recipient:'owner@example.test',sampleApproved:true}));const two=h.make({transport:baseTransport});await assert.rejects(two.sendTest({recipient:'owner@example.test',sampleApproved:true}));assert.equal(h.claims,2);assert.equal(postCount,1)
})
test('B4 DNS guard accepts only exact new test records and never root, proxied, changed or existing names',()=>{
 assert.equal(typeof api.assertNewSmtpDnsRecord,'function');const inventory={complete:true,records:[]};for(const r of manifest.dnsRecords)assert.deepEqual(api.assertNewSmtpDnsRecord(r,inventory),r)
 const r=manifest.dnsRecords[0];for(const [record,inv]of [[{...r,name:'_dmarc.verygood-chocolate.com'},inventory],[{...r,content:'wrong'},inventory],[{...r,proxied:true},inventory],[r,{complete:false,records:[]}],[r,{complete:true,records:[{name:r.name.toUpperCase()+'.'}]}]])assert.throws(()=>api.assertNewSmtpDnsRecord(record,inv))
})
test('B4 caller mutation of imported JSON cannot expand the DNS write allowlist',()=>{
 const root={...manifest.dnsRecords[0],name:'_dmarc.verygood-chocolate.com'}
 manifest.dnsRecords.push(root)
 try{assert.throws(()=>api.assertNewSmtpDnsRecord(root,{complete:true,records:[]}))}finally{manifest.dnsRecords.pop()}
})
test('B4 redirects and auth drift stop configuration without following or repairing them',async()=>{
 const h=harness();let writes=0
 const redirected=async()=>({ok:true,redirected:true,url:target.endpoint+'/projects/'+target.projectId,json:async()=>h.project})
 await assert.rejects(h.make({transport:redirected}).configure());assert.equal(h.calls.length,0)
 const drifting=async(url,o)=>{if(o.method==='PATCH'){writes++;Object.assign(h.project,Object.fromEntries(Object.entries({...manifest.smtp,password:credential.secret}).map(([k,v])=>['smtp'+k[0].toUpperCase()+k.slice(1),v])));h.project.oAuthProviders[0].secret='changed-by-another-writer'}return new Response(JSON.stringify(h.project))}
 await assert.rejects(h.make({transport:drifting}).configure());assert.equal(writes,1)
})
