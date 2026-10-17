import { useEffect, useRef, useState } from 'react'
import type { Language } from '../lib/i18n'

const sessionKey = 'au-pave-mochi-launch-seen-v1'
let seenWithoutStorage = false
function firstVisit() {
  if (typeof window === 'undefined' || seenWithoutStorage) return false
  try { return sessionStorage.getItem(sessionKey) !== '1' } catch { return true }
}

// Mounted only by AU HomePage. Non-modal: no autofocus or focus trap.
export function MochiLaunchNotice({ language }: { language: Language }) {
  const [visible, setVisible] = useState(firstVisit)
  const notice = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!visible) return
    seenWithoutStorage = true
    try { sessionStorage.setItem(sessionKey, '1') } catch { /* tab-memory fallback */ }
  }, [visible])
  function close() {
    const focusedInside = notice.current?.contains(document.activeElement)
    setVisible(false)
    if (focusedInside) document.getElementById('au-home-title')?.focus({ preventScroll: true })
  }
  if (!visible) return null
  const ko = language === 'ko'
  return <aside ref={notice} className="mochi-launch-notice" aria-labelledby="mochi-launch-title"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <button type="button" className="mochi-launch-close" aria-label={ko ? '공지 닫기' : 'Dismiss announcement'} onClick={close}>×</button>
    <h2 id="mochi-launch-title">{ko ? '파베 모찌, 예약 시작!' : 'Pavé Mochi Pre-orders Are Open!'}</h2>
    <p>{ko ? '여섯 가지 생초콜릿 모찌.\n원하는 맛을 골라 나만의 4구 선물박스를 만들어보세요.' : 'Six flavours. Choose your favourites and build\nyour own four-piece gift box.'}</p>
    <a href="/chocolates/chocolate-mochi">{ko ? '모찌 예약하기' : 'Order Pavé Mochi'} <span aria-hidden="true">→</span></a>
  </aside>
}
