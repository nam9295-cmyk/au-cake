import {useEffect,useRef,useState,type FormEvent} from 'react'
import AdminFrame from './AdminFrame'
import {isAdminLoggedIn} from './lib/repository'
import {listAdminMembers,type AdminMembersPage,type AdminMembersQuery} from './lib/admin-members'
import {CUSTOMER_AUTH_CHANGED_EVENT,CUSTOMER_AUTH_NOTICE_KEY} from './lib/customer-account-config'
import type {Page} from './lib/app-routes'

const dateLabel=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
export function AdminMembersTable({page}:{page:AdminMembersPage}) {
  return <section className="class-admin-table-card" aria-label="회원 명단">
    <div className="class-admin-table-scroll"><table className="class-admin-table">
      <thead><tr>{['이름','로그인 이메일','주문 연락 이메일','전화번호','가입일','구분','상태'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{page.members.map(member=><tr key={member.id}>
        <td>{member.name||'—'}</td><td>{member.loginEmail||'—'}</td><td>{member.contactEmail||'—'}</td><td>{member.phone||'—'}</td>
        <td>{dateLabel(member.joinedAt)}</td><td>{member.role==='admin'?'관리자':'회원'}</td><td>{member.status==='active'?'정상':'차단'}</td>
      </tr>)}</tbody>
    </table></div>
  </section>
}

type Props={navigate:(page:Page)=>void;checkAdmin?:()=>Promise<boolean>;loadMembers?:(query?:AdminMembersQuery)=>Promise<AdminMembersPage>}
export default function AdminMembersPageComponent({navigate,checkAdmin=isAdminLoggedIn,loadMembers=listAdminMembers}:Props) {
  const [authorized,setAuthorized]=useState(false),[page,setPage]=useState<AdminMembersPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[revision,setRevision]=useState(0)
  const generation=useRef(0),busy=useRef(false),mounted=useRef(false)
  useEffect(()=>{
    const requests=generation
    let live=true
    mounted.current=true
    async function refresh() {
      if(!live)return
      const ticket=++requests.current
      setAuthorized(false);setPage(null);setError('');setLoading(true);busy.current=true
      const current=()=>live&&mounted.current&&requests.current===ticket
      try {
        if(!await checkAdmin()){if(current())navigate('admin-login');return}
        if(!current())return
        setAuthorized(true)
        const result=await loadMembers({search})
        if(current())setPage(result)
      } catch(e) {
        if(!current())return
        if(e instanceof Error&&['CUSTOMER_UNAUTHORIZED','ADMIN_MEMBERS_FORBIDDEN'].includes(e.message)){setAuthorized(false);setPage(null);navigate('admin-login')}
        else setError('회원 명단을 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.')
      } finally {if(current()){setLoading(false);busy.current=false}}
    }
    const changed=()=>void refresh()
    const stored=(event:StorageEvent)=>{if(event.key===CUSTOMER_AUTH_NOTICE_KEY)changed()}
    void refresh()
    window.addEventListener('focus',changed);window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.addEventListener('storage',stored)
    return ()=>{live=false;mounted.current=false;requests.current++;window.removeEventListener('focus',changed);window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT,changed);window.removeEventListener('storage',stored)}
  },[checkAdmin,loadMembers,navigate,search,revision])
  async function more() {
    if(!authorized||!page?.nextCursor||busy.current)return
    busy.current=true;setLoading(true);setError('')
    const ticket=generation.current
    try {
      const next=await loadMembers({search,cursor:page.nextCursor})
      if(!mounted.current||ticket!==generation.current)return
      setPage({...next,members:[...new Map([...page.members,...next.members].map(m=>[m.id,m])).values()]})
    }catch(e){
      if(!mounted.current||ticket!==generation.current)return
      if(e instanceof Error&&['CUSTOMER_UNAUTHORIZED','ADMIN_MEMBERS_FORBIDDEN'].includes(e.message)){generation.current++;setAuthorized(false);setPage(null);navigate('admin-login')}
      else setError('다음 회원 목록을 불러올 수 없습니다. 다시 확인해 주세요.')
    }finally{if(mounted.current&&ticket===generation.current){setLoading(false);busy.current=false}}
  }
  function submit(event:FormEvent){event.preventDefault();setSearch(query.trim());setRevision(n=>n+1)}
  if(!authorized)return <main><p role={error?'alert':'status'}>{error||'관리자 권한을 확인하고 있습니다.'}</p></main>
  return <AdminFrame navigate={navigate}>
    <div className="admin-header"><h1>회원 명단</h1><button type="button" className="secondary-button" disabled={loading} onClick={()=>setRevision(n=>n+1)}>새로고침</button></div>
    <form className="class-admin-filters" onSubmit={submit}><label>로그인 이메일 검색<input type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="secondary-button" type="submit" disabled={loading}>검색</button></form>
    {error&&<p role="alert">{error}</p>}
    {loading&&<p role="status">회원 명단을 불러오는 중입니다.</p>}
    {page&&<><p>전체 {page.total}계정 · 관리자 포함{search?' · 검색 결과':''}</p>{page.members.length?<AdminMembersTable page={page}/>:<p>조회된 회원이 없습니다.</p>}{page.nextCursor&&<button className="secondary-button" type="button" disabled={loading} onClick={()=>void more()}>더 보기</button>}</>}
  </AdminFrame>
}
