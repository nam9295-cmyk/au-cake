import assert from 'node:assert/strict'
import test from 'node:test'
import * as authModule from '../src/lib/customer-auth'
function setup() {
  let user:Record<string,unknown>|null=null,time=Date.parse('2026-10-17T00:00:00Z')
  const calls:unknown[][]=[]
  const account={
    get:async()=>{if(!user)throw Object.assign(Error('guest'),{code:401});return user},
    getSession:async()=>({expire:'2099-01-01T00:00:00Z',userId:user?.$id}),
    createEmailToken:async(input:unknown)=>{calls.push(['token',input]);return {userId:'existing-user',expire:'2026-10-17T00:15:00Z'}},
    createSession:async(input:unknown)=>{calls.push(['session',input]);user={$id:'existing-user',email:'login@example.test',status:true,name:'Name',prefs:{unrelated:'keep'}};return {}},
    createOAuth2Session:(input:unknown)=>{calls.push(['google',input])},
    deleteSession:async(input:unknown)=>{calls.push(['logout',input]);user=null;return {}},
    getPrefs:async()=>user?.prefs||{},updatePrefs:async({prefs}:{prefs:unknown})=>{calls.push(['prefs',prefs]);user={...user,prefs};return user},
  }
  const create=Reflect.get(authModule,'createCustomerAuth');assert.equal(typeof create,'function')
  return {auth:create({account,idFactory:()=>'unique-test',now:()=>time,origin:()=> 'http://localhost:4173'}),account,calls,setTime:(n:number)=>time=n,setUser:(v:Record<string,unknown>|null)=>user=v}
}
test('new/existing OTP uses response user ID, six digits, expiry and 60-second send suppression',async()=>{
  const {auth,calls,setTime}=setup()
  assert.equal(await auth.restore(),null)
  await assert.rejects(auth.sendEmail('invalid'),/INVALID_EMAIL/)
  const sent=await auth.sendEmail(' Customer@Example.test ')
  assert.equal(sent.userId,'existing-user');assert.equal(sent.retryAt,Date.parse('2026-10-17T00:01:00Z'))
  await assert.rejects(auth.sendEmail('customer@example.test'),/OTP_COOLDOWN/)
  await assert.rejects(auth.verifyEmail({userId:sent.userId,code:'12345'}),/INVALID_OTP/)
  await assert.rejects(auth.verifyEmail({userId:'forged-user',code:'123456'}),/INVALID_OTP/)
  const who=await auth.verifyEmail({userId:sent.userId,code:'123456'})
  assert.equal(who.userId,'existing-user');assert.equal(who.loginEmail,'login@example.test')
  assert.deepEqual(calls.find(c=>c[0]==='session'),['session',{userId:'existing-user',secret:'123456'}])
  await auth.signOut();setTime(Date.parse('2026-10-17T00:16:00Z'))
  await assert.rejects(auth.verifyEmail({userId:sent.userId,code:'123456'}),/OTP_EXPIRED|INVALID_OTP/)
})
test('Google requires no existing session, same-origin callback with only random flow and explicit logout',async()=>{
  const {auth,calls,setUser}=setup()
  await auth.startGoogle({flowId:'11111111-1111-4111-8111-111111111111'})
  const request=calls[0][1] as {provider:string;success:string;failure:string}
  assert.equal(request.provider,'google')
  const url=new URL(request.success)
  assert.equal(url.origin,'http://localhost:4173');assert.equal(url.pathname,'/account/auth/callback');assert.deepEqual([...url.searchParams.keys()],['flowId'])
  setUser({$id:'admin-user',status:true,email:'admin@example.test',name:'Admin',prefs:{}})
  await assert.rejects(auth.startGoogle({flowId:'11111111-1111-4111-8111-111111111111'}),/ACCOUNT_SWITCH_REQUIRED/)
  await assert.rejects(auth.sendEmail('other@example.test'),/ACCOUNT_SWITCH_REQUIRED/)
  assert.equal(calls.filter(c=>c[0]==='logout').length,0)
})
test('profile saves merge namespace and preserve immutable prior order snapshots',async()=>{
  const {auth,calls,setUser}=setup()
  setUser({$id:'a',status:true,email:'login@example.test',name:'Google Name',prefs:{unrelated:'keep'}})
  const order={customerName:'Old Name',customerEmail:'old@example.test'}
  const result=await auth.saveProfile({version:1,name:'New Name',contactEmail:'contact@example.test',phone:'0412345678',language:'en'},'a')
  assert.equal(result.loginEmail,'login@example.test');assert.equal(result.profile.contactEmail,'contact@example.test')
  assert.deepEqual(order,{customerName:'Old Name',customerEmail:'old@example.test'})
  assert.equal((calls.find(c=>c[0]==='prefs')?.[1] as Record<string,unknown>).unrelated,'keep')
})
test('profile save is bound to the displayed user before any preference write',async()=>{
  const {auth,account,calls,setUser}=setup()
  const profile={version:1,name:'A draft',contactEmail:'a-contact@example.test',phone:'0412345678',language:'en'}
  setUser({$id:'b',status:true,email:'b@example.test',prefs:{}})
  await assert.rejects(auth.saveProfile(profile,'a'),/AUTH_SESSION_CHANGED/)
  assert.equal(calls.filter(c=>c[0]==='prefs').length,0)
  setUser({$id:'a',status:true,email:'a@example.test',prefs:{}})
  account.getPrefs=async()=>{setUser({$id:'b',status:true,email:'b@example.test',prefs:{}});return {}}
  await assert.rejects(auth.saveProfile(profile,'a'),/AUTH_SESSION_CHANGED/)
  assert.equal(calls.filter(c=>c[0]==='prefs').length,0)
})
test('concurrent sends are serialized and provider errors become safe retry states',async()=>{
  const {auth,account}=setup();let release!:(v:unknown)=>void
  account.createEmailToken=async()=>new Promise(r=>{release=r}) as never
  const pending=auth.sendEmail('customer@example.test')
  await Promise.resolve();await Promise.resolve()
  await assert.rejects(auth.sendEmail('customer@example.test'),/AUTH_BUSY/)
  while(!release)await Promise.resolve()
  release({userId:'existing-user',expire:'2026-10-17T00:15:00Z'});assert.equal((await pending).userId,'existing-user')
  const other=setup();other.account.createEmailToken=async()=>{throw Object.assign(Error('private provider details'),{code:429})}
  await assert.rejects(other.auth.sendEmail('customer@example.test'),/^Error: AUTH_RATE_LIMITED$/)
})
test('expired/blocked sessions restore as guest and preference failures never expose provider details',async()=>{
  const {auth,account,setUser}=setup()
  setUser({$id:'a',status:false,email:'a@example.test',prefs:{}})
  assert.equal(await auth.restore(),null)
  setUser({$id:'a',status:true,email:'a@example.test',prefs:{}})
  const original=account.getSession
  account.getSession=async()=>({expire:'2020-01-01T00:00:00Z',userId:'a'})
  assert.equal(await auth.restore(),null)
  account.getSession=original
  account.getPrefs=async()=>{throw Error('private operator information')}
  await assert.rejects(auth.saveProfile({version:1,name:'New Name',contactEmail:'contact@example.test',phone:'',language:'en'},'a'),/^Error: AUTH_UNAVAILABLE$/)
})
test('logout invalidates a delayed token response and never leaves a reusable stale challenge',async()=>{
  const {auth,account}=setup();let release!:(value:unknown)=>void
  account.createEmailToken=async()=>new Promise(resolve=>{release=resolve}) as never
  const sent=auth.sendEmail('customer@example.test');const rejected=assert.rejects(sent,/AUTH_CANCELLED/)
  while(!release)await Promise.resolve()
  const logout=auth.signOut()
  release({userId:'existing-user',expire:'2026-10-17T00:15:00Z'})
  await logout;await rejected
  await assert.rejects(auth.verifyEmail({userId:'existing-user',code:'123456'}),/INVALID_OTP/)
})
test('logout waits for a delayed session creation and revokes it before finishing',async()=>{
  const {auth,account,calls}=setup()
  const sent=await auth.sendEmail('customer@example.test')
  let release!:()=>void;const original=account.createSession
  account.createSession=async input=>{await new Promise<void>(resolve=>{release=resolve});return original(input)}
  const verification=auth.verifyEmail({userId:sent.userId,code:'123456'})
  const rejected=assert.rejects(verification,/AUTH_CANCELLED/)
  while(!release)await Promise.resolve()
  const logout=auth.signOut();release();await logout;await rejected
  assert.equal(await auth.restore(),null)
  assert.deepEqual(calls.filter(c=>c[0]==='session'||c[0]==='logout').map(c=>c[0]),['session','logout'])
})
