import assert from 'node:assert/strict'
import test from 'node:test'
const api=await import('../scripts/customer-account-google-test.mjs').catch(()=>({}))
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',origin:'https://au-account-test.verygood-chocolate.com',pagesProject:'au-cake-account-test',cloudflareAccountId:'f10bef6fa6f6abc7982d3792e250a9bc'}
const fields={'email-password':'authEmailPassword',phone:'authPhone','magic-url':'authUsersAuthMagicURL','email-otp':'authEmailOtp',anonymous:'authAnonymous',invites:'authInvites',jwt:'authJWT'}
function harness(){
 const project={$id:target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,oAuthProviders:[{key:'google',enabled:false},{key:'github',enabled:false}],...Object.fromEntries(Object.values(fields).map(v=>[v,true]))},calls=[],platforms=[]
 const transport=async(url,o)=>{const path=url.slice(target.endpoint.length);calls.push({path,...o});assert.equal(o.redirect,'error');assert.equal(o.headers['X-Appwrite-Project'],'console');const data=o.body?JSON.parse(o.body):null
  if(o.method==='GET')return new Response(JSON.stringify(path.endsWith('/platforms')?{total:platforms.length,platforms}:project))
  if(path.endsWith('/platforms')){platforms.push({$id:'test-platform',...data});return new Response(JSON.stringify(platforms[0]),{status:201})}
  if(path.endsWith('/oauth2')){assert.equal(data.provider,'google');project.oAuthProviders[0]={key:'google',enabled:data.enabled};return new Response(JSON.stringify(project))}
  if(path.endsWith('/auth/limit')){assert.deepEqual(data,{limit:2});project.authLimit=data.limit;return new Response(JSON.stringify(project))}
  if(path.includes('/auth/')){assert.equal(data.status,false);project[fields[path.split('/').at(-1)]]=false;return new Response(JSON.stringify(project))}
  if(path.endsWith('/service')){assert.equal(data.service,'account');project.serviceStatusForAccount=data.status;return new Response(JSON.stringify(project))}
  throw Error('Unapproved mutation')
 }
 const make=(changes={})=>{assert.equal(typeof api.createGoogleTestManager,'function');return api.createGoogleTestManager({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-cli-owner'},transport,...changes})}
 return {project,calls,platforms,make}
}
const credential={web:{project_id:'verygood-au-account-test',client_id:'123-test.apps.googleusercontent.com',client_secret:'synthetic-google-secret',redirect_uris:['https://api.verygood-chocolate.com/v1/account/sessions/oauth2/callback/google/verygood-au-account-test'],javascript_origins:['https://au-account-test.verygood-chocolate.com']}}
const proof={httpsVerified:true,googleProjectId:'verygood-au-account-test',googleTesting:true,testUsers:['nam9295@gmail.com'],limitedWindowApproved:true,watchdogArmed:true,endsAt:new Date(Date.now()+14*60000).toISOString()}
test('B3 wrong endpoint, Appwrite project, frontend origin, CF account or Pages project has zero requests',()=>{
 const h=harness();assert.equal(typeof api.createGoogleTestManager,'function')
 for(const patch of [{projectId:'verygood-au'},{endpoint:target.endpoint+'/'},{origin:'https://au.verygood-chocolate.com'},{pagesProject:'au-cake-next'},{cloudflareAccountId:'foreign'}])assert.throws(()=>h.make({target:{...target,...patch}}))
 assert.equal(h.calls.length,0)
})
test('only Google is enabled after all other methods OFF, exact platform and separate test credential verified',async()=>{
 const h=harness(),m=h.make();await assert.rejects(m.enable(proof));assert.equal(h.calls.filter(x=>x.method!=='GET').length,0)
 await m.disableOtherMethods();assert.ok(Object.values(fields).every(f=>h.project[f]===false));assert.equal(h.calls.filter(x=>x.method==='PATCH').length,7)
 await m.addPlatform();await assert.rejects(m.addPlatform());assert.equal(h.platforms.length,1);assert.equal(h.platforms[0].hostname,'au-account-test.verygood-chocolate.com')
 await assert.rejects(m.configureGoogle({web:{...credential.web,project_id:'verygood-backend-auth'}}));await m.configureGoogle(credential)
 await assert.rejects(m.enable(proof));await m.setUserLimit();assert.equal(h.project.authLimit,2)
 const state=await m.enable(proof);assert.equal(state.accountEnabled,true);assert.ok(!JSON.stringify(state).includes('synthetic-google-secret'))
 await m.stop();assert.equal(h.project.serviceStatusForAccount,false)
 assert.ok(h.calls.every(c=>c.path.startsWith('/projects/verygood-au-account-test')))
})
test('no Account ON with another provider/method, unverified HTTPS, public Google app or another test user',async()=>{
 for(const change of ['method','provider','https','published','user','limit','approval','watchdog','expired','too-long']){const h=harness(),m=h.make();await m.disableOtherMethods();await m.addPlatform();await m.configureGoogle(credential);await m.setUserLimit();const p={...proof}
  if(change==='method')h.project.authEmailOtp=true
  if(change==='provider')h.project.oAuthProviders[1].enabled=true
  if(change==='https')p.httpsVerified=false
  if(change==='published')p.googleTesting=false
  if(change==='user')p.testUsers=['other@example.test']
  if(change==='limit')h.project.authLimit=0
  if(change==='approval')p.limitedWindowApproved=false
  if(change==='watchdog')p.watchdogArmed=false
  if(change==='expired')p.endsAt=new Date(Date.now()-1000).toISOString()
  if(change==='too-long')p.endsAt=new Date(Date.now()+16*60000).toISOString()
  const count=h.calls.filter(c=>c.method!=='GET').length;await assert.rejects(m.enable(p));assert.equal(h.calls.filter(c=>c.method!=='GET').length,count)
 }
})
