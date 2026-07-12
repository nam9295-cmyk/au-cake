const MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-B7S2L88TQF')
const CONSENT_KEY = 'vg-analytics-consent'

type AnalyticsValue = string | number | boolean
type AnalyticsParams = Record<string, AnalyticsValue>
type Gtag = {
  (command: 'js', target: Date): void
  (command: 'config' | 'event', target: string, params?: AnalyticsParams): void
  (command: 'consent', target: 'default' | 'update', params: AnalyticsParams): void
}

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: Gtag
}

function analyticsWindow() {
  return window as AnalyticsWindow
}

export function getAnalyticsConsent(): boolean | null {
  const stored = window.localStorage.getItem(CONSENT_KEY)
  if (stored === 'granted') return true
  if (stored === 'denied') return false
  return null
}

export function setAnalyticsConsent(granted: boolean) {
  window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
}

export function initializeAnalytics() {
  if (!MEASUREMENT_ID || getAnalyticsConsent() !== true) return false

  const analytics = analyticsWindow()
  analytics.dataLayer ||= []
  analytics.gtag ||= function gtag() {
    // gtag.js expects the native Arguments object used by Google's standard snippet.
    // eslint-disable-next-line prefer-rest-params
    analytics.dataLayer?.push(arguments)
  } as Gtag

  if (!document.querySelector(`script[data-vg-ga="${MEASUREMENT_ID}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
    script.dataset.vgGa = MEASUREMENT_ID
    document.head.appendChild(script)
    analytics.gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    analytics.gtag('consent', 'update', {
      ad_storage: 'denied',
      analytics_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    analytics.gtag('js', new Date())
    analytics.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
  }

  return true
}

export function trackPageView(path: string) {
  if (!initializeAnalytics()) return
  analyticsWindow().gtag?.('event', 'page_view', {
    page_location: `${window.location.origin}${path}`,
    page_path: path,
    page_title: document.title,
  })
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (!initializeAnalytics()) return
  analyticsWindow().gtag?.('event', name, params)
}
