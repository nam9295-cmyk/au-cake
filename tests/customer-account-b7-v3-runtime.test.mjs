import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createB7BrowserTransport} from '../tools/customer-account-b7-v3/browser-transport.mjs'
const api=await import('../scripts/customer-account-b7-v3-runtime.mjs').catch(()=>({}))
import {b7Inputs} from './fixtures/customer-account/b7.mjs'
import {freezeB7Fixtures} from '../scripts/customer-account-b7-contract.mjs'
const monitorApi=await import('../scripts/customer-account-b7-v3-execution-monitor.mjs').catch(()=>({}))
const secret=Buffer.alloc(32,7).toString('base64url'),now=1792281601000

test('execution monitor recognizes signed paths and stops for unsigned, duplicate, guard error or budget overflow',async()=>{
 assert.equal(typeof monitorApi.createB7ExecutionMonitor,'function')
 let request
 const send=createB7BrowserTransport({crypto:webcrypto,clock:()=>now,windowState:async()=>({enabled:true,startsAt:now-1000,endsAt:now+899000}),readSecret:()=>secret,execute:async p=>{request=p}})
 await send({functionId:'ca-test-reservation-api',body:'{"action":"health"}',async:false})
 assert.match(request.xpath,/^\/b7\//)
 const entry={$id:'execution-1',requestPath:request.xpath,requestMethod:'POST',status:'completed',responseStatusCode:200,responseBody:'{}',$createdAt:new Date(now).toISOString()}
 const make=()=>monitorApi.createB7ExecutionMonitor({secret,startsAt:now-1000,endsAt:now+899000,baselineIds:['old-execution']})
 const monitor=make();assert.equal(monitor.observe([entry]).unexpectedExecutions,0);assert.equal(monitor.observe([entry]).executions,1)
 for(const entries of [[{...entry,requestPath:'/'}],[entry,{...entry,$id:'execution-2'}],[{...entry,responseBody:'{"code":"B7_GUARD_REJECTED"}'}],[{...entry,requestMethod:'GET'}]])assert.equal(make().observe(entries).unexpectedExecutions,1)
 assert.equal(make().observe(Array.from({length:121},(_,i)=>({...entry,$id:String(i)}))).unexpectedExecutions,1)
})
test('JWT adapter uses only exact endpoint/project/JWT; rejects missing, mismatched and disabled users without admin key',async()=>{
 assert.equal(typeof api.createB7IdentityVerifier,'function')
 let seen,calls=0
 const verify=api.createB7IdentityVerifier({accountFactory:config=>{seen=config;return {get:async()=>{calls++;return {$id:'6ad38e4e0ffd5f810e23',status:true}}}}})
 await verify({id:'6ad38e4e0ffd5f810e23',jwt:'synthetic-jwt'})
 assert.deepEqual(seen,{endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',jwt:'synthetic-jwt'})
 await assert.rejects(verify({id:'ca-test-customer-h-20261018',jwt:'synthetic-jwt'}));await assert.rejects(verify({id:'unknown',jwt:'synthetic-jwt'}));assert.equal(calls,2)
 await assert.rejects(verify({id:'6ad38e4e0ffd5f810e23',jwt:''}));assert.equal(calls,2)
})
test('guard archive preserves original source/lock/native build and includes only validated local artifacts',async()=>{
 assert.equal(typeof api.packageB7Function,'function')
 const directory=await mkdtemp(join(tmpdir(),'b7-package-test-')),fixtures=Buffer.from(JSON.stringify({requestIds:['b7000003-0000-4000-8000-000000000003'],createBodies:['{"action":"health"}']}))
 // Invalid fixture structure must not produce an archive.
 await assert.rejects(api.packageB7Function({directory,fixtureManifestBytes:fixtures}))
})

test('packaged archive preserves source, lockfile and native smoke bytes and never packs env or node_modules',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'b7-package-positive-')),fixtures=freezeB7Fixtures(b7Inputs())
 const result=await api.packageB7Function({directory,fixtureManifestBytes:fixtures})
 const listing=execFileSync('tar',['-tzf',result.archivePath],{encoding:'utf8'})
 assert.match(listing,/src\/b7-entry.mjs/);assert.doesNotMatch(listing,/node_modules|\.env|private|prefs/)
 for(const file of ['package-lock.json','src/main.js','scripts/native-smoke.mjs']){
  const packed=execFileSync('tar',['-xOzf',result.archivePath,file]);assert.deepEqual(packed,await readFile(new URL('../appwrite-functions/reservation-api/'+file,import.meta.url)))
 }
 const entry=execFileSync('tar',['-xOzf',result.archivePath,'src/b7-entry.mjs'],{encoding:'utf8'})
 assert.match(entry,/setJWT\(jwt\)/);assert.doesNotMatch(entry,/setKey|Cookie|setSession/)
 const packedGuard=execFileSync('tar',['-xOzf',result.archivePath,'src/b7-guard.mjs'])
 assert.deepEqual(packedGuard,await readFile(new URL('../tools/customer-account-b7-v3/function-entry.mjs',import.meta.url)))
 assert.match(packedGuard.toString(),/B7v3:1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90/)
 assert.deepEqual(execFileSync('tar',['-xOzf',result.archivePath,'src/b7-approved-manifest.json']),await readFile(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)))
 await assert.rejects(api.packageB7Function({directory,fixtureManifestBytes:fixtures}))
})
