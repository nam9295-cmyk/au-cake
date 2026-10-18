import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const api=await import('../scripts/customer-account-b7-secret-scan.mjs').catch(()=>({}))
test('secret scan detects explicit protected credentials without returning their contents',async()=>{
 assert.equal(typeof api.scanB7Files,'function')
 const d=await mkdtemp(join(tmpdir(),'b7-secret-scan-')),path=join(d,'public.js'),secret='synthetic-private-credential-never-ship'
 await writeFile(path,'const target="verygood-au-account-test";');assert.equal((await api.scanB7Files({paths:[path],secrets:[secret]})).clean,true)
 await writeFile(path,secret);const r=await api.scanB7Files({paths:[path],secrets:[secret]});assert.equal(r.clean,false);assert.equal(JSON.stringify(r).includes(secret),false)
})
