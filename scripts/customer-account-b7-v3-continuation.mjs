// Explicit approved handoff only. No transport, credentials, creates, or alteration of prior evidence.
import {assertB7Run,sha256} from './customer-account-b7-v3-execution-contract.mjs'
export function createB7ContinuationState({manifestBytes,approvalProof,priorStateBytes,priorClosed,sessionBaseline}){
 const {manifest}=assertB7Run({manifestBytes,approvalProof,target:JSON.parse(manifestBytes).target,phase:'prepare',now:Date.now()})
 const c=approvalProof.continuation,fail=()=>{throw Error('B7_CONTINUATION_REJECTED')}
 if(!Buffer.isBuffer(priorStateBytes)||!c||c.priorStateSha256!==sha256(priorStateBytes)||c.priorExecutions!==3||c.priorPages!==5||c.additionalExecutionsMax!==117||c.additionalPagesMax!==2||c.cumulativePagesMax!==7||c.newWindowsMax!==1||c.reuseDeploymentId!=='6ad456239aeb781a4f4d'||priorClosed?.closed!==true||priorClosed.verified!==true||priorClosed.failedSteps?.length!==0)fail()
 const p=JSON.parse(priorStateBytes)
 if(p.deploymentId!==c.reuseDeploymentId||p.attempts?.deployment!==true||p.attempts.prepareVariables!==true||p.attempts.configure!==true||p.initialVariableCount!==23||!p.window||!Number.isSafeInteger(p.window.endsAt)||!(/^[a-f\d]{64}$/.test(p.fixtureSha256))||!(/^[a-f\d]{64}$/.test(p.archiveSha256))||Object.keys(p.guardVariableIds||{}).length!==7||manifest.newFunctionVariableNames.some(k=>!/^[-\w.]{1,36}$/.test(p.guardVariableIds[k])))fail()
 if([manifest.actors.G.uid,manifest.actors.H.uid].some(uid=>!Array.isArray(sessionBaseline?.[uid])||sessionBaseline[uid].length!==0))fail()
 return {continuation:{...structuredClone(c),previousWindow:structuredClone(p.window)},attempts:{deployment:true,prepareVariables:true},deploymentId:p.deploymentId,archiveSha256:p.archiveSha256,fixtureSha256:p.fixtureSha256,initialVariableCount:23,guardVariableIds:structuredClone(p.guardVariableIds),sessionBaseline:structuredClone(sessionBaseline),createdSessionIds:Object.fromEntries([manifest.actors.G.uid,manifest.actors.H.uid].map(uid=>[uid,[]]))}
}
