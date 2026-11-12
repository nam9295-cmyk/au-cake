import { useEffect, useRef, useState } from 'react'
import type { Language } from '../lib/i18n'

const sessionKey = 'au-mini-cake-launch-seen-v2'
const dayKey = 'au-mini-cake-launch-hidden-day'
let seenWithoutStorage = false
const sydneyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function firstVisit() {
  if (typeof window === 'undefined' || seenWithoutStorage) return false
  try { if (localStorage.getItem(dayKey) === sydneyDay()) return false } catch { /* storage unavailable */ }
  try { return sessionStorage.getItem(sessionKey) !== sydneyDay() } catch { return true }
}

// AU HomePage only. Native modal supplies inert background, focus trap and Escape.
export function MiniCakeLaunchNotice({ language }: { language: Language }) {
  const [visible, setVisible] = useState(firstVisit)
  const notice = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!visible) return
    seenWithoutStorage = true
    try { sessionStorage.setItem(sessionKey, sydneyDay()) } catch { /* tab-memory fallback */ }
    const dialog = notice.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true })
      else document.getElementById('au-home-title')?.focus({ preventScroll: true })
    }
  }, [visible])
  function close(forToday = false) {
    if (forToday) {
      try { localStorage.setItem(dayKey, sydneyDay()) } catch { /* session dismissal still works */ }
    }
    setVisible(false)
  }
  if (!visible) return null
  const ko = language === 'ko'
  return <dialog ref={notice} className="mini-cake-launch-notice" aria-labelledby="mini-cake-launch-title" aria-describedby="mini-cake-launch-description"
    onCancel={event => { event.preventDefault(); close() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
    <div className="mini-cake-launch-content">
      <button type="button" className="mini-cake-launch-close" aria-label={ko ? '공지 닫기' : 'Dismiss announcement'} onClick={() => close()}>×</button>
      <h2 id="mini-cake-launch-title">{ko ? '미니 홀케이크 출시!' : 'Mini Whole Cakes Are Here!'}</h2>
      <p id="mini-cake-launch-description">{ko ? '작은 축하, 선물, 또는 나를 위한 특별한 간식으로 즐기는 미니 4인치 케이크.' : 'Mini 4-inch cakes for small celebrations, gifting, or a treat just for you.'}</p>
      <div className="mini-cake-launch-grid">
        <article className="mini-cake-launch-card">
          <img className="mini-cake-launch-photo" src="/products/basques-4inch.webp" width="800" height="1000" alt={ko ? '4인치 바스크 치즈케이크 기본과 크림 두 가지' : '4-inch Basque cheesecakes, plain and cream-topped'} />
          <h3>{ko ? '바스크 치즈케이크' : 'Basque Cheesecake'}</h3>
          <p>{ko ? '기본 또는 생크림을 선택하세요' : 'Choose Plain or Fresh Cream'}</p>
          <p className="mini-cake-launch-price"><strong>{ko ? 'AUD 49부터' : 'From AUD 49'}</strong></p>
          <a className="mini-cake-launch-order" href="/cakes/brownie-cheesecake?form=whole&size=4in">{ko ? '바스크 보기' : 'Shop Basque'}</a>
        </article>
        <article className="mini-cake-launch-card">
          <img className="mini-cake-launch-photo" src="/products/pave-4inch.webp" width="800" height="1000" alt={ko ? '4인치 파베 초콜릿 케이크' : '4-inch Pavé chocolate cake'} />
          <h3>{ko ? '파베 초콜릿 케이크' : 'Pavé Chocolate Cake'}</h3>
          <p>{ko ? '부드러운 가나슈, 진한 초콜릿' : 'Smooth ganache, rich chocolate'}</p>
          <p className="mini-cake-launch-price"><strong>{ko ? 'AUD 45부터' : 'From AUD 45'}</strong></p>
          <a className="mini-cake-launch-order" href="/cakes/pave-chocolate-cake?size=4in">{ko ? '파베 보기' : 'Shop Pavé'}</a>
        </article>
      </div>
      <div className="mini-cake-launch-footer">
        <p><strong>{ko ? '미니 사이즈 AUD 45부터' : 'Mini size from AUD 45'}</strong></p>
        <p>{ko ? '선물이나 작은 축하에 딱 맞는 케이크' : 'Perfect for gifting or a little celebration'}</p>
        <p>{ko ? '시드니 픽업' : 'Pickup in Sydney'}</p>
      </div>
      <div className="mini-cake-launch-actions">
        <button type="button" onClick={() => close(true)}>{ko ? '오늘 하루 안 보기' : "Don't show again today"}</button>
        <button type="button" onClick={() => close()}>{ko ? '닫기' : 'Close'}</button>
      </div>
    </div>
  </dialog>
}
