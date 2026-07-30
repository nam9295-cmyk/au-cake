import { Check } from 'lucide-react'
import { BankAccountBox } from '../components/BankAccountBox'
import { ProductDetailRows } from '../components/ProductDetailRows'
import { SiteHeader } from '../components/SiteChrome'
import { type Page } from '../lib/app-routes'
import { cakeCopy, type Language } from '../lib/i18n'
import { getReservationPricingAudit } from '../lib/review-coupon-client'
import type { Reservation, StoreSettings } from '../lib/types'
import { formatCurrency, maskPhone } from '../lib/utils'

export function CompletePage({
  navigate,
  reservation,
  settings,
  language,
  setLanguage,
}: {
  navigate: (page: Page) => void
  reservation: Reservation | null
  settings: StoreSettings
  language: Language
  setLanguage: (language: Language) => void
}) {
  const copy = cakeCopy(language)
  const pricingAudit = reservation ? getReservationPricingAudit(reservation) : null
  const usedReviewReward = reservation?.promotionKind === 'review-reward'
  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} />
      <main className="narrow-page">
        <section className="complete-panel">
          <div className="check-icon">
            <Check size={22} />
          </div>
          <h1>{copy.reservationCompleteTitle}</h1>
          {reservation?.id === 'demo-reservation' && (
            <p className="notice-line" role="status">DEMO · This order was not saved or sent.</p>
          )}
          <p>{copy.reservationCompleteText}</p>

          {reservation ? (
            <dl className="detail-list">
              <div>
                <dt>{copy.bookingNumber}</dt>
                <dd>{reservation.reservationNumber}</dd>
              </div>
              <div>
                <dt>{copy.customerName}</dt>
                <dd>{reservation.customerName}</dd>
              </div>
              <div>
                <dt>{copy.mobile}</dt>
                <dd>{maskPhone(reservation.customerPhone)}</dd>
              </div>
              <ProductDetailRows reservation={reservation} language={language} />
              <div>
                <dt>{copy.pickUp}</dt>
                <dd>
                  {reservation.pickupDate} {reservation.pickupTime}
                </dd>
              </div>
              <div>
                <dt>{copy.price}</dt>
                <dd>{formatCurrency(reservation.totalPrice)}</dd>
              </div>
              {pricingAudit && pricingAudit.discountCents > 0 && (
                <>
                  <div className="discount-summary">
                    <dt>{language === 'ko' ? '할인 전 금액' : 'Subtotal'}</dt>
                    <dd>{formatCurrency(pricingAudit.subtotalCents / 100)}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '할인' : 'Discount'}</dt>
                    <dd>{pricingAudit.discountPercent}% · -{formatCurrency(pricingAudit.discountCents / 100)}</dd>
                  </div>
                  {pricingAudit.appliedPromoCodeLast4 && (
                    <div>
                      <dt>{usedReviewReward ? (language === 'ko' ? '후기 리워드' : 'Review reward') : (language === 'ko' ? '적용 코드' : 'Applied code')}</dt>
                      <dd>
                        {usedReviewReward
                          ? language === 'ko'
                            ? `후기 리워드 · ${pricingAudit.discountPercent}% 할인 · 코드 끝 ${pricingAudit.appliedPromoCodeLast4}`
                            : `Review reward · ${pricingAudit.discountPercent}% off · code ending ${pricingAudit.appliedPromoCodeLast4}`
                          : `•••• ${pricingAudit.appliedPromoCodeLast4}`}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          ) : (
            <p className="notice-line">{copy.noReservationText}</p>
          )}

          <div className="complete-bank-section">
            <BankAccountBox settings={settings} totalPrice={reservation?.totalPrice} language={language} />
            <p>{copy.paymentConfirmText}</p>
          </div>

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => navigate('lookup')}>
              {copy.lookupNav}
            </button>
            <button className="primary-button" type="button" onClick={() => navigate('home')}>
              {copy.home}
            </button>
          </div>
        </section>
      </main>
    </>
  )
}
