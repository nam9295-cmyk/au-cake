import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CartProvider} from '../../src/CartProvider'
import {CustomerAccountProvider} from '../../src/CustomerAccountProvider'
import {AccountPage} from '../../src/pages/AccountPage'
import {CustomerAuthCallback} from '../../src/components/CustomerAuthCallback'

import {AuLanguageContext} from '../../src/lib/au-language'
import {useCustomerAccount} from '../../src/lib/customer-account-context'
import {createCustomerAuth,type CustomerAuth} from '../../src/lib/customer-auth'
import {account} from '../../src/lib/appwrite'
import {parseCustomerOrdersPage,parseCustomerOrderDetail} from '../../src/lib/customer-orders'
import type {CustomerOrderService} from '../../src/lib/customer-account-types'
import {MEMBER_TARGET as target,MEMBER_USERS as users} from './server.mjs'
import '../../src/index.css'
import '../../src/styles/au-renewal.css'
import '../customer-account-integrated/test.css'
const originalFetch=window.fetch.bind(window),root=createRoot(document.getElementById('root')!)
type Mode={enabled:boolean;mode:string;runId:string;startedAt:number;executionsMax:number;fixtureId:string}
let mode:Mode
let currentUser:string|null=null
async function readMode(){const r=await originalFetch('/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('AUTH_UNAVAILABLE');const m=await r.json() as Mode;if(m.enabled!==true||m.mode!=='member-create'||!m.runId||!Number.isSafeInteger(m.startedAt)||m.startedAt>Date.now()||!Number.isInteger(m.executionsMax)||m.executionsMax<1||m.executionsMax>3)throw Error('AUTH_UNAVAILABLE');return m}
// Test-only transport boundary. Native order submission and direct DB/Function access cannot leave this build.
window.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin),method=(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase(),h=new Headers(options?.headers||(input instanceof Request?input.headers:undefined))
 const accountRoute=u.origin==='https://api.verygood-chocolate.com'&&h.get('x-appwrite-project')===target.projectId&&!h.has('x-appwrite-mode')&&(
  method==='GET'&&['/v1/account','/v1/account/prefs','/v1/account/sessions/current'].includes(u.pathname)||method==='DELETE'&&u.pathname==='/v1/account/sessions/current'||method==='POST'&&u.pathname==='/v1/account/jwts')
 if(!accountRoute)throw Error('TEST_WRITE_OR_ROUTE_BLOCKED')
 return originalFetch(input,options)
}
const base=createCustomerAuth(),label=(uid:string)=>Object.keys(users).find(k=>users[k as keyof typeof users]===uid)
const auth:CustomerAuth={...base,
 async restore(){await readMode();const identity=await base.restore();if(identity&&identity.userId!==users.G)throw Error('AUTH_UNAVAILABLE');currentUser=identity?.userId||null;return identity},
 async signOut(){currentUser=null;return base.signOut()},
 async startGoogle(options){await readMode();return base.startGoogle(options)},
 async sendEmail(){throw Error('AUTH_UNAVAILABLE')},async verifyEmail(){throw Error('AUTH_UNAVAILABLE')},
 async saveProfile(){throw Error('TEST_PROFILE_WRITE_BLOCKED')},
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
export function MemberPage(){
 const customer=useCustomerAccount(),[language,setLanguage]=useState<'en'|'ko'>('ko'),[result,setResult]=useState(''),[showOrders,setShowOrders]=useState(false)
 const identity=customer.state.status==='authenticated'?customer.state.identity:undefined
 async function copyJwt(){try{if(identity?.userId!==users.G)throw Error();const token=await account.createJWT();await navigator.clipboard.writeText(token.jwt);setResult('복사했습니다. 안내받은 Terminal의 숨김 입력에 붙여넣으세요. 채팅에는 보내지 마세요.')}catch{setResult('JWT 보호 복사 실패. 재시도하지 말고 Codex에게 알려주세요.')}}
 return <AuLanguageContext.Provider value={{language,setLanguage}}><header className="renewal-page integration-nav"><h1>회원 주문 1건 검증</h1><p>실제 결제·쿠폰·이메일 발송 없음. 합성 주문 생성은 Mac CLI가 1회만 수행합니다.</p>
 {!identity?<button type="button" onClick={customer.openSignIn}>G Google 로그인</button>:<><p>G 인증 확인됨</p><button type="button" onClick={()=>void copyJwt()}>1. 주문 검증용 JWT 보호 복사</button><button type="button" disabled={showOrders} onClick={()=>setShowOrders(true)}>2. Codex 생성 완료 후 MY ORDERS 열기</button></>}
 <p role="status">{result}</p><button type="button" onClick={()=>setResult(evidence().map(x=>`${x.action}: HTTP ${x.status}, ${x.elapsedMs}ms`).join('\n'))}>조회 결과 표시</button><p id="test-connection" role="status"/>
 </header>{location.pathname==='/account/auth/callback'?<CustomerAuthCallback/>:showOrders&&identity?<AccountPage language={language}/>:null}</AuLanguageContext.Provider>
}
document.addEventListener('submit',e=>{if(e.target instanceof HTMLFormElement&&e.target.classList.contains('renewal-checkout')){e.preventDefault();e.stopImmediatePropagation()}},true)
async function start(){
 try{mode=await readMode();root.render(<CustomerAccountProvider auth={auth} orderService={orders}><CartProvider><MemberPage/></CartProvider></CustomerAccountProvider>);setInterval(()=>{void readMode().then(()=>{const e=document.getElementById('test-connection');if(e)e.textContent=''}).catch(async()=>{try{const r=await originalFetch('/test-mode.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if((await r.json()).enabled===false){root.render(<main><h1>Test CLOSED</h1></main>);return}}catch{/* transient mode reads do not discard the cart */}const e=document.getElementById('test-connection');if(e)e.textContent='연결 확인이 지연됩니다. 조작을 멈추고 Codex에게 알려주세요.'})},10000)}catch{root.render(<main><h1>Test CLOSED</h1></main>)}
}
void start()
