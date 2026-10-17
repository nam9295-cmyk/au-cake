import test from 'node:test'
import assert from 'node:assert/strict'
import * as orders from '../src/lib/customer-orders'
import {functions} from '../src/lib/appwrite'
test('orders client calls fixed actions, bounds parameters and never chooses owner/source',async()=>{
  const list=Reflect.get(orders,'getCustomerOrders'),detail=Reflect.get(orders,'getCustomerOrder');assert.equal(typeof list,'function');assert.equal(typeof detail,'function')
  const original=functions.createExecution,calls:unknown[]=[]
  try {
    functions.createExecution=(async args=>{calls.push(JSON.parse(args.body!));return {responseStatusCode:200,responseBody:JSON.stringify({ok:true,result:{orders:[],nextCursor:null}})}}) as never
    assert.deepEqual(await list({cursor:'order-a',userId:'forged'}),{orders:[],nextCursor:null})
    assert.deepEqual(calls,[{action:'customer-orders',data:{cursor:'order-a',limit:25}}])
    await assert.rejects(detail('../private'),/INVALID_CUSTOMER_REQUEST/)
    functions.createExecution=(async()=>({responseStatusCode:401,responseBody:'{"ok":false,"code":"CUSTOMER_UNAUTHORIZED"}'})) as never
    await assert.rejects(list({}),/CUSTOMER_UNAUTHORIZED/)
  }finally{functions.createExecution=original}
})
test('upcoming/past uses Sydney local date, midnight/DST and completed/cancelled state',()=>{
  const classify=Reflect.get(orders,'classifyCustomerOrder');assert.equal(typeof classify,'function')
  const order={pickupDate:'2026-10-04',pickupTime:'09:00',status:'예약확정'}
  assert.equal(classify(order,new Date('2026-10-03T15:30:00Z')),'upcoming')
  assert.equal(classify(order,new Date('2026-10-03T23:00:00Z')),'past')
  assert.equal(classify({...order,status:'취소'},new Date('2026-10-01T00:00:00Z')),'past')
  assert.equal(classify({...order,status:'픽업완료'},new Date('2026-10-01T00:00:00Z')),'past')
  assert.equal(classify({...order,pickupDate:'2026-10-03'},new Date('2026-10-03T14:00:00Z')),'past')
})
