import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, LockKeyhole, LogOut, RefreshCw } from 'lucide-react'
import { getCalendarGridDays, shiftCalendarMonth } from './lib/admin-calendar'
import {
  getReadOnlyCalendarEvents,
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

export default function ReadOnlyCalendarPage() {
  const today = sydneyDate()
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [pin, setPin] = useState('')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [events, setEvents] = useState<ReadOnlyCalendarEvent[]>([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')

  function handleLoadError(caught: unknown) {
    const code = caught instanceof Error ? caught.message : ''
    if (code === 'CALENDAR_UNAUTHORIZED') {
      localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setError('Session expired. Please enter the PIN again.')
    } else {
      setError('Could not load the calendar. Please try again.')
    }
  }

  async function refreshEvents(activeToken: string, activeMonth: string) {
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
  }, [month, token])

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
          <button type="button" onClick={() => setMonth(shiftCalendarMonth(month, -1))} aria-label="Previous month"><ChevronLeft /></button>
          <strong>{monthLabel(month)}</strong>
          <button type="button" onClick={() => setMonth(shiftCalendarMonth(month, 1))} aria-label="Next month"><ChevronRight /></button>
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
                onClick={() => setSelectedDate(day.date)}
                aria-label={`${day.date}, ${dayEvents.length} bookings`}
              >
                <span>{day.dayNumber}</span>
                <span className="readonly-calendar-dots">
                  {dayEvents.some((event) => event.kind === 'cake' && !event.isCancelled) && <i className="cake" />}
                  {dayEvents.some((event) => event.kind === 'class' && !event.isCancelled) && <i className="class" />}
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
              <div><strong>{event.label}</strong><span>{statusLabel(event)}</span></div>
            </article>
          ))}
        </div>
      </section>
      <footer className="readonly-calendar-footer">Schedule only · No customer contact details · No editing</footer>
    </main>
  )
}
