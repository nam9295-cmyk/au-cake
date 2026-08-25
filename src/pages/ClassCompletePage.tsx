import { Check } from 'lucide-react'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader } from '../components/SiteChrome'
import { type Page } from '../lib/app-routes'
import {
  CLASS_PAYMENT_SETTINGS,
} from '../lib/class-utils'
import { getClassPageCopy, type Language } from '../lib/i18n'
import type { ClassReservation } from '../lib/types'
import { formatCurrency } from '../lib/utils'

export function ClassCompletePage({ navigate, reservation, language, setLanguage, cartItemCount }: { navigate: (page: Page) => void; reservation: ClassReservation | null; language: Language; setLanguage: (language: Language) => void; cartItemCount: number }) {
  const reservationNumber = reservation?.reservationNumber || 'VG-2026-0702'
  const reservationClassType = reservation?.classType || 'school-holiday-private-cake-class'
  const reservationCoursePlan = reservation?.coursePlan || 'basic'
  const copy = getClassPageCopy(language)

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="class-complete-page">
        <section className="class-complete-card" aria-labelledby="class-complete-title">
          <div className="class-complete-icon" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 id="class-complete-title">{copy.complete.title}</h1>

          <div className="class-complete-message">
            <strong>{copy.complete.requestSent(reservation ? copy.reserve.classTypes[reservationClassType].label : language === 'ko' ? '키즈 클래스' : 'kids course')}</strong>
            <p>{copy.complete.availability}</p>
            <p>{copy.complete.payment}</p>
            <span>{copy.complete.bookingId}: {reservationNumber}</span>
          </div>

          {reservation && <dl className="detail-list">
            <div><dt>{copy.complete.summary.plan}</dt><dd>{copy.reserve.coursePlans[reservationCoursePlan].label}</dd></div>
            <div><dt>{copy.complete.summary.firstSession}</dt><dd>{copy.complete.sessionSummary(reservation.classDate, reservation.classTime, reservation.durationMinutes || 120, reservation.extensionMinutes === 30)}</dd></div>
            {reservation.advancedClassDate && reservation.advancedClassTime && <div><dt>{copy.complete.summary.advancedSession}</dt><dd>{copy.complete.sessionSummary(reservation.advancedClassDate, reservation.advancedClassTime, reservation.advancedDurationMinutes || 120, reservation.advancedExtensionMinutes === 30)}</dd></div>}
            <div><dt>{copy.complete.summary.subtotal}</dt><dd>{formatCurrency((reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)) / 100)}</dd></div>
            {(reservation.discountCents || 0) > 0 && <div><dt>{copy.complete.summary.packageDiscount}</dt><dd>{reservation.discountPercent}% · -{formatCurrency((reservation.discountCents || 0) / 100)}</dd></div>}
            <div><dt>{copy.complete.summary.total}</dt><dd>{formatCurrency((reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)) / 100)}</dd></div>
          </dl>}

          <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={reservation?.totalPrice} language={language} />

          <button className="class-complete-button" type="button" onClick={() => navigate('classes')}>
            {copy.complete.backToClasses}
          </button>
        </section>
      </main>
    </>
  )
}
