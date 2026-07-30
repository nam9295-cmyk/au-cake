import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import tigerImg from '../assets/tiger.png'
import heartLogoImg from '../assets/heart_logo.png'
import { type Page } from '../lib/app-routes'
import { getAnalyticsConsent, initializeAnalytics, setAnalyticsConsent, trackEvent, trackPageView } from '../lib/analytics'
import { cakeCopy, type Language } from '../lib/i18n'

const PICKUP_LOCATION_NAME = 'Pulse - Melrose Park'
const PICKUP_LOCATION_ADDRESS = '1 Bundil Blvd, Melrose Park NSW 2114'
const PICKUP_MAP_URL = 'https://www.google.com/maps/place/Pulse+-+Melrose+Park/@-33.8091415,151.0642826,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12a5a1148ce8e5:0x33e80579f801d234!8m2!3d-33.809146!4d151.0668575!16s%2Fg%2F11kq00n62q?entry=ttu&g_ep=EgoyMDI2MDYyOS4wIKXMDSoASAFQAw%3D%3D'
const PICKUP_MAP_EMBED_URL = 'https://www.google.com/maps?q=Pulse%20-%20Melrose%20Park%2C%201%20Bundil%20Blvd%2C%20Melrose%20Park%20NSW%202114&output=embed'
export function AnnouncementTicker({ language }: { language: Language }) {
  const copy = cakeCopy(language)
  return (
    <div className="announcement-ticker" aria-label={copy.announcement}>
      <div className="announcement-ticker-track" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index}>{copy.announcement}</span>
        ))}
      </div>
    </div>
  )
}

export function PickupLocationCard({ language }: { language: Language }) {
  const copy = cakeCopy(language)
  return (
    <section className="content-section pickup-location-section" aria-labelledby="pickup-location-title">
      <div className="pickup-location-copy">
        <p className="summary-kicker">{copy.pickupLocationKicker}</p>
        <h2 id="pickup-location-title">{copy.pickupLocationTitle}</h2>
        <p>{copy.pickupLocationText}</p>
        <p className="pickup-location-point">
          {language === 'ko' ? `사전 약속 픽업 장소: ${PICKUP_LOCATION_NAME} 인근` : `Pre-arranged meeting point near ${PICKUP_LOCATION_NAME}`}<br />
          {PICKUP_LOCATION_ADDRESS}<br />
          <small>{language === 'ko' ? '매장 또는 방문 판매 장소가 아닙니다' : 'Not a storefront or walk-in shop'}</small>
        </p>
        <a
          className="secondary-button pickup-map-link"
          href={PICKUP_MAP_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent('pickup_map_click', { location: 'melrose_park' })}
        >
          {copy.openMap}
        </a>
      </div>
      <div className="pickup-map-frame" aria-label="Google Map showing Pulse - Melrose Park">
        <iframe
          title="Pulse - Melrose Park Google Map"
          src={PICKUP_MAP_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </section>
  )
}

export function AnalyticsConsentBanner({ language }: { language: Language }) {
  const [choice, setChoice] = useState<boolean | null>(getAnalyticsConsent)

  if (choice !== null) return null

  function choose(granted: boolean) {
    setAnalyticsConsent(granted)
    setChoice(granted)
    if (granted) {
      initializeAnalytics()
      trackPageView(window.location.pathname)
    }
  }

  return (
    <aside className="analytics-consent" aria-label={language === 'ko' ? '분석 쿠키 설정' : 'Analytics preferences'}>
      <div>
        <strong>{language === 'ko' ? '사이트 이용 분석' : 'Help us improve the website'}</strong>
        <p>
          {language === 'ko'
            ? '동의하면 Google Analytics로 페이지 방문과 예약 완료 여부만 측정합니다. 이름, 전화번호, 이메일은 전송하지 않습니다.'
            : 'With your permission, Google Analytics measures page visits and booking completions. We do not send names, phone numbers, or email addresses.'}
        </p>
      </div>
      <div className="analytics-consent-actions">
        <button type="button" className="secondary-button" onClick={() => choose(false)}>
          {language === 'ko' ? '필수 기능만' : 'Essential only'}
        </button>
        <button type="button" className="primary-button" onClick={() => choose(true)}>
          {language === 'ko' ? '분석 허용' : 'Allow analytics'}
        </button>
      </div>
    </aside>
  )
}

export function HomeTigerBackground() {
  return <div className="home-tiger-background" aria-hidden="true" />
}

export function SiteHeader({
  navigate,
  language,
  setLanguage,
  cartItemCount,
}: {
  navigate: (page: Page) => void
  language?: Language
  setLanguage?: (language: Language) => void
  cartItemCount?: number
}) {
  const copy = cakeCopy(language || 'en')
  const cartAriaLabel = cartItemCount === undefined
    ? ''
    : language === 'ko'
      ? cartItemCount === 0 ? '주문 목록 열기, 비어 있음' : `주문 목록 열기, 총 ${cartItemCount}개`
      : cartItemCount === 0
        ? 'Open order, empty'
        : cartItemCount === 1 ? 'Open order, 1 item' : `Open order, ${cartItemCount} items`
  return (
    <>
      <header className="site-header">
        <a className="brand-button" href="/" onClick={(event) => { event.preventDefault(); navigate('home') }}>
          <img className="brand-mark" src="/favicon.png" alt="Verygood Chocolate" />
        </a>
        <nav>
          <a className="cakes-nav-button" href="/cakes" onClick={(event) => { event.preventDefault(); navigate('cakes') }}>
            {language === 'ko' ? '케이크' : 'Cakes'}
          </a>
          <a className="kids-nav-button" href="/classes" onClick={(event) => { event.preventDefault(); navigate('classes') }}>
            {copy.kidsNav}
          </a>
          <a href="/lookup" rel="nofollow" onClick={(event) => { event.preventDefault(); navigate('lookup') }}>
            {copy.lookupNav}
          </a>
          {cartItemCount !== undefined && (
            <a
              className="cart-nav-button"
              href="/cart"
              rel="nofollow"
              aria-label={cartAriaLabel}
              onClick={(event) => { event.preventDefault(); navigate('cart') }}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              <span className="cart-nav-label">{language === 'ko' ? '주문' : 'Order'}</span>
              {cartItemCount > 0 && (
                <span className="cart-nav-count" aria-hidden="true">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </a>
          )}
          <a className="admin-nav-button" href="/admin/login" rel="nofollow" onClick={(event) => { event.preventDefault(); navigate('admin-login') }}>
            {copy.adminNav}
          </a>
        </nav>
      </header>
      {language && setLanguage && (
        <div className="language-strip" aria-label={copy.languageLabel}>
          <span>{copy.languageHelp}</span>
          <div className="language-toggle" role="group" aria-label={copy.languageLabel}>
            <button
              type="button"
              className={language === 'en' ? 'is-active' : ''}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'ko' ? 'is-active' : ''}
              onClick={() => setLanguage('ko')}
            >
              <span className="language-label-full">한국어</span>
              <span className="language-label-short">KO</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function SiteFooter({
  navigate,
  language,
}: {
  navigate: (page: Page) => void
  language: Language
}) {
  const copy = language === 'ko'
    ? {
        service: '케이크 주문 & 키즈 클래스',
        order: '케이크 주문',
        classes: '키즈 클래스',
        lookup: '주문 조회',
        location: '쇼콜라티에가 주문에 맞춰 만드는 케이크',
        description: '초콜릿을 중심으로 소량씩 만들고, 멜로즈 파크에서 손으로 정성껏 완성합니다.',
      }
    : {
        service: 'Cake orders & kids classes',
        order: 'Order cakes',
        classes: 'Kids classes',
        lookup: 'Find my order',
        location: 'Made to order by our chocolatier',
        description: 'Chocolate-first cakes, prepared in small batches and finished by hand in Melrose Park.',
      }

  return (
    <footer className="site-footer">
      <img className="site-footer-tiger" src={tigerImg} alt="" aria-hidden="true" />
      <img className="site-footer-heart" src={heartLogoImg} alt="Very good" />
      <div className="site-footer-content">
        <p className="site-footer-service">{copy.service}</p>
        <p className="site-footer-location">{copy.location}</p>
        <p className="site-footer-address">{copy.description}</p>
        <nav className="site-footer-nav" aria-label={language === 'ko' ? '푸터 메뉴' : 'Footer navigation'}>
          <a href="/reserve" onClick={(event) => { event.preventDefault(); navigate('reserve') }}>{copy.order}</a>
          <a href="/classes" onClick={(event) => { event.preventDefault(); navigate('classes') }}>{copy.classes}</a>
          <a href="/lookup" onClick={(event) => { event.preventDefault(); navigate('lookup') }}>{copy.lookup}</a>
        </nav>
        <small>© {new Date().getFullYear()} Very Good</small>
      </div>
    </footer>
  )
}

export function VanillaFreshCreamCakeSilhouette() {
  return (
    <div className="vanilla-fresh-cream-silhouette" role="img" aria-label="vanilla fresh cream cake photo coming soon">
      <svg viewBox="0 0 240 180" aria-hidden="true">
        <path d="M48 68h144l-14 73H62z" />
        <path d="M38 58c0-15 18-25 40-25h84c22 0 40 10 40 25v11H38z" />
        <path d="M65 84h110v12H65zm-7 27h124v12H58z" fill="var(--canvas)" />
      </svg>
      <span>COMING SOON</span>
    </div>
  )
}
