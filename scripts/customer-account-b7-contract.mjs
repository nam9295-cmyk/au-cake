// B7 only; explicit arguments, no environment or credential discovery, no network.
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
export const B7_MANIFEST_SHA256='2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
export function assertB7Run({manifestBytes,approvalProof,target,phase,now,window}={}) {
 const fail=()=>{throw Error('B7_CONTRACT_REJECTED')}
 if(!Buffer.isBuffer(manifestBytes)||sha256(manifestBytes)!==B7_MANIFEST_SHA256||approvalProof?.manifestSha256!==B7_MANIFEST_SHA256||approvalProof.approved!==true||approvalProof.residualPublicInvocationRiskAccepted!==true||approvalProof.allowAutoExtend!==false||!Number.isFinite(now)||!['prepare','armed','open','closing','closed'].includes(phase))fail()
 const manifest=JSON.parse(manifestBytes)
 if(!isDeepStrictEqual(target,manifest.target))fail()
 if(['armed','open'].includes(phase)) {
  if(!window||!Number.isSafeInteger(window.startsAt)||!Number.isSafeInteger(window.endsAt)||window.endsAt<=window.startsAt||window.endsAt-window.startsAt>900000||now>=window.endsAt||phase==='open'&&now<window.startsAt)fail()
 }
 return {manifest,phase,window:window?{...window}:undefined,target:structuredClone(target)}
}

// Exact six baseline payloads. Request IDs 1/2 are observed, never generated or rewritten here.
export function freezeB7Fixtures(requests) {
 const fail=()=>{throw Error('B7_FIXTURE_REJECTED')}
 if(!Array.isArray(requests)||requests.length!==6)fail()
 const products=['pave-cake','pave-chocolate-100g','pave-cake','pave-chocolate-100g','pave-cake','pave-chocolate-100g'],actors=['G','G','H','H','G','G'],ids=[]
 const uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
 for(const [i,body] of requests.entries()) {
  const data=body?.data,line=data?.orderLines?.[0],actor=actors[i]
  const expected={action:'create-cake',...(i<4?{customerAccount:'link'}:{}),data:{contractVersion:'au-renewal.2026-10.v2',requestId:data?.requestId,customerName:'B7 TEST ONLY '+actor,customerPhone:actor==='G'?'0400000001':'0400000002',customerEmail:actor==='G'?'b7-g@example.invalid':'b7-h@example.invalid',pickupDate:'2026-10-23',pickupTime:'10:00',privacyConsent:true,website:'',requestNote:'',promoCode:data?.promoCode,orderLines:[{lineId:line?.lineId,offerId:products[i],quantity:1,...(i%2===0?{size:'6in',chocolateType:'dark'}:{})}]}}
  if(!isDeepStrictEqual(body,expected)||!uuid.test(data.requestId)||typeof line.lineId!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(line.lineId)||i>=2&&data.requestId!==`b700000${i+1}-0000-4000-8000-00000000000${i+1}`)fail()
  if(i===2?!/^JENNIE[A-Z0-9]{5}$/.test(data.promoCode):i===3?!/^FOXKIWI[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(data.promoCode):data.promoCode!=='')fail()
  ids.push(data.requestId)
 }
 if(new Set(ids).size!==6)fail()
 const variants=requests.map(x=>structuredClone(x))
 // Exact bounded negatives/replays reach unmodified business authorization/idempotence.
 for(const request of requests){
  variants.push({...request,data:{...request.data,requestNote:'B7 changed payload'}})
  variants.push({...request,customerAccount:'link'})
  variants.push({...request,customerAccount:'link',data:{...request.data,customerUserId:'6ad38e4e0ffd5f810e23'}})
 }
 const legacy=requests[2]
 const {contractVersion:unused,orderLines:unusedLines,...data}=legacy.data
 void unused;void unusedLines
 variants.push({...legacy,data:{...data,productId:'pave-cake',cakeSize:'6in',chocolateType:'dark',quantity:1}})
 return Buffer.from(JSON.stringify({requestIds:ids,createBodies:[...new Set(variants.map(x=>JSON.stringify(x)))]}))
}
