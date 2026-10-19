import assert from 'node:assert/strict'
import test from 'node:test'
const hosting=await import('../scripts/customer-account-google-test-hosting.mjs').catch(()=>({}))
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',origin:'https://au-account-test.verygood-chocolate.com',pagesProject:'au-cake-account-test',cloudflareAccountId:'f10bef6fa6f6abc7982d3792e250a9bc'}
test('Cloudflare mutation transport allows only new isolated Pages project and exact test hostname',async()=>{
 assert.equal(typeof hosting.createGoogleTestHostingWriter,'function');const calls=[]
 const transport=async(url,options)=>{calls.push({url,options});return new Response('{"success":true,"result":{}}')}
 assert.throws(()=>hosting.createGoogleTestHostingWriter({target:{...target,pagesProject:'au-cake-next'},token:'synthetic',transport}));assert.equal(calls.length,0)
 const write=hosting.createGoogleTestHostingWriter({target,token:'synthetic',transport});const root='/accounts/f10bef6fa6f6abc7982d3792e250a9bc/pages/projects'
 for(const [method,path,body]of [['POST',root,{name:'au-cake',production_branch:'main'}],['DELETE',root+'/au-cake-account-test',{}],['PATCH',root+'/au-cake-next',{}],['POST',root+'/au-cake-account-test/domains',{name:'au.verygood-chocolate.com'}]])await assert.rejects(write(method,path,body))
 assert.equal(calls.length,0)
 await write('POST',root,{name:'au-cake-account-test',production_branch:'b3-google-test'})
 await assert.rejects(write('POST',root,{name:'au-cake-account-test',production_branch:'b3-google-test'}));assert.equal(calls.length,1)
 await write('POST',root+'/au-cake-account-test/domains',{name:'au-account-test.verygood-chocolate.com'});assert.equal(calls.length,2)
 assert.ok(calls.every(c=>c.options.redirect==='error'))
})
