import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clipboard,
  Copy,
  Download,
  Search,
  Shield,
} from 'lucide-react'
import paveCakeCardImg from './assets/pave-side.webp'
import poundCakeCardImg from './assets/pound-side.webp'
import cupcakeCardImg from './assets/cupcake-side.webp'
import basqueCheesecakeCardImg from './assets/basquecheesecake-side.webp'
import freshLemonCupcakesCardImg from './assets/lemoncake-side.webp'
import ReadOnlyCalendarPage from './ReadOnlyCalendarPage'
import CakeDetailPage from './CakeDetailPage'
import CakesPage from './CakesPage'
import ReviewPage from './ReviewPage'
import ReviewsArchive from './ReviewsArchive'
import AdminFrame from './AdminFrame'
import AdminReviewsPage from './AdminReviewsPage'
import { PickupDatePicker } from './components/WeekendDatePicker'
import { BankAccountBox } from './components/BankAccountBox'
import { AnnouncementTicker, AnalyticsConsentBanner, HomeTigerBackground, SiteFooter, SiteHeader, VanillaFreshCreamCakeSilhouette } from './components/SiteChrome'
import { ClassCompletePage } from './pages/ClassCompletePage'
import { ClassReservePage } from './pages/ClassReservePage'
import { ClassesPage } from './pages/ClassesPage'
import { HomePage } from './pages/HomePage'
import { useTodayInputValue } from './hooks/useTodayInputValue'
import { getCakeSlugFromPath, getPageFromPath, pathForCake, pathForPage, type Page } from './lib/app-routes'
import { type CakeDetailSelection } from './lib/cake-detail'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_PACK_SIZE,
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_VANILLA_CAKE_FLAVOR,
  DEFAULT_VANILLA_CAKE_SHEET,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  isPromoEligibleProduct,
  formatCacaoLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  formatVanillaCakeFlavor,
  formatVanillaCakeSheet,
  getChocolateIcingSurcharge,
  getCupcakeFinishSurcharge,
  getLemonIcingCount,
  getProductById,
  getFreshLemonCupcakePackSize,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  isVanillaFreshCreamCakeProduct,
  getReservationPrice,
  getReservationUnitPrice,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakeSheet,
  PAYMENT_STATUSES,
  POUND_ADDON_OPTIONS,
  PRODUCT_GROUPS,
  PRODUCTS,
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_SHEET_OPTIONS,
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
  getProductText,
  readStoredLanguage,
  storeLanguage,
  type Language,
} from './lib/i18n'
import {
  PICKUP_TIME_CLASS_CONFLICT_ERROR,
  createReservation,
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
  trackEvent,
  trackPageView,
} from './lib/analytics'
import type { CacaoPercent, CakeSize, ChocolateType, ClassReservation, ClassReservationFilters, PoundAddon, ProductId, PublicReservation, Reservation, ReservationFilters, StoreSettings, VanillaCakeFlavor, VanillaCakeSheet } from './lib/types'
import {
  buildClassConfirmationMessage,
  buildClassPaymentDetails,
  buildClassPaymentMessage,
  classReservationsToCsv,
  CLASS_PAYMENT_STATUS_OPTIONS,
  CLASS_STATUS_OPTIONS,
  filterCakePickupTimesForClass,
  formatClassBookingType,
  getClassCoursePlanLabel,
  getClassTypeLabel,
  isCakePickupBlockedByClass,
  isCakePickupDateUnavailable,
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
  isSchoolPickupWindowClosed,
  PICKUP_TIME_TOO_SOON_ERROR,
  PICKUP_TIME_UNAVAILABLE_ERROR,
  isValidPhone,
  maskPhone,
  normalizePhone,
  reservationsToCsv,
  timeOptionsForDate,
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

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const page = getPageFromPath(pathname)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null)

  const [completedClassReservation, setCompletedClassReservation] = useState<ClassReservation | null>(null)
  const [reservationProductId, setReservationProductId] = useState<ProductId>(DEFAULT_PRODUCT_ID)
  const [reservationSelection, setReservationSelection] = useState<CakeDetailSelection | null>(null)
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
    const handlePop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    applySeo(pathname)
    if (!pathname.startsWith('/admin') && page !== 'calendar' && page !== 'review') trackPageView(pathname)
  }, [page, pathname])

  const navigate = useCallback((nextPage: Page) => {
    if (nextPage === 'reserve') trackEvent('booking_start', { booking_type: 'cake' })
    if (nextPage === 'class-reserve') trackEvent('booking_start', { booking_type: 'kids_class' })
    const path = pathForPage(nextPage)
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }, [])

  const navigateToCake = useCallback((slug: string) => {
    const path = pathForCake(slug)
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }, [])

  const requestCakeSelection = useCallback((selection: CakeDetailSelection) => {
    setReservationProductId(selection.productId)
    setReservationSelection(selection)
    navigate('reserve')
  }, [navigate])

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
  const currentCakeSlug = getCakeSlugFromPath(pathname) || ''

  if (page === 'review') return <ReviewPage onOrderCake={orderCakeFromReview} />

  return (
    <>
      {page === 'home' && <HomeTigerBackground />}
      <div className={`app-shell${page === 'home' ? ' home-shell' : ''}${isPrivatePage ? ' admin-shell' : ''}`}>
      {!isAppwriteConfigured && (
        <div className="env-notice">Appwrite 환경변수가 없어서 로컬 데모 저장소로 실행 중입니다.</div>
      )}
      {!isPrivatePage && <AnnouncementTicker language={language} />}

      {page === 'home' && <HomePage navigate={navigate} settings={settings} navigateToCake={navigateToCake} language={language} setLanguage={setLanguage} />}
      {page === 'cakes' && (
        <>
          <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
          <CakesPage language={language} onOpenCake={navigateToCake} />
        </>
      )}
      {page === 'cake-detail' && (
        <>
          <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
          <CakeDetailPage
            key={currentCakeSlug}
            slug={currentCakeSlug}
            language={language}
            onBack={() => navigate('cakes')}
            onBrowseCakes={() => navigate('cakes')}
            onOpenCake={navigateToCake}
            onRequest={requestCakeSelection}
          />
        </>
      )}
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
          initialSelection={reservationSelection}
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
      {!isPrivatePage && <SiteFooter navigate={navigate} language={language} />}
      {!isPrivatePage && <AnalyticsConsentBanner language={language} />}
    </div>
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
  reservation: Pick<Reservation, 'productId' | 'quantity' | 'cakeSize' | 'cacaoPercent' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'vanillaCakeSheet' | 'vanillaCakeFlavor'>
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
      {isVanillaFreshCreamCakeProduct(product.id) && (
        <>
          <div>
            <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
            <dd>{language === 'ko'
              ? reservation.vanillaCakeSheet === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트'
              : formatVanillaCakeSheet(reservation.vanillaCakeSheet)}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
            <dd>{language === 'ko'
              ? reservation.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
              : formatVanillaCakeFlavor(reservation.vanillaCakeFlavor)}</dd>
          </div>
        </>
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

function ReservePage({
  navigate,
  settings,
  initialProductId,
  initialSelection,
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
  initialSelection: CakeDetailSelection | null
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
    productId: initialSelection?.productId || initialProductId,
    cacaoPercent: '기본' as CacaoPercent,
    cakeSize: initialSelection?.cakeSize || DEFAULT_CAKE_SIZE as CakeSize,
    chocolateType: initialSelection?.chocolateType || DEFAULT_CHOCOLATE_TYPE as ChocolateType,
    poundAddon: initialSelection?.poundAddon || DEFAULT_POUND_ADDON as PoundAddon,
    chocolateIcingCount: initialSelection?.chocolateIcingCount || 0,
    vanillaCreamCount: initialSelection?.vanillaCreamCount || 0,
    partyDecorationCount: initialSelection?.partyDecorationCount || 0,
    vanillaCakeSheet: initialSelection?.vanillaCakeSheet || DEFAULT_VANILLA_CAKE_SHEET as VanillaCakeSheet,
    vanillaCakeFlavor: initialSelection?.vanillaCakeFlavor || DEFAULT_VANILLA_CAKE_FLAVOR as VanillaCakeFlavor,
    pickupDate: todayInputValue(),
    pickupTime: '',
    quantity: initialSelection?.quantity || 1,
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
  const [pickupCalendarAvailability, setPickupCalendarAvailability] = useState<{
    loading: boolean
    error: boolean
    bookedSlots: ClassBookedSlot[]
    pickupOpenings: CakePickupOpening[]
  }>({ loading: true, error: false, bookedSlots: [], pickupOpenings: [] })
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
  const isPickupCalendarDateDisabled = useCallback((date: string) => {
    const dateTimes = customerTimeOptionsForDate(date, settings, now)
    if (pickupCalendarAvailability.loading) return true
    if (pickupCalendarAvailability.error) return dateTimes.length === 0
    return isCakePickupDateUnavailable(
      date,
      dateTimes,
      pickupCalendarAvailability.bookedSlots,
      pickupCalendarAvailability.pickupOpenings,
    )
  }, [now, pickupCalendarAvailability, settings])

  const refetchPickupAvailability = useCallback(() => {
    setPickupAvailability({
      dataDate: '',
      loading: true,
      error: false,
      bookedSlots: [],
      pickupOpenings: [],
    })
    setPickupCalendarAvailability((current) => ({ ...current, loading: true, error: false }))
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

  useEffect(() => {
    let cancelled = false

    Promise.all([listClassBookedSlots(), listCakePickupOpenings()])
      .then(([bookedSlots, pickupOpenings]) => {
        if (cancelled) return
        setPickupCalendarAvailability({ loading: false, error: false, bookedSlots, pickupOpenings })
      })
      .catch(() => {
        if (cancelled) return
        setPickupCalendarAvailability({ loading: false, error: true, bookedSlots: [], pickupOpenings: [] })
      })

    return () => {
      cancelled = true
    }
  }, [pickupAvailabilityRefetchKey])

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
    if (isSchoolPickupWindowClosed(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupTimeUnavailable)
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
        vanillaCakeSheet: form.vanillaCakeSheet,
        vanillaCakeFlavor: form.vanillaCakeFlavor,
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
            vanillaCakeSheet: form.vanillaCakeSheet,
            vanillaCakeFlavor: form.vanillaCakeFlavor,
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
      if (submitError instanceof Error && (
        submitError.message === PICKUP_TIME_CLASS_CONFLICT_ERROR ||
        submitError.message === PICKUP_TIME_UNAVAILABLE_ERROR
      )) {
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
    vanillaCakeSheet: form.vanillaCakeSheet,
    vanillaCakeFlavor: form.vanillaCakeFlavor,
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
      vanillaCakeSheet: normalizeVanillaCakeSheet(productId, form.vanillaCakeSheet),
      vanillaCakeFlavor: normalizeVanillaCakeFlavor(productId, form.vanillaCakeFlavor),
      quantity: form.quantity,
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
              {isVanillaFreshCreamCakeProduct(selectedProduct.id) ? <VanillaFreshCreamCakeSilhouette /> : <img src={selectedProductImage} alt={selectedProductText.name} />}
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
              <div>
                <dt>{labels.quantity}</dt>
                <dd>
                  {form.quantity}
                  {copy.quantityUnit}
                </dd>
              </div>
              {(selectedProduct.usesSizeOptions || isCheesecakeProduct(selectedProduct.id)) && (
                <div>
                  <dt>{labels.size}</dt>
                  <dd>{formatCakeSizeLabel(form.cakeSize)}</dd>
                </div>
              )}
              {isVanillaFreshCreamCakeProduct(selectedProduct.id) && (
                <>
                  <div>
                    <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
                    <dd>{language === 'ko'
                      ? form.vanillaCakeSheet === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트'
                      : formatVanillaCakeSheet(form.vanillaCakeSheet)}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
                    <dd>{language === 'ko'
                      ? form.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
                      : formatVanillaCakeFlavor(form.vanillaCakeFlavor)}</dd>
                  </div>
                </>
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
                      : group.id === 'vanilla-fresh-cream'
                        ? getProductText('vanilla-fresh-cream-cake', language).name
                        : group.id === 'pound-cupcake'
                        ? language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes'
                        : group.id === 'cheesecake'
                          ? language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake"
                          : language === 'ko' ? '레몬 케이크' : 'Lemon Cake'
                    const groupImage = group.id === 'pave'
                      ? paveCakeCardImg
                      : group.id === 'vanilla-fresh-cream'
                        ? ''
                        : group.id === 'pound-cupcake'
                        ? poundCakeCardImg
                        : group.id === 'cheesecake' ? basqueCheesecakeCardImg : freshLemonCupcakesCardImg
                    const groupPrice = group.id === 'pave'
                      ? formatCurrency(75)
                      : group.id === 'vanilla-fresh-cream'
                        ? 'From AUD 75'
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
                          {group.id === 'vanilla-fresh-cream' ? <VanillaFreshCreamCakeSilhouette /> : <img src={groupImage} alt="" />}
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
                        {!isVanillaFreshCreamCakeProduct(selectedProduct.id) && <span>{optionText.description}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="field-help">{copy.sizeHelp}</p>
              </fieldset>
            )}

            {isVanillaFreshCreamCakeProduct(selectedProduct.id) && (
              <>
                <fieldset>
                  <legend>{language === 'ko' ? '케이크 시트 선택' : 'Choose cake sheet'}</legend>
                  <div className="choice-list">
                    {VANILLA_CAKE_SHEET_OPTIONS.map((option) => (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="vanillaCakeSheet"
                          checked={form.vanillaCakeSheet === option.value}
                          onChange={() => setForm({ ...form, vanillaCakeSheet: option.value })}
                        />
                        <span className="choice-copy">
                          <strong>{language === 'ko' ? option.value === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트' : option.label}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{language === 'ko' ? '맛 선택' : 'Choose flavour'}</legend>
                  <div className="choice-list">
                    {VANILLA_CAKE_FLAVOR_OPTIONS.map((option) => (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="vanillaCakeFlavor"
                          checked={form.vanillaCakeFlavor === option.value}
                          onChange={() => setForm({ ...form, vanillaCakeFlavor: option.value })}
                        />
                        <span className="choice-copy">
                          <strong>{language === 'ko' ? option.value === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리' : option.label}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
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
              <div className="pickup-date-field">
                <span>{labels.pickupDate}</span>
                <PickupDatePicker
                  label={labels.pickupDate}
                  minDate={minPickupDate}
                  value={pickupDate}
                  locale={language === 'ko' ? 'ko-KR' : 'en-AU'}
                  loading={pickupCalendarAvailability.loading}
                  isDateDisabled={isPickupCalendarDateDisabled}
                  onChange={(nextDate) => setForm({
                    ...form,
                    pickupDate: nextDate,
                    pickupTime: '',
                  })}
                />
              </div>
              <label>
                {labels.pickupTime}
                <select
                  value={selectedPickupTime}
                  onChange={(event) => setForm({ ...form, pickupTime: event.target.value })}
                  disabled={pickupAvailabilityLoading || pickupAvailabilityError || times.length === 0}
                >
                  {times.length === 0 && (
                    <option value="" disabled>
                      {pickupAvailabilityLoading
                        ? copy.pickupAvailabilityChecking
                        : pickupAvailabilityError
                          ? copy.pickupAvailabilityError
                          : copy.pickupAvailabilityNone}
                    </option>
                  )}
                  {baseTimes.map((time) => (
                      <option value={time} key={time} disabled={!times.includes(time)}>
                        {time}
                      </option>
                    ))}
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
                  const subtotalCents = reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
                  const discountCents = reservation.discountCents || 0
                  const totalPriceCents = reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.createdAt.slice(0, 10)}</td>
                      <td>
                        <strong>{reservation.classDate} {reservation.classTime}</strong>
                        <span>{reservation.durationMinutes || 120} min{reservation.extensionMinutes === 30 ? ' · +30 min extension' : ''}</span>
                        {reservation.advancedClassDate && reservation.advancedClassTime && (
                          <span>Advanced: {reservation.advancedClassDate} {reservation.advancedClassTime} · {reservation.advancedDurationMinutes || 120} min{reservation.advancedExtensionMinutes === 30 ? ' · +30 min extension' : ''}</span>
                        )}
                      </td>
                      <td><strong>{reservation.parentName}</strong><span>{reservation.parentPhone}</span><span>{reservation.parentEmail}</span></td>
                      <td>
                        <strong>{reservation.childName} ({reservation.childAge})</strong>
                        <span>{reservation.schoolYear}</span>
                        {reservation.secondChildName && <span>{reservation.secondChildName} ({reservation.secondChildAge})</span>}
                      </td>
                      <td>
                        <strong>{getClassCoursePlanLabel(reservation.coursePlan)} · {getClassTypeLabel(reservation.classType)}</strong>
                        <span>{formatClassBookingType(reservation.bookingType)}</span>
                        <span>Subtotal {formatCurrency(subtotalCents / 100)}</span>
                        {discountCents > 0 && <span>{reservation.discountPercent || 5}% discount · -{formatCurrency(discountCents / 100)}</span>}
                        <span>Total {formatCurrency(totalPriceCents / 100)}</span>
                      </td>
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
  const subtotalCents = reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
  const discountCents = reservation.discountCents || 0
  const totalPriceCents = reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
  return (
    <div className="drawer-backdrop">
      <aside className="drawer">
        <div className="drawer-header"><h2>{reservation.reservationNumber}</h2><button type="button" onClick={onClose}>닫기</button></div>
        <dl className="detail-list">
          <div><dt>부모</dt><dd>{reservation.parentName}<br />{reservation.parentPhone}<br />{reservation.parentEmail}</dd></div>
          <div><dt>아이</dt><dd>{reservation.childName}, {reservation.childAge}, {reservation.schoolYear}</dd></div>
          <div><dt>과정</dt><dd>{getClassCoursePlanLabel(reservation.coursePlan)}<br />{getClassTypeLabel(reservation.classType)}</dd></div>
          <div><dt>첫 세션</dt><dd>{reservation.classDate} {reservation.classTime}<br />{reservation.durationMinutes || 120} min{reservation.extensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>
          {reservation.advancedClassDate && reservation.advancedClassTime && (
            <div><dt>Advanced 세션</dt><dd>{reservation.advancedClassDate} {reservation.advancedClassTime}<br />{reservation.advancedDurationMinutes || 120} min{reservation.advancedExtensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>
          )}
          <div><dt>금액 감사</dt><dd>Subtotal {formatCurrency(subtotalCents / 100)}<br />Discount {reservation.discountPercent || 0}% · -{formatCurrency(discountCents / 100)}<br />Total {formatCurrency(totalPriceCents / 100)}</dd></div>
          <div><dt>안전</dt><dd>{reservation.allergyNote || 'none'}<br />Emergency: {reservation.emergencyContact}<br />Pick-up: {reservation.pickupPerson}</dd></div>
          <div><dt>동의</dt><dd>Parent {reservation.parentConsent ? 'yes' : 'no'} / Photo {reservation.photoConsent ? 'yes' : 'no'} / Cancellation {reservation.cancellationAgreement ? 'yes' : 'no'}</dd></div>
        </dl>
        <label>관리자 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        <ReviewInviteButton sourceType="class" sourceReservationId={reservation.id} customerName={reservation.parentName} status={reservation.status} />
        <div className="button-row"><button className="secondary-button" type="button" onClick={() => onCopy(buildClassPaymentMessage(reservation))}>결제 안내 복사</button><button className="secondary-button" type="button" onClick={() => onCopy(buildClassConfirmationMessage(reservation))}>확정 안내 복사</button><button className="primary-button" type="button" onClick={() => onSave(reservation.id, { adminMemo: memo })}>메모 저장</button></div>
        <div className="sms-preview"><pre>{buildClassConfirmationMessage(reservation)}</pre></div>
      </aside>
    </div>
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
