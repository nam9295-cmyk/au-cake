import assert from 'node:assert/strict'
import test from 'node:test'
import * as profiles from '../src/lib/customer-profile'
const input={version:1,name:'Customer Name',contactEmail:' Orders@Example.test ',phone:'+61 412 345 678',language:'ko'}
test('profile normalizes AU phone and contact email without changing login email or unrelated preferences',()=>{
  const validate=Reflect.get(profiles,'validateCustomerProfile'),read=Reflect.get(profiles,'readCustomerProfile'),merge=Reflect.get(profiles,'mergeCustomerPreferences')
  assert.equal(typeof validate,'function')
  const value=validate(input)
  assert.deepEqual(value,{version:1,name:'Customer Name',contactEmail:'orders@example.test',phone:'0412345678',language:'ko'})
  const prefs={unrelatedPreference:'keep',verygoodAuCustomer:value}
  assert.deepEqual(merge(prefs,value),prefs)
  assert.equal(read({name:'Google Name',email:'login@example.test',prefs}).contactEmail,'orders@example.test')
  assert.equal(read({name:'Google Name',email:'login@example.test',prefs:{}}).contactEmail,'login@example.test')
  assert.equal(read({name:'Google Name',email:'login@example.test',prefs:{verygoodAuCustomer:{version:999}}}).name,'Google Name')
})
test('invalid profile rejects before storage and blank phone is permitted',()=>{
  const validate=Reflect.get(profiles,'validateCustomerProfile');assert.equal(typeof validate,'function')
  for(const change of [{name:'X'},{name:'A'.repeat(81)},{contactEmail:'invalid'},{phone:'0212345678'},{language:'ja'},{version:2}])assert.throws(()=>validate({...input,...change}),/INVALID_CUSTOMER_PROFILE/)
  assert.equal(validate({...input,phone:''}).phone,'')
})
