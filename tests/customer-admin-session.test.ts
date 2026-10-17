import assert from 'node:assert/strict'
import test from 'node:test'
import {account,isAppwriteConfigured} from '../src/lib/appwrite'
import {isAdminLoggedIn,loginAdmin,loginAdminWithGoogle,logoutAdmin} from '../src/lib/repository'
import {CUSTOMER_AUTH_CHANGED_EVENT} from '../src/lib/customer-account-config'
import {createAdminPhotoPreviewHandler} from '../appwrite-functions/review-api/src/admin-photo-preview.js'

function setup() {
  assert.equal(isAppwriteConfigured,true,'this suite must exercise real configured repository paths')
  const original={get:account.get,remove:account.deleteSession,password:account.createEmailPasswordSession,google:account.createOAuth2Session,window:globalThis.window}
  let current:{email:string;status:boolean}|null={email:'customer@example.test',status:true}
  const calls:string[]=[],notifications:Event[]=[]
  account.get=(async()=>{if(!current)throw Object.assign(Error('guest'),{code:401});return {$id:'verified-user',...current}}) as never
  account.deleteSession=(async()=>{calls.push('delete');current=null;return {}}) as never
  account.createEmailPasswordSession=(async()=>{calls.push('password');current={email:'admin@example.test',status:true};return {}}) as never
  account.createOAuth2Session=(()=>{calls.push('google')}) as never
  const windowTarget=new EventTarget() as EventTarget&{location:unknown;localStorage:unknown}
  windowTarget.location={origin:'https://site.example.test',assign(){calls.push('navigate')}}
  windowTarget.localStorage={setItem(){},getItem(){return null}}
  windowTarget.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,event=>notifications.push(event))
  globalThis.window=windowTarget as never
  return {calls,notifications,setCurrent:(user:typeof current)=>{current=user},cleanup(){account.get=original.get;account.deleteSession=original.remove;account.createEmailPasswordSession=original.password;account.createOAuth2Session=original.google;globalThis.window=original.window}}
}
test('admin checks are read-only for ordinary, expired and blocked customer sessions',async()=>{
  const s=setup()
  try {
    assert.equal(await isAdminLoggedIn(),false);assert.deepEqual(s.calls,[])
    s.setCurrent({email:'admin@example.test',status:true});assert.equal(await isAdminLoggedIn(),true)
    s.setCurrent({email:'admin@example.test',status:false});assert.equal(await isAdminLoggedIn(),false)
    s.setCurrent(null);assert.equal(await isAdminLoggedIn(),false);assert.deepEqual(s.calls,[])
  }finally{s.cleanup()}
})
test('password and Google never delete or link an existing customer; explicit logout enables admin login',async()=>{
  const s=setup()
  try {
    await assert.rejects(loginAdmin('admin@example.test','test-password'),/ACCOUNT_SWITCH_REQUIRED/)
    await assert.rejects(async()=>loginAdminWithGoogle(),/ACCOUNT_SWITCH_REQUIRED/)
    assert.deepEqual(s.calls,[])
    await logoutAdmin();assert.deepEqual(s.calls,['delete']);assert.equal(s.notifications.length,1)
    await loginAdmin('admin@example.test','test-password');assert.equal(await isAdminLoggedIn(),true)
    assert.equal(s.calls.filter(c=>c==='delete').length,1)
    assert.equal(s.notifications.some(event=>Object.hasOwn(event,'detail')),false)
  }finally{s.cleanup()}
})
test('guest admin Google keeps callback contract; active admin avoids identity linking',async()=>{
  const s=setup()
  try {
    s.setCurrent(null);await loginAdminWithGoogle();assert.deepEqual(s.calls,['google'])
    s.setCurrent({email:'admin@example.test',status:true});await loginAdminWithGoogle();assert.deepEqual(s.calls,['google'])
  }finally{s.cleanup()}
})
test('indeterminate existing session blocks new admin authentication without removing it',async()=>{
  const s=setup()
  try {
    account.get=(async()=>{throw Error('private network failure')}) as never
    await assert.rejects(loginAdmin('admin@example.test','password'),/ADMIN_AUTH_UNAVAILABLE/)
    await assert.rejects(async()=>loginAdminWithGoogle(),/ADMIN_AUTH_UNAVAILABLE/)
    assert.deepEqual(s.calls,[])
  }finally{s.cleanup()}
})
test('verified customer JWT cannot use existing admin API even with forged admin ID or body',async()=>{
  let reads=0
  const handler=createAdminPhotoPreviewHandler({authenticateJwt:async()=>({$id:'customer-a'}),getReview:async()=>{reads++;return {}},getFilePreview:async()=>Buffer.alloc(4)}, {REVIEW_ADMIN_USER_IDS:'admin-1',REVIEW_FRONTEND_ORIGINS:'https://site.example.test'})
  for(const [body,status] of [[{reviewId:'private-review'},403],[{reviewId:'private-review',adminId:'admin-1'},400]] as const) {
    const response=await handler({method:'POST',headers:{origin:'https://site.example.test','x-appwrite-user-jwt':'valid-customer-jwt','x-appwrite-user-id':'admin-1'},bodyText:JSON.stringify(body),bodyJson:body})
    assert.equal(response.status,status)
  }
  assert.equal(reads,0)
})
