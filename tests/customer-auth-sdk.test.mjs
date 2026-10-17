import assert from 'node:assert/strict'
import test from 'node:test'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {rolldown} from 'rolldown'
import {Account,Client,OAuthProvider} from 'appwrite'

test('real SDK 23 email token/session/prefs routes and Google URL match pinned 1.8.1 contract on local HTTP',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'customer-sdk-')),requests=[]
  let loggedIn=false,prefs={unrelated:'keep'}
  const server=createServer(async(req,res)=>{
    let text='';for await(const chunk of req)text+=chunk
    const body=text?JSON.parse(text):undefined;requests.push({method:req.method,path:req.url,body})
    res.setHeader('Content-Type','application/json')
    let result
    if(req.method==='POST'&&req.url==='/v1/account/tokens/email')result={userId:'existing-account',expire:'2099-01-01T00:00:00Z'}
    else if(req.method==='POST'&&req.url==='/v1/account/sessions/token'){loggedIn=true;result={$id:'session',expire:'2099-01-01T00:00:00Z'}}
    else if(req.method==='DELETE'){loggedIn=false;result={}}
    else if(!loggedIn){res.statusCode=401;result={message:'guest',code:401,type:'user_unauthorized'}}
    else if(req.url==='/v1/account/sessions/current')result={userId:'existing-account',expire:'2099-01-01T00:00:00Z'}
    else if(req.url==='/v1/account/prefs'&&req.method==='PATCH'){prefs=body.prefs;result={$id:'existing-account',prefs}}
    else if(req.url==='/v1/account/prefs')result=prefs
    else result={$id:'existing-account',email:'login@example.test',name:'Test Name',status:true,prefs}
    res.end(JSON.stringify(result))
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  try {
    const output=join(directory,'auth.mjs'),bundle=await rolldown({input:resolve('src/lib/customer-auth.ts'),platform:'node',transform:{define:{'import.meta.env':'{}'}}})
    try{await bundle.write({file:output,format:'esm',codeSplitting:false})}finally{await bundle.close()}
    const {createCustomerAuth}=await import(pathToFileURL(output).href)
    const account=new Account(new Client().setEndpoint(`http://127.0.0.1:${server.address().port}/v1`).setProject('isolated-project'))
    const auth=createCustomerAuth({account,idFactory:()=> 'unique-test',origin:()=> 'http://localhost:4173'})
    const sent=await auth.sendEmail(' Buyer@Example.test ')
    const user=await auth.verifyEmail({userId:sent.userId,code:'123456'})
    assert.equal(user.userId,'existing-account')
    assert.deepEqual(requests.find(r=>r.path==='/v1/account/tokens/email'),{method:'POST',path:'/v1/account/tokens/email',body:{userId:'unique-test',email:'buyer@example.test'}})
    assert.deepEqual(requests.find(r=>r.path==='/v1/account/sessions/token'),{method:'POST',path:'/v1/account/sessions/token',body:{userId:'existing-account',secret:'123456'}})
    await auth.saveProfile({version:1,name:'New Name',contactEmail:'contact@example.test',phone:'0412345678',language:'ko'},'existing-account')
    assert.equal(prefs.unrelated,'keep');assert.equal(prefs.verygoodAuCustomer.contactEmail,'contact@example.test')
    await auth.signOut();assert.ok(requests.some(r=>r.method==='DELETE'&&r.path==='/v1/account/sessions/current'))
    const oauth=new URL(account.createOAuth2Session({provider:OAuthProvider.Google,success:'http://localhost:4173/account/auth/callback',failure:'http://localhost:4173/account/auth/callback'}))
    assert.equal(oauth.pathname,'/v1/account/sessions/oauth2/google')
    assert.equal(oauth.searchParams.get('project'),'isolated-project')
    assert.ok(requests.every(r=>!r.path.includes('magic-url')))
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true})}
})
