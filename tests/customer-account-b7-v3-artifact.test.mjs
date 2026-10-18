import test from 'node:test'
import assert from 'node:assert/strict'
const api=await import('../tools/customer-account-b7-v3/browser-transport.mjs').catch(()=>({}))
import {webcrypto,createHmac,createHash} from 'node:crypto'
test('browser signer denies closed/wrong targets before HTTP and uses original SDK payload',async()=>{
 assert.equal(typeof api.createB7BrowserTransport,'function')
 let calls=0,open=false,seen
 const secret=Buffer.alloc(32,2).toString('base64url'),now=1792281601000
 const send=api.createB7BrowserTransport({crypto:webcrypto,clock:()=>now,windowState:async()=>({enabled:open,startsAt:now-1000,endsAt:now+899000}),readSecret:()=>secret,execute:async p=>{calls++;seen=p;return {responseStatusCode:200}}})
 const request={functionId:'ca-test-reservation-api',body:'{"action":"health"}',async:false,xpath:'/',method:'POST'}
 await assert.rejects(send(request));assert.equal(calls,0);open=true
 await assert.rejects(send({...request,functionId:'reservation-api'}));assert.equal(calls,0)
 await send(request);assert.equal(calls,1);assert.equal(seen.body,request.body);assert.equal(seen.functionId,request.functionId)
 const h=seen.headers,expected=createHmac('sha256',Buffer.from(secret,'base64url')).update(['B7v3:1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90','verygood-au-account-test','ca-test-reservation-api','20261018-b7-google-01',String(now),h['x-b7-nonce'],createHash('sha256').update(request.body).digest('hex')].join('\n')).digest('base64url')
 assert.equal(h['x-b7-signature'],expected);assert.equal(JSON.stringify(seen).includes(secret),false)
})
test('browser transport serializes calls and refuses an expired window or unavailable secret',async()=>{
 assert.equal(typeof api.createB7BrowserTransport,'function')
 for(const opts of [{enabled:true,startsAt:1,endsAt:2},{enabled:true,startsAt:0,endsAt:1000000},{enabled:false,startsAt:0,endsAt:100}]){
 let calls=0;const send=api.createB7BrowserTransport({crypto:webcrypto,clock:()=>10,windowState:async()=>opts,readSecret:()=>'',execute:async()=>{calls++}})
 await assert.rejects(send({functionId:'ca-test-reservation-api',body:'{}'}));assert.equal(calls,0)
 }
})

test('isolated build excludes inherited env and supplies only test targets, closed entry and no analytics',async()=>{
 const builder=await import('../scripts/build-customer-account-b7-v3-site.mjs').catch(()=>({}))
 assert.equal(typeof builder.buildB7Site,'function')
 const {readFile,readdir,rm}=await import('node:fs/promises'),{join}=await import('node:path')
 const prior=process.env.VITE_B7_LEAK_SENTINEL;process.env.VITE_B7_LEAK_SENTINEL='B7_SENTINEL_MUST_NEVER_SHIP'
 let result
 try{
  result=await builder.buildB7Site({window:{enabled:false,startsAt:null,endsAt:null}})
  assert.deepEqual(JSON.parse(await readFile(join(result.directory,'test-window.json'),'utf8')),{enabled:false,startsAt:null,endsAt:null})
  const config=JSON.parse(await readFile(join(result.directory,'b7-public-config.json'),'utf8'))
  assert.equal(config.VITE_APPWRITE_PROJECT_ID,'verygood-au-account-test');assert.equal(config.VITE_RESERVATION_API_FUNCTION_ID,'ca-test-reservation-api')
  assert.equal(createHash('sha256').update(await readFile(join(result.directory,'b7-approved-manifest.json'))).digest('hex'),'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90')
  let css='';for(const name of await readdir(join(result.directory,'assets')))if(name.endsWith('.css'))css+=await readFile(join(result.directory,'assets',name),'utf8')
  assert.doesNotMatch(css,/@import\s*(?:url\()?['"]?https?:/i,'test CSS must load without external fonts')
  let source='';for(const name of await readdir(join(result.directory,'assets')))if(name.endsWith('.js'))source+=await readFile(join(result.directory,'assets',name),'utf8')
  for(const forbidden of ['B7_SENTINEL_MUST_NEVER_SHIP','G-B7S2L88TQF','googletagmanager.com/gtag'])assert.equal(source.includes(forbidden),false,forbidden)
  assert.ok(source.includes('ca-test-reservation-api'));assert.ok(source.includes('B7_CLOSED'))
  assert.ok(source.includes('B7v3:1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'))
 }finally{if(prior===undefined)delete process.env.VITE_B7_LEAK_SENTINEL;else process.env.VITE_B7_LEAK_SENTINEL=prior;if(result)await rm(result.stage,{recursive:true,force:true})}
})
