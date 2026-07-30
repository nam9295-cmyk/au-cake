import { useCallback, useEffect, useRef, useState } from 'react'
import ReadOnlyCalendarPage from './ReadOnlyCalendarPage'
import CakeDetailPage from './CakeDetailPage'
import CakesPage from './CakesPage'
import ReviewPage from './ReviewPage'
import ReviewsArchive from './ReviewsArchive'
import AdminFrame from './AdminFrame'
import { AdminClassesPage } from './AdminClassesPage'
import { AdminLoginPage } from './AdminLoginPage'
import { AdminReservationsPage } from './AdminReservationsPage'
import AdminReviewsPage from './AdminReviewsPage'
import { ClassReservationDrawer } from './ClassReservationDrawer'
import { ReservationDrawer } from './ReservationDrawer'
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
import { useTodayInputValue } from './hooks/useTodayInputValue'
import { getCakeSlugFromPath, getPageFromPath, pathForCake, pathForPage, type Page } from './lib/app-routes'
import { type CakeDetailSelection } from './lib/cake-detail'
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
import {
  getSettings,
  isAdminLoggedIn,
  listClassReservations,
  listReservations,
  updateClassReservation,
  updateReservation,
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
import {
  addDaysInputValue,
  buildSmsMessage,
} from './lib/utils'

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

export default App
