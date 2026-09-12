import { useState } from 'react'
import { Copy, Check, Clock, ArrowRight } from 'lucide-react'
import { SiteHeader } from '../components/SiteChrome.js'
import type { Page } from '../lib/app-routes.js'
import type { Language } from '../lib/i18n.js'
import type { CustomCakeCreateResponse } from '../lib/custom-cake-contract.js'
import { formatCents, formatExtraCents, getStatusInfo } from '../lib/custom-cake-ui.js'

export function CustomCakeCompletePage({
  navigate,
  language,
  setLanguage,
  cartItemCount,
  createdResult,
  onGoToLookup,
}: {
  navigate: (page: Page) => void
  language: Language
  setLanguage: (lang: Language) => void
  cartItemCount: number
  createdResult: CustomCakeCreateResponse | null
  onGoToLookup: (requestNumber: string) => void
}) {
  const [copied, setCopied] = useState(false)

  if (!createdResult) {
    return (
      <>
        <SiteHeader
          navigate={navigate}
          language={language}
          setLanguage={setLanguage}
          cartItemCount={cartItemCount}
        />
        <main className="narrow-page completion-page">
          <h1>{language === 'ko' ? '접수 정보가 없습니다' : 'No Request Information'}</h1>
          <p>{language === 'ko' ? '접수번호와 휴대폰 번호로 접수 상태를 조회해 주세요.' : 'Check your request using your request number and mobile phone.'}</p>
          <button className="primary-button" type="button" onClick={() => onGoToLookup('')}>
            {language === 'ko' ? '접수 내역 조회하기' : 'Check Request Status'}
          </button>
        </main>
      </>
    )
  }

  const { requestNumber, status, quote } = createdResult
  const statusInfo = getStatusInfo(status, language)

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(requestNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <>
      <SiteHeader
        navigate={navigate}
        language={language}
        setLanguage={setLanguage}
        cartItemCount={cartItemCount}
      />
      <main className="custom-cake-complete-page narrow-page">
        <div className="completion-card">
          <div className="completion-icon-wrapper">
            <Clock size={48} className="pending-clock-icon" />
          </div>

          <span className={statusInfo.className}>{statusInfo.label}</span>

          <h1>{language === 'ko' ? '커스텀 케이크 요청이 접수되었습니다' : 'Custom Cake Request Received'}</h1>

          <div className="provisional-warning-box">
            <p>
              <strong>
                {language === 'ko'
                  ? '현재 상태는 예약 확정이 아닙니다.'
                  : 'This request is NOT a confirmed reservation yet.'}
              </strong>
              <br />
              {language === 'ko'
                ? '보내주신 디자인과 일정을 확인한 후, 제작 가능 여부와 최종 견적(디자인/피규어 추가비)을 연락처로 안내해 드립니다.'
                : 'We will review your design description, reference photos and schedule, then reach out with a finalized quote and confirmation.'}
            </p>
          </div>

          <div className="request-number-box">
            <span className="number-label">{language === 'ko' ? '접수 번호' : 'Request Number'}</span>
            <div className="number-row">
              <strong className="number-text">{requestNumber}</strong>
              <button
                type="button"
                className="copy-button"
                onClick={copyNumber}
                aria-label="Copy request number"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? (language === 'ko' ? '복사됨' : 'Copied') : (language === 'ko' ? '복사' : 'Copy')}</span>
              </button>
            </div>
            <p className="number-tip">
              {language === 'ko'
                ? '주문 조회 시 접수 번호와 입력하신 휴대폰 번호가 필요합니다.'
                : 'Save this number to check your quote status anytime on the Lookup page.'}
            </p>
          </div>

          {/* Quote Breakdown Summary */}
          <section className="quote-summary-section">
            <h2>{language === 'ko' ? '잠정 견적 요약' : 'Provisional Quote Summary'}</h2>
            <dl className="quote-summary-table">
              <div className="summary-row">
                <dt>{language === 'ko' ? '케이크 기본 금액' : 'Custom Cake Base'}</dt>
                <dd>{formatCents(quote.baseCents)}</dd>
              </div>

              {quote.cakeDiscountCents > 0 && (
                <div className="summary-row discount">
                  <dt>{language === 'ko' ? '적용된 커스텀 케이크 할인' : 'Applied Custom Cake Promotion'}</dt>
                  <dd>-{formatCents(quote.cakeDiscountCents)}</dd>
                </div>
              )}

              <div className="summary-row extra">
                <dt>{language === 'ko' ? '디자인 추가비' : 'Design Extra'}</dt>
                <dd>{formatExtraCents(quote.designExtraCents, language)}</dd>
              </div>

              <div className="summary-row extra">
                <dt>{language === 'ko' ? '피규어 추가비' : 'Figurine Extra'}</dt>
                <dd>{formatExtraCents(quote.figurineExtraCents, language)}</dd>
              </div>

              {quote.paidSmoreQuantity > 0 && (
                <div className="summary-row">
                  <dt>{language === 'ko' ? '유료 추가 스모어' : 'Paid Add-on S’more'}</dt>
                  <dd>
                    {quote.paidSmoreQuantity} {language === 'ko' ? '개' : 'sticks'} ({formatCents(quote.paidSmoreTotalCents)})
                  </dd>
                </div>
              )}

              <div className="summary-divider" />

              <div className="summary-row total">
                <dt>
                  <strong>{language === 'ko' ? '잠정 확인 금액' : 'Known Total'}</strong>
                </dt>
                <dd>
                  <strong>{formatCents(quote.knownTotalCents)}</strong>
                </dd>
              </div>

              <div className="summary-row final-status">
                <dt>{language === 'ko' ? '최종 금액 (Final Total)' : 'Final Total'}</dt>
                <dd className="pending-text">{language === 'ko' ? '협의 예정 (To be confirmed)' : 'To be confirmed'}</dd>
              </div>
            </dl>
          </section>

          {/* Next Steps Guide */}
          <section className="next-steps-section">
            <h3>{language === 'ko' ? '진행 절차 안내' : 'What Happens Next'}</h3>
            <ol className="next-steps-list">
              <li>
                <span className="step-num">1</span>
                <div>
                  <strong>{language === 'ko' ? '요청 검토' : 'Request Review'}</strong>
                  <p>{language === 'ko' ? '접수된 디자인 메모와 사진, 희망 일정을 꼼꼼히 확인합니다.' : 'Our team reviews your cake concept, reference photos, and availability.'}</p>
                </div>
              </li>
              <li>
                <span className="step-num">2</span>
                <div>
                  <strong>{language === 'ko' ? '견적 안내 및 고객 동의' : 'Quote & Consent'}</strong>
                  <p>{language === 'ko' ? '디자인 난이도 및 피규어 추가비를 확정하여 최종 견적을 안내해 드립니다.' : 'We provide the final quote including any design/figurine extras for your agreement.'}</p>
                </div>
              </li>
              <li>
                <span className="step-num">3</span>
                <div>
                  <strong>{language === 'ko' ? '예약 확정 및 제작' : 'Confirmation & Baking'}</strong>
                  <p>{language === 'ko' ? '고객 동의 후 예약이 최종 확정되며, 약속된 일정에 맞춰 정성껏 제작합니다.' : 'Once agreed, your order is officially confirmed and scheduled for pickup.'}</p>
                </div>
              </li>
            </ol>
          </section>

          <div className="completion-actions">
            <button
              type="button"
              className="primary-button full-width"
              onClick={() => onGoToLookup(requestNumber)}
            >
              {language === 'ko' ? '접수 내역 조회하기' : 'Check Request Status'}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="secondary-button full-width"
              onClick={() => navigate('cakes')}
            >
              {language === 'ko' ? '다른 케이크 둘러보기' : 'Browse More Cakes'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
