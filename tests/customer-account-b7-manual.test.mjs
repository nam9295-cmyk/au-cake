import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,writeFile,chmod,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {freezeB7Fixtures,sha256,B7_MANIFEST_SHA256} from '../scripts/customer-account-b7-v3-execution-contract.mjs'
import {createMacClipboard} from '../scripts/customer-account-b7-manual-clipboard.mjs'
import {createB7ExecutionMonitor} from '../scripts/customer-account-b7-v3-execution-monitor.mjs'
import {createB7BrowserTransport} from '../tools/customer-account-b7-v3/browser-transport.mjs'
import {webcrypto} from 'node:crypto'
const api=await import('../scripts/customer-account-b7-manual.mjs').catch(()=>({}))
const manifestBytes=await readFile(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),m=JSON.parse(manifestBytes)
const now=1792306000000
function bodies(){return Array.from({length:6},(_,i)=>JSON.stringify({action:'create-cake',...(i<4?{customerAccount:'link'}:{}),data:{contractVersion:'au-renewal.2026-10.v2',requestId:`b700000${i+1}-0000-4000-8000-00000000000${i+1}`,customerName:'B7 TEST ONLY '+(i===2||i===3?'H':'G'),customerPhone:i===2||i===3?'0400000002':'0400000001',customerEmail:i===2||i===3?'b7-h@example.invalid':'b7-g@example.invalid',pickupDate:'2026-10-23',pickupTime:'10:00',privacyConsent:true,website:'',requestNote:'',promoCode:i===2?'JENNIEABCDE':i===3?'FOXKIWIABCDE':'',orderLines:[{lineId:'line-'+i,offerId:i%2?'pave-chocolate-100g':'pave-cake',quantity:1,...(i%2?{}:{size:'6in',chocolateType:'dark'})}]}}))}
function packet(){const createBodies=bodies();return {mode:'user-chrome-cli-only',manifestSha256:B7_MANIFEST_SHA256,target:{endpoint:m.target.endpoint,projectId:m.target.projectId,functionId:m.target.functionId,siteOrigin:m.target.siteOrigin},startAuthorized:true,phase:'open',window:{startsAt:now-1000,endsAt:now+899000},key:Buffer.alloc(32,7).toString('base64url'),fixtureSha256:sha256(freezeB7Fixtures(createBodies.map(JSON.parse))),createBodies}}
function input(){const prior={deploymentId:'6ad456239aeb781a4f4d',archiveSha256:'a'.repeat(64),fixtureSha256:'b'.repeat(64),initialVariableCount:23,guardVariableIds:Object.fromEntries(m.newFunctionVariableNames.map((k,i)=>[k,'v'+i])),attempts:{deployment:true,prepareVariables:true,configure:true},window:{startsAt:now-2000000,endsAt:now-1100000},phase:'open'};return {manifestBytes,priorStateBytes:Buffer.from(JSON.stringify(prior)),priorClosed:{closed:true,verified:true,failedSteps:[]},sessionBaseline:{[m.actors.G.uid]:[],[m.actors.H.uid]:[]},consumption:{executions:6,pages:7}}}
test('manual preparation preserves resource identity and old journal without creating a window or start approval',()=>{
 assert.equal(typeof api.createB7ManualPreparation,'function');const i=input(),bytes=i.priorStateBytes.toString(),s=api.createB7ManualPreparation(i)
 assert.equal(i.priorStateBytes.toString(),bytes);assert.equal(s.startAuthorized,false);assert.equal(s.window,null);assert.equal(s.signingKey,undefined)
 assert.equal(s.deploymentId,'6ad456239aeb781a4f4d');assert.equal(s.continuation.priorExecutions,6);assert.equal(s.continuation.additionalExecutionsMax,114);assert.equal(s.continuation.priorPages,7);assert.equal(s.continuation.cumulativePagesMax,9);assert.equal(s.pages.openSlot,8);assert.equal(s.pages.closedSlot,9);assert.equal(s.manualFirstOrder,'G-cake');assert.equal(s.continuation.priorStateSha256,sha256(i.priorStateBytes))
})
test('manual preparation rejects reset budgets, wrong manifest, resource replacement, dirty closure and existing sessions',()=>{
 assert.equal(typeof api.createB7ManualPreparation,'function')
 for(const change of [i=>i.consumption.executions=0,i=>i.consumption.pages=5,i=>i.manifestBytes=Buffer.from('{}'),i=>i.priorClosed.verified=false,i=>i.sessionBaseline[m.actors.H.uid]=['unknown'],i=>{const p=JSON.parse(i.priorStateBytes);p.deploymentId='new';i.priorStateBytes=Buffer.from(JSON.stringify(p))}]){const i=input();change(i);assert.throws(()=>api.createB7ManualPreparation(i))}
})
test('manual transfer copies the exact frozen text; personal clipboard replacement is preserved',async()=>{
 assert.equal(typeof api.transferB7ManualValue,'function');let text='',waited,copied;const p=packet(),clipboard={write:async v=>{text=v},read:async()=>text}
 await api.transferB7ManualValue({packet:p,action:'G-cake',clipboard,clock:()=>now,sleep:async ms=>{waited=ms;copied=text;text='user replacement'}})
 assert.equal(copied,p.createBodies[0]);assert.equal(text,'user replacement');assert.equal(waited,45000)
})
test('manual key uses only clipboard stdin boundary and clears unchanged value after at most 45 seconds',async()=>{
 assert.equal(typeof api.transferB7ManualValue,'function');let text='',copied,notice
 const p=packet();await api.transferB7ManualValue({packet:p,action:'key',clipboard:{write:async v=>{text=v},read:async()=>text},clock:()=>now,notify:message=>{notice=message},sleep:async ms=>{assert.equal(ms,45000);copied=text}})
 assert.equal(copied,p.key);assert.equal(text,'');assert.ok(!notice.includes(p.key))
})
test('before start, after deadline, altered fixture, unknown action or wrong project means clipboard writes zero',async()=>{
 assert.equal(typeof api.transferB7ManualValue,'function');let writes=0
 for(const change of [p=>p.startAuthorized=false,p=>p.phase='prepared',p=>p.window.endsAt=now,p=>p.window.startsAt=now+1,p=>p.window.endsAt=now+900001,p=>p.target.projectId='verygood-au',p=>p.manifestSha256='wrong',p=>p.key='bad',p=>p.createBodies[0]+=' ',p=>{const b=JSON.parse(p.createBodies[0]);b.data.requestId='00000000-0000-4000-8000-000000000099';p.createBodies[0]=JSON.stringify(b)}]){
  const p=packet();change(p);await assert.rejects(api.transferB7ManualValue({packet:p,action:'key',clipboard:{write:async()=>{writes++},read:async()=>''},clock:()=>now,sleep:async()=>{}}))
 }
 await assert.rejects(api.transferB7ManualValue({packet:packet(),action:'new-order',clipboard:{write:async()=>{writes++}},clock:()=>now}));assert.equal(writes,0)
})
test('cross-customer detail uses the original G document ID and does not invent an ownership filter',async()=>{
 assert.equal(typeof api.transferB7ManualValue,'function');let copied
 const p=packet();await api.transferB7ManualValue({packet:p,action:'G-detail',clipboard:{write:async text=>{if(text)copied=text},read:async()=>copied},clock:()=>now,sleep:async()=>{}})
 assert.deepEqual(JSON.parse(copied),{action:'customer-order',data:{id:JSON.parse(p.createBodies[0]).data.requestId}})
})
test('private packet reader rejects permissive files and symlinks without exposing their contents',async()=>{
 assert.equal(typeof api.readB7ManualPacket,'function');const directory=await mkdtemp(join(tmpdir(),'b7-manual-')),file=join(directory,'transfer.private.json'),link=join(directory,'link.json');await chmod(directory,0o700);await writeFile(file,JSON.stringify(packet()),{mode:0o600});assert.equal((await api.readB7ManualPacket(file)).manifestSha256,B7_MANIFEST_SHA256)
 await chmod(file,0o644);await assert.rejects(api.readB7ManualPacket(file));await chmod(file,0o600);await symlink(file,link);await assert.rejects(api.readB7ManualPacket(link));await chmod(directory,0o755);await assert.rejects(api.readB7ManualPacket(file))
})
test('Mac clipboard boundary receives content only as stdin and uses absolute fixed executables',async()=>{
 const calls=[],clipboard=createMacClipboard({execute:async(command,input)=>{calls.push({command,input});return 'owned'}})
 await clipboard.write('synthetic-sensitive-value');assert.equal(await clipboard.read(),'owned')
 assert.deepEqual(calls,[{command:'/usr/bin/pbcopy',input:'synthetic-sensitive-value'},{command:'/usr/bin/pbpaste',input:undefined}])
})
test('manual monitor carries six used executions and stops at new execution 114 without resetting the budget',async()=>{
 const rows=[],secret=packet().key,sender=createB7BrowserTransport({crypto:webcrypto,clock:()=>now,windowState:async()=>({enabled:true,startsAt:now-1000,endsAt:now+899000}),readSecret:()=>secret,execute:async p=>{rows.push({$id:'manual-'+rows.length,requestPath:p.xpath,requestMethod:'POST',status:'completed',responseBody:'{}',$createdAt:new Date(now).toISOString()})}})
 for(let i=0;i<114;i++)await sender({functionId:'ca-test-reservation-api',body:'{"action":"health"}',async:false})
 const monitor=createB7ExecutionMonitor({secret,startsAt:now-1000,endsAt:now+899000,previousExecutions:6})
 assert.deepEqual(monitor.observe(rows.slice(0,113)),{unexpectedExecutions:0,executions:119,budgetReached:false});assert.deepEqual(monitor.observe(rows),{unexpectedExecutions:0,executions:120,budgetReached:true})
})
