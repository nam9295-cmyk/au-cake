import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const api=await import('../scripts/customer-account-b7-pages.mjs').catch(()=>({}))
test('recovery Pages adapter publishes only a closed cover on the fixed test project and counts every attempt',async()=>{
 assert.equal(typeof api.createB7ClosedSiteAdapter,'function')
 const dir=await mkdtemp(join(tmpdir(),'b7-pages-local-'));let calls=0,observed
 const stop=api.createB7ClosedSiteAdapter({directory:dir,pagesAttemptSlotsUsed:2,wranglerPath:'/synthetic/wrangler.js',run:async(cmd,args,options)=>{calls++;observed={cmd,args,options};return {status:0}}})
 await stop();assert.equal(calls,1);assert.ok(observed.args.includes('au-cake-account-test'));assert.ok(observed.args.includes('b3-google-test'));assert.equal(observed.options.env.CLOUDFLARE_ACCOUNT_ID,'f10bef6fa6f6abc7982d3792e250a9bc');assert.equal(observed.options.env.APPWRITE_API_KEY,undefined)
 assert.equal(JSON.parse(await readFile(join(dir,'closed-site/test-window.json'),'utf8')).enabled,false)
 await assert.rejects(stop());assert.equal(calls,1)
})
test('V3 explicit additional approval permits the fifth closed recovery deployment only within the cumulative cap',async()=>{
 const proof={approved:true,manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',previousUsed:2,additionalMax:3,cumulativeMax:5}
 const directory=await mkdtemp(join(tmpdir(),'b7-pages-approved-'));let calls=0
 for(const budgetApprovalProof of [undefined,{...proof,approved:false},{...proof,manifestSha256:'wrong'},{...proof,cumulativeMax:6}])assert.throws(()=>api.createB7ClosedSiteAdapter({directory,pagesAttemptSlotsUsed:4,wranglerPath:'/synthetic/wrangler.js',budgetApprovalProof,run:async()=>{calls++;return {status:0}}}))
 const stop=api.createB7ClosedSiteAdapter({directory,pagesAttemptSlotsUsed:4,wranglerPath:'/synthetic/wrangler.js',budgetApprovalProof:proof,run:async()=>{calls++;return {status:0}}})
 assert.deepEqual(await stop(),{attempts:5,entryEnabled:false});assert.equal(calls,1)
 assert.throws(()=>api.createB7ClosedSiteAdapter({directory,pagesAttemptSlotsUsed:5,wranglerPath:'/synthetic/wrangler.js',budgetApprovalProof:proof}))
})
test('continuation reserves only slot seven for CLOSED and rejects any eighth deployment',async()=>{
 const proof={approved:true,manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',previousUsed:5,additionalMax:2,cumulativeMax:7,openSlot:6,closedSlot:7}
 const directory=await mkdtemp(join(tmpdir(),'b7-pages-continuation-'));let calls=0
 const args={directory,pagesAttemptSlotsUsed:6,wranglerPath:'/synthetic/wrangler.js',budgetApprovalProof:proof,run:async()=>{calls++;return {status:0}}}
 const stop=api.createB7ClosedSiteAdapter(args);assert.deepEqual(await stop(),{attempts:7,entryEnabled:false});assert.equal(calls,1)
 for(const change of [{pagesAttemptSlotsUsed:5},{pagesAttemptSlotsUsed:7},{budgetApprovalProof:{...proof,closedSlot:8}},{budgetApprovalProof:{...proof,additionalMax:3}}])assert.throws(()=>api.createB7ClosedSiteAdapter({...args,...change}))
})
