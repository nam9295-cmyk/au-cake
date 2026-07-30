import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import CakeDetailPage from './CakeDetailPage'
import CakesPage from './CakesPage'
import CartPage from './CartPage'
import { useCart } from './CartProvider'
import ReviewPage from './ReviewPage'
import ReviewsArchive from './ReviewsArchive'
import {
  AnnouncementTicker,
  AnalyticsConsentBanner,
  HomeTigerBackground,
  SiteFooter,
  SiteHeader,
} from './components/SiteChrome'
import { ClassCompletePage } from './pages/ClassCompletePage'
import { ClassReservePage } from './pages/ClassReservePage'
import { ClassesPage } from './pages/ClassesPage'
import { CompletePage } from './pages/CompletePage'
import { HomePage } from './pages/HomePage'
import { LookupPage } from './pages/LookupPage'
import { ReservePage } from './pages/ReservePage'
import { getCakeSlugFromPath, getPageFromPath, pathForCake, pathForPage, type Page } from './lib/app-routes'
import { type CakeDetailSelection } from './lib/cake-detail'
import type { CartLine } from './lib/cart'
import {
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
} from './lib/constants'
import { appwriteConfig, functions, isAppwriteConfigured } from './lib/appwrite'
import { shouldLoadStoreSettings } from './lib/review-page'
import { normalizeReviewCouponCode } from './lib/review-coupon-client'
import {
  readStoredLanguage,
  storeLanguage,
  type Language,
} from './lib/i18n'
import { getSettings } from './lib/repository'
import { applySeo } from './lib/seo'
import {
  trackEvent,
  trackPageView,
} from './lib/analytics'
import type {
  ClassReservation,
  ProductId,
  Reservation,
  StoreSettings,
} from './lib/types'

const AdminLoginPage = lazy(() => import('./AdminLoginPage').then(({ AdminLoginPage }) => ({ default: AdminLoginPage })))
const AdminDashboardPage = lazy(() => import('./AdminDashboardPage').then(({ AdminDashboardPage }) => ({ default: AdminDashboardPage })))
const AdminReservationsPage = lazy(() => import('./AdminReservationsPage').then(({ AdminReservationsPage }) => ({ default: AdminReservationsPage })))
const AdminClassesPage = lazy(() => import('./AdminClassesPage').then(({ AdminClassesPage }) => ({ default: AdminClassesPage })))
const AdminReviewsPage = lazy(() => import('./AdminReviewsPage'))
const ReadOnlyCalendarPage = lazy(() => import('./ReadOnlyCalendarPage'))

function PrivateRouteFallback() {
  return <div role="status" aria-live="polite">Loading…</div>
}

function App() {
  const {
    lines: cartLines,
    add: addCartLine,
    update: updateCartLine,
    remove: removeCartLine,
  } = useCart()
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const page = getPageFromPath(pathname)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null)

  const [completedClassReservation, setCompletedClassReservation] = useState<ClassReservation | null>(null)
  const [reservationProductId, setReservationProductId] = useState<ProductId>(DEFAULT_PRODUCT_ID)
  const [reservationSelection, setReservationSelection] = useState<CakeDetailSelection | null>(null)
  const [reservationSessionKey, setReservationSessionKey] = useState(0)
  const [pendingReviewCoupon, setPendingReviewCoupon] = useState('')
  const [pendingReviewRewardPercent, setPendingReviewRewardPercent] = useState<5 | 10 | null>(null)
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)
  const hasLoadedSettings = useRef(false)
  const cartOriginLineKeyRef = useRef<string | null>(null)

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
    const handlePop = () => {
      cartOriginLineKeyRef.current = null
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    applySeo(pathname)
    if (!pathname.startsWith('/admin') && page !== 'calendar' && page !== 'review') trackPageView(pathname)
  }, [page, pathname])

  const pushPage = useCallback((nextPage: Page) => {
    if (nextPage === 'reserve') trackEvent('booking_start', { booking_type: 'cake' })
    if (nextPage === 'class-reserve') trackEvent('booking_start', { booking_type: 'kids_class' })
    const path = pathForPage(nextPage)
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }, [])

  const navigate = useCallback((nextPage: Page) => {
    cartOriginLineKeyRef.current = null
    if (nextPage === 'reserve') {
      setReservationProductId(DEFAULT_PRODUCT_ID)
      setReservationSelection(null)
      setReservationSessionKey((current) => current + 1)
    }
    pushPage(nextPage)
  }, [pushPage])

  const navigateToCake = useCallback((slug: string) => {
    cartOriginLineKeyRef.current = null
    const path = pathForCake(slug)
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }, [])

  const continueCartLine = useCallback((line: CartLine) => {
    setReservationProductId(line.selection.productId)
    setReservationSelection({ ...line.selection })
    cartOriginLineKeyRef.current = line.lineKey
    setReservationSessionKey((current) => current + 1)
    pushPage('reserve')
  }, [pushPage])

  const orderCakeFromReview = useCallback((couponCode: string, rewardPercent: 5 | 10) => {
    const normalized = normalizeReviewCouponCode(couponCode)
    if (!normalized) return
    setPendingReviewCoupon(normalized)
    setPendingReviewRewardPercent(rewardPercent)
    navigate('reserve')
  }, [navigate])

  const completeReservation = useCallback((reservation: Reservation) => {
    const originLineKey = cartOriginLineKeyRef.current
    if (originLineKey) {
      removeCartLine(originLineKey)
      cartOriginLineKeyRef.current = null
    }
    setPendingReviewCoupon('')
    setPendingReviewRewardPercent(null)
    setCompletedReservation(reservation)
  }, [removeCartLine])

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
      {page === 'cart' && (
        <>
          <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
          <CartPage
            language={language}
            lines={cartLines}
            onUpdate={updateCartLine}
            onRemove={removeCartLine}
            onContinue={continueCartLine}
            onBrowseCakes={() => navigate('cakes')}
          />
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
            onAddToOrder={addCartLine}
            onViewOrder={() => navigate('cart')}
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
          key={reservationSessionKey}
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
      {isPrivatePage && (
        <Suspense fallback={<PrivateRouteFallback />}>
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
        </Suspense>
      )}
      {!isPrivatePage && <SiteFooter navigate={navigate} language={language} />}
      {!isPrivatePage && <AnalyticsConsentBanner language={language} />}
    </div>
    </>
  )
}

export default App
