// B7 only; explicit arguments, no environment or credential discovery, no network.
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
export const B7_MANIFEST_SHA256='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
export function assertB7Run({manifestBytes,approvalProof,target,phase,now,window}={}) {
 const fail=()=>{throw Error('B7_CONTRACT_REJECTED')}
 if(!Buffer.isBuffer(manifestBytes)||sha256(manifestBytes)!==B7_MANIFEST_SHA256||approvalProof?.manifestSha256!==B7_MANIFEST_SHA256||approvalProof.manifestVersion!==3||approvalProof.approved!==true||approvalProof.residualPublicInvocationRiskAccepted!==true||approvalProof.allowAutoExtend!==false||!Number.isFinite(now)||!['prepare','armed','open','closing','closed'].includes(phase))fail()
 const manifest=JSON.parse(manifestBytes)
 if(!isDeepStrictEqual(target,manifest.target))fail()
 if(['armed','open'].includes(phase)) {
  if(!window||!Number.isSafeInteger(window.startsAt)||!Number.isSafeInteger(window.endsAt)||window.endsAt<=window.startsAt||window.endsAt-window.startsAt>900000||now>=window.endsAt||phase==='open'&&now<window.startsAt)fail()
 }
 return {manifest,phase,window:window?{...window}:undefined,target:structuredClone(target)}
}


export {freezeB7Fixtures} from './customer-account-b7-contract.mjs'
