import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash,webcrypto} from 'node:crypto'
import {createB7ExecutionMonitor} from '../scripts/customer-account-b7-v3-execution-monitor.mjs'
import {createB7BrowserTransport} from '../tools/customer-account-b7-v3/browser-transport.mjs'
const api=await import('../scripts/customer-account-b7-v3-continuation.mjs').catch(()=>({}))
const manifestBytes=await readFile(new URL('../docs/customer-account-b7-execution-manifest-v3.json',import.meta.url)),m=JSON.parse(manifestBytes)
const prior={attempts:{deployment:true,prepareVariables:true,configure:true},deploymentId:'6ad456239aeb781a4f4d',fixtureSha256:'a'.repeat(64),archiveSha256:'b'.repeat(64),initialVariableCount:23,guardVariableIds:Object.fromEntries(m.newFunctionVariableNames.map((k,i)=>[k,'var-'+i])),window:{startsAt:1792301099634,endsAt:1792301999634}}
function inputs(){const priorStateBytes=Buffer.from(JSON.stringify(prior));return {manifestBytes,priorStateBytes,priorClosed:{closed:true,verified:true,failedSteps:[]},approvalProof:{manifestVersion:3,manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',approved:true,allowAutoExtend:false,residualPublicInvocationRiskAccepted:true,continuation:{priorStateSha256:createHash('sha256').update(priorStateBytes).digest('hex'),priorExecutions:3,priorPages:5,additionalExecutionsMax:117,additionalPagesMax:2,cumulativePagesMax:7,newWindowsMax:1,reuseDeploymentId:'6ad456239aeb781a4f4d'}},sessionBaseline:{[m.actors.G.uid]:[],[m.actors.H.uid]:[]}}}
test('continuation inherits immutable resources and cumulative consumption without resetting the old journal',()=>{
 assert.equal(typeof api.createB7ContinuationState,'function');const i=inputs(),before=i.priorStateBytes.toString(),s=api.createB7ContinuationState(i)
 assert.equal(i.priorStateBytes.toString(),before);assert.equal(s.deploymentId,prior.deploymentId);assert.deepEqual(s.guardVariableIds,prior.guardVariableIds);assert.equal(s.continuation.priorExecutions,3);assert.equal(s.continuation.priorPages,5);assert.equal(s.window,undefined);assert.equal(s.attempts.deployment,true);assert.equal(s.attempts.prepareVariables,true);assert.equal(s.attempts.configure,undefined)
})
test('continuation rejects mismatched journal, unsafe closure and expanded budgets before any transport exists',()=>{
 assert.equal(typeof api.createB7ContinuationState,'function')
 for(const change of [i=>{i.priorStateBytes=Buffer.from('{}')},i=>{i.priorClosed.verified=false},i=>{i.approvalProof.continuation.priorExecutions=0},i=>{i.approvalProof.continuation.additionalPagesMax=3},i=>{i.approvalProof.continuation.reuseDeploymentId='other'}]){const i=inputs();change(i);assert.throws(()=>api.createB7ContinuationState(i))}
})
test('continuation monitor keeps prior three executions and stops at the 117th new execution',async()=>{
 const secret=Buffer.alloc(32,7).toString('base64url'),now=1792303000000,rows=[]
 const sender=createB7BrowserTransport({crypto:webcrypto,clock:()=>now,windowState:async()=>({enabled:true,startsAt:now-1000,endsAt:now+899000}),readSecret:()=>secret,execute:async p=>{rows.push({$id:'e-'+rows.length,requestPath:p.xpath,requestMethod:'POST',status:'completed',responseBody:'{}',$createdAt:new Date(now).toISOString()})}})
 for(let i=0;i<118;i++)await sender({functionId:'ca-test-reservation-api',body:'{"action":"health"}',async:false})
 const monitor=createB7ExecutionMonitor({secret,startsAt:now-1000,endsAt:now+899000,previousExecutions:3})
 assert.deepEqual(monitor.observe(rows.slice(0,116)),{unexpectedExecutions:0,executions:119,budgetReached:false});assert.deepEqual(monitor.observe(rows.slice(0,117)),{unexpectedExecutions:0,executions:120,budgetReached:true});assert.equal(monitor.observe(rows).unexpectedExecutions,1)
})
