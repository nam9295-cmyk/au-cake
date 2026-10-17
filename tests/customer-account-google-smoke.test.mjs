import assert from 'node:assert/strict'
import test from 'node:test'
import {Account,Client} from 'appwrite'
const smoke=await import('../tools/customer-account-google-smoke/contract.mjs').catch(()=>({}))
test('smoke OAuth session URL is Google-only and fixed to the isolated project and HTTPS origin',()=>{
 assert.equal(typeof smoke.googleSessionOptions,'function')
 const c=new Account(new Client().setEndpoint('https://api.verygood-chocolate.com/v1').setProject('verygood-au-account-test'))
 const u=new URL(c.createOAuth2Session(smoke.googleSessionOptions('https://au-account-test.verygood-chocolate.com')))
 assert.equal(u.pathname,'/v1/account/sessions/oauth2/google');assert.equal(u.searchParams.get('project'),'verygood-au-account-test');assert.equal(u.searchParams.get('success'),'https://au-account-test.verygood-chocolate.com/success/');assert.equal(u.searchParams.get('failure'),'https://au-account-test.verygood-chocolate.com/failed/')
 for(const origin of ['https://au.verygood-chocolate.com','http://localhost:5173','https://au-cake-account-test.pages.dev'])assert.throws(()=>smoke.googleSessionOptions(origin))
})
test('smoke account/error rendering exposes only public account fields and never secrets or raw error text',()=>{
 assert.equal(typeof smoke.publicAccount,'function');assert.equal(typeof smoke.publicAuthError,'function')
 const u=smoke.publicAccount({$id:'synth-user',name:'TEST',email:'test@example.test',emailVerification:true,secret:'synth-secret',providerAccessToken:'synth-access',sessions:[{secret:'synth-session'}],jwt:'synth-jwt'})
 assert.deepEqual(u,{userId:'synth-user',name:'TEST',email:'test@example.test',emailVerified:true})
 assert.deepEqual(smoke.publicAuthError({code:401,type:'general_unauthorized_scope',message:'contains synth-jwt',response:{secret:'synth-secret'}}),{status:401,type:'general_unauthorized_scope'})
 assert.deepEqual(smoke.publicAuthError({code:500,type:'contains synth-secret',message:'secret'}),{status:500,type:'authentication_error'})
})
test('isolated artifact never inherits operating env, has a hard 404 and defaults to a closed test window',async()=>{
 const {googleTestSiteArtifacts}=await import('../scripts/build-customer-account-google-smoke.mjs')
 const {GOOGLE_TEST_TARGET}=await import('../scripts/customer-account-google-test.mjs')
 const old=process.env.VITE_APPWRITE_PROJECT_ID;process.env.VITE_APPWRITE_PROJECT_ID='OPERATING-PROJECT-SENTINEL'
 try{const a=await googleTestSiteArtifacts({target:GOOGLE_TEST_TARGET});assert.equal(a.files['test-window.json'],'{"enabled":false,"endsAt":null}');assert.match(a.files['404.html'],/Not found/);assert.doesNotMatch(a.files['404.html'],/<script/);assert.ok(!Object.values(a.files).join('').includes('OPERATING-PROJECT-SENTINEL'));assert.ok(a.inputs.every(p=>!p.startsWith('src/')));assert.match(a.files['_headers'],/Referrer-Policy: no-referrer/);assert.match(a.files['_headers'],/frame-ancestors 'none'/);assert.ok(!Object.keys(a.files).some(p=>p.startsWith('functions/')||p==='_worker.js'))}
 finally{if(old===undefined)delete process.env.VITE_APPWRITE_PROJECT_ID;else process.env.VITE_APPWRITE_PROJECT_ID=old}
})
