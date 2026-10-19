import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CustomerAccountProvider} from '../../src/CustomerAccountProvider'
import {CartProvider,useCart} from '../../src/CartProvider'
import {useCustomerAccount} from '../../src/lib/customer-account-context'
import {createCustomerAuth} from '../../src/lib/customer-auth'
import {account} from '../../src/lib/appwrite'
import {CustomerAuthCallback} from '../../src/components/CustomerAuthCallback'
import {saveCustomerSignInReturn} from '../../src/lib/customer-checkout-draft'
import type {CustomerOrderService} from '../../src/lib/customer-account-types'
import '../../src/index.css'
import '../../src/styles/customer-account.css'
const G='6ad38e4e0ffd5f810e23',email='nam9295@gmail.com',endpoint='https://api.verygood-chocolate.com',project='verygood-au-account-test',nativeFetch=window.fetch.bind(window),runId='b5-otp-one-shot-20261019'
const root=createRoot(document.getElementById('root')!)
const key=(name:string)=>runId+':'+name
function claim(name:string){if(localStorage.getItem(key(name)))throw Error('OTP_TRIAL_ALREADY_ATTEMPTED');localStorage.setItem(key(name),'1')}
async function mode(){const r=await nativeFetch('/test-mode.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('AUTH_UNAVAILABLE');const m=await r.json();if(m.enabled===false)throw Error('OTP_TEST_CLOSED');if(m.enabled!==true||m.mode!=='otp-one-shot'||m.runId!==runId)throw Error('AUTH_UNAVAILABLE')}
window.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin),method=(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase(),headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined))
 if(u.origin!==endpoint||headers.get('x-appwrite-project')!==project||headers.has('x-appwrite-key')||headers.has('x-appwrite-mode'))throw Error('TEST_ROUTE_BLOCKED')
 const allowed=method==='GET'&&['/v1/account','/v1/account/prefs','/v1/account/sessions/current'].includes(u.pathname)||method==='DELETE'&&u.pathname==='/v1/account/sessions/current'
 if(allowed)return nativeFetch(input,options)
 const body=JSON.parse(String(options?.body||'{}'))
 if(method==='POST'&&u.pathname==='/v1/account/tokens/email'&&body.email===email){claim('send-request');await mode();return nativeFetch(input,options)}
 if(method==='POST'&&u.pathname==='/v1/account/sessions/token'&&body.userId===G&&/^\d{6}$/.test(body.secret)){claim('verify-request');await mode();return nativeFetch(input,options)}
 throw Error('TEST_ROUTE_BLOCKED')
}
const base=createCustomerAuth(),auth={...base,async restore(){const i=await base.restore();if(i&&(i.userId!==G||i.loginEmail!==email))throw Error('AUTH_SESSION_CHANGED');return i},async saveProfile(){throw Error('TEST_WRITE_BLOCKED')}}
const orders:CustomerOrderService={async list(){throw Error('CUSTOMER_ACCOUNT_NOT_READY')},async detail(){throw Error('CUSTOMER_ACCOUNT_NOT_READY')}}
export function Page(){
 const customer=useCustomerAccount(),cart=useCart(),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[failed,setFailed]=useState(false)
 const identity=customer.state.status==='authenticated'?customer.state.identity:null
 const stop=(e:unknown)=>{setFailed(true);setResult(e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'OTP_TRIAL_FAILED')}
 async function send(){if(busy||failed)return;setBusy(true);try{await mode();const t=await base.sendEmail(email);if(t.userId!==G)throw Error('OTP_UID_MISMATCH');setSent(true);setResult('기존 G UID 확인. 이메일의 6자리 코드를 아래에 직접 입력해 주세요.')}catch(e){stop(e)}finally{setBusy(false)}}
 async function verify(){if(busy||failed)return;setBusy(true);try{await mode();const i=await base.verifyEmail({userId:G,code}),session=await account.getSession({sessionId:'current'});setCode('');if(i.userId!==G||i.loginEmail!==email||session.userId!==G||session.provider!=='token')throw Error('OTP_UID_OR_PROVIDER_MISMATCH');localStorage.setItem(key('otp-verified'),'1');setResult('OTP PASS · 기존 Google G UID와 동일합니다. Codex에게 OTP 성공이라고 알려 주세요.');await customer.refresh()}catch(e){setCode('');stop(e)}finally{setBusy(false)}}
 async function google(){if(busy||failed)return;setBusy(true);try{await mode();if(localStorage.getItem(key('otp-verified'))!=='1')throw Error('OTP_FIRST_REQUIRED');claim('google');await customer.signOut();const flowId=crypto.randomUUID();if(!saveCustomerSignInReturn(sessionStorage,{flowId,savedAt:Date.now(),pathname:'/account'}))throw Error('AUTH_DRAFT_UNAVAILABLE');await base.startGoogle({flowId})}catch(e){stop(e);setBusy(false)}}
 async function session(){if(busy||failed)return;setBusy(true);try{const u=await account.get(),s=await account.getSession({sessionId:'current'});if(u.$id!==G||u.email!==email||s.userId!==G||s.current!==true||s.provider!=='google'||localStorage.getItem(key('otp-verified'))!=='1')throw Error('GOOGLE_UID_MISMATCH');setResult('최종 PASS · OTP와 Google 모두 기존 G UID입니다. Codex에게 완료라고 알려 주세요.')}catch(e){stop(e)}finally{setBusy(false)}}
 return <main className="customer-account-page"><h1>이메일 OTP 단발 검증</h1><p>대상: {email} · 주문·결제·회원정보 저장 없음</p><p>화면 안내 순서대로 진행하고, 오류 시 재시도하지 마세요. 인증번호는 이 화면에만 직접 입력하세요.</p>
 <p role="status">{identity?'기존 G 로그인 상태':customer.state.status==='checking'?'세션 확인 중':'비로그인'}</p>
 {!identity&&!sent&&<button type="button" disabled={busy||failed||customer.state.status!=='guest'||!!localStorage.getItem(key('send-request'))} onClick={()=>void send()}>G 이메일로 인증번호 1회 발송</button>}
 {sent&&!identity&&<form onSubmit={e=>{e.preventDefault();void verify()}}><label>6자리 인증번호<input type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button disabled={busy||failed||!!localStorage.getItem(key('verify-request'))} type="submit">OTP 로그인 1회 확인</button></form>}
 {identity&&<section><h2>기존 정보·장바구니 보존</h2><p>이름: {identity.profile.name}</p><p>연락처 입력값 유지: {identity.profile.phone?'전화번호 저장됨':'전화번호 미저장'}</p><p>회원 장바구니: {cart.ready?cart.itemCount:'확인 중'}개</p><ul>{cart.renewalLines.map(l=><li key={l.lineId}>{l.offerId} · {l.quantity}개</li>)}</ul></section>}
 {localStorage.getItem(key('otp-verified'))==='1'&&<><p>Codex가 Google 확인 단계라고 안내한 뒤에만 아래 버튼을 누르세요.</p><button disabled={busy||failed||!!localStorage.getItem(key('google'))} type="button" onClick={()=>void google()}>OTP 로그아웃 후 G Google 로그인</button><button disabled={busy||failed} type="button" onClick={()=>void session()}>Google 복귀 후 동일 UID 확인</button></>}
 <p role="status" aria-live="polite">{result}</p><p id="connection-status" role="status"/></main>
}
async function start(){try{await mode();root.render(<CustomerAccountProvider auth={auth} orderService={orders}><CartProvider>{location.pathname==='/account/auth/callback'?<CustomerAuthCallback/>:<Page/>}</CartProvider></CustomerAccountProvider>);setInterval(()=>{void mode().catch(e=>{if(e instanceof Error&&e.message==='OTP_TEST_CLOSED')root.render(<main><h1>Test CLOSED</h1></main>);else{const el=document.getElementById('connection-status');if(el)el.textContent='연결 확인 지연: 조작을 멈추고 Codex에게 알려 주세요.'}})},10000)}catch{root.render(<main><h1>Test CLOSED</h1></main>)}}
void start()
