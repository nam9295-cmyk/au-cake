import {GOOGLE_ONLY_ORIGIN,GOOGLE_ONLY_USERS} from '../customer-account-google-only/contract.mjs'
/** @returns {never} */
const fail=()=>{throw Error('MANUAL_CART_UNAVAILABLE')}
export function assertManualCartMode(value,{origin=GOOGLE_ONLY_ORIGIN,now=Date.now()}={}){
 if(origin!==GOOGLE_ONLY_ORIGIN||!value||Object.keys(value).sort().join(',')!=='enabled,mode,runId,startedAt'||value.enabled!==true||value.mode!=='manual-cart'||!/^manual-cart-[a-zA-Z0-9-]{1,60}$/.test(value.runId||'')||!Number.isSafeInteger(value.startedAt)||!Number.isFinite(now)||now<value.startedAt)fail()
 return value
}
export function createManualCartAuth({base,readMode,origin=()=>globalThis.location.origin,clock=Date.now}){
 const gate=async()=>assertManualCartMode(await readMode(),{origin:origin(),now:clock()})
 return {
  async restore(){await gate();const identity=await base.restore();if(identity&&!Object.values(GOOGLE_ONLY_USERS).some(u=>u.id===identity.userId))fail();return identity},
  async startGoogle(options){await gate();return base.startGoogle(options)},
  signOut:()=>base.signOut(),
  async sendEmail(){fail()},async verifyEmail(){fail()},async saveProfile(){fail()},
 }
}
export function createManualCartFetch({origin=GOOGLE_ONLY_ORIGIN,transport}){
 if(origin!==GOOGLE_ONLY_ORIGIN||typeof transport!=='function')fail()
 return async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input),origin),method=(options?.method||input?.method||'GET').toUpperCase()
  const headers=new Headers(options?.headers||input?.headers)
  const mode=url.origin===origin&&url.pathname==='/test-mode.json'&&method==='GET'
  const account=url.origin==='https://api.verygood-chocolate.com'&&headers.get('x-appwrite-project')==='verygood-au-account-test'&&!headers.has('x-appwrite-mode')&&((url.pathname==='/v1/account'&&method==='GET')||(url.pathname==='/v1/account/sessions/current'&&['GET','DELETE'].includes(method)))
  if(url.username||url.password||url.hash||(!mode&&!account))fail()
  return transport(input,options)
 }
}
