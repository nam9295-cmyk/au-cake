import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CartProvider,useCart} from '../../src/CartProvider'
import {CustomerAccountProvider} from '../../src/CustomerAccountProvider'
import {AccountPage} from '../../src/pages/AccountPage'
import {CustomerAuthCallback} from '../../src/components/CustomerAuthCallback'
import {AuRenewalShop} from '../../src/pages/AuRenewalShop'
import {AuLanguageContext} from '../../src/lib/au-language'
import {useCustomerAccount} from '../../src/lib/customer-account-context'
import {createCustomerAuth,type CustomerAuth} from '../../src/lib/customer-auth'
import {account} from '../../src/lib/appwrite'
import {parseCustomerOrdersPage,parseCustomerOrderDetail} from '../../src/lib/customer-orders'
import type {CustomerOrderService} from '../../src/lib/customer-account-types'
import {INTEGRATED_TARGET as target,INTEGRATED_USERS as users} from './server.mjs'
import '../../src/index.css'
import '../../src/styles/au-renewal.css'
import './test.css'
const originalFetch=window.fetch.bind(window),root=createRoot(document.getElementById('root')!)
type Mode={enabled:boolean;mode:string;runId:string;startedAt:number;executionsMax:number}
let mode:Mode
let currentUser:string|null=null
async function readMode(){const r=await originalFetch('/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('AUTH_UNAVAILABLE');const m=await r.json() as Mode;if(m.enabled!==true||m.mode!=='integrated-read'||!m.runId||!Number.isSafeInteger(m.startedAt)||m.startedAt>Date.now()||!Number.isInteger(m.executionsMax)||m.executionsMax<1||m.executionsMax>10)throw Error('AUTH_UNAVAILABLE');return m}
// Test-only transport boundary. Native order submission and direct DB/Function access cannot leave this build.
window.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin),method=(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase(),h=new Headers(options?.headers||(input instanceof Request?input.headers:undefined))
 const accountRoute=u.origin==='https://api.verygood-chocolate.com'&&h.get('x-appwrite-project')===target.projectId&&!h.has('x-appwrite-mode')&&(
  method==='GET'&&['/v1/account','/v1/account/prefs','/v1/account/sessions/current'].includes(u.pathname)||method==='DELETE'&&u.pathname==='/v1/account/sessions/current'||method==='PATCH'&&u.pathname==='/v1/account/prefs'||method==='POST'&&u.pathname==='/v1/account/jwts')
 if(!accountRoute)throw Error('TEST_WRITE_OR_ROUTE_BLOCKED')
 return originalFetch(input,options)
}
const base=createCustomerAuth(),label=(uid:string)=>Object.keys(users).find(k=>users[k as keyof typeof users]===uid)
const auth:CustomerAuth={...base,
 async restore(){await readMode();const identity=await base.restore();if(identity&&!label(identity.userId))throw Error('AUTH_UNAVAILABLE');currentUser=identity?.userId||null;return identity},
 async signOut(){currentUser=null;return base.signOut()},
 async startGoogle(options){await readMode();return base.startGoogle(options)},
 async sendEmail(){throw Error('AUTH_UNAVAILABLE')},async verifyEmail(){throw Error('AUTH_UNAVAILABLE')},
 async saveProfile(profile,uid){await readMode();const actor=label(uid);if(!actor||profile.name!==`CA Test ${actor}`||profile.contactEmail!==`${actor.toLowerCase()}-profile@example.invalid`||profile.phone!==(actor==='G'?'0491570006':'0491570007'))throw Error('INVALID_PROFILE');const key=mode.runId+':prefs:'+actor,count=Number(localStorage.getItem(key)||'0');if(count>=2)throw Error('AUTH_RATE_LIMITED');localStorage.setItem(key,String(count+1));return base.saveProfile(profile,uid)},
}
const evidenceKey=()=>mode.runId+':read-evidence',countKey=()=>mode.runId+':dispatches'
type Evidence={actor:string;action:string;status:number;elapsedMs:number;within10s:boolean;upstreamMs:number;executionMs:number}
function evidence():Evidence[]{try{return JSON.parse(localStorage.getItem(evidenceKey())||'[]') as Evidence[]}catch{return []}}
async function query(action:string,data:Record<string,unknown>,unauthenticated=false){
 const began=performance.now()
 await readMode()
 if(!navigator.locks)throw Error('TEST_SERIAL_LOCK_UNAVAILABLE')
 return navigator.locks.request(mode.runId+':query',{ifAvailable:true},async lock=>{
  if(!lock)throw Error('TEST_QUERY_BUSY')
  let actor='Guest',jwt=''
  if(!unauthenticated){if(!currentUser||!label(currentUser))throw Error('CUSTOMER_UNAUTHORIZED');actor=label(currentUser)!;const count=Number(localStorage.getItem(countKey())||'0');if(count>=mode.executionsMax)throw Error('TEST_QUERY_LIMIT');localStorage.setItem(countKey(),String(count+1));jwt=(await account.createJWT()).jwt}
  const left=10000-Math.round(performance.now()-began);if(left<=0)throw Error('CUSTOMER_ORDERS_UNAVAILABLE')
  let r:Response
  try{r=await originalFetch('/__acceptance/orders',{method:'POST',redirect:'error',signal:AbortSignal.timeout(left),headers:{'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({action,data})})}
  catch{const elapsedMs=Math.round(performance.now()-began);localStorage.setItem(evidenceKey(),JSON.stringify([...evidence(),{actor,action,status:0,elapsedMs,within10s:false,upstreamMs:0,executionMs:0}]));throw Error('CUSTOMER_ORDERS_UNAVAILABLE')}
  const body=await r.json(),elapsedMs=Math.round(performance.now()-began)
  const row:Evidence={actor,action,status:r.status,elapsedMs,within10s:elapsedMs<10000,upstreamMs:Number(r.headers.get('x-ca-upstream-ms')||'0'),executionMs:Number(r.headers.get('x-ca-execution-ms')||'0')}
  localStorage.setItem(evidenceKey(),JSON.stringify([...evidence(),row]));window.dispatchEvent(new Event('ca-integration-result'))
  if(elapsedMs>=10000)throw Error('CUSTOMER_ORDERS_UNAVAILABLE')
  if(!r.ok||body.ok!==true)throw Object.assign(Error(body.code||'CUSTOMER_ORDERS_UNAVAILABLE'),{httpStatus:r.status})
  return body.result
 })
}
const orders:CustomerOrderService={async list(){return parseCustomerOrdersPage(await query('customer-orders',{limit:25}))},async detail(id){return parseCustomerOrderDetail(await query('customer-order',{id}))}}
export function IntegratedPage(){
 const customer=useCustomerAccount(),cart=useCart(),[language,setLanguage]=useState<'en'|'ko'>('ko'),[result,setResult]=useState(''),[busy,setBusy]=useState(false)
 const identity=customer.state.status==='authenticated'?customer.state.identity:undefined,path=location.pathname.replace(/\/+$/,'')||'/'
 const showResults=()=>setResult(evidence().map(x=>`${x.actor} ${x.action}: HTTP ${x.status}, ${x.elapsedMs}ms ${x.within10s?'':'TIMEOUT FAIL'}`).join('\n'))
 async function negative(unauthenticated=false){if(busy)return;setBusy(true);try{await query(unauthenticated?'customer-orders':'customer-order',unauthenticated?{limit:25}:{id:target.fixtureId},unauthenticated);setResult('FAIL: 접근 거부되지 않았습니다. Codex에게 알려주세요.')}catch(e){const expected=unauthenticated?401:404;setResult((e as {httpStatus?:number}).httpStatus===expected?`HTTP ${expected} 확인`:'확인 실패: Codex에게 알려주세요.')}finally{setBusy(false)}}
 return <AuLanguageContext.Provider value={{language,setLanguage}}>
  <header className="renewal-page integration-nav"><p>VERYGOOD AU · 통합 인수 · 주문 제출·결제 불가</p>
   <nav><a href="/account">MY ACCOUNT / MY ORDERS</a><a href="/chocolates/pave-chocolate">초콜릿</a><a href="/cakes/pave-chocolate-cake">케이크</a><a href="/cart">Bag ({cart.itemCount}) / 주문서</a></nav>
   <p>{identity?`고객 ${label(identity.userId)}`:customer.state.status==='checking'?'로그인 확인 중…':'Guest'}</p>
   {identity?<button type="button" onClick={()=>void customer.signOut().catch(()=>setResult('로그아웃 확인 실패'))}>로그아웃</button>:<button type="button" onClick={customer.openSignIn}>Google 로그인</button>}
   <p>합성 회원정보: CA Test G / g-profile@example.invalid / 0491570006 · H는 CA Test H / h-profile@example.invalid / 0491570007</p>
   {identity&&label(identity.userId)==='H'&&<button type="button" disabled={busy} onClick={()=>void negative()}>G 주문 접근 차단 확인 (404)</button>}
   <button type="button" disabled={busy} onClick={()=>void negative(true)}>미인증 조회 차단 확인 (401)</button>
   <button type="button" onClick={showResults}>조회 결과·응답시간 표시</button><pre role="status">{result}</pre><p id="test-connection" role="status"/>
   <button type="button" onClick={()=>void navigator.clipboard.writeText(JSON.stringify({runId:mode.runId,queries:evidence()})).then(()=>setResult('비민감 결과를 복사했습니다. Codex에게 붙여넣어 주세요.'))}>조회 결과 복사</button>
  </header>
  {path==='/account/auth/callback'?<CustomerAuthCallback/>:path==='/account'||path==='/'?<AccountPage language={language}/>:<AuRenewalShop path={path}/>}
 </AuLanguageContext.Provider>
}
document.addEventListener('submit',e=>{if(e.target instanceof HTMLFormElement&&e.target.classList.contains('renewal-checkout')){e.preventDefault();e.stopImmediatePropagation()}},true)
async function start(){
 try{mode=await readMode();root.render(<CustomerAccountProvider auth={auth} orderService={orders}><CartProvider><IntegratedPage/></CartProvider></CustomerAccountProvider>);setInterval(()=>{void readMode().then(()=>{const e=document.getElementById('test-connection');if(e)e.textContent=''}).catch(async()=>{try{const r=await originalFetch('/test-mode.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if((await r.json()).enabled===false){root.render(<main><h1>Test CLOSED</h1></main>);return}}catch{/* transient mode reads do not discard the cart */}const e=document.getElementById('test-connection');if(e)e.textContent='연결 확인이 지연됩니다. 조작을 멈추고 Codex에게 알려주세요.'})},10000)}catch{root.render(<main><h1>Test CLOSED</h1></main>)}
}
void start()
