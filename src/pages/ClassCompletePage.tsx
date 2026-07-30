import { Check } from 'lucide-react'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader } from '../components/SiteChrome'
import { type Page } from '../lib/app-routes'
import {
  CLASS_PAYMENT_SETTINGS,
  getClassCoursePlanLabel,
  getClassTypeLabel,
} from '../lib/class-utils'
import type { ClassReservation } from '../lib/types'
import { formatCurrency } from '../lib/utils'

export function ClassCompletePage({ navigate, reservation, cartItemCount }: { navigate: (page: Page) => void; reservation: ClassReservation | null; cartItemCount: number }) {
  const reservationNumber = reservation?.reservationNumber || 'VG-2026-0702'

  return (
    <>
      <SiteHeader navigate={navigate} cartItemCount={cartItemCount} />
      <main className="class-complete-page">
        <section className="class-complete-card" aria-labelledby="class-complete-title">
          <div className="class-complete-icon" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 id="class-complete-title">Booking Request Sent!</h1>

          <div className="class-complete-message">
            <strong>Your {reservation ? getClassTypeLabel(reservation.classType) : 'kids course'} request has been sent.</strong>
            <p>Jenny will check availability and confirm the session shortly.</p>
            <p>Your booking is complete once full payment has been received.</p>
            <span>Booking ID: {reservationNumber}</span>
          </div>

          {reservation && <dl className="detail-list">
            <div><dt>Plan</dt><dd>{getClassCoursePlanLabel(reservation.coursePlan)}</dd></div>
            <div><dt>First session</dt><dd>{reservation.classDate} {reservation.classTime} · {reservation.durationMinutes || 120} min{reservation.extensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>
            {reservation.advancedClassDate && reservation.advancedClassTime && <div><dt>Advanced session</dt><dd>{reservation.advancedClassDate} {reservation.advancedClassTime} · {reservation.advancedDurationMinutes || 120} min{reservation.advancedExtensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>}
            <div><dt>Subtotal</dt><dd>{formatCurrency((reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)) / 100)}</dd></div>
            {(reservation.discountCents || 0) > 0 && <div><dt>Package discount</dt><dd>{reservation.discountPercent}% · -{formatCurrency((reservation.discountCents || 0) / 100)}</dd></div>}
            <div><dt>Total</dt><dd>{formatCurrency((reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)) / 100)}</dd></div>
          </dl>}

          <BankAccountBox settings={CLASS_PAYMENT_SETTINGS} totalPrice={reservation?.totalPrice} language="en" />

          <button className="class-complete-button" type="button" onClick={() => navigate('classes')}>
            Back to Classes
          </button>
        </section>
      </main>
    </>
  )
}
