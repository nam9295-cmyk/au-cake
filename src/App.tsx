import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clipboard,
  Copy,
  Download,
  LogOut,
  MessageCircleCheck,
  Search,
  Shield,
  Wallet,
} from 'lucide-react'
import heroCake2Img from './assets/hero-cake-2.webp'
import heroCake3Img from './assets/hero-cake-3.webp'
import paveCakeCardImg from './assets/pave-side.webp'
import poundCakeCardImg from './assets/pound-side.webp'
import cupcakeHeroImg from './assets/cupcake-hero.webp'
import cupcakeCardImg from './assets/cupcake-side.webp'
import kidsClassHeroImg from './assets/kids-class-hero.webp'
import kidsClassProcessImg from './assets/kids-class-process.webp'
import kidsClassFinishedImg from './assets/kids-class-finished.webp'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  PROMO_CODE,
  applyPromoDiscount,
  formatCakeSizeLabel,
  formatCacaoLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getProductById,
  getReservationPrice,
  getReservationUnitPrice,
  PAYMENT_STATUSES,
  POUND_ADDON_OPTIONS,
  PRODUCTS,
  RESERVATION_STATUSES,
  usesReservationChocolateType,
} from './lib/constants'
import { isAppwriteConfigured } from './lib/appwrite'
import { marketConfig } from './lib/market'
import {
  cakeCopy,
  formatChocolateTypeText,
  formatPoundAddonText,
  getCakeSizeText,
  getChocolateTypeText,
  getPoundAddonText,
  getProductFeatures,
  getProductText,
  readStoredLanguage,
  storeLanguage,
  type Language,
} from './lib/i18n'
import {
  createReservation,
  createClassReservation,
  getReservationByNumber,
  getSettings,
  isAdminLoggedIn,
  listReservations,
  listClassReservations,
  loginAdmin,
  loginAdminWithGoogle,
  logoutAdmin,
  updateReservation,
  updateClassReservation,
} from './lib/repository'
import {
  buildAdminCalendarEvents,
  currentCalendarMonth,
  getCalendarGridDays,
  getDailyCalendarSummary,
  getMonthLabel,
  shiftCalendarMonth,
  type AdminCalendarEvent,
} from './lib/admin-calendar'
import type { CacaoPercent, CakeSize, ChocolateType, ClassBookingType, ClassReservation, ClassReservationFilters, PoundAddon, ProductId, Reservation, ReservationFilters, StoreSettings } from './lib/types'
import {
  buildClassConfirmationMessage,
  buildClassPaymentDetails,
  buildClassPaymentMessage,
  classReservationsToCsv,
  CLASS_PAYMENT_SETTINGS,
  CLASS_PAYMENT_STATUS_OPTIONS,
  CLASS_SESSION_TIMES,
  CLASS_STATUS_OPTIONS,
  formatClassBookingType,
  getClassBookingPrice,
} from './lib/class-utils'
import {
  addDaysInputValue,
  buildSmsMessage,
  formatCurrency,
  isValidPhone,
  maskPhone,
  normalizePhone,
  reservationsToCsv,
  timeOptionsForDate,
  todayInputValue,
} from './lib/utils'

type Page =
  | 'home'
  | 'reserve'
  | 'complete'
  | 'lookup'
  | 'classes'
  | 'class-reserve'
  | 'class-complete'
  | 'admin-login'
  | 'admin'
  | 'admin-reservations'
  | 'admin-classes'

const initialFilters: ReservationFilters = {
  pickupDate: '',
  status: '',
  paymentStatus: '',
  cacaoPercent: '',
  search: '',
}

const initialClassFilters: ClassReservationFilters = {
  classDate: '',
  status: '',
  paymentStatus: '',
  search: '',
}

function useTodayInputValue() {
  const [today, setToday] = useState(() => todayInputValue())

  useEffect(() => {
    const refreshToday = () => setToday(todayInputValue())
    refreshToday()

    const interval = window.setInterval(refreshToday, 60_000)
    window.addEventListener('focus', refreshToday)
    document.addEventListener('visibilitychange', refreshToday)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshToday)
      document.removeEventListener('visibilitychange', refreshToday)
    }
  }, [])

  return today
}

function getPageFromPath(): Page {
  const path = window.location.pathname
  if (path === '/reserve') return 'reserve'
  if (path === '/complete') return 'complete'
  if (path === '/lookup') return 'lookup'
  if (path === '/classes') return 'classes'
  if (path === '/class-reserve') return 'class-reserve'
  if (path === '/class-complete') return 'class-complete'
  if (path === '/admin/login') return 'admin-login'
  if (path === '/admin/reservations') return 'admin-reservations'
  if (path === '/admin/classes') return 'admin-classes'
  if (path === '/admin') return 'admin'
  return 'home'
}

function pathForPage(page: Page) {
  const paths: Record<Page, string> = {
    home: '/',
    reserve: '/reserve',
    complete: '/complete',
    lookup: '/lookup',
    classes: '/classes',
    'class-reserve': '/class-reserve',
    'class-complete': '/class-complete',
    'admin-login': '/admin/login',
    admin: '/admin',
    'admin-reservations': '/admin/reservations',
    'admin-classes': '/admin/classes',
  }
  return paths[page]
}


const PICKUP_LOCATION_NAME = 'Pulse - Melrose Park'
const PICKUP_LOCATION_ADDRESS = '1 Bundil Blvd, Melrose Park NSW 2114'
const PICKUP_MAP_URL = 'https://www.google.com/maps/place/Pulse+-+Melrose+Park/@-33.8091415,151.0642826,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12a5a1148ce8e5:0x33e80579f801d234!8m2!3d-33.809146!4d151.0668575!16s%2Fg%2F11kq00n62q?entry=ttu&g_ep=EgoyMDI2MDYyOS4wIKXMDSoASAFQAw%3D%3D'
const PICKUP_MAP_EMBED_URL = 'https://www.google.com/maps?q=Pulse%20-%20Melrose%20Park%2C%201%20Bundil%20Blvd%2C%20Melrose%20Park%20NSW%202114&output=embed'
function AnnouncementTicker({ language }: { language: Language }) {
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

function PickupLocationCard({ language }: { language: Language }) {
  const copy = cakeCopy(language)
  return (
    <section className="content-section pickup-location-section" aria-labelledby="pickup-location-title">
      <div className="pickup-location-copy">
        <p className="summary-kicker">{copy.pickupLocationKicker}</p>
        <h2 id="pickup-location-title">{copy.pickupLocationTitle}</h2>
        <p>{copy.pickupLocationText}</p>
        <address>
          {PICKUP_LOCATION_NAME}<br />
          {PICKUP_LOCATION_ADDRESS}
        </address>
        <a className="secondary-button pickup-map-link" href={PICKUP_MAP_URL} target="_blank" rel="noreferrer">
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

function DesktopBackground() {
  return (
    <div className="desktop-background-pattern" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="verygood-pattern" width="240" height="240" patternUnits="userSpaceOnUse">
            <text
              x="60"
              y="60"
              transform="rotate(-30 60 60)"
              fill="rgba(255, 250, 243, 0.15)"
              fontFamily="'Work Sans', sans-serif"
              fontSize="13px"
              fontWeight="300"
              letterSpacing="0.08em"
              textAnchor="middle"
            >
              very good
            </text>
            <text
              x="180"
              y="180"
              transform="rotate(-30 180 180)"
              fill="rgba(255, 250, 243, 0.15)"
              fontFamily="'Work Sans', sans-serif"
              fontSize="13px"
              fontWeight="300"
              letterSpacing="0.08em"
              textAnchor="middle"
            >
              very good
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#verygood-pattern)" />
      </svg>
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>(getPageFromPath)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null)
  const [completedClassReservation, setCompletedClassReservation] = useState<ClassReservation | null>(null)
  const [reservationProductId, setReservationProductId] = useState<ProductId>(DEFAULT_PRODUCT_ID)
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    storeLanguage(nextLanguage)
  }, [])

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    const handlePop = () => setPage(getPageFromPath())
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  const navigate = useCallback((nextPage: Page) => {
    window.history.pushState(null, '', pathForPage(nextPage))
    setPage(nextPage)
    window.scrollTo({ top: 0 })
  }, [])

  const reserveProduct = useCallback(
    (productId: ProductId) => {
      setReservationProductId(productId)
      navigate('reserve')
    },
    [navigate],
  )

  const isAdminPage = page === 'admin-login' || page === 'admin' || page === 'admin-reservations' || page === 'admin-classes'

  return (
    <>
      {!isAdminPage && <DesktopBackground />}
      <div className={`app-shell${isAdminPage ? ' admin-shell' : ''}`}>
      {!isAppwriteConfigured && (
        <div className="env-notice">Appwrite 환경변수가 없어서 로컬 데모 저장소로 실행 중입니다.</div>
      )}
      {!isAdminPage && <AnnouncementTicker language={language} />}

      {page === 'home' && <HomePage navigate={navigate} settings={settings} onReserveProduct={reserveProduct} language={language} setLanguage={setLanguage} />}
      {page === 'classes' && <ClassesPage navigate={navigate} />}
      {page === 'class-reserve' && <ClassReservePage navigate={navigate} onComplete={setCompletedClassReservation} />}
      {page === 'class-complete' && <ClassCompletePage navigate={navigate} reservation={completedClassReservation} />}
      {page === 'reserve' && (
        <ReservePage
          navigate={navigate}
          settings={settings}
          initialProductId={reservationProductId}
          onComplete={setCompletedReservation}
          language={language}
          setLanguage={setLanguage}
        />
      )}
      {page === 'complete' && (
        <CompletePage navigate={navigate} reservation={completedReservation} settings={settings} language={language} setLanguage={setLanguage} />
      )}
      {page === 'lookup' && <LookupPage navigate={navigate} language={language} setLanguage={setLanguage} />}
      {page === 'admin-login' && <AdminLoginPage navigate={navigate} />}
      {page === 'admin' && <AdminDashboardPage navigate={navigate} />}
      {page === 'admin-reservations' && <AdminReservationsPage navigate={navigate} />}
      {page === 'admin-classes' && <AdminClassesPage navigate={navigate} />}
    </div>
    </>
  )
}

function BankAccountBox({ settings, totalPrice, language = 'en' }: { settings: StoreSettings; totalPrice?: number; language?: Language }) {
  const copy = cakeCopy(language)
  const bankName = settings.bankName
  const bankAccount = settings.bankAccount
  const accountHolder = settings.accountHolder
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`${bankName} ${bankAccount}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bank-account-card">
      <div className="bank-account-header">
        <span className="bank-label">{copy.paymentLabel}</span>
      </div>
      <div className="bank-account-body">
        <div className="bank-info">
          <strong className="bank-number">
            {bankName} {bankAccount}
          </strong>
          <span className="bank-holder">
            {copy.accountHolderLabel}: {accountHolder}
          </span>
          {totalPrice !== undefined && (
            <span className="bank-total-price" style={{ marginTop: '4px', fontSize: '15px' }}>
              {copy.paymentAmountLabel}:{' '}
              <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(totalPrice)}</strong>
            </span>
          )}
        </div>
        <button type="button" className="copy-button" onClick={handleCopy}>
          <Copy size={16} />
          {copied ? copy.copiedButton : copy.copyButton}
        </button>
      </div>
    </div>
  )
}

function SiteHeader({
  navigate,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  language?: Language
  setLanguage?: (language: Language) => void
}) {
  const copy = cakeCopy(language || 'en')
  return (
    <>
      <header className="site-header">
        <button className="brand-button" type="button" onClick={() => navigate('home')}>
          Verygood Chocolate
        </button>
        <nav>
          <button className="kids-nav-button" type="button" onClick={() => navigate('classes')}>
            {copy.kidsNav}
          </button>
          <button type="button" onClick={() => navigate('lookup')}>
            {copy.lookupNav}
          </button>
          <button type="button" onClick={() => navigate('admin-login')}>
            {copy.adminNav}
          </button>
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

function formatReservationStatus(status: string) {
  if (marketConfig.market === 'KR') return status
  const mapping: Record<string, string> = {
    '예약신청': 'Requested',
    '예약확정': 'Confirmed',
    '픽업완료': 'Picked up',
    '취소': 'Cancelled',
  }
  return mapping[status] || status
}

function formatPaymentStatus(status: string) {
  if (marketConfig.market === 'KR') return status
  const mapping: Record<string, string> = {
    '입금대기': 'Pending payment',
    '입금확인': 'Paid',
    '현장결제': 'Pay on pick-up',
    '환불필요': 'Refund required',
  }
  return mapping[status] || status
}

function ProductDetailRows({ reservation, language = 'ko' }: { reservation: Reservation; language?: Language }) {
  const product = getProductById(reservation.productId)
  const productText = getProductText(product.id, language)
  const copy = cakeCopy(language)
  const showChocolate = usesReservationChocolateType(product.id, reservation.poundAddon)

  return (
    <>
      <div>
        <dt>{copy.product}</dt>
        <dd>{productText.name}</dd>
      </div>
      <div>
        <dt>{copy.quantity}</dt>
        <dd>
          {reservation.quantity}
          {copy.quantityUnit}
        </dd>
      </div>
      {product.usesSizeOptions && (
        <div>
          <dt>{copy.size}</dt>
          <dd>{formatCakeSizeLabel(reservation.cakeSize)}</dd>
        </div>
      )}
      {product.usesCacaoOptions && (
        <div>
          <dt>{marketConfig.market === 'KR' ? '카카오 농도' : 'Cacao'}</dt>
          <dd>{formatCacaoLabel(reservation.cacaoPercent)}</dd>
        </div>
      )}
      {showChocolate && (
        <div>
          <dt>{copy.chocolate}</dt>
          <dd>{formatChocolateTypeText(reservation.chocolateType, language)}</dd>
        </div>
      )}
      {product.usesPoundAddonOptions && (
        <div>
          <dt>{copy.finish}</dt>
          <dd>{formatPoundAddonText(reservation.poundAddon, language)}</dd>
        </div>
      )}
    </>
  )
}

function reservationCacaoText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesCacaoOptions ? formatCacaoLabel(reservation.cacaoPercent) : '-'
}

function reservationCakeSizeText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesSizeOptions ? formatCakeSizeLabel(reservation.cakeSize) : '-'
}

function reservationChocolateText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return usesReservationChocolateType(product.id, reservation.poundAddon) ? formatChocolateTypeLabel(reservation.chocolateType) : '-'
}

function reservationFinishText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesPoundAddonOptions ? formatPoundAddonLabel(reservation.poundAddon) : '-'
}

function HomePage({
  navigate,
  settings,
  onReserveProduct,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  settings: StoreSettings
  onReserveProduct: (productId: ProductId) => void
  language: Language
  setLanguage: (language: Language) => void
}) {
  const copy = cakeCopy(language)
  const products = Object.values(PRODUCTS)
  const [activeHeroCake, setActiveHeroCake] = useState(1)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [heroDragX, setHeroDragX] = useState(0)
  const heroCakes = [
    { image: cupcakeHeroImg, label: 'cupcake', tagKey: 'mini', className: 'hero-cake-one' },
    { image: heroCake2Img, label: '6/7.5/8.7inch', tagKey: 'first', className: 'hero-cake-two' },
    { image: heroCake3Img, label: 'pound', tagKey: 'pound', className: 'hero-cake-three' },
  ]
  const productCards: Record<ProductId, { image: string; imageAlt: string; features: string[] }> = {
    'pave-cake': {
      image: paveCakeCardImg,
      imageAlt: getProductText('pave-cake', language).name,
      features: getProductFeatures('pave-cake', language),
    },
    'pound-cake': {
      image: poundCakeCardImg,
      imageAlt: getProductText('pound-cake', language).name,
      features: getProductFeatures('pound-cake', language),
    },
    'cupcake-dozen': {
      image: cupcakeCardImg,
      imageAlt: getProductText('cupcake-dozen', language).name,
      features: getProductFeatures('cupcake-dozen', language),
    },
  }

  const rotateHeroCake = useCallback((direction: 1 | -1) => {
    setActiveHeroCake((current) => (current + direction + heroCakes.length) % heroCakes.length)
  }, [heroCakes.length])

  function heroCakePosition(index: number) {
    const offset = (index - activeHeroCake + heroCakes.length) % heroCakes.length
    if (offset === 0) return 'center'
    if (offset === 1) return 'right'
    return 'left'
  }

  function handleHeroPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(max-width: 560px)').matches) {
      setSwipeStartX(event.clientX)
      setHeroDragX(0)
    }
  }

  function handleHeroPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    setHeroDragX(Math.max(-84, Math.min(84, deltaX)))
  }

  function handleHeroPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    setSwipeStartX(null)
    setHeroDragX(0)
    if (Math.abs(deltaX) < 34) return
    rotateHeroCake(deltaX < 0 ? 1 : -1)
  }

  const heroDragStyle = { '--hero-drag': `${heroDragX}px` } as CSSProperties

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main>
        <section className="hero-section">
          <span className="featured-seal" aria-hidden="true">
            <span>LIMITED</span>
            <b>VCC</b>
          </span>
          <h1 className="billboard-word hero-display-word">
            <span>gâteau</span>
            <span>au</span>
            <span>chocolat</span>
          </h1>
          <div className="hero-copy">
            <p className="hero-title">{copy.homeTitle}</p>
            <p className="hero-description">{copy.homeDescription}</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => onReserveProduct(DEFAULT_PRODUCT_ID)}>
                {copy.reserveCta}
              </button>
              <small className="hero-pickup-note">{copy.announcement}</small>
              <span>{language === 'ko' ? copy.dailyLimitText : settings.dailyLimitText}</span>
            </div>
          </div>
          <div
            className={`hero-image-wrap${swipeStartX !== null ? ' is-dragging' : ''}`}
            style={heroDragStyle}
            aria-label={copy.homeTitle}
            onPointerDown={handleHeroPointerDown}
            onPointerMove={handleHeroPointerMove}
            onPointerUp={handleHeroPointerUp}
            onPointerCancel={() => {
              setSwipeStartX(null)
              setHeroDragX(0)
            }}
          >
            <div className="hero-cake-cluster" aria-hidden="true">
              {heroCakes.map((cake, index) => {
                const position = heroCakePosition(index)
                return (
                  <div
                    className="hero-cake-slide"
                    data-position={position}
                    key={cake.label}
                    onClick={() => setActiveHeroCake(index)}
                  >
                    <img src={cake.image} alt="" className={`hero-cake ${cake.className}`} draggable="false" />
                    <span className={`hero-size-tag hero-size-tag-${cake.tagKey}`}>
                      {cake.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="hero-carousel-dots" aria-hidden="true">
              {heroCakes.map((cake, index) => (
                <span className={index === activeHeroCake ? 'is-active' : ''} key={cake.label} />
              ))}
            </div>
          </div>
        </section>

        <section className="content-section product-section">
          <h2>{copy.productSectionTitle}</h2>
          <div className="product-grid">
            {products.map((product) => {
              const productText = getProductText(product.id, language)
              return (
              <article className="product-card" key={product.id}>
                <div className="product-image-wrap">
                  <img src={productCards[product.id].image} alt={productCards[product.id].imageAlt} />
                </div>
                <div>
                  <strong>{productText.name}</strong>
                  <p>{productText.description}</p>
                </div>
                <ul>
                  {productCards[product.id].features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <dl>
                  <div>
                    <dt>{copy.price}</dt>
                    <dd>{formatCurrency(product.price)}</dd>
                  </div>
                  <div>
                    <dt>{copy.options}</dt>
                    <dd>{productText.priceNote}</dd>
                  </div>
                </dl>
                <button className="secondary-button full-width" type="button" onClick={() => onReserveProduct(product.id)}>
                  {copy.reserveCta}
                </button>
              </article>
              )
            })}
          </div>
        </section>

        <section className="content-section policy-section" id="reservation-guide">
          <h2>{copy.reservationGuideTitle}</h2>
          <div className="policy-manual">
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>01</span>
                <Clipboard size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[0].title}</strong>
                <p>{copy.guideSteps[0].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>02</span>
                <MessageCircleCheck size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[1].title}</strong>
                <p>{copy.guideSteps[1].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>03</span>
                <Wallet size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[2].title}</strong>
                <p>{copy.guideSteps[2].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>04</span>
                <CalendarDays size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[3].title}</strong>
                {marketConfig.market === 'AU' ? (
                  <p>
                    {copy.pickupHours[0]}
                    <br />
                    {copy.pickupHours[1]}
                  </p>
                ) : (
                  <p>
                    평일 {settings.weekdayOpen}-{settings.weekdayClose}, 주말 {settings.weekendOpen}-{settings.weekendClose}
                  </p>
                )}
              </div>
            </article>
          </div>
          {settings.pickupNotice.trim() && <p className="policy-note">{settings.pickupNotice}</p>}
        </section>

        {marketConfig.market === 'AU' && <PickupLocationCard language={language} />}
      </main>
      <button className="sticky-cta" type="button" onClick={() => onReserveProduct(DEFAULT_PRODUCT_ID)}>
        {copy.reserveCta}
      </button>
    </>
  )
}

function ClassesPage({ navigate }: { navigate: (page: Page) => void }) {
  const essentials = [
    ['Year 1-6 courses', 'Age-aware private sessions for primary school children'],
    ['Professional-style course', 'Real studio guidance from planning to finishing'],
    ['One 15cm cake per child', 'Plan, build, and finish a real chocolate cake'],
    ['Max 2 kids per session', 'Private small group focus'],
  ]
  const steps = [
    ['Choose a course', 'Select the age group, date, and studio session time.'],
    ['Imagine your cake', 'Sketch the cake from your imagination and plan the shape, colour, and finish.'],
    ['Bring it to life', 'Build your chocolate cake with professional guidance from Jenny.'],
    ['Box and take home', 'Pack your finished cake beautifully and take it home safely.'],
  ]

  return (
    <>
      <SiteHeader navigate={navigate} />
      <main className="kids-class-page">
        <section className="kids-class-hero" aria-labelledby="kids-class-title">
          <div className="kids-hero-copy reveal-up">
            <h1 id="kids-class-title">Kids Professional Cake Course</h1>
            <p className="kids-location">Melrose Park, Sydney</p>
            <p className="kids-hero-text">
              A private chocolate cake course where kids imagine their dream cake, learn real studio techniques, and bring it to life with Jenny's guidance.
            </p>
            <div className="kids-hero-actions">
              <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
                Request a spot
              </button>
              <span>Professional-style course · Max 2 kids · Limited school holiday spots</span>
            </div>
          </div>

          <div className="kids-photo-card reveal-up delay-one">
            <img src={kidsClassHeroImg} alt="Kids professional cake course hero" />
          </div>
        </section>

        <section className="kids-section reveal-up delay-two" aria-labelledby="class-essentials-title">
          <h2 id="class-essentials-title">Class Essentials</h2>
          <div className="kids-essentials-grid">
            {essentials.map(([title, text]) => (
              <article className="kids-mini-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-section reveal-up" aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title">How it works</h2>
          <div className="kids-step-grid">
            {steps.map(([title, text]) => (
              <article className="kids-step-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-gallery-section reveal-up" aria-label="Kids class photos">
          <figure className="kids-gallery-card kids-gallery-process">
            <img src={kidsClassProcessImg} alt="Kids class cake making process" />
            <figcaption>
              <strong>Studio process</strong>
              <span>Plan, layer, cream, and finish with guided hands-on steps.</span>
            </figcaption>
          </figure>
          <figure className="kids-gallery-card kids-gallery-finished">
            <img src={kidsClassFinishedImg} alt="Finished kids cake class chocolate cake" />
            <figcaption>
              <strong>Finished cake</strong>
              <span>A real chocolate cake boxed beautifully to take home.</span>
            </figcaption>
          </figure>
        </section>

        <section className="kids-bottom-grid reveal-up" aria-label="Pricing and safety information">
          <article className="kids-price-card">
            <h2>Launch Pricing</h2>
            <strong>{formatCurrency(99)} / Year 1-2</strong>
            <p className="kids-price-line">{formatCurrency(109)} / Year 3-6</p>
            <p className="kids-price-line">{formatCurrency(198)} / two kids, siblings, or friends</p>
            <p className="kids-small-note">
              * Booking is completed after availability and full payment are confirmed by Jenny.
            </p>
          </article>

          <article className="kids-safety-card">
            <h2>Safety & Allergy Policy</h2>
            <p>
              This is a short private cake decorating class, not childcare. Younger children may need a parent or guardian to stay nearby or join the session.
            </p>
            <ul>
              <li>All allergies and dietary requirements must be declared before booking confirmation</li>
              <li>Parent/guardian consent is required when submitting a booking request</li>
              <li>Detailed address shared after payment confirmation (Melrose Park, Sydney)</li>
            </ul>
          </article>
        </section>

        <section className="kids-final-cta reveal-up" aria-label="Request class booking">
          <p>Limited school holiday spots are handled manually so Jenny can confirm each course safely.</p>
          <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
            Request a spot
          </button>
        </section>
      </main>
    </>
  )
}

function ClassReservePage({ navigate, onComplete }: { navigate: (page: Page) => void; onComplete: (reservation: ClassReservation) => void }) {
  const [form, setForm] = useState<{
    classDate: string
    classTime: string
    bookingType: ClassBookingType
    parentName: string
    parentPhone: string
    parentEmail: string
    childName: string
    childAge: number
    schoolYear: string
    secondChildName: string
    secondChildAge: number
    secondChildSchoolYear: string
    allergyNote: string
    emergencyContact: string
    pickupPerson: string
    parentConsent: boolean
    cancellationAgreement: boolean
    photoConsent: boolean
  }>({
    classDate: addDaysInputValue(4),
    classTime: CLASS_SESSION_TIMES[0],
    bookingType: 'year-1-2',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    childName: '',
    childAge: 7,
    schoolYear: 'Year 1',
    secondChildName: '',
    secondChildAge: 9,
    secondChildSchoolYear: '',
    allergyNote: '',
    emergencyContact: '',
    pickupPerson: '',
    parentConsent: false,
    cancellationAgreement: false,
    photoConsent: false,
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const today = useTodayInputValue()
  const price = getClassBookingPrice(form.bookingType)

  async function submitClassReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.parentPhone)
    if (!form.parentName.trim() || !form.childName.trim()) return setError('Please enter parent and child name.')
    if (!form.schoolYear.trim()) return setError('Please enter Child 1 school year.')
    if (!isValidPhone(phone)) return setError(`Please check the mobile number. ${marketConfig.copy.phoneHelp}`)
    if (!form.parentEmail.includes('@')) return setError('Please enter a valid email address.')
    if (!form.classDate || form.classDate < today) return setError('Please choose a future class date.')
    if (form.bookingType === '2-friends' && (!form.secondChildName.trim() || !form.secondChildSchoolYear.trim())) return setError('Please enter Child 2 name and school year.')
    if (!form.emergencyContact.trim() || !form.pickupPerson.trim()) return setError('Emergency contact and pick-up person are required.')
    if (!form.parentConsent || !form.cancellationAgreement) return setError('Parent consent and booking agreement are required.')
    setSubmitting(true)
    try {
      const reservation = await createClassReservation({ ...form, parentPhone: phone })
      onComplete(reservation)
      navigate('class-complete')
    } catch {
      setError('An error occurred while submitting your class request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader navigate={navigate} />
      <main className="class-reserve-page">
        <form className="class-reserve-form" onSubmit={submitClassReservation}>
          <header className="class-reserve-title-block">
            <button className="class-back-button" type="button" onClick={() => navigate('classes')}>
              <ArrowLeft size={14} /> Back to classes
            </button>
            <h1>Request a Kids Course</h1>
            <p>Please fill out the details below. Jenny will confirm availability and send full payment details.</p>
          </header>

          <section className="class-form-section" aria-labelledby="session-type-title">
            <h2 id="session-type-title">1. Select Session Type</h2>
            <div className="class-booking-grid">
              {(['year-1-2', '1-child', '2-friends'] as const).map((type) => (
                <label className="class-option-card" key={type}>
                  <input
                    type="radio"
                    name="classBookingType"
                    checked={form.bookingType === type}
                    onChange={() => setForm({ ...form, bookingType: type })}
                  />
                  <span>{formatClassBookingType(type)}</span>
                  <strong>{formatCurrency(getClassBookingPrice(type))}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="class-form-section class-form-section-tight" aria-labelledby="session-detail-title">
            <h2 id="session-detail-title">Preferred Session</h2>
            <label className="class-field">
              <span>Preferred Date</span>
              <input
                type="date"
                min={today}
                value={form.classDate}
                onChange={(event) => setForm({ ...form, classDate: event.target.value })}
              />
            </label>
            <fieldset className="class-time-fieldset">
              <legend>Preferred Session Time</legend>
              <div className="class-time-grid">
                {CLASS_SESSION_TIMES.map((time) => (
                  <label className="class-time-option" key={time}>
                    <input
                      type="radio"
                      name="classTime"
                      checked={form.classTime === time}
                      onChange={() => setForm({ ...form, classTime: time })}
                    />
                    <span>{time}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="class-form-section" aria-labelledby="guardian-detail-title">
            <h2 id="guardian-detail-title">2. Parent / Guardian Details</h2>
            <label className="class-field">
              <span>Full Name</span>
              <input value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} placeholder="Parent or guardian name" />
            </label>
            <label className="class-field">
              <span>Email Address</span>
              <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="name@email.com" />
            </label>
            <label className="class-field">
              <span>Mobile Number</span>
              <input inputMode="tel" value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="0412 345 678" />
            </label>
          </section>

          <section className="class-form-section" aria-labelledby="child-detail-title">
            <h2 id="child-detail-title">3. Child Details</h2>
            <label className="class-field">
              <span>Child 1 Name</span>
              <input value={form.childName} onChange={(event) => setForm({ ...form, childName: event.target.value })} placeholder="Leo" />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>Child 1 Age</span>
                <input type="number" min="3" max="18" value={form.childAge} onChange={(event) => setForm({ ...form, childAge: Number(event.target.value) })} />
              </label>
              <label className="class-field">
                <span>Child 1 School Year</span>
                <input value={form.schoolYear} onChange={(event) => setForm({ ...form, schoolYear: event.target.value })} placeholder="Year 4" />
              </label>
            </div>
            {form.bookingType === '2-friends' && (
              <>
                <label className="class-field">
                  <span>Child 2 Name</span>
                  <input value={form.secondChildName} onChange={(event) => setForm({ ...form, secondChildName: event.target.value })} placeholder="Chloe" />
                </label>
                <div className="class-split-row">
                  <label className="class-field">
                    <span>Child 2 Age</span>
                    <input type="number" min="3" max="18" value={form.secondChildAge} onChange={(event) => setForm({ ...form, secondChildAge: Number(event.target.value) })} />
                  </label>
                  <label className="class-field">
                    <span>Child 2 School Year</span>
                    <input value={form.secondChildSchoolYear} onChange={(event) => setForm({ ...form, secondChildSchoolYear: event.target.value })} placeholder="Year 2" />
                  </label>
                </div>
              </>
            )}
          </section>

          <section className="class-form-section" aria-labelledby="safety-title">
            <h2 id="safety-title">4. Allergy & Safety Declarations</h2>
            <label className="class-field">
              <span>Allergy declarations & safety notes</span>
              <textarea value={form.allergyNote} onChange={(event) => setForm({ ...form, allergyNote: event.target.value })} placeholder="Please write known allergies, dietary notes, or none." />
            </label>
            <div className="class-split-row">
              <label className="class-field">
                <span>Emergency Contact</span>
                <input value={form.emergencyContact} onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })} placeholder="Name and mobile" />
              </label>
              <label className="class-field">
                <span>Pick-up Person</span>
                <input value={form.pickupPerson} onChange={(event) => setForm({ ...form, pickupPerson: event.target.value })} placeholder="Who will pick up" />
              </label>
            </div>
          </section>

          <section className="class-form-section" aria-labelledby="consent-title">
            <h2 id="consent-title">5. Consent & Confirmation</h2>
            <label className="class-check-row">
              <input type="checkbox" checked={form.parentConsent} onChange={(event) => setForm({ ...form, parentConsent: event.target.checked })} />
              <span>I am the parent/guardian and consent to my child joining this class.</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.cancellationAgreement} onChange={(event) => setForm({ ...form, cancellationAgreement: event.target.checked })} />
              <span>I understand my booking is completed only after availability is confirmed and full payment is received.</span>
            </label>
            <fieldset className="class-photo-consent">
              <legend>Photo Consent</legend>
              <div className="class-photo-options">
                <label>
                  <input type="radio" name="photoConsent" checked={form.photoConsent} onChange={() => setForm({ ...form, photoConsent: true })} />
                  <span>Yes, I consent to photos</span>
                </label>
                <label>
                  <input type="radio" name="photoConsent" checked={!form.photoConsent} onChange={() => setForm({ ...form, photoConsent: false })} />
                  <span>No, do not take photos</span>
                </label>
              </div>
            </fieldset>
          </section>

          <aside className="class-reserve-summary" aria-label="Class request summary">
            <dl>
              <div><dt>Booking</dt><dd>{formatClassBookingType(form.bookingType)}</dd></div>
              <div><dt>Total</dt><dd>{formatCurrency(price)}</dd></div>
              <div><dt>Payment</dt><dd>Full payment required</dd></div>
            </dl>
            <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={price} language="en" />
            <p className="class-submit-note">Use this account after Jenny confirms the session is available.</p>
          </aside>

          {error && <p className="error-text class-error-text">{error}</p>}
          <button className="class-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Request booking'}</button>
          <p className="class-submit-note">Jenny will confirm availability and send full payment details. Your booking is complete after payment is received.</p>
        </form>
      </main>
    </>
  )
}

function ClassCompletePage({ navigate, reservation }: { navigate: (page: Page) => void; reservation: ClassReservation | null }) {
  const reservationNumber = reservation?.reservationNumber || 'VG-2026-0702'

  return (
    <>
      <SiteHeader navigate={navigate} />
      <main className="class-complete-page">
        <section className="class-complete-card" aria-labelledby="class-complete-title">
          <div className="class-complete-icon" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 id="class-complete-title">Booking Request Sent!</h1>

          <div className="class-complete-message">
            <strong>Your kids course request has been sent.</strong>
            <p>Jenny will check availability and confirm the session shortly.</p>
            <p>Your booking is complete once full payment has been received.</p>
            <span>Booking ID: {reservationNumber}</span>
          </div>

          <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={reservation?.totalPrice} language="en" />

          <button className="class-complete-button" type="button" onClick={() => navigate('classes')}>
            Back to Classes
          </button>
        </section>
      </main>
    </>
  )
}

function ReservePage({
  navigate,
  settings,
  initialProductId,
  onComplete,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  settings: StoreSettings
  initialProductId: ProductId
  onComplete: (reservation: Reservation) => void
  language: Language
  setLanguage: (language: Language) => void
}) {
  const copy = cakeCopy(language)
  const [form, setForm] = useState({
    productId: initialProductId,
    cacaoPercent: '기본' as CacaoPercent,
    cakeSize: DEFAULT_CAKE_SIZE as CakeSize,
    chocolateType: DEFAULT_CHOCOLATE_TYPE as ChocolateType,
    poundAddon: DEFAULT_POUND_ADDON as PoundAddon,
    pickupDate: todayInputValue(),
    pickupTime: '',
    quantity: 1,
    customerName: '',
    customerPhone: '',
    requestNote: '',
    promoCode: '',
    privacy: false,
  })
  const [showCakeSelector, setShowCakeSelector] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const today = useTodayInputValue()
  const minPickupDate = today
  const pickupDate = form.pickupDate && form.pickupDate >= minPickupDate ? form.pickupDate : minPickupDate
  const times = useMemo(() => timeOptionsForDate(pickupDate, settings), [pickupDate, settings])
  const selectedPickupTime = times.includes(form.pickupTime) ? form.pickupTime : times[0] || ''

  async function submitReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.customerPhone)

    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      setError(copy.errors.name)
      return
    }
    if (!isValidPhone(phone)) {
      setError(`${copy.errors.phone} ${copy.phoneHelp}`)
      return
    }
    if (!pickupDate || pickupDate < minPickupDate) {
      setError(copy.errors.pickupDate)
      return
    }
    if (!selectedPickupTime) {
      setError(copy.errors.pickupTime)
      return
    }
    if (form.quantity < 1 || form.quantity > MAX_RESERVATION_QUANTITY) {
      setError(copy.errors.quantity(MAX_RESERVATION_QUANTITY))
      return
    }
    if (!form.privacy) {
      setError(copy.errors.privacy)
      return
    }

    setSubmitting(true)
    try {
      const reservation = await createReservation(
        {
          customerName: form.customerName,
          customerPhone: phone,
          productId: form.productId,
          cakeSize: form.cakeSize,
          chocolateType: form.chocolateType,
          poundAddon: form.poundAddon,
          quantity: form.quantity,
          pickupDate,
          pickupTime: selectedPickupTime,
          cacaoPercent: form.cacaoPercent,
          requestNote: form.requestNote,
          promoCode: form.promoCode,
        }
      )
      onComplete(reservation)
      navigate('complete')
    } catch {
      setError(copy.errors.submit)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedProduct = getProductById(form.productId)
  const selectedProductText = getProductText(selectedProduct.id, language)
  const selectedProductImage = selectedProduct.id === 'pound-cake'
    ? poundCakeCardImg
    : selectedProduct.id === 'cupcake-dozen'
      ? cupcakeCardImg
      : paveCakeCardImg
  const priceOptions = {
    cacaoPercent: form.cacaoPercent,
    cakeSize: form.cakeSize,
    chocolateType: form.chocolateType,
    poundAddon: form.poundAddon,
  }
  const unitPrice = getReservationUnitPrice(selectedProduct.id, priceOptions)
  const currentPrice = getReservationPrice(selectedProduct.id, priceOptions, form.quantity)
  const isPromoApplied = form.promoCode.trim().toLowerCase() === PROMO_CODE.toLowerCase()
  const discountedPrice = applyPromoDiscount(currentPrice, form.promoCode)
  const promoDiscountAmount = Math.max(0, currentPrice - discountedPrice)
  const showChocolateTypeOptions = usesReservationChocolateType(selectedProduct.id, form.poundAddon)
  const labels = {
    back: copy.back,
    title: copy.title,
    product: copy.product,
    totalPrice: copy.totalPrice,
    quantity: copy.quantity,
    size: copy.size,
    options: copy.options,
    production: copy.production,
    cakeSelect: copy.cakeSelect,
    changeCake: copy.changeCake,
    selectedCake: copy.selectedCake,
    sizeSelect: copy.sizeSelect,
    cacaoSelect: copy.cacaoSelect,
    chocolateSelect: copy.chocolateSelect,
    finishSelect: copy.finishSelect,
    orderQuantity: copy.orderQuantity,
    quantityHelp:
      selectedProduct.id === 'cupcake-dozen'
        ? copy.quantityHelpCupcake(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit)
        : copy.quantityHelp(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit),
    pickupDate: copy.pickupDate,
    pickupTime: copy.pickupTime,
    customerName: copy.customerName,
    phone: copy.phone,
    requestNote: copy.requestNote,
    promoCode: copy.promoCode,
    promoPlaceholder: copy.promoPlaceholder,
    promoApplied: copy.promoApplied,
    promoHint: copy.promoHint,
  }

  function selectProduct(productId: ProductId) {
    const product = getProductById(productId)
    setShowCakeSelector(false)
    setForm({
      ...form,
      productId,
      cacaoPercent: product.usesCacaoOptions ? form.cacaoPercent : '기본',
      cakeSize: product.usesSizeOptions ? form.cakeSize : DEFAULT_CAKE_SIZE,
      chocolateType: usesReservationChocolateType(product.id, form.poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
      poundAddon: product.usesPoundAddonOptions ? form.poundAddon : DEFAULT_POUND_ADDON,
    })
  }

  function selectPoundAddon(poundAddon: PoundAddon) {
    setForm({
      ...form,
      poundAddon,
      chocolateType: usesReservationChocolateType(form.productId, poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
    })
  }

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="form-page">
        <button className="text-button" type="button" onClick={() => navigate('home')}>
          <ArrowLeft size={16} /> {labels.back}
        </button>
        <section className="reservation-layout">
          <aside className="summary-panel">
            <div className="summary-product-photo">
              <img src={selectedProductImage} alt={selectedProductText.name} />
            </div>
            <p className="summary-kicker">{copy.productSectionTitle}</p>
            <h1>{labels.title}</h1>
            <dl>
              <div>
                <dt>{labels.product}</dt>
                <dd>{selectedProductText.name}</dd>
              </div>
              <div>
                <dt>{labels.totalPrice}</dt>
                <dd>
                  {isPromoApplied ? (
                    <span className="promo-price-summary">
                      <span className="original-price">{formatCurrency(currentPrice)}</span>
                      <strong>{formatCurrency(discountedPrice)}</strong>
                    </span>
                  ) : (
                    formatCurrency(currentPrice)
                  )}
                </dd>
              </div>
              <div>
                <dt>{labels.quantity}</dt>
                <dd>
                  {form.quantity}
                  {copy.quantityUnit}
                </dd>
              </div>
              {selectedProduct.usesSizeOptions && (
                <div>
                  <dt>{labels.size}</dt>
                  <dd>{formatCakeSizeLabel(form.cakeSize)}</dd>
                </div>
              )}
              {showChocolateTypeOptions && (
                <div>
                  <dt>{copy.chocolate}</dt>
                  <dd>{formatChocolateTypeText(form.chocolateType, language)}</dd>
                </div>
              )}
              {selectedProduct.usesPoundAddonOptions && (
                <div>
                  <dt>{copy.finish}</dt>
                  <dd>{formatPoundAddonText(form.poundAddon, language)}</dd>
                </div>
              )}
              <div>
                <dt>{labels.options}</dt>
                <dd>{selectedProductText.priceNote}</dd>
              </div>
              <div>
                <dt>{labels.production}</dt>
                <dd>{language === 'ko' ? copy.dailyLimitText : settings.dailyLimitText}</dd>
              </div>
            </dl>
            <button className="change-cake-button" type="button" onClick={() => setShowCakeSelector(true)}>
              {labels.changeCake}
            </button>
            <p>{language === 'ko' ? copy.reservationCompleteText : settings.reservationNotice}</p>
          </aside>

          <form className="reservation-form" onSubmit={submitReservation}>
            {showCakeSelector && (
              <fieldset className="cake-selector-fieldset">
                <legend>{labels.cakeSelect}</legend>
                <div className="product-choice-list">
                  {Object.values(PRODUCTS).map((product) => {
                    const isSelected = form.productId === product.id
                    const productImage = product.id === 'pound-cake'
                      ? poundCakeCardImg
                      : product.id === 'cupcake-dozen'
                        ? cupcakeCardImg
                        : paveCakeCardImg
                    return (
                      <label
                        className={`product-choice-card${isSelected ? ' is-selected' : ''}`}
                        key={product.id}
                        onClick={() => selectProduct(product.id)}
                      >
                        <input
                          type="radio"
                          name="product"
                          checked={isSelected}
                          onChange={() => selectProduct(product.id)}
                        />
                        <span className="product-choice-thumb" aria-hidden="true">
                          <img src={productImage} alt="" />
                        </span>
                        <span className="product-choice-copy">
                          <span className="product-choice-topline">
                            <strong>{getProductText(product.id, language).name}</strong>
                            {isSelected && <span className="selected-cake-badge">{labels.selectedCake}</span>}
                          </span>
                          <span>
                            1{copy.quantityUnit} {formatCurrency(getReservationUnitPrice(product.id, { cakeSize: DEFAULT_CAKE_SIZE, chocolateType: DEFAULT_CHOCOLATE_TYPE, poundAddon: DEFAULT_POUND_ADDON }))} ·{' '}
                            {getProductText(product.id, language).priceNote}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {selectedProduct.usesSizeOptions && (
              <fieldset>
              <legend>{labels.sizeSelect}</legend>
              <div className="choice-list">
                {CAKE_SIZE_OPTIONS.map((option) => {
                  const optionText = getCakeSizeText(option, language)
                  return (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="cakeSize"
                        checked={form.cakeSize === option.value}
                        onChange={() => setForm({ ...form, cakeSize: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>
                          {optionText.label} · {formatCurrency(selectedProduct.sizePrices[option.value] || option.price)}
                        </strong>
                        <span>{optionText.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="field-help">{copy.sizeHelp}</p>
              </fieldset>
            )}

            {selectedProduct.usesCacaoOptions && (
              <fieldset>
                <legend>{labels.cacaoSelect}</legend>
                <div className="choice-list">
                  {CACAO_OPTIONS.map((option) => (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="cacao"
                        checked={form.cacaoPercent === option.value}
                        onChange={() => setForm({ ...form, cacaoPercent: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>
                          {option.label} {option.extraPrice > 0 && `(+${formatCurrency(option.extraPrice)})`}
                        </strong>
                        <span>{option.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="field-help">{copy.cacaoHelp}</p>
              </fieldset>
            )}

            {selectedProduct.usesPoundAddonOptions && (
              <fieldset>
                <legend>{labels.finishSelect}</legend>
                <div className="choice-list">
                  {POUND_ADDON_OPTIONS.map((option) => {
                    const optionText = getPoundAddonText(option, language)
                    return (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="poundAddon"
                          checked={form.poundAddon === option.value}
                          onChange={() => selectPoundAddon(option.value)}
                        />
                        <span className="choice-copy">
                          <strong>
                            {optionText.label} {option.extraPrice > 0 && `(+${formatCurrency(option.extraPrice)})`}
                          </strong>
                          <span>{optionText.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="field-help">{copy.finishHelp}</p>
              </fieldset>
            )}

            {showChocolateTypeOptions && (
              <fieldset>
                <legend>{labels.chocolateSelect}</legend>
                <div className="choice-list">
                  {CHOCOLATE_TYPE_OPTIONS.map((option) => {
                    const optionText = getChocolateTypeText(option, language)
                    return (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="chocolateType"
                          checked={form.chocolateType === option.value}
                          onChange={() => setForm({ ...form, chocolateType: option.value })}
                        />
                        <span className="choice-copy">
                          <strong>{optionText.label}</strong>
                          <span>{optionText.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend>{labels.quantity}</legend>
              <label>
                {labels.orderQuantity}
                <select
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                >
                  {Array.from({ length: MAX_RESERVATION_QUANTITY }, (_, index) => index + 1).map((quantity) => (
                    <option value={quantity} key={quantity}>
                      {quantity}
                      {copy.quantityUnit}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-help">{labels.quantityHelp}</p>
            </fieldset>

            <div className="field-row">
              <label>
                {labels.pickupDate}
                <input
                  type="date"
                  min={minPickupDate}
                  value={pickupDate}
                  onChange={(event) => {
                    const nextDate = event.target.value && event.target.value >= minPickupDate ? event.target.value : minPickupDate
                    setForm({
                      ...form,
                      pickupDate: nextDate,
                      pickupTime: timeOptionsForDate(nextDate, settings)[0] || '',
                    })
                  }}
                />
              </label>
              <label>
                {labels.pickupTime}
                <select
                  value={selectedPickupTime}
                  onChange={(event) => setForm({ ...form, pickupTime: event.target.value })}
                >
                  {times.map((time) => (
                    <option value={time} key={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {settings.pickupNotice.trim() && <p className="field-help">{settings.pickupNotice}</p>}

            <div className="field-row">
              <label>
                {labels.customerName}
                <input
                  value={form.customerName}
                  onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                  placeholder={copy.namePlaceholder}
                />
              </label>
              <label>
                {labels.phone}
                <input
                  inputMode="tel"
                  value={form.customerPhone}
                  onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
                  placeholder={copy.phonePlaceholder}
                />
              </label>
            </div>

            <label>
              {labels.requestNote}
              <textarea
                value={form.requestNote}
                onChange={(event) => setForm({ ...form, requestNote: event.target.value })}
                placeholder={copy.requestPlaceholder}
              />
            </label>

            <label className="promo-code-field">
              {labels.promoCode}
              <input
                value={form.promoCode}
                onChange={(event) => setForm({ ...form, promoCode: event.target.value })}
                placeholder={labels.promoPlaceholder}
                autoCapitalize="none"
              />
              <span className={isPromoApplied ? 'promo-message is-applied' : 'promo-message'}>
                {isPromoApplied
                  ? `${labels.promoApplied} (-${formatCurrency(promoDiscountAmount)})`
                  : labels.promoHint}
              </span>
            </label>

            <label className="agree-row">
              <input
                type="checkbox"
                checked={form.privacy}
                onChange={(event) => setForm({ ...form, privacy: event.target.checked })}
              />
              <span>
                {copy.privacyNotice}
              </span>
            </label>

            {error && <p className="error-text">{error}</p>}

            <BankAccountBox settings={settings} totalPrice={discountedPrice} language={language} />

            <button className="primary-button full-width" type="submit" disabled={submitting}>
              {submitting ? copy.submitting : copy.reserveCta}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}

function CompletePage({
  navigate,
  reservation,
  settings,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  reservation: Reservation | null
  settings: StoreSettings
  language: Language
  setLanguage: (language: Language) => void
}) {
  const copy = cakeCopy(language)
  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="narrow-page">
        <section className="complete-panel">
          <div className="check-icon">
            <Check size={22} />
          </div>
          <h1>{copy.reservationCompleteTitle}</h1>
          <p>{copy.reservationCompleteText}</p>

          {reservation ? (
            <dl className="detail-list">
              <div>
                <dt>{copy.bookingNumber}</dt>
                <dd>{reservation.reservationNumber}</dd>
              </div>
              <div>
                <dt>{copy.customerName}</dt>
                <dd>{reservation.customerName}</dd>
              </div>
              <div>
                <dt>{copy.mobile}</dt>
                <dd>{maskPhone(reservation.customerPhone)}</dd>
              </div>
              <ProductDetailRows reservation={reservation} language={language} />
              <div>
                <dt>{copy.pickUp}</dt>
                <dd>
                  {reservation.pickupDate} {reservation.pickupTime}
                </dd>
              </div>
              <div>
                <dt>{copy.price}</dt>
                <dd>{formatCurrency(reservation.totalPrice)}</dd>
              </div>
            </dl>
          ) : (
            <p className="notice-line">{copy.noReservationText}</p>
          )}

          <div className="complete-bank-section">
            <BankAccountBox settings={settings} totalPrice={reservation?.totalPrice} language={language} />
            <p>{copy.paymentConfirmText}</p>
          </div>

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => navigate('lookup')}>
              {copy.lookupNav}
            </button>
            <button className="primary-button" type="button" onClick={() => navigate('home')}>
              {copy.home}
            </button>
          </div>
        </section>
      </main>
    </>
  )
}

function LookupPage({
  navigate,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  language: Language
  setLanguage: (language: Language) => void
}) {
  const copy = cakeCopy(language)
  const [reservationNumber, setReservationNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [message, setMessage] = useState('')

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    const result = await getReservationByNumber(reservationNumber.trim(), phone.trim())
    setReservation(result)
    if (!result) setMessage(copy.notFoundText)
  }

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="narrow-page">
        <form className="lookup-form" onSubmit={lookup}>
          <h1>{copy.lookupTitle}</h1>
          <label>
            {copy.bookingNumber}
            <input value={reservationNumber} onChange={(event) => setReservationNumber(event.target.value)} />
          </label>
          <label>
            {copy.lookupPhoneLabel}
            <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="primary-button full-width" type="submit">
            {copy.search}
          </button>
          {message && <p className="error-text">{message}</p>}
        </form>

        {reservation && (
          <section className="result-panel">
            <dl className="detail-list">
              <div>
                <dt>{copy.bookingStatus}</dt>
                <dd>{formatReservationStatus(reservation.status)}</dd>
              </div>
              <div>
                <dt>{copy.paymentStatus}</dt>
                <dd>{formatPaymentStatus(reservation.paymentStatus)}</dd>
              </div>
              <ProductDetailRows reservation={reservation} language={language} />
              <div>
                <dt>{copy.pickUp}</dt>
                <dd>
                  {reservation.pickupDate} {reservation.pickupTime}
                </dd>
              </div>
            </dl>
          </section>
        )}
      </main>
    </>
  )
}

function AdminLoginPage({ navigate }: { navigate: (page: Page) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        setError('허용된 관리자 Google 계정이 아닙니다.')
        window.history.replaceState(null, '', '/admin/login')
      }
    })
  }, [navigate])

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await loginAdmin(email, password)
      navigate('admin')
    } catch {
      setError('로그인 정보를 확인해 주세요.')
    }
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
          <button className="google-button full-width" type="button" onClick={loginAdminWithGoogle}>
            Google로 로그인
          </button>
          <div className="login-divider">또는</div>
          <button className="primary-button full-width" type="submit">
            이메일로 로그인
          </button>
        </form>
      </main>
    </>
  )
}

function AdminFrame({
  navigate,
  children,
}: {
  navigate: (page: Page) => void
  children: React.ReactNode
}) {
  async function logout() {
    await logoutAdmin()
    navigate('admin-login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <button className="brand-button" type="button" onClick={() => navigate('home')}>
          Verygood
        </button>
        <button type="button" onClick={() => navigate('admin')}>
          대시보드
        </button>
        <button type="button" onClick={() => navigate('admin-reservations')}>
          예약 목록
        </button>
        <button type="button" onClick={() => navigate('admin-classes')}>
          클래스 예약
        </button>
        <button type="button" onClick={logout}>
          <LogOut size={16} /> 로그아웃
        </button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  )
}

function AdminMonthlyCalendar({
  month,
  cakeReservations,
  classReservations,
  onPreviousMonth,
  onCurrentMonth,
  onNextMonth,
  onSelectCake,
  onSelectClass,
}: {
  month: string
  cakeReservations: Reservation[]
  classReservations: ClassReservation[]
  onPreviousMonth: () => void
  onCurrentMonth: () => void
  onNextMonth: () => void
  onSelectCake: (reservation: Reservation) => void
  onSelectClass: (reservation: ClassReservation) => void
}) {
  const days = getCalendarGridDays(month)
  const events = buildAdminCalendarEvents(cakeReservations, classReservations)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function eventsForDate(date: string) {
    return events.filter((event) => event.date === date)
  }

  function selectEvent(event: AdminCalendarEvent) {
    if (event.kind === 'cake') onSelectCake(event.reservation)
    else onSelectClass(event.reservation)
  }

  return (
    <section className="admin-month-calendar-section" aria-labelledby="admin-calendar-title">
      <div className="admin-month-calendar-header">
        <div>
          <p className="summary-kicker">Reservation Calendar</p>
          <h2 id="admin-calendar-title">예약 캘린더</h2>
          <p>케이크 예약과 키즈 클래스를 한 달 달력으로 확인하세요.</p>
        </div>
        <div className="admin-month-calendar-controls">
          <button className="secondary-button" type="button" onClick={onPreviousMonth}>지난달</button>
          <strong>{getMonthLabel(month)}</strong>
          <button className="secondary-button" type="button" onClick={onCurrentMonth}>이번달</button>
          <button className="secondary-button" type="button" onClick={onNextMonth}>다음달</button>
        </div>
      </div>

      <div className="admin-month-calendar-grid" aria-label={`${getMonthLabel(month)} 예약 캘린더`}>
        {weekdays.map((weekday) => (
          <div className="admin-month-calendar-weekday" key={weekday}>{weekday}</div>
        ))}
        {days.map((day) => {
          const dayEvents = eventsForDate(day.date)
          const summary = getDailyCalendarSummary(dayEvents)
          return (
            <article
              className={`admin-month-calendar-day${day.isToday ? ' is-today' : ''}${day.isCurrentMonth ? '' : ' is-outside-month'}`}
              key={day.date}
            >
              <div className="admin-month-calendar-day-head">
                <span className="admin-month-calendar-day-number">{day.dayNumber}</span>
                {summary && <span className="admin-month-calendar-summary">{summary}</span>}
              </div>
              <div className="admin-month-calendar-events">
                {dayEvents.map((event) => (
                  <button
                    className={`admin-calendar-event ${event.kind}${event.isCancelled ? ' is-cancelled' : ''}`}
                    key={`${event.kind}-${event.id}`}
                    type="button"
                    onClick={() => selectEvent(event)}
                    title={`${event.time} ${event.title} ${event.subtitle}`}
                  >
                    <span className="admin-calendar-event-time">{event.time}</span>
                    <span className="admin-calendar-event-title">{event.title}</span>
                    <span className="admin-calendar-event-subtitle">{event.subtitle}</span>
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function AdminDashboardPage({ navigate }: { navigate: (page: Page) => void }) {
  const [authorized, setAuthorized] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [classReservations, setClassReservations] = useState<ClassReservation[]>([])
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassReservation | null>(null)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [calendarMonth, setCalendarMonth] = useState(() => currentCalendarMonth())
  const [toast, setToast] = useState('')
  const today = useTodayInputValue()
  const tomorrow = addDaysInputValue(1)

  useEffect(() => {
    isAdminLoggedIn().then((loggedIn) => {
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
  }, [navigate])

  useEffect(() => {
    if (authorized) {
      listReservations().then(setReservations)
      listClassReservations().then(setClassReservations)
      getSettings().then(setSettings)
    }
  }, [authorized])

  async function saveReservation(id: string, updates: Parameters<typeof updateReservation>[1]) {
    const saved = await updateReservation(id, updates)
    setReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelected((current) => (current?.id === id ? saved : current))
  }

  async function saveClassReservation(id: string, updates: Parameters<typeof updateClassReservation>[1]) {
    const saved = await updateClassReservation(id, updates)
    setClassReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelectedClass((current) => (current?.id === id ? saved : current))
  }

  async function copySms(reservation: Reservation) {
    await navigator.clipboard.writeText(buildSmsMessage(reservation, settings))
    setToast('문자 내용이 복사되었습니다.')
    window.setTimeout(() => setToast(''), 2500)
  }

  async function copyClassMessage(message: string) {
    await navigator.clipboard.writeText(message)
    setToast('클래스 메시지가 복사되었습니다.')
    window.setTimeout(() => setToast(''), 2500)
  }

  const activeReservations = reservations.filter((item) => item.status !== '취소')
  const activeClassReservations = classReservations.filter((item) => item.status !== 'Cancelled')
  const stats = [
    { label: '오늘 픽업', value: activeReservations.filter((item) => item.pickupDate === today).length },
    { label: '내일 픽업', value: activeReservations.filter((item) => item.pickupDate === tomorrow).length },
    { label: '신규 신청', value: activeReservations.filter((item) => item.status === '예약신청').length },
    { label: '입금대기', value: activeReservations.filter((item) => item.paymentStatus === '입금대기').length },
    { label: '이번 달 클래스', value: activeClassReservations.filter((item) => item.classDate.startsWith(calendarMonth)).length },
  ]

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      {toast && <div className="toast">{toast}</div>}
      <div className="admin-header">
        <h1>관리자 대시보드</h1>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => navigate('admin-reservations')}>
            케이크 예약 보기
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate('admin-classes')}>
            키즈 클래스 예약 보기
          </button>
        </div>
      </div>
      <section className="stat-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>
      <AdminMonthlyCalendar
        month={calendarMonth}
        cakeReservations={reservations}
        classReservations={classReservations}
        onPreviousMonth={() => setCalendarMonth((current) => shiftCalendarMonth(current, -1))}
        onCurrentMonth={() => setCalendarMonth(currentCalendarMonth())}
        onNextMonth={() => setCalendarMonth((current) => shiftCalendarMonth(current, 1))}
        onSelectCake={setSelected}
        onSelectClass={setSelectedClass}
      />
      {selected && (
        <ReservationDrawer
          reservation={selected}
          onClose={() => setSelected(null)}
          onSave={saveReservation}
          onCopy={copySms}
          settings={settings}
        />
      )}
      {selectedClass && (
        <ClassReservationDrawer
          reservation={selectedClass}
          onClose={() => setSelectedClass(null)}
          onSave={saveClassReservation}
          onCopy={copyClassMessage}
        />
      )}
    </AdminFrame>
  )
}

function AdminReservationsPage({
  navigate,
}: {
  navigate: (page: Page) => void
}) {
  const [authorized, setAuthorized] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filters, setFilters] = useState<ReservationFilters>(initialFilters)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)

  async function refresh(nextFilters = filters) {
    setReservations(await listReservations(nextFilters))
  }

  useEffect(() => {
    isAdminLoggedIn().then((loggedIn) => {
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
  }, [navigate])

  useEffect(() => {
    if (authorized) {
      listReservations(initialFilters).then(setReservations)
      getSettings().then(setSettings)
    }
  }, [authorized])

  async function updateFilters(nextFilters: ReservationFilters) {
    setFilters(nextFilters)
    await refresh(nextFilters)
  }

  async function saveReservation(id: string, updates: Parameters<typeof updateReservation>[1]) {
    const saved = await updateReservation(id, updates)
    setReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelected((current) => (current?.id === id ? saved : current))
  }

  async function copySms(reservation: Reservation) {
    await navigator.clipboard.writeText(buildSmsMessage(reservation, settings))
    setToast('문자 내용이 복사되었습니다.')
    window.setTimeout(() => setToast(''), 2500)
  }

  function downloadCsv() {
    const csv = `\uFEFF${reservationsToCsv(reservations)}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `verygood-cake-reservations-${todayInputValue()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      {toast && <div className="toast">{toast}</div>}
      <div className="admin-header">
        <h1>예약 목록</h1>
        <button className="primary-button" type="button" onClick={downloadCsv}>
          <Download size={16} /> 엑셀 다운로드
        </button>
      </div>

      <section className="filters">
        <label>
          <CalendarDays size={16} />
          <input
            type="date"
            value={filters.pickupDate}
            onChange={(event) => updateFilters({ ...filters, pickupDate: event.target.value })}
          />
        </label>
        <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
          <option value="">예약상태 전체</option>
          {RESERVATION_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(event) => updateFilters({ ...filters, paymentStatus: event.target.value })}
        >
          <option value="">입금상태 전체</option>
          {PAYMENT_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filters.cacaoPercent}
          onChange={(event) => updateFilters({ ...filters, cacaoPercent: event.target.value })}
        >
          <option value="">카카오 전체</option>
          {CACAO_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="고객명, 연락처, 예약번호"
            value={filters.search}
            onChange={(event) => updateFilters({ ...filters, search: event.target.value })}
          />
        </label>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>신청일시</th>
              <th>예약번호</th>
              <th>예약자</th>
              <th>연락처</th>
              <th>제품</th>
              <th>사이즈</th>
              <th>카카오</th>
              <th>초콜릿</th>
              <th>마감</th>
              <th>수량</th>
              <th>픽업일</th>
              <th>픽업시간</th>
              <th>요청사항</th>
              <th>예약상태</th>
              <th>입금상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>{reservation.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>{reservation.reservationNumber}</td>
                <td>{reservation.customerName}</td>
                <td>{reservation.customerPhone}</td>
                <td>{getProductById(reservation.productId).name}</td>
                <td>{reservationCakeSizeText(reservation)}</td>
                <td>{reservationCacaoText(reservation)}</td>
                <td>{reservationChocolateText(reservation)}</td>
                <td>{reservationFinishText(reservation)}</td>
                <td>{reservation.quantity}개</td>
                <td>{reservation.pickupDate}</td>
                <td>{reservation.pickupTime}</td>
                <td className="note-cell">{reservation.requestNote || '-'}</td>
                <td>
                  <select
                    value={reservation.status}
                    onChange={(event) =>
                      saveReservation(reservation.id, { status: event.target.value as Reservation['status'] })
                    }
                  >
                    {RESERVATION_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={reservation.paymentStatus}
                    onChange={(event) =>
                      saveReservation(reservation.id, {
                        paymentStatus: event.target.value as Reservation['paymentStatus'],
                      })
                    }
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="table-actions">
                    <button type="button" onClick={() => copySms(reservation)} title="문자 복사">
                      <Clipboard size={16} />
                    </button>
                    <button type="button" onClick={() => setSelected(reservation)}>
                      상세
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={16} className="empty-cell">
                  표시할 예약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <ReservationDrawer
          reservation={selected}
          onClose={() => setSelected(null)}
          onSave={saveReservation}
          onCopy={copySms}
          settings={settings}
        />
      )}
    </AdminFrame>
  )
}

function AdminClassesPage({ navigate }: { navigate: (page: Page) => void }) {
  const [authorized, setAuthorized] = useState(false)
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [filters, setFilters] = useState<ClassReservationFilters>(initialClassFilters)
  const [selected, setSelected] = useState<ClassReservation | null>(null)
  const [toast, setToast] = useState('')

  async function refresh(nextFilters = filters) {
    setReservations(await listClassReservations(nextFilters))
  }

  useEffect(() => {
    isAdminLoggedIn().then((loggedIn) => {
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
  }, [navigate])

  useEffect(() => {
    if (authorized) listClassReservations(initialClassFilters).then(setReservations)
  }, [authorized])

  async function updateFilters(nextFilters: ClassReservationFilters) {
    setFilters(nextFilters)
    await refresh(nextFilters)
  }

  async function saveReservation(id: string, updates: Parameters<typeof updateClassReservation>[1]) {
    const saved = await updateClassReservation(id, updates)
    setReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelected((current) => (current?.id === id ? saved : current))
  }

  async function copyMessage(message: string, label = '클래스 메시지') {
    await navigator.clipboard.writeText(message)
    setToast(`${label}가 복사되었습니다.`)
    window.setTimeout(() => setToast(''), 2500)
  }

  function downloadCsv() {
    const csv = `\uFEFF${classReservationsToCsv(reservations)}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `verygood-au-class-reservations-${todayInputValue()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const totalRequests = reservations.length
  const pendingPayment = reservations.filter(
    (reservation) => reservation.paymentStatus === 'Payment pending' || reservation.status === 'Requested',
  ).length
  const confirmedSpots = reservations.filter((reservation) => reservation.status === 'Confirmed').length
  const firstReservation = reservations[0]
  const paymentTemplate = firstReservation
    ? buildClassPaymentMessage(firstReservation)
    : `Hi [Parent name], thank you for your booking for [Child name]\n\nRequested session:\n[Class date] [Class time]\n\nThe session is currently available.\n\nPlease use the payment details below:\n${buildClassPaymentDetails()}\n\nOnce your payment is confirmed, we will send you a final confirmation message!\n\nPlease note:\n- Please arrive 5 minutes early\n- Long hair should be tied back\n- Clothes may get chocolate/cream on them\n- Please let us know immediately if there are any allergies or dietary concerns\n- If your child has a favourite figure, doll, LEGO, or small toy, please bring it along. It can help them create their own special cake.\n\nLocation:\n1 Bundil Blvd, Melrose Park, Sydney\n\nWe're excited to see you soon.\nThank you:)`
  const confirmationTemplate = firstReservation
    ? buildClassConfirmationMessage(firstReservation)
    : `Hi [Parent name], [Child name]'s cake class booking is confirmed.\n\nDate/time:\n[Class date] [Class time]\n\nPlease note:\n- Please arrive 5 minutes early\n- Long hair should be tied back\n- Clothes may get chocolate/cream on them\n- Please let us know immediately if there are any allergies or dietary concerns\n- If your child has a favourite figure, doll, LEGO, or small toy, please bring it along. It can help them create their own special cake.\n\nLocation:\n1 Bundil Blvd, Melrose Park, Sydney\n\nWe're excited to see you soon.\nThank you:)`
  const stats = [
    { label: 'Total Requests', value: totalRequests, tone: 'neutral' },
    { label: 'Pending Payment', value: pendingPayment, tone: 'warning' },
    { label: 'Confirmed Spots', value: confirmedSpots, tone: 'success' },
  ]

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      {toast && <div className="toast">{toast}</div>}
      <section className="class-admin-page" aria-labelledby="class-admin-title">
        <div className="class-admin-topline">
          <strong>verygood chocolate</strong>
          <span id="class-admin-title">Admin / Class Reservations</span>
        </div>

        <div className="class-admin-summary-row">
          <div className="class-admin-stats" aria-label="Class reservation summary">
            {stats.map((stat) => (
              <article className={`class-admin-stat ${stat.tone}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
          <button className="class-admin-download" type="button" onClick={downloadCsv}>
            <Download size={15} />
            Download CSV
          </button>
        </div>

        <section className="class-admin-filters" aria-label="Class reservation filters">
          <label>
            <span>Date</span>
            <input type="date" value={filters.classDate} onChange={(event) => updateFilters({ ...filters, classDate: event.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
              <option value="">All status</option>
              {CLASS_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select value={filters.paymentStatus} onChange={(event) => updateFilters({ ...filters, paymentStatus: event.target.value })}>
              <option value="">All payments</option>
              {CLASS_PAYMENT_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label className="class-admin-search">
            <span>Search</span>
            <input placeholder="Parent, child, phone, reservation no." value={filters.search} onChange={(event) => updateFilters({ ...filters, search: event.target.value })} />
          </label>
        </section>

        <section className="class-admin-table-card" aria-label="Class reservation table">
          <div className="class-admin-table-scroll">
            <table className="class-admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Session</th>
                  <th>Parent Details</th>
                  <th>Child (Age)</th>
                  <th>Booking Type</th>
                  <th>Allergies</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => {
                  const hasAllergy = reservation.allergyNote.trim().length > 0
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.createdAt.slice(0, 10)}</td>
                      <td><strong>{reservation.classDate}</strong><span>{reservation.classTime}</span></td>
                      <td><strong>{reservation.parentName}</strong><span>{reservation.parentPhone}</span><span>{reservation.parentEmail}</span></td>
                      <td>
                        <strong>{reservation.childName} ({reservation.childAge})</strong>
                        <span>{reservation.schoolYear}</span>
                        {reservation.secondChildName && <span>{reservation.secondChildName} ({reservation.secondChildAge})</span>}
                      </td>
                      <td><strong>{formatClassBookingType(reservation.bookingType)}</strong><span>{formatCurrency(reservation.totalPrice)}</span></td>
                      <td className={hasAllergy ? 'class-allergy-cell warning' : 'class-allergy-cell'}>{hasAllergy ? reservation.allergyNote : 'None'}</td>
                      <td>
                        <select className={`class-status-select ${reservation.status.toLowerCase()}`} value={reservation.status} onChange={(event) => saveReservation(reservation.id, { status: event.target.value as ClassReservation['status'] })}>
                          {CLASS_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="class-payment-select" value={reservation.paymentStatus} onChange={(event) => saveReservation(reservation.id, { paymentStatus: event.target.value as ClassReservation['paymentStatus'] })}>
                          {CLASS_PAYMENT_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="class-admin-actions">
                          <button type="button" onClick={() => copyMessage(buildClassPaymentMessage(reservation), 'Payment message')}>Copy Payment</button>
                          <button type="button" onClick={() => copyMessage(buildClassConfirmationMessage(reservation), 'Confirmation message')}>Copy Confirm</button>
                          <button type="button" onClick={() => setSelected(reservation)}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {reservations.length === 0 && <tr><td colSpan={9} className="empty-cell">No class reservations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="class-copy-library" aria-labelledby="copy-library-title">
          <h2 id="copy-library-title">Copy Templates Library</h2>
          <div className="class-copy-grid">
            <article className="class-copy-card">
              <div className="class-copy-card-header">
                <strong>1. Payment Request (SMS/Email)</strong>
                <button type="button" onClick={() => copyMessage(paymentTemplate, 'Payment template')}>Copy</button>
              </div>
              <pre>{paymentTemplate}</pre>
            </article>
            <article className="class-copy-card">
              <div className="class-copy-card-header">
                <strong>2. Confirmation (SMS/Email)</strong>
                <button type="button" onClick={() => copyMessage(confirmationTemplate, 'Confirmation template')}>Copy</button>
              </div>
              <pre>{confirmationTemplate}</pre>
            </article>
          </div>
        </section>
      </section>
      {selected && <ClassReservationDrawer reservation={selected} onClose={() => setSelected(null)} onSave={saveReservation} onCopy={(message) => copyMessage(message, '클래스 메시지')} />}
    </AdminFrame>
  )
}

function ClassReservationDrawer({ reservation, onClose, onSave, onCopy }: { reservation: ClassReservation; onClose: () => void; onSave: (id: string, updates: Parameters<typeof updateClassReservation>[1]) => Promise<void>; onCopy: (message: string) => Promise<void> }) {
  const [memo, setMemo] = useState(reservation.adminMemo)
  return (
    <div className="drawer-backdrop"><aside className="drawer"><div className="drawer-header"><h2>{reservation.reservationNumber}</h2><button type="button" onClick={onClose}>닫기</button></div>
      <dl className="detail-list"><div><dt>부모</dt><dd>{reservation.parentName}<br />{reservation.parentPhone}<br />{reservation.parentEmail}</dd></div><div><dt>아이</dt><dd>{reservation.childName}, {reservation.childAge}, {reservation.schoolYear}</dd></div><div><dt>세션</dt><dd>{reservation.classDate} {reservation.classTime}</dd></div><div><dt>안전</dt><dd>{reservation.allergyNote || 'none'}<br />Emergency: {reservation.emergencyContact}<br />Pick-up: {reservation.pickupPerson}</dd></div><div><dt>동의</dt><dd>Parent {reservation.parentConsent ? 'yes' : 'no'} / Photo {reservation.photoConsent ? 'yes' : 'no'} / Cancellation {reservation.cancellationAgreement ? 'yes' : 'no'}</dd></div></dl>
      <label>관리자 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
      <div className="button-row"><button className="secondary-button" type="button" onClick={() => onCopy(buildClassPaymentMessage(reservation))}>결제 안내 복사</button><button className="secondary-button" type="button" onClick={() => onCopy(buildClassConfirmationMessage(reservation))}>확정 안내 복사</button><button className="primary-button" type="button" onClick={() => onSave(reservation.id, { adminMemo: memo })}>메모 저장</button></div>
      <div className="sms-preview"><pre>{buildClassConfirmationMessage(reservation)}</pre></div>
    </aside></div>
  )
}

function ReservationDrawer({
  reservation,
  onClose,
  onSave,
  onCopy,
  settings,
}: {
  reservation: Reservation
  onClose: () => void
  onSave: (id: string, updates: Parameters<typeof updateReservation>[1]) => Promise<void>
  onCopy: (reservation: Reservation) => Promise<void>
  settings: StoreSettings
}) {
  const [memo, setMemo] = useState(reservation.adminMemo)

  return (
    <div className="drawer-backdrop">
      <aside className="drawer">
        <div className="drawer-header">
          <h2>{reservation.reservationNumber}</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <dl className="detail-list">
          <div>
            <dt>예약자명</dt>
            <dd>{reservation.customerName}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>{reservation.customerPhone}</dd>
          </div>
          <ProductDetailRows reservation={reservation} />
          <div>
            <dt>픽업</dt>
            <dd>
              {reservation.pickupDate} {reservation.pickupTime}
            </dd>
          </div>
          <div>
            <dt>총 가격</dt>
            <dd>{formatCurrency(reservation.totalPrice)}</dd>
          </div>
          <div>
            <dt>요청사항</dt>
            <dd>{reservation.requestNote || '-'}</dd>
          </div>
        </dl>

        <label>
          관리자 메모
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>

        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => onCopy(reservation)}>
            <Clipboard size={16} /> 확정 문자 복사
          </button>
          <button className="primary-button" type="button" onClick={() => onSave(reservation.id, { adminMemo: memo })}>
            메모 저장
          </button>
        </div>
        <div className="sms-preview">
          <pre>{buildSmsMessage(reservation, settings)}</pre>
        </div>
      </aside>
    </div>
  )
}

export default App
