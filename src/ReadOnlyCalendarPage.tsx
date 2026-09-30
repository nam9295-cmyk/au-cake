import { CalendarProductionDetails } from './components/CalendarProductionDetails'
import type { CalendarProductionDetail } from './lib/calendar-production'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, LockKeyhole, LogOut, RefreshCw } from 'lucide-react'
import { getCalendarGridDays, shiftCalendarMonth } from './lib/admin-calendar'
import {
  getReadOnlyCalendarEvents,
  getCalendarProductionDetail,
  loginReadOnlyCalendar,
  type ReadOnlyCalendarEvent,
} from './lib/repository'

const TOKEN_KEY = 'verygood-calendar-token'

function sydneyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
}

function statusLabel(event: ReadOnlyCalendarEvent) {
  if (event.isCancelled) return 'Cancelled'
  return event.status
}

function eventDetail(event: ReadOnlyCalendarEvent) {
  const parts = [statusLabel(event)]
  if (event.kind !== 'class') return parts.join(' · ')
  const plan = event.coursePlan === 'basic-advanced-package'
    ? 'Package'
    : event.coursePlan === 'advanced' ? 'Advanced' : 'Basic'
  parts.push(plan)
  if (event.durationMinutes) parts.push(`${event.durationMinutes} min`)
  if (event.extensionMinutes === 30) parts.push('+30 min extension')
  if ((event.discountCents || 0) > 0) parts.push(`${event.discountPercent || 5}% off`)
  if ((event.totalPriceCents || 0) > 0) parts.push(`AUD ${((event.totalPriceCents || 0) / 100).toFixed(2)}`)
  return parts.join(' · ')
}

export default function ReadOnlyCalendarPage() {
  const today = sydneyDate()
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [pin, setPin] = useState('')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [events, setEvents] = useState<ReadOnlyCalendarEvent[]>([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<CalendarProductionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const detailSequence = useRef(0)

  const clearDetail = useCallback(() => {
    detailSequence.current++
    setDetail(null)
    setDetailLoading(false)
    setDetailError('')
  }, [])
  useEffect(() => () => { detailSequence.current++ }, [])

  async function loadProductionDetail(eventId: string) {
    const sequence = ++detailSequence.current
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const result = await getCalendarProductionDetail(token, eventId)
      if (sequence === detailSequence.current) setDetail(result)
    } catch (caught) {
      if (sequence !== detailSequence.current) return
      const code = caught instanceof Error ? caught.message : ''
      if (code === 'CALENDAR_UNAUTHORIZED') handleLoadError(caught)
      else setDetailError('Could not load production details. Please try again.')
    } finally { if (sequence === detailSequence.current) setDetailLoading(false) }
  }

  const handleLoadError = useCallback((caught: unknown) => {
    const code = caught instanceof Error ? caught.message : ''
    if (code === 'CALENDAR_UNAUTHORIZED') {
      clearDetail()
      localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setEvents([])
      setError('Session expired. Please enter the PIN again.')
    } else {
      setError('Could not load the calendar. Please try again.')
    }
  }, [clearDetail, setToken, setEvents, setError])

  async function refreshEvents(activeToken: string, activeMonth: string) {
    clearDetail()
    setLoading(true)
    setError('')
    try {
      const result = await getReadOnlyCalendarEvents(activeToken, activeMonth)
      setEvents(result.events)
    } catch (caught) {
      handleLoadError(caught)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getReadOnlyCalendarEvents(token, month)
      .then((result) => {
        if (!cancelled) setEvents(result.events)
      })
      .catch((caught: unknown) => {
        if (!cancelled) handleLoadError(caught)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [month, token, handleLoadError])

  async function submitPin(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter the 6-digit PIN.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await loginReadOnlyCalendar(pin)
      localStorage.setItem(TOKEN_KEY, result.token)
      setToken(result.token)
      setPin('')
    } catch {
      setError('Incorrect PIN. Please try again.')
      setLoading(false)
    }
  }

  function logout() {
    clearDetail()
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setEvents([])
    setError('')
  }

  const days = useMemo(() => getCalendarGridDays(month, today), [month, today])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, ReadOnlyCalendarEvent[]>()
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) || []), event])
    return grouped
  }, [events])
  const selectedEvents = eventsByDate.get(selectedDate) || []

  if (!token) {
    return (
      <main className="readonly-calendar-login">
        <section className="readonly-calendar-login-card">
          <div className="readonly-calendar-lock"><LockKeyhole size={26} /></div>
          <p className="readonly-calendar-kicker">VERYGOOD · PRIVATE</p>
          <h1>Schedule</h1>
          <p>Read-only access for the Sydney booking calendar. Customer contact details are never shown here.</p>
          <form onSubmit={submitPin}>
            <label htmlFor="calendar-pin">6-digit PIN</label>
            <input
              id="calendar-pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error && <p className="readonly-calendar-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Open calendar'}</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="readonly-calendar-page">
      <header className="readonly-calendar-header">
        <div>
          <p className="readonly-calendar-kicker">VERYGOOD · READ ONLY</p>
          <h1>Schedule</h1>
        </div>
        <button type="button" className="readonly-calendar-icon-button" onClick={logout} aria-label="Log out"><LogOut size={19} /></button>
      </header>

      <section className="readonly-calendar-panel" aria-label="Booking calendar">
        <div className="readonly-calendar-toolbar">
          <button type="button" onClick={() => { clearDetail(); setMonth(shiftCalendarMonth(month, -1)) }} aria-label="Previous month"><ChevronLeft /></button>
          <strong>{monthLabel(month)}</strong>
          <button type="button" onClick={() => { clearDetail(); setMonth(shiftCalendarMonth(month, 1)) }} aria-label="Next month"><ChevronRight /></button>
        </div>
        <div className="readonly-calendar-weekdays" aria-hidden="true">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="readonly-calendar-grid">
          {days.map((day) => {
            const dayEvents = eventsByDate.get(day.date) || []
            return (
              <button
                type="button"
                key={day.date}
                className={[
                  !day.isCurrentMonth ? 'is-outside' : '',
                  day.isToday ? 'is-today' : '',
                  selectedDate === day.date ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => { clearDetail(); setSelectedDate(day.date) }}
                aria-label={`${day.date}, ${dayEvents.length} bookings`}
              >
                <span className="readonly-calendar-day-number">{day.dayNumber}</span>
                <span className="readonly-calendar-cell-summary">
                  {dayEvents.filter(event => event.id.startsWith('custom-cake:') && !event.isCancelled).slice(0, 2).map(event => <span className="calendar-cell-production" key={event.id} title={`${event.time} ${event.label}`}><time>{event.time}</time>{event.customCake ? <><span>Custom Cake</span><span>{event.customCake.tier === 'single' ? 'Single' : 'Double'} {event.customCake.size} ×{event.customCake.quantity}</span><span className="calendar-cell-flavour">{event.customCake.flavour || 'Not specified'}</span></> : event.label}</span>)}
                  {dayEvents.some((event) => event.kind === 'cake' && !event.isCancelled) && (
                    <i className="cake">Cake {dayEvents.filter((event) => event.kind === 'cake' && !event.isCancelled).length}</i>
                  )}
                  {dayEvents.some((event) => event.kind === 'class' && !event.isCancelled) && (
                    <i className="class">Class {dayEvents.filter((event) => event.kind === 'class' && !event.isCancelled).length}</i>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="readonly-calendar-agenda" aria-live="polite">
        <div className="readonly-calendar-agenda-heading">
          <div><span>{selectedDate}</span><strong>{selectedEvents.filter((event) => !event.isCancelled).length} booking{selectedEvents.filter((event) => !event.isCancelled).length === 1 ? '' : 's'}</strong></div>
          <button type="button" onClick={() => void refreshEvents(token, month)} disabled={loading} aria-label="Refresh calendar"><RefreshCw size={17} className={loading ? 'is-spinning' : ''} /></button>
        </div>
        {error && <p className="readonly-calendar-error" role="alert">{error}</p>}
        {!loading && selectedEvents.length === 0 && <p className="readonly-calendar-empty">No bookings on this day.</p>}
        <div className="readonly-calendar-event-list">
          {selectedEvents.map((event) => (
            <article key={event.id} className={`${event.kind}${event.isCancelled ? ' is-cancelled' : ''}`}>
              <time>{event.time}</time>
              <div>
                {event.id.startsWith('custom-cake:') ? <button className="calendar-production-open" type="button" aria-label={`View production details for ${event.label}`} onClick={() => void loadProductionDetail(event.id)}>{event.label}</button> : <strong>{event.label}</strong>}
                <span>{eventDetail(event)}</span>
              </div>
            </article>
          ))}
        </div>
        {detailLoading && <p className="calendar-detail-feedback" role="status">Loading production details…</p>}
        {detailError && <p className="calendar-detail-feedback readonly-calendar-error" role="alert">{detailError}</p>}
        {detail && <CalendarProductionDetails detail={detail} onClose={clearDetail} />}
      </section>
      <footer className="readonly-calendar-footer">Schedule only · No customer contact details · No editing</footer>
    </main>
  )
}
