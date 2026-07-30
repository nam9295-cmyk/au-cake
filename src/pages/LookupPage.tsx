import { useState } from 'react'
import { OrderDetailRows } from '../components/ProductDetailRows'
import { SiteHeader } from '../components/SiteChrome'
import { type Page } from '../lib/app-routes'
import { cakeCopy, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import { getReservationByNumber } from '../lib/repository'
import type { PublicReservation } from '../lib/types'
import { formatCurrency, isValidPhone, normalizePhone } from '../lib/utils'

function formatReservationStatus(status: string) {
  if (marketConfig.market === 'KR') return status
  const mapping: Record<string, string> = {
    '예약신청': 'Requested',
    '예약확정': 'Confirmed',
    '픽업완료': 'Picked up',
    '취소': 'Cancelled',
  }
  return mapping[status] || status
}

function formatPaymentStatus(status: string) {
  if (marketConfig.market === 'KR') return status
  const mapping: Record<string, string> = {
    '입금대기': 'Pending payment',
    '입금확인': 'Paid',
    '현장결제': 'Pay on pick-up',
    '환불필요': 'Refund required',
  }
  return mapping[status] || status
}

export function LookupPage({
  navigate,
  language,
  setLanguage,
  cartItemCount,
}: {
  navigate: (page: Page) => void
  language: Language
  setLanguage: (language: Language) => void
  cartItemCount: number
}) {
  const copy = cakeCopy(language)
  const [reservationNumber, setReservationNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [reservation, setReservation] = useState<PublicReservation | null>(null)
  const [message, setMessage] = useState('')
  const totalPriceCents = reservation && 'totalPriceCents' in reservation
    && Number.isSafeInteger(reservation.totalPriceCents)
    ? reservation.totalPriceCents as number
    : null
  const [searching, setSearching] = useState(false)

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setReservation(null)
    const normalizedPhone = normalizePhone(phone)
    if (!isValidPhone(normalizedPhone)) {
      setMessage(copy.errors.phone)
      return
    }
    setSearching(true)
    try {
      const result = await getReservationByNumber(reservationNumber.trim(), normalizedPhone)
      setReservation(result)
      if (!result) setMessage(copy.notFoundText)
    } catch {
      setMessage(copy.errors.submit)
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="narrow-page">
        <form className="lookup-form" onSubmit={lookup}>
          <h1>{copy.lookupTitle}</h1>
          <label>
            {copy.bookingNumber}
            <input value={reservationNumber} onChange={(event) => setReservationNumber(event.target.value)} />
          </label>
          <label>
            {copy.lookupPhoneLabel}
            <input
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder={copy.phonePlaceholder}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <button className="primary-button full-width" type="submit" disabled={searching}>
            {searching ? copy.submitting : copy.search}
          </button>
          {message && <p className="error-text">{message}</p>}
        </form>

        {reservation && (
          <section className="result-panel">
            <dl className="detail-list">
              <div>
                <dt>{copy.bookingStatus}</dt>
                <dd>{formatReservationStatus(reservation.status)}</dd>
              </div>
              <div>
                <dt>{copy.paymentStatus}</dt>
                <dd>{formatPaymentStatus(reservation.paymentStatus)}</dd>
              </div>
              <OrderDetailRows reservation={reservation} language={language} />
              {totalPriceCents !== null && (
                <div>
                  <dt>{copy.price}</dt>
                  <dd>{formatCurrency(totalPriceCents / 100)}</dd>
                </div>
              )}
              <div>
                <dt>{copy.pickUp}</dt>
                <dd>
                  {reservation.pickupDate} {reservation.pickupTime}
                </dd>
              </div>
            </dl>
          </section>
        )}
      </main>
    </>
  )
}
