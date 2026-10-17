import { useEffect, useRef, useState } from 'react'
import type { Language } from '../lib/i18n'

const sessionKey = 'au-chocolate-mochi-launch-seen-v2'
const dayKey = 'au-chocolate-mochi-launch-hidden-day'
let seenWithoutStorage = false
const sydneyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function firstVisit() {
  if (typeof window === 'undefined' || seenWithoutStorage) return false
  try { if (localStorage.getItem(dayKey) === sydneyDay()) return false } catch { /* storage unavailable */ }
  try { return sessionStorage.getItem(sessionKey) !== sydneyDay() } catch { return true }
}

// AU HomePage only. Native modal supplies inert background, focus trap and Escape.
export function MochiLaunchNotice({ language }: { language: Language }) {
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
  return <dialog ref={notice} className="mochi-launch-notice" aria-labelledby="mochi-launch-title" aria-describedby="mochi-launch-description"
    onCancel={event => { event.preventDefault(); close() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}>
    <div className="mochi-launch-content">
      <button type="button" className="mochi-launch-close" aria-label={ko ? '공지 닫기' : 'Dismiss announcement'} onClick={() => close()}>×</button>
      <img className="mochi-launch-photo" src="/products/renewal-photos/mochi-hero-v2.webp" width="1080" height="1012" alt={ko ? '파베 모찌 4구 선물박스' : 'Chocolate Mochi four-piece gift box'} />
      <h2 id="mochi-launch-title">{ko ? '파베 모찌, 예약 시작!' : 'Chocolate Mochi Pre-orders Are Open!'}</h2>
      <p id="mochi-launch-description">{ko ? '여섯 가지 생초콜릿 모찌.\n원하는 맛을 골라 나만의 4구 선물박스를 만들어보세요.' : 'Six flavours. Choose your favourites and build your own four-piece gift box.'}</p>
      <a className="mochi-launch-order" href="/chocolates/chocolate-mochi">{ko ? '모찌 예약하기' : 'Order Chocolate Mochi'}</a>
      <div className="mochi-launch-actions">
        <button type="button" onClick={() => close(true)}>{ko ? '오늘 하루 안 보기' : "Don't show again today"}</button>
        <button type="button" onClick={() => close()}>{ko ? '닫기' : 'Close'}</button>
      </div>
    </div>
  </dialog>
}
