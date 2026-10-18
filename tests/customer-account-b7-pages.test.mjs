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
