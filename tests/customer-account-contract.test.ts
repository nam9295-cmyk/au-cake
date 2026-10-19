import assert from 'node:assert/strict'
import test from 'node:test'
import * as config from '../src/lib/customer-account-config'
import * as orders from '../src/lib/customer-orders'
import * as serverOrders from '../appwrite-functions/reservation-api/src/customer-orders.js'
import fixtures from './fixtures/customer-account/orders.json'

test('customer feature requires AU, configured all API and exact explicit true', () => {
  const resolve = Reflect.get(config, 'resolveCustomerAccountConfig')
  assert.equal(typeof resolve, 'function', 'default-off resolver must exist')
  const base = {market:'AU',configured:true,frontendEnabled:'true',reservationApiMode:'all'}
  assert.deepEqual(resolve(base), {enabled:true})
  for (const delta of [{market:'KR'},{configured:false},{frontendEnabled:undefined},{frontendEnabled:'TRUE'},{frontendEnabled:false},{reservationApiMode:'lookup'},{reservationApiMode:'off'}]) {
    assert.equal(resolve({...base,...delta}).enabled,false)
  }
})

test('health parser accepts only boolean contract and health transport uses fixed action', async () => {
  const parse = Reflect.get(orders,'parseCustomerAccountHealth')
  assert.equal(typeof parse,'function')
  assert.deepEqual(parse({enabled:false,ready:false}),{enabled:false,ready:false})
  assert.throws(()=>parse({enabled:'true',ready:true}))
  assert.throws(()=>parse({enabled:true,ready:true,token:'secret'}))
  const calls: unknown[]=[]
  const get = Reflect.get(orders,'getCustomerAccountHealth')
  assert.deepEqual(await get(async (action: string,_data:unknown,parser:(v:unknown)=>unknown)=>{
    calls.push(action); return parser({enabled:true,ready:true})
  }),{enabled:true,ready:true})
  assert.deepEqual(calls,['customer-account-health'])
})

const summary = {id:'order-a',reservationNumber:'AU-1',createdAt:'2026-10-17T00:00:00.000Z',pickupDate:'2026-11-01',pickupTime:'12:00',status:'pending',paymentStatus:'unpaid',totalPriceCents:6500}
test('order parser rejects internal keys, invalid totals, oversized pages and arbitrary views', () => {
  const page = Reflect.get(orders,'parseCustomerOrdersPage')
  const detail = Reflect.get(orders,'parseCustomerOrderDetail')
  assert.equal(typeof page,'function'); assert.equal(typeof detail,'function')
  assert.deepEqual(page({orders:[summary],nextCursor:null}),{orders:[summary],nextCursor:null})
  for(const extra of [{customerUserId:'a'},{adminMemo:'internal'},{token:'secret'}]) assert.throws(()=>page({orders:[{...summary,...extra}],nextCursor:null}))
  for(const totalPriceCents of [-1,1.1,NaN]) assert.throws(()=>page({orders:[{...summary,totalPriceCents}],nextCursor:null}))
  assert.throws(()=>page({orders:Array(26).fill(summary),nextCursor:null}))
  const value={...summary,contact:{name:'A',phone:'0412345678',email:'a@example.test'},requestNote:'',view:{format:'legacy',productId:'classic-chocolate',quantity:1}}
  assert.deepEqual(detail(value),value)
  assert.throws(()=>detail({...value,view:{...value.view,reviewCouponId:'private'}}))
  assert.throws(()=>detail({...value,view:{format:'custom'}}))
})
test('real legacy and historical Renewal server projections satisfy frontend DTO without current repricing',()=>{
  const project=Reflect.get(serverOrders,'projectCustomerOrderDetail')
  assert.equal(typeof project,'function')
  for(const document of fixtures.slice(0,2)) {
    const result=project(document)
    assert.deepEqual(orders.parseCustomerOrderDetail(result),result)
  }
  assert.equal(project(fixtures[0]).totalPriceCents,8200)
})
test('nested customer DTO rejects credentials hidden in numeric arrays or selection counts',()=>{
  const project=Reflect.get(serverOrders,'projectCustomerOrderDetail'),value=project(fixtures[0])
  const arrayAttack=structuredClone(value)
  arrayAttack.view.orderLines[0].flavourTotals=[{token:'private'}]
  assert.throws(()=>orders.parseCustomerOrderDetail(arrayAttack))
  const countAttack=structuredClone(value)
  countAttack.view.orderLines[0].selection.flavourCounts={nama_chocolate:{jwt:'secret'}}
  assert.throws(()=>orders.parseCustomerOrderDetail(countAttack))
})
