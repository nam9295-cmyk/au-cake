import { useEffect, useRef, useState } from 'react'
import {
  getBookingCalendarMonthDays,
  getClassCalendarMonthLabel,
  shiftClassCalendarMonth,
} from '../lib/class-utils'

interface SharedDatePickerProps {
  label: string
  value: string
  minDate: string
  onChange: (value: string) => void
  locale?: 'en-AU' | 'ko-KR'
  isDateDisabled?: (value: string) => boolean
  loading?: boolean
}

interface BookingDatePickerProps extends SharedDatePickerProps {
  weekendsOnly: boolean
}

const WEEKDAY_LABELS = {
  'en-AU': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  'ko-KR': ['일', '월', '화', '수', '목', '금', '토'],
} as const

function formatSelectedDate(value: string, locale: 'en-AU' | 'ko-KR') {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function BookingDatePicker({
  label,
  value,
  minDate,
  onChange,
  weekendsOnly,
  locale = 'en-AU',
  isDateDisabled = () => false,
  loading = false,
}: BookingDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(value.slice(0, 7) || minDate.slice(0, 7))
  const days = getBookingCalendarMonthDays(visibleMonth, minDate, weekendsOnly)
  const previousMonth = shiftClassCalendarMonth(visibleMonth, -1)
  const minimumMonth = minDate.slice(0, 7)
  const previousLabel = locale === 'ko-KR' ? '이전 달' : 'Previous month'
  const nextLabel = locale === 'ko-KR' ? '다음 달' : 'Next month'
  const note = loading
    ? locale === 'ko-KR' ? '예약 가능 날짜를 확인하고 있습니다.' : 'Checking available dates.'
    : weekendsOnly
      ? 'Saturday and Sunday are available.'
      : locale === 'ko-KR' ? '예약할 수 없는 날짜는 회색으로 표시됩니다.' : 'Unavailable dates are shown in grey.'

  useEffect(() => {
    if (!open) return

    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="weekend-date-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="weekend-date-trigger"
        aria-label={`${label}. ${formatSelectedDate(value, locale)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open && value) setVisibleMonth(value.slice(0, 7))
          setOpen((current) => !current)
        }}
      >
        <span>{formatSelectedDate(value, locale)}</span>
        <span className="weekend-date-trigger-icon" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="weekend-calendar-popover" role="dialog" aria-label={`${label} calendar`}>
          <div className="weekend-calendar-header">
            <button
              type="button"
              className="weekend-calendar-nav"
              aria-label={previousLabel}
              disabled={previousMonth < minimumMonth}
              onClick={() => setVisibleMonth(previousMonth)}
            >
              ‹
            </button>
            <strong aria-live="polite">{getClassCalendarMonthLabel(visibleMonth, locale)}</strong>
            <button
              type="button"
              className="weekend-calendar-nav"
              aria-label={nextLabel}
              onClick={() => setVisibleMonth(shiftClassCalendarMonth(visibleMonth, 1))}
            >
              ›
            </button>
          </div>

          <div className="weekend-calendar-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS[locale].map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="weekend-calendar-grid">
            {days.map((day) => {
              const externallyDisabled = loading || isDateDisabled(day.isoDate)
              const disabled = day.disabled || externallyDisabled
              const availabilityLabel = disabled && day.inCurrentMonth
                ? locale === 'ko-KR' ? ', 예약 불가' : ', unavailable'
                : day.isWeekend ? ', weekend' : ''
              return (
                <button
                  type="button"
                  className={`weekend-calendar-day${day.isoDate === value ? ' selected' : ''}${!day.inCurrentMonth ? ' outside-month' : ''}`}
                  key={day.isoDate}
                  disabled={disabled}
                  aria-label={`${day.isoDate}${availabilityLabel}`}
                  aria-pressed={day.isoDate === value}
                  onClick={() => {
                    onChange(day.isoDate)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                >
                  {day.dayNumber}
                </button>
              )
            })}
          </div>
          <p className="weekend-calendar-note">{note}</p>
        </div>
      )}
    </div>
  )
}

export function WeekendDatePicker(props: SharedDatePickerProps) {
  return <BookingDatePicker {...props} weekendsOnly />
}

export function PickupDatePicker(props: SharedDatePickerProps) {
  return <BookingDatePicker {...props} weekendsOnly={false} />
}
