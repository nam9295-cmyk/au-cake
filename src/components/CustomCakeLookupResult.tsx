import { CustomCakePhoto } from './CustomCakePhoto'
import { normalizePhone } from '../lib/utils'
import { CheckCircle2, Clock, Info, ShieldCheck } from 'lucide-react'
import type { CustomCakeLookupResponse } from '../lib/custom-cake-contract.js'
import type { Language } from '../lib/i18n.js'
import { formatCents, formatExtraCents, getStatusInfo } from '../lib/custom-cake-ui.js'

export function CustomCakeLookupResult({
  result,
  language = 'en',
}: {
  result: CustomCakeLookupResponse
  language?: Language
}) {
  const { requestNumber, status, customer, pickup, lines, quote, acceptance } = result
  const statusInfo = getStatusInfo(status, language)

  const cakeLine = lines.find((l) => l.kind === 'custom-cake')
  const smoreLine = lines.find((l) => l.kind === 'cake-addon-smore')

  return (
    <div className="custom-cake-lookup-result" aria-label="Custom Cake Request Details">
      <header className="lookup-result-header">
        <div className="header-meta">
          <span className="request-kicker">{language === 'ko' ? '커스텀 케이크 접수 내역' : 'Custom Cake Request'}</span>
          <h2 className="request-number">{requestNumber}</h2>
        </div>
        <div className="status-badges-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={statusInfo.className}>{statusInfo.label}</span>
          {acceptance && (
            <span
              className="status-badge status-agreed"
              style={{ background: '#f6ffed', color: '#237804', border: '1px solid #b7eb8f' }}
            >
              {language === 'ko'
                ? `견적 v${acceptance.acceptedQuoteVersion} 고객 동의 완료`
                : `Quote v${acceptance.acceptedQuoteVersion} Agreed`}
            </span>
          )}
        </div>
      </header>

      <div className="status-callout-box">
        <p className="status-callout-desc">{statusInfo.description}</p>
        {status === 'requested' && (
          <p className="provisional-notice">
            <Info size={16} />
            <span>
              {language === 'ko'
                ? '현재는 잠정 견적 상태이며 예약이 확정되지 않았습니다. 추가비 산정 후 최종 견적이 발급됩니다.'
                : 'This is a provisional quote and not a confirmed booking. Final quote will follow after design review.'}
            </span>
          </p>
        )}
      </div>

      {/* 1. Request Details */}
      <section className="lookup-section">
        <h3>{language === 'ko' ? '1. 접수 내용' : '1. Cake & Design Details'}</h3>
        <dl className="lookup-dl">
          <div className="lookup-dl-row">
            <dt>{language === 'ko' ? '신청자 성함' : 'Customer Name'}</dt>
            <dd>{customer.customerName}</dd>
          </div>
          <div className="lookup-dl-row">
            <dt>{language === 'ko' ? '연락처' : 'Mobile Phone'}</dt>
            <dd>{customer.customerPhone}</dd>
          </div>
          <div className="lookup-dl-row">
            <dt>{language === 'ko' ? '이메일' : 'Email'}</dt>
            <dd>{customer.customerEmail}</dd>
          </div>
          <div className="lookup-dl-row">
            <dt>{language === 'ko' ? '픽업 희망 일시' : 'Pickup Date & Time'}</dt>
            <dd>
              <strong>{pickup.pickupDate}</strong> {pickup.pickupTime} (Melrose Park, Sydney)
            </dd>
          </div>

          {cakeLine && cakeLine.kind === 'custom-cake' && (
            <>
              <div className="lookup-dl-row">
                <dt>{language === 'ko' ? '단수 및 사이즈' : 'Tier & Size'}</dt>
                <dd>
                  <span className="tier-tag">{cakeLine.tier === 'single' ? 'Single Tier (1단)' : 'Double Tier (2단)'}</span>{' '}
                  <strong>{cakeLine.size}</strong> ({cakeLine.quantity} {language === 'ko' ? '개' : cakeLine.quantity === 1 ? 'cake' : 'cakes'})
                </dd>
              </div>

              <div className="lookup-dl-row">
                <dt>{language === 'ko' ? '피규어 옵션' : 'Figurine Option'}</dt>
                <dd>
                  {cakeLine.figurineSource === 'none' && (language === 'ko' ? '피규어 없음' : 'No figurine')}
                  {cakeLine.figurineSource === 'customer' && (language === 'ko' ? '고객 직접 전달 (피규어 구매비 없음)' : 'Customer Provided (No purchase fee)')}
                  {cakeLine.figurineSource === 'shop' && (language === 'ko' ? '매장 준비 요청' : 'Shop Prepared')}
                </dd>
              </div>

              {cakeLine.designNote && (
                <div className="lookup-dl-row multiline">
                  <dt>{language === 'ko' ? '디자인 메모' : 'Design Note'}</dt>
                  <dd className="note-body">{cakeLine.designNote}</dd>
                </div>
              )}

              {cakeLine.photoRefs && cakeLine.photoRefs.length > 0 && (
                <div className="lookup-dl-row">
                  <dt>{language === 'ko' ? '참고 사진' : 'Reference Photos'}</dt>
                  <dd>
                    <span className="photo-count-badge">
                      {cakeLine.photoRefs.length} {language === 'ko' ? '장의 사진 첨부됨' : 'photos attached'}
                    </span>
                    <div className="custom-cake-staged-photos">
                      {cakeLine.photoRefs.map(ref => <CustomCakePhoto key={requestNumber + ':' + ref} requestNumber={requestNumber} photoRef={ref} customerPhone={normalizePhone(customer.customerPhone)} />)}
                    </div>
                  </dd>
                </div>
              )}
            </>
          )}

          <div className="lookup-dl-row">
            <dt>{language === 'ko' ? '스모어 스틱' : 'S’more Sticks'}</dt>
            <dd>
              <span className="gift-tag">
                {language === 'ko' ? `무료 증정 ${quote.giftSmoreQuantity}개` : `Gift: ${quote.giftSmoreQuantity} sticks (Free)`}
              </span>
              {smoreLine && smoreLine.kind === 'cake-addon-smore' && smoreLine.quantity > 0 && (
                <span className="addon-tag">
                  {language === 'ko' ? `유료 추가 ${smoreLine.quantity}개` : `Paid Add-on: ${smoreLine.quantity} sticks`}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* 2. Authoritative Quote Snapshot */}
      <section className="lookup-section quote-section">
        <div className="quote-section-header">
          <h3>{language === 'ko' ? '2. 견적 상세 내역' : '2. Authoritative Quote Breakdown'}</h3>
          <span className="quote-version-badge">Quote v{quote.quoteVersion}</span>
        </div>

        <dl className="lookup-quote-table">
          <div className="quote-row">
            <dt>{language === 'ko' ? '커스텀 케이크 기본가' : 'Custom Cake Base Price'}</dt>
            <dd>{formatCents(quote.baseCents)}</dd>
          </div>

          <div className="quote-row discount">
            <dt>{language === 'ko' ? '9월 커스텀 5% 특별 할인' : 'September 5% Custom Promotion'}</dt>
            <dd>-{formatCents(quote.cakeDiscountCents)}</dd>
          </div>

          <div className="quote-row extra">
            <dt>{language === 'ko' ? '디자인 추가비' : 'Design Extra'}</dt>
            <dd className={quote.designExtraCents === null ? 'pending' : 'settled'}>
              {formatExtraCents(quote.designExtraCents, language)}
            </dd>
          </div>

          <div className="quote-row extra">
            <dt>{language === 'ko' ? '피규어 추가비' : 'Figurine Extra'}</dt>
            <dd className={quote.figurineExtraCents === null ? 'pending' : 'settled'}>
              {formatExtraCents(quote.figurineExtraCents, language)}
            </dd>
          </div>

          <div className="quote-row gift">
            <dt>{language === 'ko' ? '무료 증정 스모어' : 'Gift S’more Sticks'}</dt>
            <dd>{quote.giftSmoreQuantity} {language === 'ko' ? '개 (무료)' : 'sticks (Complimentary)'}</dd>
          </div>

          {quote.paidSmoreQuantity > 0 && (
            <div className="quote-row">
              <dt>
                {language === 'ko' ? '유료 추가 스모어' : 'Paid Add-on S’more'} ({quote.paidSmoreQuantity}{language === 'ko' ? '개' : ' sticks'})
              </dt>
              <dd>{formatCents(quote.paidSmoreTotalCents)}</dd>
            </div>
          )}

          <div className="quote-divider" />

          <div className="quote-row total">
            <dt>
              <strong>{language === 'ko' ? '확인된 소계 (Known Total)' : 'Known Total'}</strong>
            </dt>
            <dd>
              <strong>{formatCents(quote.knownTotalCents)}</strong>
            </dd>
          </div>

          <div className="quote-row final">
            <dt>
              <strong>{language === 'ko' ? '최종 견적 (Final Quote)' : 'Final Quote'}</strong>
            </dt>
            <dd className={quote.isFinalQuote ? 'final-settled' : 'final-pending'}>
              {quote.isFinalQuote && quote.finalTotalCents !== null ? (
                <strong>{formatCents(quote.finalTotalCents)}</strong>
              ) : (
                <span>{language === 'ko' ? '협의 예정 (To be confirmed)' : 'To be confirmed'}</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* 3. Acceptance & Confirmation Status */}
      <section className="lookup-section status-details-section">
        <h3>{language === 'ko' ? '3. 동의 및 예약 상태' : '3. Agreement & Confirmation'}</h3>
        {acceptance ? (
          <div className="acceptance-box agreed">
            <CheckCircle2 size={18} />
            <div>
              <strong>{language === 'ko' ? '고객 견적 동의 완료' : 'Customer Agreement Recorded'}</strong>
              <p>
                {language === 'ko'
                  ? `견적 버전 v${acceptance.acceptedQuoteVersion}에 동의하셨습니다. (동의 일시: ${new Date(acceptance.acceptedAt).toLocaleString()})`
                  : `Agreed to Quote v${acceptance.acceptedQuoteVersion} on ${new Date(acceptance.acceptedAt).toLocaleString()}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="acceptance-box pending">
            <Clock size={18} />
            <div>
              <strong>{language === 'ko' ? '고객 동의 대기 중' : 'Awaiting Customer Agreement'}</strong>
              <p>
                {language === 'ko'
                  ? '최종 추가비 및 견적이 확정되면 담당자가 동의 절차를 진행합니다.'
                  : 'Once the final quote is confirmed by our decorator, we will confirm your agreement.'}
              </p>
            </div>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="confirmed-guidance-box">
            <ShieldCheck size={20} />
            <div>
              <h4>{language === 'ko' ? '예약이 확정되었습니다!' : 'Booking Confirmed!'}</h4>
              <p>
                {language === 'ko'
                  ? '모든 견적 협의가 완료되어 제작이 확정되었습니다. 약속된 일시에 멜로즈 파크 픽업 장소로 방문해 주세요.'
                  : 'Your celebration cake is scheduled for preparation. Please arrive at the Melrose Park pickup location at your scheduled time.'}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
