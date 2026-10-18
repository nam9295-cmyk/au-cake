import test from 'node:test'
import assert from 'node:assert/strict'
const api=await import('../scripts/customer-account-settings-fingerprint.mjs').catch(()=>({}))
test('settings fingerprints cover Auth SMTP OAuth and service policy without exposing credentials',()=>{
 assert.equal(typeof api.semanticSettingsEvidence,'function')
 const secret='synthetic-sensitive-value',base={$id:'fixture',authEmailOtp:false,authLimit:2,smtpEnabled:true,smtpPassword:secret,serviceStatusForAccount:false,oAuthProviders:[{key:'google',enabled:true,secret,appId:'public-test-id'}],$updatedAt:'ignored-clock'}
 const a=api.semanticSettingsEvidence(base),b=api.semanticSettingsEvidence({...base,$updatedAt:'another-clock'})
 assert.deepEqual(a,b);assert.equal(JSON.stringify(a).includes(secret),false)
 for(const [key,value]of Object.entries({authEmailOtp:true,authLimit:3,smtpPassword:'rotated-fixture-value',serviceStatusForAccount:true,oAuthProviders:[{key:'google',enabled:false,secret}]})){
  const changed=api.semanticSettingsEvidence({...base,[key]:value});assert.notEqual(changed.sha256,a.sha256);assert.notEqual(changed.fieldSha256[key],a.fieldSha256[key])
 }
 assert.equal(a.historicalEquivalenceProven,false)
})
