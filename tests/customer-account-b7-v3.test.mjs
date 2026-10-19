import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const read=name=>readFileSync(new URL('../docs/'+name,import.meta.url))
const v2=JSON.parse(read('customer-account-b7-execution-manifest-v2.json'))
const api=await import('../scripts/customer-account-b7-v3-contract.mjs').catch(()=>({}))
const hash=x=>createHash('sha256').update(x).digest('hex')
test('V3 adds exactly two flags and preserves V1/V2 approval bytes and every execution limit',()=>{
 assert.equal(typeof api.inspectB7V3VariableState,'function')
 const bytes=read('customer-account-b7-execution-manifest-v3.json'),v3=JSON.parse(bytes)
 assert.equal(hash(read('customer-account-b7-execution-manifest.json')),'f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43')
 assert.equal(hash(read('customer-account-b7-execution-manifest-v2.json')),'2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41')
 assert.equal(v3.executionApproved,false);assert.equal(v3.proposedWrites.functionVariablesAddedMax,7)
 assert.deepEqual(v3.newGuardVariableNames,v2.newGuardVariableNames)
 assert.deepEqual(v3.newFunctionVariableNames,[...v2.newGuardVariableNames,'AU_RENEWAL_WRITES_ENABLED','AU_RENEWAL_PREORDERS_ENABLED'])
 for(const field of ['target','actors','window','requiredBeforeOpen','orders','couponFixtures','fixedBusinessPolicies','stopConditions','restoreState','publicInvocationResidualRisk'])assert.deepEqual(v3[field],v2[field],field)
 assert.deepEqual({...v3.proposedWrites,functionVariablesAddedMax:5},v2.proposedWrites)
})
function rows(phase='prepare'){
 const v3=JSON.parse(read('customer-account-b7-execution-manifest-v3.json')),window=phase==='approvedWindow'
 const values={B7_TEST_RUN_ID:v3.runId,B7_TEST_STARTS_AT:window?'1792281600000':'0',B7_TEST_ENDS_AT:window?'1792282500000':'0',B7_TEST_HMAC_SECRET:'',B7_TEST_FIXTURE_MANIFEST_SHA256:'a'.repeat(64),AU_RENEWAL_WRITES_ENABLED:window?'true':'false',AU_RENEWAL_PREORDERS_ENABLED:'false',CUSTOMER_ACCOUNT_ENABLED:window?'true':'false'}
 return Object.entries(values).map(([key,value])=>({key,value,secret:key==='B7_TEST_HMAC_SECRET'}))
}
test('V3 requires all seven explicit variables, exact secret metadata and phase flags with no defaults',()=>{
 assert.equal(typeof api.inspectB7V3VariableState,'function')
 const bytes=read('customer-account-b7-execution-manifest-v3.json')
 for(const phase of ['prepare','approvedWindow','closed']){const r=api.inspectB7V3VariableState({manifestBytes:bytes,variables:rows(phase),phase});assert.equal(r.remoteWritesAllowed,false);assert.equal(r.requiredNewVariableCount,7)}
 const all=rows();for(const key of JSON.parse(bytes).newFunctionVariableNames)assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:bytes,variables:all.filter(v=>v.key!==key),phase:'prepare'}))
 for(const alter of [x=>{x.find(v=>v.key==='AU_RENEWAL_WRITES_ENABLED').value='true'},x=>{x.find(v=>v.key==='AU_RENEWAL_PREORDERS_ENABLED').value='true'},x=>{x.find(v=>v.key==='B7_TEST_HMAC_SECRET').secret=false},x=>x.push(x[0])]){const vars=rows();alter(vars);assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:bytes,variables:vars,phase:'prepare'}))}
 assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:read('customer-account-b7-execution-manifest-v2.json'),variables:all,phase:'prepare'}))
})
test('V3 rejects unreadable public variables and additional unapproved guard variables',()=>{
 const bytes=read('customer-account-b7-execution-manifest-v3.json')
 const missingValue=rows('closed');delete missingValue.find(v=>v.key==='B7_TEST_STARTS_AT').value
 assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:bytes,variables:missingValue,phase:'closed'}))
 assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:bytes,variables:[...rows(),{key:'B7_TEST_EXTRA',value:'unapproved',secret:false}],phase:'prepare'}))
 const tooLong=rows('approvedWindow');tooLong.find(v=>v.key==='B7_TEST_ENDS_AT').value='1792282500001'
 assert.throws(()=>api.inspectB7V3VariableState({manifestBytes:bytes,variables:tooLong,phase:'approvedWindow'}))
})
