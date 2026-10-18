import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=await import('../scripts/customer-account-b7-v3-fixtures.mjs').catch(()=>({}))
const bytes=readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),m=JSON.parse(bytes),proof={manifestVersion:3,manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',approved:true,residualPublicInvocationRiskAccepted:true,allowAutoExtend:false}
function setup(changes={}){const calls=[],state={attempts:{}};const args={manifestBytes:bytes,approvalProof:proof,target:m.target,cliSession:{endpoint:m.target.endpoint,cookie:'mock-owner'},hEmail:'verygoutchocolate@gmail.com',codes:{manual:'JENNIETEST7',review:'FOXKIWI7Q2MK'},hmacSecret:Buffer.alloc(32,8).toString('base64url'),persist:async()=>{},state,transport:async(url,o)=>{calls.push({url,...o});if(url.includes('/projects/'))return Response.json({$id:m.target.projectId,serviceStatusForAccount:false});if(url.endsWith('/users'))return o.method==='GET'?Response.json({total:2,users:[m.actors.M,m.actors.G].map(x=>({$id:x.uid}))}):Response.json({$id:m.actors.H.uid,email:'verygoutchocolate@gmail.com',status:true,labels:[]});if(o.method==='GET')return Response.json({total:0,documents:[]});const b=JSON.parse(o.body);return Response.json({$id:b.documentId,...b.data})},...changes};return {calls,args}}
test('V3 fixture manager rejects changed email or project before network',()=>{
 assert.equal(typeof api.createB7V3FixtureManager,'function')
 for(const changes of [{hEmail:'another@example.invalid'},{target:{...m.target,projectId:'verygood-au'}},{approvalProof:{...proof,manifestVersion:2}}]){const s=setup(changes);assert.throws(()=>api.createB7V3FixtureManager(s.args));assert.equal(s.calls.length,0)}
})
test('V3 creates only H and exactly two private synthetic coupons, no email or password, one attempt each',async()=>{
 assert.equal(typeof api.createB7V3FixtureManager,'function')
 const s=setup(),r=api.createB7V3FixtureManager(s.args)
 await r.createH();await r.createCoupons()
 const writes=s.calls.filter(x=>x.method==='POST');assert.equal(writes.length,3)
 assert.deepEqual(JSON.parse(writes[0].body),{userId:m.actors.H.uid,email:'verygoutchocolate@gmail.com',name:'B7 TEST ONLY H'})
 for(const [i,c]of writes.slice(1).entries()){const b=JSON.parse(c.body),fixture=m.couponFixtures[i];assert.equal(b.documentId,fixture.documentId);assert.equal(b.data.rewardPercent,fixture.rewardPercent);assert.equal(b.data.status,'active');assert.deepEqual(b.permissions,['read("user:ca-test-admin-m-20261017")','update("user:ca-test-admin-m-20261017")','delete("user:ca-test-admin-m-20261017")']);assert.equal(JSON.stringify(b).includes(i?'FOXKIWI7Q2MK':'JENNIETEST7'),false)}
 const n=s.calls.length;await assert.rejects(r.createH());await assert.rejects(r.createCoupons());assert.equal(s.calls.length,n)
 assert.ok(s.calls.every(c=>c.headers['X-Appwrite-Project']===(c.url.includes('/projects/')?'console':'verygood-au-account-test')))
})
