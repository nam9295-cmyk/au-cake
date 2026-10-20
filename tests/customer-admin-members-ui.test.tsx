import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {getPageFromPath,pathForPage} from '../src/lib/app-routes'
import {listAdminMembers,parseAdminMembersPage,type AdminMembersPage} from '../src/lib/admin-members'
import AdminMembersPageComponent,{AdminMembersTable} from '../src/AdminMembersPage'
import {CUSTOMER_AUTH_CHANGED_EVENT,CUSTOMER_AUTH_NOTICE_KEY} from '../src/lib/customer-account-config'
import {getSeoConfig} from '../src/lib/seo'

const page:AdminMembersPage={members:[{id:'member-1',name:'Saved member',loginEmail:'google@example.test',contactEmail:'orders@example.test',phone:'0412345678',joinedAt:'2026-10-19T10:00:00.000Z',status:'active',role:'customer'}],total:1,nextCursor:null}
test('AU member route and explicit safe response parser preserve login/contact separation',()=>{
  assert.equal(getPageFromPath('/admin/members'),'admin-members');assert.equal(pathForPage('admin-members'),'/admin/members')
  assert.equal(getPageFromPath('/admin/members/'),'admin-members')
  assert.equal(getSeoConfig('/admin/members').noindex,true)
  assert.deepEqual(parseAdminMembersPage(page),page)
  for(const value of [{...page,password:'private'},{...page,total:-1},{...page,members:[{...page.members[0],prefs:{private:'value'}}]},{...page,nextCursor:'../user'},{...page,members:[{...page.members[0],status:'unknown'}]}])assert.throws(()=>parseAdminMembersPage(value))
})
test('member transport uses existing authenticated execution, strict data and no local persistence',async()=>{
  let calls=0
  const execute=async(action:string,data:unknown,parse:(value:unknown)=>AdminMembersPage)=>{calls++;assert.equal(action,'list-admin-members');assert.deepEqual(data,{search:'google@example.test',cursor:'previous'});return parse(page)}
  assert.deepEqual(await listAdminMembers({search:'google@example.test',cursor:'previous'},execute),page)
  await assert.rejects(listAdminMembers({cursor:'../all'},execute));await assert.rejects(listAdminMembers({search:'x'.repeat(101)},execute));assert.equal(calls,1)
})
test('member table displays useful contact/account fields and read-only role/status',()=>{
  const html=renderToStaticMarkup(<AdminMembersTable page={page}/>);assert.match(html,/Saved member/);assert.match(html,/google@example.test/);assert.match(html,/orders@example.test/);assert.match(html,/0412345678/);assert.match(html,/가입일/);assert.match(html,/회원/);assert.match(html,/정상/)
  assert.doesNotMatch(html,/password|token|secret|<button|<input/)
})
test('member request times out once without an automatic retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  let calls=0
  const request=listAdminMembers({},async()=>{calls++;return new Promise<AdminMembersPage>(()=>{})})
  const rejected=assert.rejects(request,/ADMIN_MEMBERS_UNAVAILABLE/)
  t.mock.timers.tick(10000);await rejected;assert.equal(calls,1)
})

// Existing project hook-dispatcher test pattern; no browser/service credentials.
function mount(props:React.ComponentProps<typeof AdminMembersPageComponent>) {
  const slots:unknown[]=[],effects:Array<()=>void>=[],cleanups:Array<undefined|(()=>void)>=[];let index=0,tree:React.ReactElement
  const dispatcher={
    useState(initial:unknown){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?next(slots[i]):next}]},
    useRef(initial:unknown){return dispatcher.useState(()=>({current:initial}))[0]},
    useEffect(effect:()=>void|(()=>void),deps:unknown[]){const i=index++,old=slots[i] as unknown[]|undefined;if(!old||deps.some((v,j)=>!Object.is(v,old[j]))){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect()||undefined})}},
  }
  function render(){index=0;const internal=Reflect.get(React,'__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE') as {H:unknown},previous=internal.H;internal.H=dispatcher;try{tree=AdminMembersPageComponent(props)}finally{internal.H=previous}return tree}
  render();return {render,html:()=>renderToStaticMarkup(tree),async flush(){for(let i=0;i<4;i++){while(effects.length)effects.shift()!();await new Promise(setImmediate);render()}},unmount(){cleanups.forEach(fn=>fn?.())}}
}
test('non-admin/guest never loads a member page; authenticated admin loads through the server',async t=>{
  const old=globalThis.window;globalThis.window=new EventTarget() as never;t.after(()=>{globalThis.window=old})
  let reads=0;const routes:string[]=[],navigate=(p:string)=>routes.push(p)
  const denied=mount({navigate,checkAdmin:async()=>false,loadMembers:async()=>{reads++;return page}});await denied.flush();assert.equal(reads,0);assert.deepEqual(routes,['admin-login']);assert.doesNotMatch(denied.html(),/google@example.test/);denied.unmount()
  const allowed=mount({navigate,checkAdmin:async()=>true,loadMembers:async()=>{reads++;return page}});await allowed.flush();assert.equal(reads,1);assert.match(allowed.html(),/google@example.test/);allowed.unmount()
})
test('auth change clears private rows immediately and ignores old in-flight responses',async t=>{
  const old=globalThis.window;const window=new EventTarget();globalThis.window=window as never;t.after(()=>{globalThis.window=old})
  let admin=true,resolve!:(p:AdminMembersPage)=>void
  const pending=new Promise<AdminMembersPage>(r=>{resolve=r})
  const screen=mount({navigate(){},checkAdmin:async()=>admin,loadMembers:async()=>pending});await screen.flush();admin=false
  window.dispatchEvent(new Event(CUSTOMER_AUTH_CHANGED_EVENT));screen.render();assert.doesNotMatch(screen.html(),/google@example.test/)
  resolve(page);await screen.flush();assert.doesNotMatch(screen.html(),/google@example.test/);screen.unmount()
})
test('a loaded private member list disappears synchronously on logout or account change',async t=>{
  const old=globalThis.window,window=new EventTarget();globalThis.window=window as never;t.after(()=>{globalThis.window=old})
  for(const type of [CUSTOMER_AUTH_CHANGED_EVENT,'storage','focus']) {
    let admin=true
    const screen=mount({navigate(){},checkAdmin:async()=>admin,loadMembers:async()=>page});await screen.flush();assert.match(screen.html(),/google@example.test/)
    const event=new Event(type);if(type==='storage')Object.defineProperty(event,'key',{value:CUSTOMER_AUTH_NOTICE_KEY})
    admin=false;window.dispatchEvent(event);screen.render();assert.doesNotMatch(screen.html(),/google@example.test|orders@example.test|0412345678/)
    await screen.flush();assert.doesNotMatch(screen.html(),/google@example.test/);screen.unmount()
  }
})
test('service failure is unavailable, never a misleading empty members result',async t=>{
  const old=globalThis.window;globalThis.window=new EventTarget() as never;t.after(()=>{globalThis.window=old})
  const screen=mount({navigate(){},checkAdmin:async()=>true,loadMembers:async()=>{throw Error('PRIVATE_UPSTREAM')}});await screen.flush();assert.match(screen.html(),/role="alert"/);assert.doesNotMatch(screen.html(),/PRIVATE_UPSTREAM|회원이 없습니다|google@example.test/);screen.unmount()
})
