import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=await import('../scripts/customer-account-b7-contract.mjs').catch(()=>({}))
const bytes=readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v2.json',import.meta.url))
const proof={manifestSha256:'2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41',approved:true,residualPublicInvocationRiskAccepted:true,allowAutoExtend:false}
const target=JSON.parse(bytes).target
const input={manifestBytes:bytes,approvalProof:proof,target,phase:'prepare',now:Date.parse('2026-10-18T00:00:00Z')}
test('B7 requires exact V2 bytes, approval and explicit target before any operation',()=>{
 assert.equal(typeof api.assertB7Run,'function')
 assert.equal(api.assertB7Run(input).manifest.runId,'20261018-b7-google-01')
 for(const change of [{manifestBytes:Buffer.from('{}')},{approvalProof:{...proof,approved:false}},{approvalProof:{...proof,manifestSha256:'f71da5a2'}},{target:undefined},{target:{...target,projectId:'verygood-au'}},{target:{...target,endpoint:target.endpoint+'/'}},{target:{...target,databaseIds:['verygood_cake_au']}},{phase:'unknown'},{now:NaN}])assert.throws(()=>api.assertB7Run({...input,...change}))
})
test('B7 refuses absent/extended/expired opening windows while permitting emergency close',()=>{
 assert.equal(typeof api.assertB7Run,'function')
 const window={startsAt:input.now,endsAt:input.now+900000}
 assert.equal(api.assertB7Run({...input,phase:'open',window}).phase,'open')
 for(const w of [undefined,{...window,endsAt:window.endsAt+1},{...window,startsAt:input.now+1},{...window,endsAt:input.now}])assert.throws(()=>api.assertB7Run({...input,phase:'open',window:w}))
 assert.equal(api.assertB7Run({...input,phase:'closing',window,now:window.endsAt+1}).phase,'closing')
})
