import React from 'react'
import test,{type TestContext} from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {CustomerAccountProvider} from '../src/CustomerAccountProvider'
import {AccountPage} from '../src/pages/AccountPage'
import {CustomerAccountContext,disabledCustomerAccount,type CustomerAccountContextValue} from '../src/lib/customer-account-context'
import {functions} from '../src/lib/appwrite'
import type {CustomerAuth} from '../src/lib/customer-auth'
import type {CustomerIdentity,CustomerOrdersPage} from '../src/lib/customer-account-types'

const a:CustomerIdentity={userId:'customer-a',loginEmail:'login-a@example.test',profile:{version:1,name:'Saved A',contactEmail:'contact-a@example.test',phone:'0412345678',language:'en'}}
const b:CustomerIdentity={...a,userId:'customer-b',loginEmail:'login-b@example.test'}
const empty:CustomerOrdersPage={orders:[],nextCursor:null}
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}

// Same CLI hook-dispatcher approach as custom-cake-ui.test.mjs; no browser or SDK network.
function mount(properties:Record<string,unknown>) {
  const slots:unknown[]=[],setters:Array<(next:unknown)=>void>=[],effects:Array<()=>void>=[],cleanups:Array<undefined|(()=>void)>=[]
  let cursor=0,tree:React.ReactElement<{value:CustomerAccountContextValue;children:React.ReactNode}>
  const memo=(compute:()=>unknown,deps:unknown[])=>{
    const i=cursor++,previous=slots[i] as {deps:unknown[];value:unknown}|undefined
    if(!previous||deps.some((d,j)=>!Object.is(d,previous.deps[j])))slots[i]={deps,value:compute()}
    return (slots[i] as {value:unknown}).value
  }
  const dispatcher={
    useState(initial:unknown){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;setters[i]??=next=>{slots[i]=typeof next==='function'?next(slots[i]):next};return [slots[i],setters[i]]},
    useRef(initial:unknown){return dispatcher.useState(()=>({current:initial}))[0]},
    useCallback(callback:unknown,deps:unknown[]){return memo(()=>callback,deps)},useMemo:memo,
    useEffect(effect:()=>void|(()=>void),deps:unknown[]){const i=cursor++,old=slots[i] as unknown[]|undefined;if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect()||undefined})}},
  }
  function render(){cursor=0;const internals=Reflect.get(React,'__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE') as {H:unknown},previous=internals.H;internals.H=dispatcher;try{tree=Reflect.apply(CustomerAccountProvider,null,[properties])}finally{internals.H=previous}return tree}
  render()
  return {render,get value(){return tree.props.value},get dialog(){return React.Children.toArray(tree.props.children).find(x=>React.isValidElement(x)&&typeof x.type==='function') as React.ReactElement<{available:boolean;onGoogle:()=>Promise<void>}>|undefined},async flush(){for(let i=0;i<4;i++){while(effects.length)effects.shift()!();await new Promise(setImmediate);render()}},unmount(){cleanups.forEach(cleanup=>cleanup?.())}}
}
function browser() {
  const originals=new Map(['window','document','sessionStorage','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]))
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}
  const window=Object.assign(new EventTarget(),{localStorage:storage,location:{origin:'https://shop.example.test'}})
  for(const [key,value]of Object.entries({window,document:{documentElement:{lang:'en'}},sessionStorage:storage,fetch:()=>{throw Error('UNEXPECTED_NETWORK')}}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  return {window,cleanup(){for(const[key,value]of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key)}}
}
function setup(t:TestContext,options:{identity?:CustomerIdentity|null;restore?:()=>Promise<CustomerIdentity|null>;list?:()=>Promise<CustomerOrdersPage>}={}) {
  const {window,cleanup}=browser(),calls={restore:0,health:0,list:0,google:0,logout:0}
  let identity=options.identity??null
  const auth={restore:async()=>{calls.restore++;return options.restore?options.restore():identity},startGoogle:async()=>{calls.google++},signOut:async()=>{calls.logout++;identity=null},saveProfile:async(profile)=>({...a,profile}),sendEmail:async()=>{throw Error('NOT_USED')},verifyEmail:async()=>{throw Error('NOT_USED')}} satisfies CustomerAuth
  const originalExecution=functions.createExecution
  functions.createExecution=async()=>{calls.health++;throw Error('UNEXPECTED_FUNCTION_EXECUTION')}
  const page=mount({enabled:true,auth,orderService:{list:async()=>{calls.list++;return options.list?options.list():empty},detail:async()=>{throw Error('CUSTOMER_ORDER_NOT_FOUND')}},children:<div>Existing checkout</div>})
  t.after(()=>{page.unmount();functions.createExecution=originalExecution;cleanup()})
  return {page,calls,window,setIdentity:(value:CustomerIdentity|null)=>{identity=value}}
}
test('guest Google entry works without a reservation health call and preserves account return state',async t=>{
  const {page,calls}=setup(t);await page.flush()
  assert.equal(page.value.state.status,'guest');assert.equal(calls.health,0);assert.equal(calls.list,0)
  page.value.openSignIn();page.render();assert.equal(page.dialog?.props.available,true)
  await page.dialog!.props.onGoogle();assert.equal(calls.google,1);assert.equal(calls.health,0)
})
test('signed-in identity and profile restore independently from unavailable order service',async t=>{
  const {page,calls}=setup(t,{identity:a,list:async()=>{throw Error('CUSTOMER_ACCOUNT_NOT_READY')}});await page.flush()
  assert.equal(page.value.state.status,'authenticated');assert.equal(page.value.ordersStatus,'idle');assert.equal(calls.list,0);assert.equal(calls.health,0)
  await assert.rejects(page.value.getOrders(),/CUSTOMER_ACCOUNT_NOT_READY/);page.render()
  assert.equal(page.value.ordersStatus,'unavailable');assert.equal(page.value.state.status,'authenticated');assert.equal(calls.logout,0)
})
test('actual orders response drives readiness; focus refresh does not repeat health or order reads',async t=>{
  const pending=deferred<CustomerOrdersPage>(),{page,calls,window}=setup(t,{identity:a,list:()=>pending.promise});await page.flush()
  const request=page.value.getOrders();page.render();assert.equal(page.value.ordersStatus,'checking');assert.equal(page.value.state.status,'authenticated')
  pending.resolve(empty);assert.deepEqual(await request,empty);page.render();assert.equal(page.value.ordersStatus,'ready')
  window.dispatchEvent(new Event('focus'));await page.flush();assert.equal(page.value.state.status,'authenticated');assert.equal(page.value.ordersStatus,'ready');assert.equal(calls.list,1);assert.equal(calls.health,0)
})
test('order timeout never logs out a valid Account session and late success cannot mark it ready',async t=>{
  const pending=deferred<CustomerOrdersPage>(),{page}=setup(t,{identity:a,list:()=>pending.promise});await page.flush()
  t.mock.timers.enable({apis:['setTimeout']})
  const request=page.value.getOrders(),rejected=assert.rejects(request,/CUSTOMER_ORDERS_UNAVAILABLE/)
  t.mock.timers.tick(10000);await rejected;page.render();assert.equal(page.value.ordersStatus,'unavailable');assert.equal(page.value.state.status,'authenticated')
  pending.resolve(empty);await page.flush();assert.equal(page.value.ordersStatus,'unavailable')
})
test('Account OFF keeps Google unavailable without consulting the order service',async t=>{
  const {page,calls}=setup(t,{restore:async()=>{throw Error('AUTH_UNAVAILABLE')}});await page.flush();assert.equal(page.value.state.status,'unavailable')
  page.value.openSignIn();page.render();assert.equal(page.dialog?.props.available,false);assert.equal(calls.health,0);assert.equal(calls.list,0);assert.equal(calls.google,0)
})
test('guests and disabled accounts cannot trigger private order reads',async t=>{
  const {page,calls}=setup(t);await page.flush();assert.equal(typeof page.value.getOrders,'function');await assert.rejects(page.value.getOrders(),/CUSTOMER_UNAUTHORIZED/);assert.equal(calls.list,0)
  await assert.rejects(disabledCustomerAccount.getOrders(),/CUSTOMER_ACCOUNT_DISABLED/)
})
test('switching users rejects stale order responses and resets only order availability',async t=>{
  const pending=deferred<CustomerOrdersPage>(),{page,window,setIdentity}=setup(t,{identity:a,list:()=>pending.promise});await page.flush()
  const request=page.value.getOrders(),rejected=assert.rejects(request,/AUTH_CANCELLED/)
  setIdentity(b);window.dispatchEvent(new Event('focus'));await page.flush();pending.resolve(empty);await rejected;page.render()
  assert.equal(page.value.ordersStatus,'idle');assert.equal(page.value.state.status==='authenticated'&&page.value.state.identity.userId,b.userId)
})
test('logout rejects stale order responses and never restores private readiness',async t=>{
  const pending=deferred<CustomerOrdersPage>(),{page}=setup(t,{identity:a,list:()=>pending.promise});await page.flush()
  const request=page.value.getOrders(),rejected=assert.rejects(request,/AUTH_CANCELLED/);await page.value.signOut();await page.flush();pending.resolve(empty);await rejected;page.render()
  assert.equal(page.value.state.status,'guest');assert.equal(page.value.ordersStatus,'idle')
})
test('order authorization failure invalidates private state without deleting the shared session',async t=>{
  const {page,calls}=setup(t,{identity:a,list:async()=>{throw Error('CUSTOMER_UNAUTHORIZED')}});await page.flush();await assert.rejects(page.value.getOrders(),/CUSTOMER_UNAUTHORIZED/);page.render()
  assert.equal(page.value.state.status,'unavailable');assert.equal(calls.logout,0)
})
test('MY ORDERS unavailable preserves bilingual profile access without claiming there are no orders',()=>{
  for(const language of ['en','ko'] as const){
    const value={...disabledCustomerAccount,enabled:true,ordersStatus:'unavailable',state:{status:'authenticated',identity:a}} as CustomerAccountContextValue
    const html=renderToStaticMarkup(<CustomerAccountContext.Provider value={value}><AccountPage language={language}/></CustomerAccountContext.Provider>)
    assert.match(html,/Saved A/);assert.match(html,language==='en'?/Orders are temporarily unavailable/:/지금은 주문 내역을 불러올 수 없습니다/)
    assert.doesNotMatch(html,/No orders in this group\.|해당하는 주문이 없습니다\./);assert.match(html,language==='en'?/Save details/:/정보 저장/)
  }
})
