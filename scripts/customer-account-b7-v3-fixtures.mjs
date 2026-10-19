import {assertB7Run,sha256} from './customer-account-b7-v3-execution-contract.mjs'
import {buildManualCouponDocument} from './manual-coupon-config.mjs'
import {digestReviewCouponCode} from '../appwrite-functions/reservation-api/src/coupon-digest.js'
const fail=()=>{throw Error('B7_V3_FIXTURE_CREATE_REJECTED')}
export function createB7V3FixtureManager({manifestBytes,approvalProof,target:input,cliSession,hEmail,codes,hmacSecret,state,persist,transport=fetch,clock=Date.now}){
 const {manifest:m,target}=assertB7Run({manifestBytes,approvalProof,target:input,phase:'prepare',now:clock()})
 if(cliSession?.endpoint!==target.endpoint||!cliSession.cookie||cliSession.key||cliSession.selfSigned||/[\r\n]/.test(cliSession.cookie)||sha256(hEmail||'')!==m.actors.H.emailSha256||!/^JENNIE[A-Z0-9]{5}$/.test(codes?.manual||'')||!/^FOXKIWI[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(codes?.review||'')||!state?.attempts||typeof persist!=='function')fail()
 let busy=false
 async function call(method,path,data){
  const project=path==='/projects/'+target.projectId
  const r=await transport(target.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Appwrite-Project':project?'console':target.projectId,...(project?{}:{'X-Appwrite-Mode':'admin'}),Cookie:cliSession.cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})
  if(!r.ok||r.redirected)fail();return r.json()
 }
 async function closed(){const p=await call('GET','/projects/'+target.projectId);if(p.$id!==target.projectId||p.serviceStatusForAccount!==false)fail()}
 async function serial(fn){if(busy)fail();busy=true;try{return await fn()}finally{busy=false}}
 const permissions=['read','update','delete'].map(op=>op+'("user:'+m.actors.M.uid+'")')
 return {
  async createH(){if(state.attempts.h)fail();return serial(async()=>{
   await closed();const users=await call('GET','/users')
   if(users.total!==2||JSON.stringify(users.users?.map(u=>u.$id).sort())!==JSON.stringify([m.actors.M.uid,m.actors.G.uid].sort()))fail()
   state.attempts.h=true;await persist(structuredClone(state))
   const h=await call('POST','/users',{userId:m.actors.H.uid,email:hEmail,name:'B7 TEST ONLY H'})
   if(h.$id!==m.actors.H.uid||sha256(h.email||'')!==m.actors.H.emailSha256||h.status!==true||h.labels?.length)fail()
   state.hCreated=true;await persist(structuredClone(state));return {uid:h.$id,created:true}
  })},
  async createCoupons(){if(state.attempts.coupons||state.hCreated!==true)fail();return serial(async()=>{
   await closed()
   for(const f of m.couponFixtures){const list=await call('GET','/databases/ca_test_cake_au/collections/'+f.collectionId+'/documents');if(list.total!==0||list.documents?.length)fail()}
   state.attempts.coupons=true;state.createdCouponIds=[];await persist(structuredClone(state))
   const now=new Date(clock()),manual=buildManualCouponDocument({config:{code:codes.manual,hmacSecret},now})
   const review={...manual,codeHash:digestReviewCouponCode(codes.review,hmacSecret),codeLast4:codes.review.slice(-4),rewardPercent:10,sourceReviewId:'b7-synthetic-review-reference'}
   for(const [i,f]of m.couponFixtures.entries()){
    const data=i===0?manual:review,row=await call('POST','/databases/ca_test_cake_au/collections/'+f.collectionId+'/documents',{documentId:f.documentId,data,permissions})
    if(row.$id!==f.documentId||row.codeHash!==data.codeHash||row.rewardPercent!==f.rewardPercent||row.status!=='active')fail()
    state.createdCouponIds.push(row.$id);await persist(structuredClone(state))
   }
   return {created:2,ids:[...state.createdCouponIds]}
  })},
 }
}
