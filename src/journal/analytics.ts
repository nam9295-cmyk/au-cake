import { getAnalyticsConsent, setAnalyticsConsent, trackPageView } from '../lib/analytics'
import content from '../content/au-public-pages.json'

// Static Journal pages reuse the website's opt-in without starting the React app.
function initializeJournalAnalytics() {
  if (window.location.origin !== content.site.url) return
  if (document.documentElement.dataset.journalAnalyticsReady) return
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) return
  const url = new URL(canonical.href)
  if (url.origin !== content.site.url || !/^\/journal(?:\/[a-z0-9-]+)?$/.test(url.pathname)) return
  document.documentElement.dataset.journalAnalyticsReady = 'true'
  const banner = document.querySelector<HTMLElement>('[data-journal-analytics-consent]')
  if (!banner) return
  let tracked = false
  function recordPageView() {
    if (tracked) return
    trackPageView(url.pathname)
    tracked = true
  }
  try {
    const consent = getAnalyticsConsent()
    if (consent === true) recordPageView()
    if (consent !== null) return
    banner.hidden = false
    for (const button of banner.querySelectorAll<HTMLButtonElement>('[data-analytics-choice]')) {
      button.addEventListener('click', () => {
        try {
          const granted = button.dataset.analyticsChoice === 'granted'
          setAnalyticsConsent(granted)
          if (granted) recordPageView()
        } catch {
          // A failed consent write must not enable tracking or interrupt reading.
        } finally {
          banner.hidden = true
        }
      })
    }
  } catch {
    // Storage/privacy restrictions must leave the article readable and untracked.
    banner.hidden = true
  }
}

initializeJournalAnalytics()
