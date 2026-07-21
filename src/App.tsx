import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  MessageCircleCheck,
  Search,
  Shield,
  Wallet,
} from 'lucide-react'
import heroCake2Img from './assets/hero-cake-2.webp'
import heroCake3Img from './assets/hero-cake-3.webp'
import paveCakeCardImg from './assets/pave-side.webp'
import poundCakeCardImg from './assets/pound-side.webp'
import cupcakeCardImg from './assets/cupcake-side.webp'
import basqueCheesecakeHeroImg from './assets/basquecheesecake.webp'
import basqueCheesecakeCardImg from './assets/basquecheesecake-side.webp'
import glutenFreeStampImg from './assets/glutenfree.webp'
import freshLemonCupcakesHeroImg from './assets/lemoncake.webp'
import freshLemonCupcakesCardImg from './assets/lemoncake-side.webp'
import kidsClassHeroImg from './assets/kids-class-hero.webp'
import kidsClassProcessImg from './assets/kids-class-process.webp'
import kidsClassFinishedImg from './assets/kids-class-finished.webp'
import ReadOnlyCalendarPage from './ReadOnlyCalendarPage'
import ReviewPage from './ReviewPage'
import PublicReviewsSection from './PublicReviewsSection'
import ReviewsArchive from './ReviewsArchive'
import AdminFrame from './AdminFrame'
import AdminReviewsPage from './AdminReviewsPage'
import { getPageFromPath, pathForPage, type Page } from './lib/app-routes'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_PACK_SIZE,
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  isPromoEligibleProduct,
  formatCacaoLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getChocolateIcingSurcharge,
  getCupcakeFinishSurcharge,
  getLemonIcingCount,
  getProductById,
  getFreshLemonCupcakePackSize,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  getReservationPrice,
  getReservationUnitPrice,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  PAYMENT_STATUSES,
  POUND_ADDON_OPTIONS,
  PRODUCT_GROUPS,
  PRODUCTS,
  RESERVATION_STATUSES,
  usesReservationChocolateType,
} from './lib/constants'
import { appwriteConfig, functions, isAppwriteConfigured } from './lib/appwrite'
import {
  buildReviewRequestMessage,
  canCreateReviewInvite,
  reviewInviteErrorMessage,
} from './lib/review-messages'
import { createReviewInvite } from './lib/review-repository'
import { copyAdminRewardMessage } from './lib/admin-reviews'
import { shouldLoadStoreSettings } from './lib/review-page'
import {
  normalizeReviewCouponCode,
  getPromoEntryState,
  getPromoPriceDisplay,
  getDemoReviewPricingAudit,
  getOptionalReservationPricingAudit,
  getReservationPricingAudit,
  promoErrorMessage,
  shouldShowPromoInput,
} from './lib/review-coupon-client'
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
  PICKUP_TIME_CLASS_CONFLICT_ERROR,
  createReservation,
  createClassReservation,
  getReservationByNumber,
  getSettings,
  isAdminLoggedIn,
  listCakePickupOpenings,
  listReservations,
  listClassBookedSlots,
  listClassReservations,
  loginAdmin,
  loginAdminWithGoogle,
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
import { buildAdminReservationUpdate } from './lib/admin-reservation-edit'
import { applySeo } from './lib/seo'
import {
  getAnalyticsConsent,
  initializeAnalytics,
  setAnalyticsConsent,
  trackEvent,
  trackPageView,
} from './lib/analytics'
import type { CacaoPercent, CakeSize, ChocolateType, ClassAgeGroup, ClassPartySize, ClassReservation, ClassReservationFilters, ClassType, PoundAddon, ProductId, PublicReservation, Reservation, ReservationFilters, StoreSettings } from './lib/types'
import {
  buildClassConfirmationMessage,
  buildClassPaymentDetails,
  buildClassPaymentMessage,
  classReservationsToCsv,
  CLASS_PAYMENT_SETTINGS,
  CLASS_PAYMENT_STATUS_OPTIONS,
  CLASS_SESSION_TIMES,
  CLASS_STATUS_OPTIONS,
  filterCakePickupTimesForClass,
  formatClassBookingType,
  getAvailableClassSessionTimes,
  getClassBookingPrice,
  getClassBookingType,
  getClassTypeLabel,
  isCakePickupBlockedByClass,
  isClassDateBooked,
  type CakePickupOpening,
  type ClassBookedSlot,
} from './lib/class-utils'
import {
  addDaysInputValue,
  addDaysToInputValue,
  buildSmsMessage,
  customerTimeOptionsForDate,
  dateInputValue,
  formatCurrency,
  generateRequestId,
  isPickupTimeAllowed,
  PICKUP_TIME_TOO_SOON_ERROR,
  isValidPhone,
  maskPhone,
  normalizePhone,
  reservationsToCsv,
  timeOptionsForDate,
  todayInputValue,
} from './lib/utils'

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

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refreshNow = () => setNow(new Date())
    const interval = window.setInterval(refreshNow, 60_000)
    window.addEventListener('focus', refreshNow)
    document.addEventListener('visibilitychange', refreshNow)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshNow)
      document.removeEventListener('visibilitychange', refreshNow)
    }
  }, [])

  return now
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

function AnalyticsConsentBanner({ language }: { language: Language }) {
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
  const [page, setPage] = useState<Page>(() => getPageFromPath(window.location.pathname))
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null)

  const [completedClassReservation, setCompletedClassReservation] = useState<ClassReservation | null>(null)
  const [reservationProductId, setReservationProductId] = useState<ProductId>(DEFAULT_PRODUCT_ID)
  const [pendingReviewCoupon, setPendingReviewCoupon] = useState('')
  const [pendingReviewRewardPercent, setPendingReviewRewardPercent] = useState<5 | 10 | null>(null)
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)
  const hasLoadedSettings = useRef(false)

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    storeLanguage(nextLanguage)
  }, [])

  useEffect(() => {
    if (!shouldLoadStoreSettings(page) || hasLoadedSettings.current) return
    hasLoadedSettings.current = true
    getSettings().then(setSettings)
  }, [page])

  useEffect(() => {
    const handlePop = () => setPage(getPageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    applySeo(window.location.pathname)
    if (!window.location.pathname.startsWith('/admin') && page !== 'calendar' && page !== 'review') trackPageView(window.location.pathname)
  }, [page])

  const navigate = useCallback((nextPage: Page) => {
    if (nextPage === 'reserve') trackEvent('booking_start', { booking_type: 'cake' })
    if (nextPage === 'class-reserve') trackEvent('booking_start', { booking_type: 'kids_class' })
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

  const orderCakeFromReview = useCallback((couponCode: string, rewardPercent: 5 | 10) => {
    const normalized = normalizeReviewCouponCode(couponCode)
    if (!normalized) return
    setPendingReviewCoupon(normalized)
    setPendingReviewRewardPercent(rewardPercent)
    navigate('reserve')
  }, [navigate])

  const completeReservation = useCallback((reservation: Reservation) => {
    setPendingReviewCoupon('')
    setPendingReviewRewardPercent(null)
    setCompletedReservation(reservation)

  }, [])

  const isAdminPage = page === 'admin-login' || page === 'admin' || page === 'admin-reservations' || page === 'admin-classes' || page === 'admin-reviews'
  const isPrivatePage = isAdminPage || page === 'calendar'

  if (page === 'review') return <ReviewPage onOrderCake={orderCakeFromReview} />

  return (
    <>
      {!isPrivatePage && <DesktopBackground />}
      <div className={`app-shell${isPrivatePage ? ' admin-shell' : ''}`}>
      {!isAppwriteConfigured && (
        <div className="env-notice">Appwrite 환경변수가 없어서 로컬 데모 저장소로 실행 중입니다.</div>
      )}
      {!isPrivatePage && <AnnouncementTicker language={language} />}

      {page === 'home' && <HomePage navigate={navigate} settings={settings} onReserveProduct={reserveProduct} language={language} setLanguage={setLanguage} />}
      {page === 'classes' && <ClassesPage navigate={navigate} language={language} setLanguage={setLanguage} />}
      {page === 'reviews' && (
        <>
          <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
          <ReviewsArchive
            language={language}
            executor={functions}
            functionId={appwriteConfig.reviewApiFunctionId}
            functionEndpoint={appwriteConfig.publicEndpoint}
          />
        </>
      )}
      {page === 'class-reserve' && <ClassReservePage navigate={navigate} onComplete={setCompletedClassReservation} />}
      {page === 'class-complete' && <ClassCompletePage navigate={navigate} reservation={completedClassReservation} />}
      {page === 'reserve' && (
        <ReservePage
          navigate={navigate}
          settings={settings}
          initialProductId={reservationProductId}
          initialPromoCode={pendingReviewCoupon}
          initialRewardPercent={pendingReviewRewardPercent}
          onInitialPromoConsumed={() => setPendingReviewCoupon('')}
          reviewDemoMode={import.meta.env.DEV && import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          onComplete={completeReservation}
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
      {page === 'admin-reviews' && (
        <AdminReviewsPage
          navigate={navigate}
          demoEnabled={import.meta.env.DEV && import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          development={import.meta.env.DEV}
        />
      )}
      {page === 'calendar' && <ReadOnlyCalendarPage />}
      {!isPrivatePage && <AnalyticsConsentBanner language={language} />}
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
        <a className="brand-button" href="/" onClick={(event) => { event.preventDefault(); navigate('home') }}>
          Verygood Chocolate
        </a>
        <nav>
          <a className="kids-nav-button" href="/classes" onClick={(event) => { event.preventDefault(); navigate('classes') }}>
            {copy.kidsNav}
          </a>
          <a href="/lookup" rel="nofollow" onClick={(event) => { event.preventDefault(); navigate('lookup') }}>
            {copy.lookupNav}
          </a>
          <a href="/admin/login" rel="nofollow" onClick={(event) => { event.preventDefault(); navigate('admin-login') }}>
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

function ProductDetailRows({ reservation, language = 'ko' }: {
  reservation: Pick<Reservation, 'productId' | 'quantity' | 'cakeSize' | 'cacaoPercent' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount'>
  language?: Language
}) {
  const product = getProductById(reservation.productId)
  const productText = getProductText(product.id, language)
  const copy = cakeCopy(language)
  const showChocolate = usesReservationChocolateType(product.id, reservation.poundAddon)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    product.id,
    reservation.vanillaCreamCount,
    reservation.partyDecorationCount,
  )
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - cupcakeFinishCounts.vanillaCreamCount - cupcakeFinishCounts.partyDecorationCount

  return (
    <>
      <div>
        <dt>{copy.product}</dt>
        <dd>{productText.name}</dd>
      </div>
      {isFreshLemonCupcakeProduct(product.id) ? (
        <>
          <div>
            <dt>{language === 'ko' ? '구성' : 'Pack size'}</dt>
            <dd>{getFreshLemonCupcakePackSize(product.id)} {language === 'ko' ? '개' : 'pieces'}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
            <dd>{language === 'ko'
              ? `생레몬 제스트 아이싱 ${getLemonIcingCount(product.id, reservation.chocolateIcingCount)}개 / 다크 커버춰 초콜릿 ${normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount)}개`
              : `Fresh lemon zest icing ${getLemonIcingCount(product.id, reservation.chocolateIcingCount)} / Dark couverture chocolate ${normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount)}`}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>{copy.quantity}</dt>
          <dd>
            {reservation.quantity}
            {copy.quantityUnit}
          </dd>
        </div>
      )}
      {isCupcakeDozenProduct(product.id) && (
        <div>
          <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
          <dd>{language === 'ko'
            ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개`
            : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount} / Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</dd>
        </div>
      )}
      {(product.usesSizeOptions || isCheesecakeProduct(product.id)) && (
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

function isCheesecakeProduct(productId: ProductId) {
  return [
    'choco-basque-cheesecake',
    'pave-choco-basque-cheesecake',
    'eiffel-tower-basque-cheesecake',
  ].includes(productId)
}

function reservationCakeSizeText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesSizeOptions || isCheesecakeProduct(product.id) ? formatCakeSizeLabel(reservation.cakeSize) : '-'
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
  const homeReserveCta = language === 'ko' ? '지금 주문하기' : 'Order Now'
  const [activeHeroCake, setActiveHeroCake] = useState(1)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [heroDragX, setHeroDragX] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const heroCakes = [
    { image: basqueCheesecakeHeroImg, label: "Chocolatier's Basque", tagKey: 'mini', className: 'hero-cake-one' },
    { image: heroCake2Img, label: 'Pave Chocolate Cake', tagKey: 'first', className: 'hero-cake-two' },
    { image: heroCake3Img, label: 'Chocolate Pound Cake', tagKey: 'pound', className: 'hero-cake-three' },
    { image: freshLemonCupcakesHeroImg, label: 'Lemon Cake', tagKey: 'lemon', className: 'hero-cake-four' },
  ]

  useEffect(() => {
    if (heroPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intervalId = window.setInterval(() => {
      setActiveHeroCake((current) => (current + 1) % 4)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [heroPaused])
  const catalogCards = [
    {
      id: 'pave',
      productId: 'pave-cake' as ProductId,
      image: paveCakeCardImg,
      name: getProductText('pave-cake', language).name,
      description: getProductText('pave-cake', language).description,
      features: getProductFeatures('pave-cake', language),
      priceLabel: formatCurrency(PRODUCTS['pave-cake'].price),
      optionLabel: getProductText('pave-cake', language).priceNote,
    },
    {
      id: 'pound-cupcake',
      productId: 'pound-cake' as ProductId,
      image: poundCakeCardImg,
      name: language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes',
      description: language === 'ko'
        ? '파운드케이크를 기본으로 선택하고 10달러를 추가하면 컵케이크 1다스로 변경할 수 있어요.'
        : 'Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.',
      features: language === 'ko'
        ? ['파운드케이크 AUD 45', '컵케이크 1다스 +AUD 10', '기존 마감 옵션 선택 가능']
        : ['Pound cake AUD 45', 'Cupcakes · 1 dozen +AUD 10', 'Keep your choice of finish'],
      priceLabel: `${language === 'ko' ? 'AUD 45부터' : 'From AUD 45'}`,
      optionLabel: language === 'ko' ? '파운드 / 컵케이크와 마감 선택' : 'Choose pound or cupcakes, then a finish',
    },
    {
      id: 'cheesecake',
      productId: 'choco-basque-cheesecake' as ProductId,
      image: basqueCheesecakeCardImg,
      name: language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake",
      description: language === 'ko'
        ? '기본, 파베 초콜릿 on top, 에펠탑 초콜릿 마감 중에서 선택할 수 있는 15cm 치즈케이크예요.'
        : 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
      features: language === 'ko'
        ? ['글루텐 프리', '6 inch / 15cm 고정 사이즈', '기본 AUD 55', '파베 on top +AUD 10', '에펠탑 마감 +AUD 20']
        : ['Gluten-free', '6 inch / 15cm fixed size', 'Classic AUD 55', 'Pave chocolate on top +AUD 10', 'Eiffel Tower finish +AUD 20'],
      priceLabel: `${language === 'ko' ? 'AUD 55부터' : 'From AUD 55'}`,
      optionLabel: language === 'ko' ? '세 가지 마감 선택' : 'Three finishing options',
    },
    {
      id: 'fresh-lemon-cupcakes',
      productId: 'fresh-lemon-cupcakes-12' as ProductId,
      image: freshLemonCupcakesCardImg,
      name: language === 'ko' ? '레몬 케이크' : 'Lemon Cake',
      description: language === 'ko'
        ? '레몬 모양 케이크에 상큼한 레몬 크림을 채우고 꽃무늬 장식으로 마무리해요.'
        : 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
      features: language === 'ko'
        ? ['6, 8, 12, 16개 구성', '12개 · Most Popular', '기본 또는 스페셜 마감 선택']
        : ['Boxes of 6, 8, 12 or 16', '12 pieces · Most Popular', 'Choose basic or special finishing'],
      priceLabel: language === 'ko' ? 'AUD 36부터' : 'From AUD 36',
      optionLabel: language === 'ko' ? '구성 수량만 선택' : 'Choose a pack size',
    },
  ]

  const rotateHeroCake = useCallback((direction: 1 | -1) => {
    setActiveHeroCake((current) => (current + direction + heroCakes.length) % heroCakes.length)
  }, [heroCakes.length])

  function heroCakePosition(index: number) {
    const offset = (index - activeHeroCake + heroCakes.length) % heroCakes.length
    if (offset === 0) return 'center'
    if (offset === 1) return 'right'
    if (offset === heroCakes.length - 1) return 'left'
    return 'hidden'
  }

  function handleHeroPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setHeroPaused(true)
    setSwipeStartX(event.clientX)
    setHeroDragX(0)
  }

  function handleHeroPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    setHeroDragX(Math.max(-120, Math.min(120, deltaX)))
  }

  function handleHeroPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setSwipeStartX(null)
    setHeroDragX(0)
    setHeroPaused(false)
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
          <div className="billboard-word hero-display-word" aria-hidden="true">
            <span>gâteau</span>
            <span>au</span>
            <span>chocolat</span>
          </div>
          <div className="hero-copy">
            <h1 className="hero-title">{copy.homeTitle}</h1>
            <p className="hero-description">
              {language === 'ko' ? (
                <><strong>Very Good Chocolate</strong>이 만드는 소량 생산 케이크를 Melrose Park 픽업 예약으로 만나보세요.</>
              ) : (
                <>Small-batch cakes made by <strong>Very Good Chocolate</strong>,<br className="hero-description-break" /> available by pre-order for confirmed Melrose Park pick-up.</>
              )}
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => onReserveProduct(DEFAULT_PRODUCT_ID)}>
                {homeReserveCta}
              </button>
            </div>
          </div>
          <div
            className={`hero-image-wrap${swipeStartX !== null ? ' is-dragging' : ''}`}
            style={heroDragStyle}
            aria-label={copy.homeTitle}
            onPointerDown={handleHeroPointerDown}
            onPointerMove={handleHeroPointerMove}
            onPointerUp={handleHeroPointerUp}
            onPointerEnter={() => setHeroPaused(true)}
            onPointerLeave={() => setHeroPaused(false)}
            onFocusCapture={() => setHeroPaused(true)}
            onBlurCapture={() => setHeroPaused(false)}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              setSwipeStartX(null)
              setHeroDragX(0)
              setHeroPaused(false)
            }}
          >
            <div className="hero-cake-cluster" aria-hidden="true">
              {heroCakes.map((cake, index) => {
                const position = heroCakePosition(index)
                return (
                  <div
                    className={`hero-cake-slide${cake.className === 'hero-cake-four' ? ' hero-cake-slide-lemon' : ''}`}
                    data-position={position}
                    key={cake.label}
                  >
                    <img src={cake.image} alt="" className={`hero-cake ${cake.className}`} draggable="false" />
                    <span className={`hero-size-tag hero-size-tag-${cake.tagKey}`}>
                      {cake.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-previous"
              aria-label="Show previous cake"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => rotateHeroCake(-1)}
            >
              <ChevronLeft size={24} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-next"
              aria-label="Show next cake"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => rotateHeroCake(1)}
            >
              <ChevronRight size={24} strokeWidth={1.8} />
            </button>
            <div className="hero-carousel-dots" aria-label="Choose featured cake">
              {heroCakes.map((cake, index) => (
                <button
                  type="button"
                  className={index === activeHeroCake ? 'is-active' : ''}
                  key={cake.label}
                  aria-label={`Show ${cake.label}`}
                  aria-pressed={index === activeHeroCake}
                  onClick={() => setActiveHeroCake(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="content-section product-section">
          <h2>{copy.productSectionTitle}</h2>
          <div className="product-grid">
            {catalogCards.map((card) => (
              <article className="product-card" key={card.id}>
                <div className="product-image-wrap">
                  <img src={card.image} alt={card.name} />
                  {card.id === 'cheesecake' && (
                    <img
                      className="gluten-free-stamp"
                      src={glutenFreeStampImg}
                      alt={language === 'ko' ? '글루텐 프리' : 'Gluten-free'}
                    />
                  )}
                </div>
                <div>
                  <strong>{card.name}</strong>
                  <p>{card.description}</p>
                </div>
                <ul>
                  {card.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <dl>
                  <div>
                    <dt>{copy.price}</dt>
                    <dd>{card.priceLabel}</dd>
                  </div>
                  <div>
                    <dt>{copy.options}</dt>
                    <dd>{card.optionLabel}</dd>
                  </div>
                </dl>
                <button className="secondary-button full-width" type="button" onClick={() => onReserveProduct(card.productId)}>
                  {homeReserveCta}
                </button>
              </article>
            ))}
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

        <section className="content-section cake-information-section" aria-labelledby="sydney-cake-info-title">
          <p className="summary-kicker">{language === 'ko' ? '시드니에서 직접 제작' : 'Made in Sydney'}</p>
          <h2 id="sydney-cake-info-title">
            {language === 'ko' ? '예약 주문으로 준비하는 소량 제작 초콜릿 케이크' : 'Small-batch chocolate cakes for pre-order'}
          </h2>
          <div className="cake-information-grid">
            <article>
              <h3>{language === 'ko' ? '초콜릿이 중심인 레시피' : 'Chocolate-first recipes'}</h3>
              <p>{language === 'ko' ? '파베 초콜릿 케이크, 파운드케이크와 컵케이크, 두 가지 초코 바스크 치즈케이크 중 선택할 수 있어요. 확정된 주문에 맞춰 소량으로 준비합니다.' : 'Choose from pave chocolate cake, pound cake or cupcakes, and two chocolate Basque cheesecake finishes. Each order is made in a small batch.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? '원하는 옵션 선택' : 'Choose your finish'}</h3>
              <p>{language === 'ko' ? '케이크에 따라 사이즈, 다크 또는 밀크 초콜릿, 초콜릿 추가, 바닐라 크림 마감을 선택할 수 있어요.' : 'Available options vary by cake and include multiple sizes, dark or milk chocolate, extra chocolate, and vanilla cream finishes.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? 'Melrose Park 사전 약속 픽업' : 'Pre-arranged Melrose Park pick-up'}</h3>
              <p>{language === 'ko' ? '방문 매장 없이 운영하는 홈베이킹 서비스입니다. 신청 후 Jenny가 가능 여부, 결제 정보, 정확한 Melrose Park 전달 장소를 안내해 드려요.' : 'This is a home-baking service without a walk-in shop. Jenny confirms availability, payment details, and the exact Melrose Park handoff point after your request.'}</p>
            </article>
          </div>
        </section>

        <section className="content-section cake-faq-section" aria-labelledby="cake-faq-title">
          <h2 id="cake-faq-title">{language === 'ko' ? '시드니 케이크 주문 FAQ' : 'Sydney cake order FAQ'}</h2>
          <div className="cake-faq-list">
            <details>
              <summary>{language === 'ko' ? '케이크는 어디서 픽업하나요?' : 'Where do I pick up my cake?'}</summary>
              <p>{language === 'ko' ? 'Sydney Melrose Park에서 사전 약속 픽업으로 진행됩니다. 방문 매장은 없으며 주문 확정 후 Jenny가 정확한 전달 방법을 안내해 드려요.' : 'Pick-up is arranged in Melrose Park, Sydney. There is no walk-in shop, so Jenny sends the exact meeting details after confirming your order.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '신청서를 보내면 바로 주문이 확정되나요?' : 'Is submitting the form a confirmed order?'}</summary>
              <p>{language === 'ko' ? '아니요. Jenny가 먼저 가능 여부를 확인하고 결제 정보를 보내드립니다. 입금이 확인되면 주문이 최종 확정됩니다.' : 'No. Jenny first checks availability and sends payment details. Your order is confirmed after payment is received.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '어떤 초콜릿 케이크를 주문할 수 있나요?' : 'Which chocolate cakes can I order?'}</summary>
              <p>{language === 'ko' ? '파베 초콜릿 케이크, 파운드케이크 또는 컵케이크 1다스, 초코 바스크와 파베초코 바스크 치즈케이크를 신청할 수 있습니다.' : 'You can request pave chocolate cake, pound cake or a dozen cupcakes, and chocolate Basque cheesecake with either a classic or pave chocolate finish.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '시드니 배송이나 방문 구매가 가능한가요?' : 'Do you offer Sydney delivery or walk-in sales?'}</summary>
              <p>{language === 'ko' ? '현재는 제공하지 않습니다. Melrose Park 사전 약속 픽업 주문만 받고 있습니다.' : 'Not currently. Orders are made for pre-arranged pick-up in Melrose Park only.'}</p>
            </details>
          </div>
        </section>

        <PublicReviewsSection
          language={language}
          executor={functions}
          functionId={appwriteConfig.reviewApiFunctionId}
          functionEndpoint={appwriteConfig.publicEndpoint}
          onViewAll={() => navigate('reviews')}
          demoEnabled={import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          development={import.meta.env.DEV}
        />

        {marketConfig.market === 'AU' && <PickupLocationCard language={language} />}
      </main>
      <button className="sticky-cta" type="button" onClick={() => onReserveProduct(DEFAULT_PRODUCT_ID)}>
        {homeReserveCta}
      </button>
    </>
  )
}

function ClassesPage({ navigate, language, setLanguage }: { navigate: (page: Page) => void; language: Language; setLanguage: (language: Language) => void }) {
  const essentials = [
    ['Kindy–Year 6 courses', 'Age-aware private sessions for primary school children'],
    ['Professional-style course', 'Real studio guidance from planning to finishing'],
    ['Two course choices', 'Make a 15cm chocolate cake or 4 cupcakes plus chocolate'],
    ['90-minute class', 'A focused hands-on session with Jenny'],
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
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="kids-class-page">
        <section className="kids-class-hero" aria-labelledby="kids-class-title">
          <div className="kids-hero-copy reveal-up">
            <h1 id="kids-class-title">Kids Professional Cake Course</h1>
            <p className="kids-location">Melrose Park, Sydney</p>
            <p className="kids-hero-text">
              Two private, hands-on choices: make a 15cm chocolate cake, or make 4 cupcakes plus chocolate with Jenny's guidance.
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

        <section className="kids-section reveal-up" aria-labelledby="course-choices-title">
          <h2 id="course-choices-title">Choose a Course</h2>
          <div className="kids-step-grid">
            <article className="kids-step-card">
              <strong>Chocolate Cake Course</strong>
              <p>Plan, build, and finish one 15cm chocolate cake to take home.</p>
            </article>
            <article className="kids-step-card">
              <strong>4 Cupcakes & Chocolate Class</strong>
              <p>Make four cupcakes and enjoy a guided hands-on chocolate-making activity.</p>
            </article>
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
            <strong>{formatCurrency(99)} / Kindy–Year 2</strong>
            <p className="kids-price-line">{formatCurrency(109)} / Year 3–6</p>
            <p className="kids-price-line">{formatCurrency(198)} / two children</p>
            <p className="kids-small-note">Same pricing for both course choices · 90 minutes</p>
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

        <PublicReviewsSection
          language={language}
          executor={functions}
          functionId={appwriteConfig.reviewApiFunctionId}
          functionEndpoint={appwriteConfig.publicEndpoint}
          onViewAll={() => navigate('reviews')}
          demoEnabled={import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          development={import.meta.env.DEV}
        />

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
  const [requestId] = useState(generateRequestId)
  const [form, setForm] = useState<{
    classDate: string
    classTime: string
    classType: ClassType
    ageGroup: ClassAgeGroup
    partySize: ClassPartySize
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
    privacyConsent: boolean
    website: string
  }>({
    classDate: addDaysInputValue(4),
    classTime: CLASS_SESSION_TIMES[0],
    classType: 'school-holiday-private-cake-class',
    ageGroup: 'kindy-year-2',
    partySize: 1,
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
    privacyConsent: false,
    website: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookedClassSlots, setBookedClassSlots] = useState<ClassBookedSlot[]>([])
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(false)
  const today = useTodayInputValue()
  const bookingType = getClassBookingType(form.ageGroup, form.partySize)
  const price = getClassBookingPrice(bookingType)
  const availableSessionTimes = getAvailableClassSessionTimes(form.classDate, bookedClassSlots)
  const selectedDateBooked = isClassDateBooked(form.classDate, bookedClassSlots)

  useEffect(() => {
    listClassBookedSlots()
      .then((classSlots) => {
        setBookedClassSlots(classSlots)
        setAvailabilityError(false)
      })
      .catch(() => {
        setBookedClassSlots([])
        setAvailabilityError(true)
      })
      .finally(() => setAvailabilityLoaded(true))
  }, [])

  async function submitClassReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.parentPhone)
    if (!form.parentName.trim() || !form.childName.trim()) return setError('Please enter parent and child name.')
    if (!form.schoolYear.trim()) return setError('Please enter Child 1 school year.')
    if (!isValidPhone(phone)) return setError(`Please check the mobile number. ${marketConfig.copy.phoneHelp}`)
    if (!form.parentEmail.includes('@')) return setError('Please enter a valid email address.')
    if (!form.classDate || form.classDate < today) return setError('Please choose a future class date.')
    if (selectedDateBooked) return setError('This date is already booked. Please choose another date.')
    if (!availableSessionTimes.includes(form.classTime as (typeof CLASS_SESSION_TIMES)[number])) return setError('Please choose an available class time.')
    if (form.partySize === 2 && (!form.secondChildName.trim() || !form.secondChildSchoolYear.trim())) return setError('Please enter Child 2 name and school year.')
    if (!form.emergencyContact.trim() || !form.pickupPerson.trim()) return setError('Emergency contact and pick-up person are required.')
    if (!form.parentConsent || !form.cancellationAgreement || !form.privacyConsent) return setError('Parent, privacy, and booking agreements are required.')
    setSubmitting(true)
    try {
      const reservation = await createClassReservation({ ...form, bookingType, parentPhone: phone, requestId })
      trackEvent('class_booking_request', {
        booking_type: bookingType,
        class_type: form.classType,
        age_group: form.ageGroup,
        value: price,
        currency: 'AUD',
      })
      onComplete(reservation)
      navigate('class-complete')
    } catch (submitError) {
      if (submitError instanceof Error && (submitError.message === 'CLASS_SESSION_UNAVAILABLE' || submitError.message === 'CLASS_DATE_UNAVAILABLE')) {
        setError('This session time is already booked. Please choose another time or date.')
      } else {
        setError('An error occurred while submitting your class request. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader navigate={navigate} />
      <main className="class-reserve-page">
        <form className="class-reserve-form" onSubmit={submitClassReservation}>
          <label className="website-field" aria-hidden="true">
            Leave this field blank
            <input name="website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>
          <header className="class-reserve-title-block">
            <button className="class-back-button" type="button" onClick={() => navigate('classes')}>
              <ArrowLeft size={14} /> Back to classes
            </button>
            <h1>Request a Kids Course</h1>
            <p>Please fill out the details below. Jenny will confirm availability and send full payment details.</p>
          </header>

          <section className="class-form-section" aria-labelledby="course-type-title">
            <h2 id="course-type-title">1. Choose a Course</h2>
            <div className="class-booking-grid class-two-option-grid">
              {(['school-holiday-private-cake-class', 'cupcake-chocolate-class'] as const).map((classType) => (
                <label className="class-option-card" key={classType}>
                  <input
                    type="radio"
                    name="classType"
                    checked={form.classType === classType}
                    onChange={() => setForm({ ...form, classType })}
                  />
                  <span>{getClassTypeLabel(classType)}</span>
                  <strong>{classType === 'cupcake-chocolate-class' ? '4 cupcakes + chocolate making' : 'One 15cm chocolate cake'}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="class-form-section" aria-labelledby="school-group-title">
            <h2 id="school-group-title">2. Choose School Year Group</h2>
            <div className="class-booking-grid class-two-option-grid">
              {(['kindy-year-2', 'year-3-6'] as const).map((ageGroup) => (
                <label className="class-option-card" key={ageGroup}>
                  <input
                    type="radio"
                    name="classAgeGroup"
                    checked={form.ageGroup === ageGroup}
                    onChange={() => setForm({ ...form, ageGroup })}
                  />
                  <span>{ageGroup === 'kindy-year-2' ? 'Kindy–Year 2' : 'Year 3–6'}</span>
                  <strong>{formatCurrency(getClassBookingPrice(getClassBookingType(ageGroup, 1)))}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="class-form-section" aria-labelledby="children-count-title">
            <h2 id="children-count-title">3. Number of Children</h2>
            <div className="class-booking-grid class-two-option-grid">
              {([1, 2] as const).map((partySize) => (
                <label className="class-option-card" key={partySize}>
                  <input
                    type="radio"
                    name="classPartySize"
                    checked={form.partySize === partySize}
                    onChange={() => setForm({ ...form, partySize })}
                  />
                  <span>{partySize === 1 ? '1 child' : '2 children / siblings / friends'}</span>
                  <strong>{formatCurrency(getClassBookingPrice(getClassBookingType(form.ageGroup, partySize)))}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="class-form-section class-form-section-tight" aria-labelledby="session-detail-title">
            <h2 id="session-detail-title">4. Preferred Session · 90 minutes</h2>
            <label className="class-field">
              <span>Preferred Date</span>
              <input
                type="date"
                min={today}
                value={form.classDate}
                onChange={(event) => {
                  const nextDate = event.target.value
                  const nextAvailableTimes = getAvailableClassSessionTimes(nextDate, bookedClassSlots)
                  setForm({ ...form, classDate: nextDate, classTime: nextAvailableTimes[0] || CLASS_SESSION_TIMES[0] })
                }}
              />
            </label>
            <fieldset className="class-time-fieldset">
              <legend>Preferred Session Time</legend>
              <div className="class-time-grid">
                {availableSessionTimes.length > 0 ? availableSessionTimes.map((time) => (
                  <label className="class-time-option" key={time}>
                    <input
                      type="radio"
                      name="classTime"
                      checked={form.classTime === time}
                      onChange={() => setForm({ ...form, classTime: time })}
                    />
                    <span>{time}</span>
                  </label>
                )) : (
                  <p className="class-availability-note unavailable">This date is already booked. Please choose another date.</p>
                )}
              </div>
              {availabilityLoaded && availabilityError && <p className="class-availability-note unavailable">Availability could not be loaded. Jenny will double-check this session before confirming.</p>}
              {availabilityLoaded && !availabilityError && !selectedDateBooked && <p className="class-availability-note">Available: {availableSessionTimes.join(' / ')}</p>}
            </fieldset>
          </section>

          <section className="class-form-section" aria-labelledby="guardian-detail-title">
            <h2 id="guardian-detail-title">5. Parent / Guardian Details</h2>
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
            <h2 id="child-detail-title">6. Child Details</h2>
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
            {form.partySize === 2 && (
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
            <h2 id="safety-title">7. Allergy & Safety Declarations</h2>
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
            <h2 id="consent-title">8. Consent & Confirmation</h2>
            <label className="class-check-row">
              <input type="checkbox" checked={form.parentConsent} onChange={(event) => setForm({ ...form, parentConsent: event.target.checked })} />
              <span>I am the parent/guardian and consent to my child joining this class.</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.cancellationAgreement} onChange={(event) => setForm({ ...form, cancellationAgreement: event.target.checked })} />
              <span>I understand my booking is completed only after availability is confirmed and full payment is received.</span>
            </label>
            <label className="class-check-row">
              <input type="checkbox" checked={form.privacyConsent} onChange={(event) => setForm({ ...form, privacyConsent: event.target.checked })} />
              <span>I agree that booking, contact, allergy and emergency details may be stored in Appwrite for class administration and sent through Resend for operator email notifications.</span>
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
              <div><dt>Course</dt><dd>{getClassTypeLabel(form.classType)}</dd></div>
              <div><dt>School group</dt><dd>{form.ageGroup === 'kindy-year-2' ? 'Kindy–Year 2' : 'Year 3–6'}</dd></div>
              <div><dt>Children</dt><dd>{form.partySize}</dd></div>
              <div><dt>Total</dt><dd>{formatCurrency(price)}</dd></div>
              <div><dt>Payment</dt><dd>Full payment required</dd></div>
            </dl>
            <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={price} language="en" />
            <p className="class-submit-note">Use this account after Jenny confirms the session is available.</p>
          </aside>

          {error && <p className="error-text class-error-text">{error}</p>}
          <button className="class-submit-button" type="submit" disabled={submitting || selectedDateBooked}>{submitting ? 'Submitting...' : selectedDateBooked ? 'Date unavailable' : 'Request booking'}</button>
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
            <strong>Your {reservation ? getClassTypeLabel(reservation.classType) : 'kids course'} request has been sent.</strong>
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
  initialPromoCode,
  initialRewardPercent,
  onInitialPromoConsumed,
  reviewDemoMode,
  onComplete,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  settings: StoreSettings
  initialProductId: ProductId
  initialPromoCode: string
  initialRewardPercent: 5 | 10 | null
  onInitialPromoConsumed: () => void
  reviewDemoMode: boolean
  onComplete: (reservation: Reservation) => void
  language: Language
  setLanguage: (language: Language) => void
}) {
  const [requestId] = useState(generateRequestId)
  const copy = cakeCopy(language)
  const [form, setForm] = useState({
    productId: initialProductId,
    cacaoPercent: '기본' as CacaoPercent,
    cakeSize: DEFAULT_CAKE_SIZE as CakeSize,
    chocolateType: DEFAULT_CHOCOLATE_TYPE as ChocolateType,
    poundAddon: DEFAULT_POUND_ADDON as PoundAddon,
    chocolateIcingCount: 0,
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
    pickupDate: todayInputValue(),
    pickupTime: '',
    quantity: 1,
    customerName: '',
    customerPhone: '',
    requestNote: '',
    promoCode: initialPromoCode,
    privacy: false,
    website: '',
  })
  const [reviewRewardHandoff] = useState(() => ({
    couponCode: normalizeReviewCouponCode(initialPromoCode),
    rewardPercent: initialRewardPercent,
  }))
  const currentReviewCoupon = normalizeReviewCouponCode(form.promoCode)
  const knownReviewRewardPercent = currentReviewCoupon && currentReviewCoupon === reviewRewardHandoff.couponCode
    ? reviewRewardHandoff.rewardPercent
    : null
  const [showCakeSelector, setShowCakeSelector] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pickupAvailability, setPickupAvailability] = useState<{
    dataDate: string
    loading: boolean
    error: boolean
    bookedSlots: ClassBookedSlot[]
    pickupOpenings: CakePickupOpening[]
  }>({
    dataDate: '',
    loading: true,
    error: false,
    bookedSlots: [],
    pickupOpenings: [],
  })
  const [pickupAvailabilityRefetchKey, setPickupAvailabilityRefetchKey] = useState(0)

  useEffect(() => {
    if (initialPromoCode) onInitialPromoConsumed()
  }, [initialPromoCode, onInitialPromoConsumed])
  const now = useCurrentTime()
  const today = dateInputValue(now)
  const todayTimes = useMemo(() => customerTimeOptionsForDate(today, settings, now), [today, settings, now])
  const minPickupDate = todayTimes.length > 0 ? today : addDaysToInputValue(today, 1)
  const pickupDate = form.pickupDate && form.pickupDate >= minPickupDate ? form.pickupDate : minPickupDate
  const baseTimes = useMemo(() => customerTimeOptionsForDate(pickupDate, settings, now), [pickupDate, settings, now])
  const pickupAvailabilityIsCurrent = pickupAvailability.dataDate === pickupDate
  const pickupAvailabilityLoading = pickupAvailability.loading || !pickupAvailabilityIsCurrent
  const pickupAvailabilityError = pickupAvailabilityIsCurrent && pickupAvailability.error
  const times = useMemo(() => {
    if (pickupAvailabilityLoading || pickupAvailabilityError) return []
    return filterCakePickupTimesForClass(
      pickupDate,
      baseTimes,
      pickupAvailability.bookedSlots,
      pickupAvailability.pickupOpenings,
    )
  }, [
    baseTimes,
    pickupAvailability.bookedSlots,
    pickupAvailability.pickupOpenings,
    pickupAvailabilityError,
    pickupAvailabilityLoading,
    pickupDate,
  ])
  const selectedPickupTime = times.includes(form.pickupTime) ? form.pickupTime : times[0] || ''

  const refetchPickupAvailability = useCallback(() => {
    setPickupAvailability({
      dataDate: '',
      loading: true,
      error: false,
      bookedSlots: [],
      pickupOpenings: [],
    })
    setPickupAvailabilityRefetchKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listClassBookedSlots(pickupDate),
      listCakePickupOpenings(pickupDate),
    ])
      .then(([bookedSlots, pickupOpenings]) => {
        if (cancelled) return
        setPickupAvailability({
          dataDate: pickupDate,
          loading: false,
          error: false,
          bookedSlots,
          pickupOpenings,
        })
      })
      .catch(() => {
        if (cancelled) return
        setPickupAvailability({
          dataDate: pickupDate,
          loading: false,
          error: true,
          bookedSlots: [],
          pickupOpenings: [],
        })
      })

    return () => {
      cancelled = true
    }
  }, [pickupAvailabilityRefetchKey, pickupDate])

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
    if (pickupAvailabilityLoading || pickupAvailabilityError) {
      setError(copy.pickupAvailabilityError)
      return
    }
    if (!selectedPickupTime) {
      setError(copy.errors.pickupTime)
      return
    }
    if (!isPickupTimeAllowed(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupLeadTime)
      return
    }
    if (isCakePickupBlockedByClass(
      pickupDate,
      selectedPickupTime,
      pickupAvailability.bookedSlots,
      pickupAvailability.pickupOpenings,
    )) {
      setError(copy.errors.pickupTimeUnavailable)
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
    const submittedPromo = getPromoEntryState(form.productId, form.promoCode, undefined, knownReviewRewardPercent)
    if (submittedPromo.kind === 'invalid') {
      setError(promoErrorMessage('PROMO_CODE_INVALID', language) || copy.errors.submit)
      return
    }

    setSubmitting(true)
    try {
      const reservationInput = {
        customerName: form.customerName,
        customerPhone: phone,
        productId: form.productId,
        cakeSize: form.cakeSize,
        chocolateType: form.chocolateType,
        poundAddon: form.poundAddon,
        chocolateIcingCount: form.chocolateIcingCount,
        vanillaCreamCount: form.vanillaCreamCount,
        partyDecorationCount: form.partyDecorationCount,
        quantity: form.quantity,
        pickupDate,
        pickupTime: selectedPickupTime,
        cacaoPercent: form.cacaoPercent,
        requestNote: form.requestNote,
        promoCode: submittedPromo.normalizedCode,
        privacyConsent: form.privacy,
        requestId,
        website: form.website,
      }
      const demoPricing = reviewDemoMode ? getDemoReviewPricingAudit(currentPrice, submittedPromo) : null
      const reservation: Reservation = demoPricing
        ? {
            id: 'demo-reservation',
            reservationNumber: 'VG-C-AU-DEMO',
            customerName: form.customerName.trim(),
            customerPhone: phone,
            productId: form.productId,
            cakeSize: form.cakeSize,
            chocolateType: form.chocolateType,
            poundAddon: form.poundAddon,
            chocolateIcingCount: form.chocolateIcingCount,
            vanillaCreamCount: form.vanillaCreamCount,
            partyDecorationCount: form.partyDecorationCount,
            quantity: form.quantity,
            pickupDate,
            pickupTime: selectedPickupTime,
            cacaoPercent: form.cacaoPercent,
            requestNote: form.requestNote,
            status: '예약신청',
            paymentStatus: '입금대기',
            totalPrice: demoPricing.totalPriceCents / 100,
            ...demoPricing,
            promotionKind: promoEntry.normalizedCode.startsWith('JENNIE') ? 'manual-coupon' : 'review-reward',
            adminMemo: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : await createReservation(reservationInput)
      trackEvent('cake_booking_request', {
        product_id: form.productId,
        quantity: form.quantity,
        value: reservation.totalPrice,
        currency: 'AUD',
      })
      setForm((current) => ({ ...current, promoCode: '' }))
      onComplete(reservation)
      navigate('complete')
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message === PICKUP_TIME_CLASS_CONFLICT_ERROR) {
        setError(copy.errors.pickupTimeUnavailable)
        refetchPickupAvailability()
      } else if (submitError instanceof Error && submitError.message === PICKUP_TIME_TOO_SOON_ERROR) {
        setError(copy.errors.pickupLeadTime)
      } else {
        setError(submitError instanceof Error
          ? promoErrorMessage(submitError.message, language) || copy.errors.submit
          : copy.errors.submit)
      }
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
      : isCheesecakeProduct(selectedProduct.id)
        ? basqueCheesecakeCardImg
        : isFreshLemonCupcakeProduct(selectedProduct.id)
          ? freshLemonCupcakesCardImg
          : paveCakeCardImg
  const priceOptions = {
    cacaoPercent: form.cacaoPercent,
    cakeSize: form.cakeSize,
    chocolateType: form.chocolateType,
    poundAddon: form.poundAddon,
    chocolateIcingCount: form.chocolateIcingCount,
    vanillaCreamCount: form.vanillaCreamCount,
    partyDecorationCount: form.partyDecorationCount,
  }
  const unitPrice = getReservationUnitPrice(selectedProduct.id, priceOptions)
  const currentPrice = getReservationPrice(selectedProduct.id, priceOptions, form.quantity)
  const promoEntry = getPromoEntryState(selectedProduct.id, form.promoCode, undefined, knownReviewRewardPercent)
  const isManualCouponPending = promoEntry.kind === 'review-pending' && promoEntry.normalizedCode.startsWith('JENNIE')
  const isPromoApplied = promoEntry.kind === 'static-valid' || promoEntry.kind === 'review-pending'
  const promoPriceDisplay = getPromoPriceDisplay(currentPrice, promoEntry)
  const promoPreviewPrice = promoPriceDisplay.estimatedPrice ?? promoPriceDisplay.finalPrice
  const promoDiscountAmount = Math.max(0, currentPrice - promoPreviewPrice)
  const lemonPackSize = getFreshLemonCupcakePackSize(selectedProduct.id) || 0
  const chocolateIcingCount = normalizeChocolateIcingCount(selectedProduct.id, form.chocolateIcingCount)
  const lemonIcingCount = getLemonIcingCount(selectedProduct.id, chocolateIcingCount)
  const chocolateIcingSurcharge = getChocolateIcingSurcharge(selectedProduct.id, chocolateIcingCount)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    selectedProduct.id,
    form.vanillaCreamCount,
    form.partyDecorationCount,
  )
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - cupcakeFinishCounts.vanillaCreamCount - cupcakeFinishCounts.partyDecorationCount
  const cupcakeFinishSurcharge = getCupcakeFinishSurcharge(
    selectedProduct.id,
    cupcakeFinishCounts.vanillaCreamCount,
    cupcakeFinishCounts.partyDecorationCount,
  )
  const promoHint = isPromoEligibleProduct(selectedProduct.id)
    ? isFreshLemonCupcakeProduct(selectedProduct.id)
      ? language === 'ko' ? 'Lemoni · 대소문자 구분 없음 · 7월 16일까지 유효' : 'Lemoni · Not case-sensitive · Valid through 16 July'
      : language === 'ko' ? 'Chocolate · 대소문자 구분 없음 · 7월 15일까지 유효' : 'Chocolate · Not case-sensitive · Valid through 15 July'
    : copy.promoHint
  const showChocolateTypeOptions = usesReservationChocolateType(selectedProduct.id, form.poundAddon)
  const selectedProductGroup = PRODUCT_GROUPS.find((group) => group.productIds.includes(selectedProduct.id)) || PRODUCT_GROUPS[0]
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
      chocolateIcingCount: normalizeChocolateIcingCount(productId, form.chocolateIcingCount),
      ...normalizeCupcakeFinishCounts(productId, form.vanillaCreamCount, form.partyDecorationCount),
      quantity: isFreshLemonCupcakeProduct(productId) ? 1 : form.quantity,
    })
  }

  function selectChocolateIcingCount(value: number) {
    setForm({
      ...form,
      chocolateIcingCount: normalizeChocolateIcingCount(form.productId, value),
    })
  }

  function selectCupcakeFinishCount(kind: 'vanilla' | 'party', value: number) {
    const counts = normalizeCupcakeFinishCounts(
      form.productId,
      kind === 'vanilla' ? value : form.vanillaCreamCount,
      kind === 'party' ? value : form.partyDecorationCount,
    )
    setForm({ ...form, ...counts })
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
                  {promoEntry.kind === 'static-valid' ? (
                    <span className="promo-price-summary">
                      <span className="original-price">{formatCurrency(currentPrice)}</span>
                      <strong>{formatCurrency(promoPriceDisplay.finalPrice)}</strong>
                    </span>
                  ) : (
                    <>
                      {formatCurrency(promoPriceDisplay.finalPrice)}
                      {promoPriceDisplay.estimatedPrice !== null && (
                        <small className="promo-estimate-summary">
                          {language === 'ko'
                            ? `서버 확인 후 예상 ${formatCurrency(promoPriceDisplay.estimatedPrice)}`
                            : `Estimated ${formatCurrency(promoPriceDisplay.estimatedPrice)} after server validation`}
                        </small>
                      )}
                    </>
                  )}
                </dd>
              </div>
              {isFreshLemonCupcakeProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '구성' : 'Pack size'}</dt>
                  <dd>{getFreshLemonCupcakePackSize(selectedProduct.id)} {language === 'ko' ? '개' : 'pieces'}</dd>
                </div>
              )}
              {isFreshLemonCupcakeProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
                  <dd>{language === 'ko'
                    ? `생레몬 제스트 아이싱 ${lemonIcingCount}개 / 다크 커버춰 초콜릿 ${chocolateIcingCount}개`
                    : `Fresh lemon zest icing ${lemonIcingCount} / Dark couverture chocolate ${chocolateIcingCount}`}</dd>
                </div>
              )}
              {isCupcakeDozenProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
                  <dd>{language === 'ko'
                    ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개`
                    : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount} / Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</dd>
                </div>
              )}
              {!isFreshLemonCupcakeProduct(selectedProduct.id) && (
                <div>
                  <dt>{labels.quantity}</dt>
                  <dd>
                    {form.quantity}
                    {copy.quantityUnit}
                  </dd>
                </div>
              )}
              {(selectedProduct.usesSizeOptions || isCheesecakeProduct(selectedProduct.id)) && (
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
          <label className="website-field" aria-hidden="true">
            Leave this field blank
            <input name="website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>
            {showCakeSelector && (
              <fieldset className="cake-selector-fieldset">
                <legend>{labels.cakeSelect}</legend>
                <div className="product-choice-list">
                  {PRODUCT_GROUPS.map((group) => {
                    const isSelected = group.id === selectedProductGroup.id
                    const groupName = group.id === 'pave'
                      ? getProductText('pave-cake', language).name
                      : group.id === 'pound-cupcake'
                        ? language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes'
                        : group.id === 'cheesecake'
                          ? language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake"
                          : language === 'ko' ? '레몬 케이크' : 'Lemon Cake'
                    const groupImage = group.id === 'pave'
                      ? paveCakeCardImg
                      : group.id === 'pound-cupcake'
                        ? poundCakeCardImg
                        : group.id === 'cheesecake' ? basqueCheesecakeCardImg : freshLemonCupcakesCardImg
                    const groupPrice = group.id === 'pave'
                      ? formatCurrency(75)
                      : group.id === 'pound-cupcake'
                        ? 'From AUD 45'
                        : group.id === 'cheesecake' ? 'From AUD 55' : 'From AUD 36'
                    return (
                      <label
                        className={`product-choice-card${isSelected ? ' is-selected' : ''}`}
                        key={group.id}
                        onClick={() => selectProduct(group.defaultProductId)}
                      >
                        <input
                          type="radio"
                          name="productGroup"
                          checked={isSelected}
                          onChange={() => selectProduct(group.defaultProductId)}
                        />
                        <span className="product-choice-thumb" aria-hidden="true">
                          <img src={groupImage} alt="" />
                        </span>
                        <span className="product-choice-copy">
                          <span className="product-choice-topline">
                            <strong>{groupName}</strong>
                            {isSelected && <span className="selected-cake-badge">{labels.selectedCake}</span>}
                          </span>
                          <span>{groupPrice}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {selectedProductGroup.productIds.length > 1 && (
              <fieldset>
                <legend>{selectedProductGroup.id === 'fresh-lemon-cupcakes'
                  ? language === 'ko' ? '구성 선택' : 'Choose pack size'
                  : language === 'ko' ? '종류 선택' : 'Choose type'}</legend>
                <div className="choice-list">
                  {selectedProductGroup.productIds.map((productId) => {
                    const optionProduct = getProductById(productId)
                    const optionText = getProductText(productId, language)
                    const isLemonPack = isFreshLemonCupcakeProduct(productId)
                    const packSize = getFreshLemonCupcakePackSize(productId)
                    const extraFromBase = optionProduct.price - getProductById(selectedProductGroup.defaultProductId).price
                    return (
                      <label className="choice-item" key={productId}>
                        <input
                          type="radio"
                          name="productType"
                          checked={form.productId === productId}
                          onChange={() => selectProduct(productId)}
                        />
                        <span className="choice-copy">
                          <strong>
                            {isLemonPack
                              ? `${packSize} ${language === 'ko' ? '개' : 'pieces'} · ${formatCurrency(optionProduct.price)}`
                              : `${optionText.name} · ${formatCurrency(optionProduct.price)}${extraFromBase > 0 ? ` (+${formatCurrency(extraFromBase)})` : ''}`}
                            {productId === 'fresh-lemon-cupcakes-12' && <span className="pack-choice-badge">Most Popular</span>}
                          </strong>
                          <span>{isLemonPack
                            ? language === 'ko' ? '레몬 크림과 꽃무늬 장식 포함' : 'Lemon cream and floral decoration included'
                            : optionText.priceNote}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {isFreshLemonCupcakeProduct(selectedProduct.id) && (
              <fieldset className="icing-mix-fieldset">
                <legend>{language === 'ko' ? '마감 구성 선택' : 'Choose finishing'}</legend>
                <p className="field-help">
                  {language === 'ko'
                    ? '기본 마감은 생레몬 제스트 아이싱이며, 스페셜 다크 커버춰 초콜릿은 개당 AUD 0.50이 추가돼요.'
                    : 'Basic finishing: Fresh lemon zest icing. Special finishing: Dark couverture chocolate (+AUD 0.50 per piece).'}
                </p>
                <div className="icing-mix-summary" aria-live="polite">
                  <div><span>{language === 'ko' ? '기본 · 생레몬 제스트 아이싱' : 'Basic · Fresh lemon zest icing'}</span><strong>{lemonIcingCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '스페셜 · 다크 커버춰 초콜릿' : 'Special · Dark couverture chocolate'}</span><strong>{chocolateIcingCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                </div>
                <div className="icing-count-stepper">
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '다크 커버춰 초콜릿 한 개 줄이기' : 'Remove one dark couverture chocolate finishing'}
                    disabled={chocolateIcingCount === 0}
                    onClick={() => selectChocolateIcingCount(chocolateIcingCount - 1)}
                  >−</button>
                  <output>
                    <strong>{language === 'ko' ? `스페셜 ${chocolateIcingCount}개` : `${chocolateIcingCount} special`}</strong>
                    <span>+{formatCurrency(chocolateIcingSurcharge)}</span>
                  </output>
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '다크 커버춰 초콜릿 한 개 늘리기' : 'Add one dark couverture chocolate finishing'}
                    disabled={chocolateIcingCount === lemonPackSize}
                    onClick={() => selectChocolateIcingCount(chocolateIcingCount + 1)}
                  >+</button>
                </div>
                <div className="icing-quick-choices">
                  <button type="button" className={chocolateIcingCount === 0 ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(0)}>
                    {language === 'ko' ? '전부 기본' : 'All basic'}
                  </button>
                  <button type="button" className={chocolateIcingCount === lemonPackSize / 2 ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(lemonPackSize / 2)}>
                    {language === 'ko' ? '반반' : 'Half & half'}
                  </button>
                  <button type="button" className={chocolateIcingCount === lemonPackSize ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(lemonPackSize)}>
                    {language === 'ko' ? '전부 스페셜' : 'All special'}
                  </button>
                </div>
              </fieldset>
            )}

            {isCupcakeDozenProduct(selectedProduct.id) && (
              <fieldset className="icing-mix-fieldset">
                <legend>{language === 'ko' ? '컵케이크 마감 선택' : 'Choose cupcake finishing'}</legend>
                <p className="field-help">
                  {language === 'ko'
                    ? '기본 마감은 무료예요. 바닐라 크림은 개당 AUD 0.50, 파티용 데코는 개당 AUD 1.00이 추가돼요.'
                    : 'Basic finishing is included. Vanilla cream is +AUD 0.50 each and party decoration is +AUD 1.00 each.'}
                </p>
                <div className="icing-mix-summary" aria-live="polite">
                  <div><span>{language === 'ko' ? '기본 마감' : 'Basic finishing'}</span><strong>{basicCupcakeCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '바닐라 크림' : 'Vanilla cream'}</span><strong>{cupcakeFinishCounts.vanillaCreamCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '파티용 데코' : 'Party decoration'}</span><strong>{cupcakeFinishCounts.partyDecorationCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                </div>
                <div className="icing-count-stepper">
                  <button type="button" aria-label={language === 'ko' ? '바닐라 크림 한 개 줄이기' : 'Remove one vanilla cream finish'} disabled={cupcakeFinishCounts.vanillaCreamCount === 0} onClick={() => selectCupcakeFinishCount('vanilla', cupcakeFinishCounts.vanillaCreamCount - 1)}>−</button>
                  <output><strong>{language === 'ko' ? `바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개` : `Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount}`}</strong><span>+{formatCurrency(cupcakeFinishCounts.vanillaCreamCount * 0.5)}</span></output>
                  <button type="button" aria-label={language === 'ko' ? '바닐라 크림 한 개 늘리기' : 'Add one vanilla cream finish'} disabled={basicCupcakeCount === 0} onClick={() => selectCupcakeFinishCount('vanilla', cupcakeFinishCounts.vanillaCreamCount + 1)}>+</button>
                </div>
                <div className="icing-count-stepper">
                  <button type="button" aria-label={language === 'ko' ? '파티용 데코 한 개 줄이기' : 'Remove one party decoration'} disabled={cupcakeFinishCounts.partyDecorationCount === 0} onClick={() => selectCupcakeFinishCount('party', cupcakeFinishCounts.partyDecorationCount - 1)}>−</button>
                  <output><strong>{language === 'ko' ? `파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개` : `Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</strong><span>+{formatCurrency(cupcakeFinishCounts.partyDecorationCount)}</span></output>
                  <button type="button" aria-label={language === 'ko' ? '파티용 데코 한 개 늘리기' : 'Add one party decoration'} disabled={basicCupcakeCount === 0} onClick={() => selectCupcakeFinishCount('party', cupcakeFinishCounts.partyDecorationCount + 1)}>+</button>
                </div>
                <div className="icing-quick-choices">
                  <button type="button" className={basicCupcakeCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: 0, partyDecorationCount: 0 })}>{language === 'ko' ? '전부 기본' : 'All basic'}</button>
                  <button type="button" className={cupcakeFinishCounts.vanillaCreamCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: CUPCAKE_PACK_SIZE, partyDecorationCount: 0 })}>{language === 'ko' ? '전부 바닐라' : 'All vanilla'}</button>
                  <button type="button" className={cupcakeFinishCounts.partyDecorationCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: 0, partyDecorationCount: CUPCAKE_PACK_SIZE })}>{language === 'ko' ? '전부 파티 데코' : 'All party'}</button>
                </div>
                <p className="field-help">{language === 'ko' ? `마감 추가금 ${formatCurrency(cupcakeFinishSurcharge)}` : `Finishing surcharge ${formatCurrency(cupcakeFinishSurcharge)}`}</p>
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

            {!isFreshLemonCupcakeProduct(selectedProduct.id) && (
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
            )}

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
                      pickupTime: '',
                    })
                  }}
                />
              </label>
              <label>
                {labels.pickupTime}
                <select
                  value={selectedPickupTime}
                  onChange={(event) => setForm({ ...form, pickupTime: event.target.value })}
                  disabled={pickupAvailabilityLoading || pickupAvailabilityError || times.length === 0}
                >
                  {times.length === 0 ? (
                    <option value="" disabled>
                      {pickupAvailabilityLoading
                        ? copy.pickupAvailabilityChecking
                        : pickupAvailabilityError
                          ? copy.pickupAvailabilityError
                          : copy.pickupAvailabilityNone}
                    </option>
                  ) : (
                    times.map((time) => (
                      <option value={time} key={time}>
                        {time}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div aria-live="polite">
              {pickupAvailabilityLoading ? (
                <p className="field-help">{copy.pickupAvailabilityChecking}</p>
              ) : pickupAvailabilityError ? (
                <>
                  <p className="error-text">{copy.pickupAvailabilityError}</p>
                  <button className="text-button" type="button" onClick={refetchPickupAvailability}>
                    {copy.pickupAvailabilityRetry}
                  </button>
                </>
              ) : times.length === 0 ? (
                <p className="field-help">{copy.pickupAvailabilityNone}</p>
              ) : null}
            </div>
            <p className="field-help">{copy.pickupLeadTimeHelp}</p>
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

            {shouldShowPromoInput('cake', selectedProduct.id) && (
              <label className="promo-code-field">
                {labels.promoCode}
                <input
                  value={form.promoCode}
                  onChange={(event) => setForm({ ...form, promoCode: event.target.value })}
                  placeholder={labels.promoPlaceholder}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span
                  className={isPromoApplied ? 'promo-message is-applied' : 'promo-message'}
                  role={promoEntry.kind === 'invalid' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {promoEntry.kind === 'review-pending'
                    ? isManualCouponPending
                      ? language === 'ko'
                        ? `일회용 쿠폰 준비됨 · 예상 ${promoEntry.discountPercent}% 할인 (-${formatCurrency(promoDiscountAmount)}) · 주문 시 확인됩니다`
                        : `One-time coupon ready · estimated ${promoEntry.discountPercent}% off (-${formatCurrency(promoDiscountAmount)}) · Verified when you place the order`
                      : language === 'ko'
                        ? `후기 리워드 준비됨 · 예상 ${promoEntry.discountPercent}% 할인 (-${formatCurrency(promoDiscountAmount)}) · 주문 시 확인됩니다`
                        : `Review reward ready · estimated ${promoEntry.discountPercent}% off (-${formatCurrency(promoDiscountAmount)}) · Verified when you place the order`
                    : promoEntry.kind === 'static-valid'
                      ? `${labels.promoApplied}: ${promoEntry.discountPercent}% (${formatCurrency(promoDiscountAmount)} off)`
                      : promoEntry.kind === 'invalid'
                        ? promoErrorMessage('PROMO_CODE_INVALID', language)
                        : promoHint}
                </span>
              </label>
            )}

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

            {error && <p className="error-text" role="alert">{error}</p>}

            <BankAccountBox settings={settings} totalPrice={promoPriceDisplay.finalPrice} language={language} />

            <button
              className="primary-button full-width"
              type="submit"
              disabled={submitting || pickupAvailabilityLoading || pickupAvailabilityError || !selectedPickupTime}
            >
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
  const pricingAudit = reservation ? getReservationPricingAudit(reservation) : null
  const usedReviewReward = reservation?.promotionKind === 'review-reward'
  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="narrow-page">
        <section className="complete-panel">
          <div className="check-icon">
            <Check size={22} />
          </div>
          <h1>{copy.reservationCompleteTitle}</h1>
          {reservation?.id === 'demo-reservation' && (
            <p className="notice-line" role="status">DEMO · This order was not saved or sent.</p>
          )}
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
              {pricingAudit && pricingAudit.discountCents > 0 && (
                <>
                  <div className="discount-summary">
                    <dt>{language === 'ko' ? '할인 전 금액' : 'Subtotal'}</dt>
                    <dd>{formatCurrency(pricingAudit.subtotalCents / 100)}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '할인' : 'Discount'}</dt>
                    <dd>{pricingAudit.discountPercent}% · -{formatCurrency(pricingAudit.discountCents / 100)}</dd>
                  </div>
                  {pricingAudit.appliedPromoCodeLast4 && (
                    <div>
                      <dt>{usedReviewReward ? (language === 'ko' ? '후기 리워드' : 'Review reward') : (language === 'ko' ? '적용 코드' : 'Applied code')}</dt>
                      <dd>
                        {usedReviewReward
                          ? language === 'ko'
                            ? `후기 리워드 · ${pricingAudit.discountPercent}% 할인 · 코드 끝 ${pricingAudit.appliedPromoCodeLast4}`
                            : `Review reward · ${pricingAudit.discountPercent}% off · code ending ${pricingAudit.appliedPromoCodeLast4}`
                          : `•••• ${pricingAudit.appliedPromoCodeLast4}`}
                      </dd>
                    </div>
                  )}
                </>
              )}
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
  const [reservation, setReservation] = useState<PublicReservation | null>(null)
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setReservation(null)
    const normalizedPhone = normalizePhone(phone)
    if (!isValidPhone(normalizedPhone)) {
      setMessage(copy.errors.phone)
      return
    }
    setSearching(true)
    try {
      const result = await getReservationByNumber(reservationNumber.trim(), normalizedPhone)
      setReservation(result)
      if (!result) setMessage(copy.notFoundText)
    } catch {
      setMessage(copy.errors.submit)
    } finally {
      setSearching(false)
    }
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
            <input
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder={copy.phonePlaceholder}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <button className="primary-button full-width" type="submit" disabled={searching}>
            {searching ? copy.submitting : copy.search}
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
          key={selected.id}
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
          key={selected.id}
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
                      <td><strong>{getClassTypeLabel(reservation.classType)}</strong><span>{formatClassBookingType(reservation.bookingType)} · {formatCurrency(reservation.totalPrice)}</span></td>
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

function ReviewInviteButton({
  sourceType,
  sourceReservationId,
  customerName,
  status,
}: {
  sourceType: 'cake' | 'class'
  sourceReservationId: string
  customerName: string
  status: string
}) {
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const issuingRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
  }, [])

  if (!canCreateReviewInvite(sourceType, status)) return null

  async function copyReviewRequest() {
    if (issuingRef.current) return
    issuingRef.current = true
    setIssuing(true)
    setError('')
    setSuccess('')
    try {
      const invite = await createReviewInvite(functions, appwriteConfig.reviewApiFunctionId, {
        sourceType,
        sourceReservationId,
      })
      await copyAdminRewardMessage(buildReviewRequestMessage(sourceType, customerName, invite.token))
      setSuccess('리뷰 요청 메시지가 복사되었습니다.')
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setSuccess(''), 2500)
    } catch (copyError) {
      setError(reviewInviteErrorMessage(copyError))
    } finally {
      issuingRef.current = false
      setIssuing(false)
    }
  }

  return (
    <div className="review-invite-action">
      {success && <div className="toast" role="status">{success}</div>}
      <button className="secondary-button" type="button" disabled={issuing} onClick={copyReviewRequest}>
        <Copy size={16} /> {issuing ? '리뷰 요청 준비 중...' : 'Copy review request'}
      </button>
      {error && <p className="error-text review-invite-error" role="alert">{error}</p>}
    </div>
  )
}

function ClassReservationDrawer({ reservation, onClose, onSave, onCopy }: { reservation: ClassReservation; onClose: () => void; onSave: (id: string, updates: Parameters<typeof updateClassReservation>[1]) => Promise<void>; onCopy: (message: string) => Promise<void> }) {
  const [memo, setMemo] = useState(reservation.adminMemo)
  return (
    <div className="drawer-backdrop"><aside className="drawer"><div className="drawer-header"><h2>{reservation.reservationNumber}</h2><button type="button" onClick={onClose}>닫기</button></div>
      <dl className="detail-list"><div><dt>부모</dt><dd>{reservation.parentName}<br />{reservation.parentPhone}<br />{reservation.parentEmail}</dd></div><div><dt>아이</dt><dd>{reservation.childName}, {reservation.childAge}, {reservation.schoolYear}</dd></div><div><dt>세션</dt><dd>{reservation.classDate} {reservation.classTime}</dd></div><div><dt>안전</dt><dd>{reservation.allergyNote || 'none'}<br />Emergency: {reservation.emergencyContact}<br />Pick-up: {reservation.pickupPerson}</dd></div><div><dt>동의</dt><dd>Parent {reservation.parentConsent ? 'yes' : 'no'} / Photo {reservation.photoConsent ? 'yes' : 'no'} / Cancellation {reservation.cancellationAgreement ? 'yes' : 'no'}</dd></div></dl>
      <label>관리자 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
      <ReviewInviteButton sourceType="class" sourceReservationId={reservation.id} customerName={reservation.parentName} status={reservation.status} />
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
  const [productId, setProductId] = useState<ProductId>(reservation.productId)
  const [cakeSize, setCakeSize] = useState<CakeSize>(reservation.cakeSize)
  const [chocolateType, setChocolateType] = useState<ChocolateType>(reservation.chocolateType)
  const [poundAddon, setPoundAddon] = useState<PoundAddon>(reservation.poundAddon)
  const [chocolateIcingCount, setChocolateIcingCount] = useState(reservation.chocolateIcingCount || 0)
  const [vanillaCreamCount, setVanillaCreamCount] = useState(reservation.vanillaCreamCount || 0)
  const [partyDecorationCount, setPartyDecorationCount] = useState(reservation.partyDecorationCount || 0)
  const [quantity, setQuantity] = useState(reservation.quantity)
  const [pickupDate, setPickupDate] = useState(reservation.pickupDate)
  const [pickupTime, setPickupTime] = useState(reservation.pickupTime)
  const [cacaoPercent, setCacaoPercent] = useState<CacaoPercent>(reservation.cacaoPercent)
  const [status, setStatus] = useState(reservation.status)
  const [paymentStatus, setPaymentStatus] = useState(reservation.paymentStatus)
  const [memo, setMemo] = useState(reservation.adminMemo)
  const hasOneTimeCoupon = Boolean(reservation.reviewCouponId)
  const reservationPricingAudit = getOptionalReservationPricingAudit(reservation)

  const draftUpdate = buildAdminReservationUpdate(reservation, {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    quantity,
    pickupDate,
    pickupTime,
    cacaoPercent,
    status,
    paymentStatus,
    adminMemo: memo,
  })
  const draftReservation: Reservation = { ...reservation, ...draftUpdate }
  const selectedProduct = getProductById(draftUpdate.productId)
  const timeOptions = timeOptionsForDate(pickupDate, settings)
  const displayedTimeOptions = timeOptions.includes(pickupTime) ? timeOptions : [pickupTime, ...timeOptions].filter(Boolean)

  async function saveAll() {
    await onSave(reservation.id, draftUpdate)
  }

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
          <div>
            <dt>요청사항</dt>
            <dd>{reservation.requestNote || '-'}</dd>
          </div>
          {reservationPricingAudit && reservationPricingAudit.discountCents > 0 && (
            <div>
              <dt>할인 감사 정보</dt>
              <dd>
                소계 {formatCurrency(reservationPricingAudit.subtotalCents / 100)} ·
                {' '}{reservationPricingAudit.discountPercent}% 할인 ·
                {' '}- {formatCurrency(reservationPricingAudit.discountCents / 100)}
                {reservationPricingAudit.appliedPromoCodeLast4
                  ? ` · 코드 끝 4자리 ${reservationPricingAudit.appliedPromoCodeLast4}`
                  : ''}
                {reservation.reviewCouponId
                  ? ` · 일회용 쿠폰 ID ${reservation.reviewCouponId}`
                  : ''}
              </dd>
            </div>
          )}
        </dl>

        <section className="admin-edit-card" aria-label="예약 수정">
          <h3>예약 내용 수정</h3>
          {hasOneTimeCoupon && (
            <p className="notice-line" role="status">
              일회용 쿠폰 예약은 서버 재가격 계산 기능이 준비될 때까지 제품·옵션·수량·카카오·금액을 수정할 수 없습니다.
            </p>
          )}
          <div className="admin-edit-grid">
            <fieldset disabled={hasOneTimeCoupon} className="admin-repricing-fields">
            <label>
              제품
              <select value={productId} onChange={(event) => setProductId(event.target.value as ProductId)}>
                {Object.values(PRODUCTS).filter((product) => product.id !== 'fresh-lemon-cupcakes-4' || product.id === reservation.productId).map((product) => (
                  <option value={product.id} key={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            {selectedProduct.usesSizeOptions && (
              <label>
                사이즈
                <select value={cakeSize} onChange={(event) => setCakeSize(event.target.value as CakeSize)}>
                  {CAKE_SIZE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {selectedProduct.usesPoundAddonOptions && (
              <label>
                옵션
                <select value={poundAddon} onChange={(event) => setPoundAddon(event.target.value as PoundAddon)}>
                  {POUND_ADDON_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {usesReservationChocolateType(draftUpdate.productId, draftUpdate.poundAddon) && (
              <label>
                초콜릿
                <select value={chocolateType} onChange={(event) => setChocolateType(event.target.value as ChocolateType)}>
                  {CHOCOLATE_TYPE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {selectedProduct.usesCacaoOptions && (
              <label>
                카카오
                <select value={cacaoPercent} onChange={(event) => setCacaoPercent(event.target.value as CacaoPercent)}>
                  {CACAO_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {isFreshLemonCupcakeProduct(draftUpdate.productId) && (
              <label>
                다크 커버춰 초콜릿 개수
                <input
                  type="number"
                  min="0"
                  max={getFreshLemonCupcakePackSize(draftUpdate.productId) || 0}
                  value={draftUpdate.chocolateIcingCount}
                  onChange={(event) => setChocolateIcingCount(Number(event.target.value || 0))}
                />
              </label>
            )}
            {isCupcakeDozenProduct(draftUpdate.productId) && (
              <>
                <label>
                  바닐라 크림 개수 (+AUD 0.50)
                  <input type="number" min="0" max={CUPCAKE_PACK_SIZE - (draftUpdate.partyDecorationCount || 0)} value={draftUpdate.vanillaCreamCount || 0} onChange={(event) => setVanillaCreamCount(Number(event.target.value || 0))} />
                </label>
                <label>
                  파티용 데코 개수 (+AUD 1.00)
                  <input type="number" min="0" max={CUPCAKE_PACK_SIZE - (draftUpdate.vanillaCreamCount || 0)} value={draftUpdate.partyDecorationCount || 0} onChange={(event) => setPartyDecorationCount(Number(event.target.value || 0))} />
                </label>
              </>
            )}
            {!isFreshLemonCupcakeProduct(draftUpdate.productId) && (
              <label>
                수량
                <input type="number" min="1" max={MAX_RESERVATION_QUANTITY} value={quantity} onChange={(event) => setQuantity(Number(event.target.value || 1))} />
              </label>
            )}
            </fieldset>
            <label>
              픽업 날짜
              <input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
            </label>
            <label>
              픽업 시간
              <select value={pickupTime} onChange={(event) => setPickupTime(event.target.value)}>
                {displayedTimeOptions.map((time) => <option value={time} key={time}>{time}</option>)}
              </select>
            </label>
            <label>
              예약상태
              <select value={status} onChange={(event) => setStatus(event.target.value as Reservation['status'])}>
                {RESERVATION_STATUSES.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              입금상태
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as Reservation['paymentStatus'])}>
                {PAYMENT_STATUSES.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-edit-price-row">
            <span>수정 후 금액</span>
            <strong>{formatCurrency(draftUpdate.totalPrice)}</strong>
          </div>
        </section>

        <label>
          관리자 메모
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>

        <ReviewInviteButton sourceType="cake" sourceReservationId={reservation.id} customerName={reservation.customerName} status={reservation.status} />
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => onCopy(draftReservation)}>
            <Clipboard size={16} /> 확정 문자 복사
          </button>
          <button className="primary-button" type="button" onClick={saveAll}>
            예약 수정 저장
          </button>
        </div>
        <div className="sms-preview">
          <pre>{buildSmsMessage(draftReservation, settings)}</pre>
        </div>
      </aside>
    </div>
  )
}

export default App
