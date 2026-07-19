import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import type { Page } from './lib/app-routes'
import { logoutAdmin } from './lib/repository'

export default function AdminFrame({ navigate, children }: { navigate: (page: Page) => void; children: ReactNode }) {
  async function logout() {
    await logoutAdmin()
    navigate('admin-login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="관리자 메뉴">
        <button className="brand-button" type="button" onClick={() => navigate('home')}>Verygood</button>
        <button type="button" onClick={() => navigate('admin')}>대시보드</button>
        <button type="button" onClick={() => navigate('admin-reservations')}>예약 목록</button>
        <button type="button" onClick={() => navigate('admin-classes')}>클래스 예약</button>
        <button type="button" onClick={() => navigate('admin-reviews')}>리뷰 관리</button>
        <button type="button" onClick={logout}><LogOut size={16} /> 로그아웃</button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  )
}
