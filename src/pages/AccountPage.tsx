import {useEffect,useRef,useState} from 'react'
import {useCustomerAccount} from '../lib/customer-account-context'
import type {CustomerIdentity,CustomerOrderDetail as Detail,CustomerOrderSummary,CustomerProfile} from '../lib/customer-account-types'
import type {Language} from '../lib/i18n'
import {getCustomerOrders,getCustomerOrder,classifyCustomerOrder} from '../lib/customer-orders'
import {CustomerOrderDetail} from '../components/CustomerOrderDetail'
import {customerAccountCopy,customerOrderStatusLabel} from '../lib/customer-account-copy'

function AccountPanel({identity,language}:{identity:CustomerIdentity;language:Language}) {
  const customer=useCustomerAccount(),t=(en:string,ko:string)=>language==='ko'?ko:en
  const [profile,setProfile]=useState<CustomerProfile>(identity.profile),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
  const [orders,setOrders]=useState<CustomerOrderSummary[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[detail,setDetail]=useState<Detail|null>(null)
  const active=useRef(false),operation=useRef(0),detailOperation=useRef(0)
  const {invalidateSession}=customer
  useEffect(()=>{
    active.current=true;const generation=++operation.current
    getCustomerOrders().then(page=>{if(active.current&&generation===operation.current){setOrders(page.orders);setCursor(page.nextCursor);setError('')}}).catch(caught=>{if(active.current&&generation===operation.current){setOrders([]);setDetail(null);setError('orders');if(caught instanceof Error&&caught.message==='CUSTOMER_UNAUTHORIZED')invalidateSession()}}).finally(()=>{if(active.current&&generation===operation.current)setLoading(false)})
    const sequence=operation,detailSequence=detailOperation
    return ()=>{active.current=false;sequence.current++;detailSequence.current++}
  },[identity.userId,invalidateSession])
  async function save(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();if(saving)return;setSaving(true);setMessage('')
    try{await customer.saveProfile(profile);if(active.current)setMessage(t('Saved. These details will be available for your next order.','저장했습니다. 다음 주문에서 사용할 수 있습니다.'))}
    catch(caught){if(active.current)setMessage(customerAccountCopy(language).error(caught))}
    finally{if(active.current)setSaving(false)}
  }
  async function load(next?:string) {
    if(loading)return;const generation=operation.current;setLoading(true);setError('')
    try{const page=await getCustomerOrders(next?{cursor:next}:{});if(active.current&&generation===operation.current){setOrders(current=>next?[...current,...page.orders.filter(o=>!current.some(p=>p.id===o.id))]:page.orders);setCursor(page.nextCursor)}}
    catch(caught){if(active.current&&generation===operation.current){setError('orders');if(caught instanceof Error&&caught.message==='CUSTOMER_UNAUTHORIZED')invalidateSession()}}
    finally{if(active.current&&generation===operation.current)setLoading(false)}
  }
  async function show(id:string) {
    const generation=++detailOperation.current;setDetail(null);setError('')
    try{const order=await getCustomerOrder(id);if(active.current&&generation===detailOperation.current)setDetail(order)}
    catch(caught){if(active.current&&generation===detailOperation.current){setError('detail');if(caught instanceof Error&&caught.message==='CUSTOMER_UNAUTHORIZED')invalidateSession()}}
  }
  return <>
    <form className="customer-profile-form" onSubmit={save}>
      <label>{t('Name','이름')}<input name="name" autoComplete="name" required minLength={2} maxLength={80} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label>
      <label>{t('Login email','로그인 이메일')}<input name="loginEmail" type="email" readOnly value={identity.loginEmail}/></label>
      <label>{t('Order contact email','주문 연락 이메일')}<input name="contactEmail" type="email" required maxLength={120} value={profile.contactEmail} onChange={e=>setProfile({...profile,contactEmail:e.target.value})}/></label>
      <label>{t('Australian mobile','호주 휴대전화')}<input name="phone" type="tel" autoComplete="tel" value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label>
      <label>{t('Preferred language','기본 언어')}<select name="language" value={profile.language} onChange={e=>setProfile({...profile,language:e.target.value as Language})}><option value="en">English</option><option value="ko">한국어</option></select></label>
      <button type="submit" className="primary-button" disabled={saving}>{saving?t('Saving…','저장 중…'):t('Save details','정보 저장')}</button>
      <p role="status">{message}</p>
    </form>
    {(['upcoming','past'] as const).map(group=><section key={group}><h2>{group==='upcoming'?t('Upcoming Orders','예정된 주문'):t('Past Orders','지난 주문')}</h2>
      <ul className="customer-orders">{orders.filter(o=>classifyCustomerOrder(o)===group).map(o=><li key={o.id}><button type="button" onClick={()=>void show(o.id)}><strong>{o.reservationNumber}</strong><span>{o.pickupDate} {o.pickupTime} · {customerOrderStatusLabel(o.status,language)}</span><span>{o.totalPriceCents===null?t('To be confirmed','확인 예정'):new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(o.totalPriceCents/100)}</span></button></li>)}</ul>
      {!loading&&!orders.some(o=>classifyCustomerOrder(o)===group)&&<p>{cursor?t('No orders in this group among the loaded orders.','불러온 주문 중 해당하는 주문이 없습니다.'):t('No orders in this group.','해당하는 주문이 없습니다.')}</p>}
    </section>)}
    {loading&&<p role="status">{t('Loading orders…','주문 불러오는 중…')}</p>}
    {cursor&&<><p>{t('These groups show loaded orders. More orders can be loaded.','불러온 주문을 표시하고 있습니다. 더 많은 주문을 불러올 수 있습니다.')}</p><button type="button" disabled={loading} onClick={()=>void load(cursor)}>{t('Load more orders','주문 더 불러오기')}</button></>}
    {error&&<p role="alert">{error==='detail'?t('Order details are unavailable.','주문 상세를 불러올 수 없습니다.'):t('Orders could not be loaded. Try again.','주문을 불러오지 못했습니다. 다시 시도해 주세요.')} <button type="button" disabled={loading} onClick={()=>void load()}>{t('Try again','다시 시도')}</button></p>}
    {detail&&<CustomerOrderDetail detail={detail} language={language} onClose={()=>setDetail(null)}/>}
    <button type="button" onClick={()=>void customer.signOut().catch(caught=>setMessage(customerAccountCopy(language).error(caught)))}>{t('Sign out','로그아웃')}</button>
  </>
}
export function AccountPage({language='en'}:{language?:Language}) {
  const customer=useCustomerAccount(),t=(en:string,ko:string)=>language==='ko'?ko:en
  return <main className="customer-account-page"><h1>MY ACCOUNT</h1>
    {!customer.enabled?<p>{t('Customer accounts are currently unavailable. Guest ordering is available.','지금은 회원 기능을 사용할 수 없습니다. 비회원 주문은 가능합니다.')}</p>:customer.state.status==='authenticated'?<AccountPanel key={customer.state.identity.userId} identity={customer.state.identity} language={language}/>:customer.state.status==='checking'?<p role="status">{t('Checking your session…','로그인 상태 확인 중…')}</p>:<><p>{t('Sign in to save your details and view your new cake and chocolate orders.','로그인하고 정보를 저장하거나 새 케이크·초콜릿 주문을 확인하세요.')}</p><button type="button" onClick={customer.openSignIn}>{t('Sign in','로그인')}</button>{customer.state.status==='unavailable'&&<p role="status">{customerAccountCopy(language).unavailable}</p>}</>}
    <p><a href="/cakes">{t('Continue shopping','계속 둘러보기')}</a> · <a href="/lookup">{t('Order number & phone lookup','예약번호·전화번호 조회')}</a></p>
    <p>{t('To request account deletion or help with your personal information, please use Contact Us. Some order and accounting records may need to be retained.','계정 삭제 또는 개인정보 관련 요청은 Contact Us로 문의해 주세요. 일부 주문·회계 기록은 필요한 기간 동안 보관될 수 있습니다.')} <a href="https://www.instagram.com/verygood_syd/" target="_blank" rel="noreferrer">Contact Us</a></p>
  </main>
}
