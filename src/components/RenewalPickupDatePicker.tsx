import type { RenewalSelection } from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import { renewalPickupSlots, type RenewalPickupPolicy } from '../../appwrite-functions/reservation-api/src/au-renewal-pickup.js'
import { PickupDatePicker } from './WeekendDatePicker'
import type { Language } from '../lib/i18n'

interface RenewalPickupDatePickerProps {
  value: string
  onChange: (value: string) => void
  lines: RenewalSelection[]
  policy: RenewalPickupPolicy & { enabled: boolean }
  language: Language
  now?: Date
}

export function RenewalPickupDatePicker({ value, onChange, lines, policy, language, now = new Date() }: RenewalPickupDatePickerProps) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
  const label = language === 'ko' ? '픽업 날짜' : 'Pickup date'
  return <div className="renewal-pickup-date">
    <span className="renewal-pickup-label">{label}</span>
    <PickupDatePicker
    label={label}
    value={value}
    minDate={today}
    onChange={onChange}
    locale={language === 'ko' ? 'ko-KR' : 'en-AU'}
    isDateDisabled={date => !policy.enabled || !lines.length || renewalPickupSlots(lines, date, now, policy).length === 0}
    availabilityNote={language === 'ko'
      ? '선택할 수 없는 날짜는 회색으로 표시됩니다. 픽업 시간은 시드니 기준입니다.'
      : 'Unavailable dates are shown in grey. Pickup times are in Sydney time.'}
  /></div>
}
