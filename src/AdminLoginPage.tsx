import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { SiteHeader } from './components/SiteChrome'
import type { Page } from './lib/app-routes'
import { isAppwriteConfigured } from './lib/appwrite'
import {
  isAdminLoggedIn,
  loginAdmin,
  loginAdminWithGoogle,
  logoutAdmin,
} from './lib/repository'

export function AdminLoginPage({ navigate }: { navigate: (page: Page) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [switchRequired,setSwitchRequired]=useState(false),[busy,setBusy]=useState(false)
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('oauth') === 'failed' ? 'Google 로그인에 실패했습니다.' : ''
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('oauth')

    if (oauth === 'failed') {
      window.history.replaceState(null, '', '/admin/login')
      return
    }

    isAdminLoggedIn().then((loggedIn) => {
      if (loggedIn) {
        navigate('admin')
        return
      }

      if (oauth === 'success') {
        setSwitchRequired(true)
        setError('허용된 관리자 Google 계정이 아닙니다.')
        window.history.replaceState(null, '', '/admin/login')
      }
    })
  }, [navigate])

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault()
    if(busy)return
    setBusy(true)
    setError('')
    try {
      await loginAdmin(email, password)
      navigate('admin')
    } catch(caught) { showError(caught) }
    finally {setBusy(false)}
  }
  function showError(caught:unknown) {
    if(caught instanceof Error&&caught.message==='ACCOUNT_SWITCH_REQUIRED'){setSwitchRequired(true);setError('현재 로그인된 계정이 있습니다. 관리자 계정으로 전환하려면 먼저 로그아웃해 주세요.')}
    else setError('로그인 정보를 확인해 주세요. 연결 오류가 있으면 잠시 후 다시 시도해 주세요.')
  }
  async function googleLogin() {
    if(busy)return
    setBusy(true);setError('')
    try{if(await loginAdminWithGoogle())navigate('admin')}catch(caught){showError(caught)}finally{setBusy(false)}
  }
  async function switchAccount() {
    setBusy(true)
    try{await logoutAdmin();setSwitchRequired(false);setError('로그아웃했습니다. 관리자 계정으로 로그인해 주세요.')}catch(caught){showError(caught)}finally{setBusy(false)}
  }

  return (
    <>
      <SiteHeader navigate={navigate} />
      <main className="narrow-page">
        <form className="lookup-form" onSubmit={submitLogin}>
          <Shield size={22} />
          <h1>관리자 로그인</h1>
          <label>
            이메일
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {!isAppwriteConfigured && <p className="field-help">로컬 데모 모드에서는 아무 값으로 로그인됩니다.</p>}
          {error && <p className="error-text">{error}</p>}
          {switchRequired&&<button type="button" disabled={busy} onClick={()=>void switchAccount()}>현재 계정에서 로그아웃</button>}
          <button className="google-button full-width" type="button" disabled={busy} onClick={()=>void googleLogin()}>
            Google로 로그인
          </button>
          <div className="login-divider">또는</div>
          <button className="primary-button full-width" type="submit" disabled={busy}>
            이메일로 로그인
          </button>
        </form>
      </main>
    </>
  )
}
