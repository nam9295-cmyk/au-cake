// CLI-only handoff. No browser, network, environment credentials or remote writes.
import {open,lstat} from 'node:fs/promises'
import {constants} from 'node:fs'
import {dirname,isAbsolute} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {B7_MANIFEST_SHA256,freezeB7Fixtures,sha256} from './customer-account-b7-v3-execution-contract.mjs'
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',functionId:'ca-test-reservation-api',siteOrigin:'https://au-account-test.verygood-chocolate.com'}
const fail=()=>{throw Error('B7_MANUAL_HANDOFF_REJECTED')}
export function createB7ManualPreparation({manifestBytes,priorStateBytes,priorClosed,sessionBaseline,consumption}){
 if(!Buffer.isBuffer(manifestBytes)||sha256(manifestBytes)!==B7_MANIFEST_SHA256||!Buffer.isBuffer(priorStateBytes)||!isDeepStrictEqual(consumption,{executions:6,pages:7})||priorClosed?.closed!==true||priorClosed.verified!==true||!isDeepStrictEqual(priorClosed.failedSteps,[]))fail()
 const m=JSON.parse(manifestBytes),p=JSON.parse(priorStateBytes)
 if(p.deploymentId!=='6ad456239aeb781a4f4d'||p.initialVariableCount!==23||!['deployment','prepareVariables','configure'].every(k=>p.attempts?.[k]===true)||!(/^[a-f\d]{64}$/.test(p.fixtureSha256))||!(/^[a-f\d]{64}$/.test(p.archiveSha256))||Object.keys(p.guardVariableIds||{}).length!==7||m.newFunctionVariableNames.some(k=>!/^[-\w.]{1,36}$/.test(p.guardVariableIds[k]))||[m.actors.G.uid,m.actors.H.uid].some(uid=>!isDeepStrictEqual(sessionBaseline?.[uid],[])))fail()
 return {mode:'user-chrome-cli-only',manifestSha256:B7_MANIFEST_SHA256,startAuthorized:false,window:null,target:{...target},manualFirstOrder:'G-cake',deploymentId:p.deploymentId,fixtureSha256:p.fixtureSha256,archiveSha256:p.archiveSha256,guardVariableIds:structuredClone(p.guardVariableIds),sessionBaseline:structuredClone(sessionBaseline),continuation:{priorStateSha256:sha256(priorStateBytes),priorExecutions:6,additionalExecutionsMax:114,priorPages:7,additionalPagesMax:2,cumulativePagesMax:9,newWindowsMax:1,reuseDeploymentId:p.deploymentId},pages:{openSlot:8,closedSlot:9},limits:{windowSeconds:900,executionsTotal:120,concurrency:1,orders:6,coupons:2,users:3}}
}
export async function readB7ManualPacket(path){
 let file
 try{
  if(!isAbsolute(path||''))fail()
  const dir=await lstat(dirname(path));if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o777)!==0o700||dir.uid!==process.getuid())fail()
  file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  const stat=await file.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>150000)fail()
  return JSON.parse(await file.readFile('utf8'))
 }catch{fail()}finally{await file?.close()}
}
export async function transferB7ManualValue({packet:p,action,clipboard,clock=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),notify=()=>{}}){
 let value
 try{
  const now=clock(),w=p?.window
  if(p?.mode!=='user-chrome-cli-only'||p.manifestSha256!==B7_MANIFEST_SHA256||!isDeepStrictEqual(p.target,target)||p.startAuthorized!==true||p.phase!=='open'||!w||!Number.isSafeInteger(w.startsAt)||!Number.isSafeInteger(w.endsAt)||w.endsAt-w.startsAt!==900000||now<w.startsAt||now>=w.endsAt||!Number.isFinite(now)||!/^[A-Za-z0-9_-]{43}$/.test(p.key)||Buffer.from(p.key,'base64url').toString('base64url')!==p.key||!Array.isArray(p.createBodies)||p.createBodies.length!==6||p.createBodies.some(text=>typeof text!=='string'||JSON.stringify(JSON.parse(text))!==text)||sha256(freezeB7Fixtures(p.createBodies.map(JSON.parse)))!==p.fixtureSha256)fail()
  if(action==='key')value=p.key
  else if(action==='G-cake')value=p.createBodies[0]
  else if(action==='G-detail')value=JSON.stringify({action:'customer-order',data:{id:JSON.parse(p.createBodies[0]).data.requestId}})
  else fail()
  await clipboard.write(value)
  try{
   notify('Copied locally. Paste only into the test page. Keep this Terminal open; unchanged clipboard clears within 45 seconds.')
   await sleep(Math.min(45000,w.endsAt-now))
  }finally{
   // Read only after taking ownership; preserve anything the user copied since.
   if(await clipboard.read()===value)await clipboard.write('')
  }
  return {copied:true,action,secretPrinted:false}
 }catch{throw Error('B7_MANUAL_TRANSFER_FAILED')}
}
