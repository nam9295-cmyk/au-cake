import { useEffect, useRef, useState } from 'react'
import type { Language } from '../lib/i18n'
import { ALMOND_GIFT_BOX_ID, ALMOND_GIFT_BOX_REGULAR_CENTS, ALMOND_GIFT_BOX_SALE_CENTS, ALMOND_SALE_END } from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import { useAlmondGiftSale } from '../lib/use-almond-gift-sale'

const storageKeys = {
  cakes: { session: 'au-mini-cake-launch-seen-v2', day: 'au-mini-cake-launch-hidden-day' },
  almonds: { session: 'au-almond-gift-2026-seen', day: 'au-almond-gift-2026-hidden-day' },
}
type Campaign = keyof typeof storageKeys
type NoticeProps = { language: Language; onVisibilityChange?: (visible: boolean) => void }
const seenDays = new Map<Campaign, string>()
const cardSizes = '(max-width: 600px) calc(50vw - 32px), (max-width: 724px) calc(50vw - 41px), 321px'
function cardSources(cake: 'basque' | 'pave') {
  const base = `/products/${cake}-strawberry-popup`
  return `${base}-320.webp 320w, ${base}-480.webp 480w, ${base}.webp 800w`
}
const sydneyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function firstVisit(campaign: Campaign) {
  const { session, day } = storageKeys[campaign]
  const today = sydneyDay()
  if (typeof window === 'undefined' || seenDays.get(campaign) === today) return false
  try { if (localStorage.getItem(day) === today) return false } catch { /* storage unavailable */ }
  try { return sessionStorage.getItem(session) !== today } catch { return true }
}

export function MiniCakeLaunchNotice({ language, onVisibilityChange }: NoticeProps) {
  const sale = useAlmondGiftSale()
  const [showCakes, setShowCakes] = useState(() => firstVisit('cakes'))
  const [almondPending, setAlmondPending] = useState(() => firstVisit('almonds'))
  const showAlmonds = sale && almondPending
  const visible = showAlmonds || showCakes
  useEffect(() => { onVisibilityChange?.(visible) }, [visible, onVisibilityChange])
  useEffect(() => {
    if (!visible) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (document.activeElement === document.body) document.getElementById('au-home-title')?.focus({ preventScroll: true })
    }
  }, [visible])
  // Native dialogs enter the top layer in opening order. The cake stays underneath.
  return <>
    {showCakes && <LaunchDialog campaign="cakes" language={language} foreground={!showAlmonds} onClose={() => setShowCakes(false)} />}
    {showAlmonds && <LaunchDialog campaign="almonds" language={language} foreground stacked={showCakes} onClose={() => setAlmondPending(false)} />}
  </>
}

function LaunchDialog({ campaign, language, foreground, stacked, onClose }: {
  campaign: Campaign; language: Language; foreground: boolean; stacked?: boolean; onClose: () => void
}) {
  const { session, day } = storageKeys[campaign]
  const notice = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = notice.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  useEffect(() => {
    if (!foreground) return
    const today = sydneyDay()
    seenDays.set(campaign, today)
    try { sessionStorage.setItem(session, today) } catch { /* tab-memory fallback */ }
    const dialog = notice.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector('button')?.focus({ preventScroll: true })
  }, [campaign, foreground, session])
  function close(forToday = false) {
    if (forToday) {
      try { localStorage.setItem(day, sydneyDay()) } catch { /* session dismissal still works */ }
    }
    onClose()
  }
  const ko = language === 'ko'
  const prefix = campaign === 'cakes' ? 'mini-cake-launch' : 'almond-gift-launch'
  return <dialog ref={notice} className="mini-cake-launch-notice" data-campaign={campaign} data-stacked={stacked || undefined}
    inert={!foreground} aria-hidden={foreground ? undefined : true} aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-description`}
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
      {campaign === 'almonds' ? <AlmondOffer ko={ko} /> : <MiniCakes ko={ko} />}
      <div className="mini-cake-launch-actions">
        <button type="button" onClick={() => close(true)}>{ko ? '오늘 하루 안 보기' : "Don't show again today"}</button>
        <button type="button" onClick={() => close()}>{ko ? '닫기' : 'Close'}</button>
      </div>
    </div>
  </dialog>
}

function MiniCakes({ ko }: { ko: boolean }) {
  return <>
    <h2 id="mini-cake-launch-title">{ko ? '미니 홀케이크 출시!' : 'Mini Whole Cakes Are Here!'}</h2>
    <p id="mini-cake-launch-description">{ko ? '작은 축하, 선물, 또는 나를 위한 특별한 간식으로 즐기는 미니 4인치 케이크.' : 'Mini 4-inch cakes for small celebrations, gifting, or a treat just for you.'}</p>
    <div className="mini-cake-launch-grid">
      <article className="mini-cake-launch-card">
        <img className="mini-cake-launch-photo" src="/products/basque-strawberry-popup.webp" srcSet={cardSources('basque')} sizes={cardSizes} width="800" height="1000" alt={ko ? '딸기와 트리 장식을 올린 바스크 치즈케이크 두 가지' : 'Basque cheesecakes with strawberries and tree decorations'} />
        <h3>{ko ? '바스크 치즈케이크' : 'Basque Cheesecake'}</h3>
        <p>{ko ? '기본 또는 생크림을 선택하세요' : 'Choose Plain or Fresh Cream'}</p>
        <p className="mini-cake-launch-price"><strong>{ko ? 'AUD 49부터' : 'From AUD 49'}</strong></p>
        <a className="mini-cake-launch-order" href="/cakes/brownie-cheesecake?form=whole&size=4in">{ko ? '바스크 보기' : 'Shop Basque'}</a>
      </article>
      <article className="mini-cake-launch-card">
        <img className="mini-cake-launch-photo" src="/products/pave-strawberry-popup.webp" srcSet={cardSources('pave')} sizes={cardSizes} width="800" height="1000" alt={ko ? '딸기와 트리 장식을 올린 파베 초콜릿 케이크' : 'Pavé chocolate cake with strawberries and a tree decoration'} />
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
  </>
}

function AlmondOffer({ ko }: { ko: boolean }) {
  const lastDay = new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-AU', {
    timeZone: 'Australia/Sydney', month: 'long', day: 'numeric', weekday: ko ? 'short' : 'long',
  }).format(Date.parse(ALMOND_SALE_END) - 1)
  const discount = 100 * (ALMOND_GIFT_BOX_REGULAR_CENTS - ALMOND_GIFT_BOX_SALE_CENTS) / ALMOND_GIFT_BOX_REGULAR_CENTS
  return <>
    <div>
      <h2 id="almond-gift-launch-title">{ko ? '아몬드 초콜릿 4박스' : '4 Boxes of Almond Chocolates'}</h2>
      <p>{ko ? '블랙프라이데이 × 연말 얼리버드' : 'Black Friday × Holiday Early Bird'}</p>
    </div>
    <img className="almond-launch-photo" src="/products/almond/gift-unboxing-480.webp"
      srcSet="/products/almond/gift-unboxing-480.webp 480w, /products/almond/gift-unboxing-960.webp 960w"
      sizes="min(27.2dvh, 240px)" width="960" height="1200"
      alt={ko ? '손으로 크림색 선물 상자의 뚜껑을 열자 보이는 아몬드 초콜릿 삼각박스' : 'A hand lifts the cream gift box lid to reveal the almond chocolate triangle boxes'} />
    <p id="almond-gift-launch-description">
      {ko ? '60g 삼각박스 네 개를 담은 수제 아몬드 초콜릿 선물 세트' : 'Handmade almond chocolates in four 60g triangle boxes, packed in one gift box.'}
    </p>
    <p className="almond-launch-price">
      <s>AUD {ALMOND_GIFT_BOX_REGULAR_CENTS / 100}</s>{' '}
      <strong>AUD {ALMOND_GIFT_BOX_SALE_CENTS / 100}</strong>{' '}
      <span>{discount}% {ko ? '할인' : 'off'}</span>
    </p>
    <p>{ko ? `시드니 시간 ${lastDay}까지. 준비 수량 소진 시 조기 종료됩니다.` : `Ends ${lastDay}, Sydney time, while supplies last.`}</p>
    <a className="mini-cake-launch-order" href={`/chocolates/almond-chocoball?offer=${ALMOND_GIFT_BOX_ID}`}>{ko ? '선물 세트 보기' : 'Shop the gift set'}</a>
  </>
}
