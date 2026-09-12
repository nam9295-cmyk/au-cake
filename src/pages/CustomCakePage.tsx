import { useState, useId, useEffect, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { SiteHeader } from '../components/SiteChrome.js'
import type { Page } from '../lib/app-routes.js'
import type { Language } from '../lib/i18n.js'
import {
  formatExtraCents,
} from '../lib/custom-cake-ui.js'
import { getCakeWireRepository } from '../lib/custom-cake-repository'
import { createSubmissionIntent } from '../lib/custom-cake-submission'
import type {
  CustomCakeCreateRequest,
  CustomCakeCreateResponse,
} from '../lib/custom-cake-contract.js'
import { isValidPhone, normalizePhone } from '../lib/utils.js'

type SingleTierSize = '6in' | '8in' | '10in'
type DoubleTierSize = '4in+6in' | '6in+8in' | '8in+10in'

function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`cake-detail-option${active ? ' is-selected' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function CustomCakePage({
  navigate,
  language,
  setLanguage,
  cartItemCount,
  onComplete,
}: {
  navigate: (page: Page) => void
  language: Language
  setLanguage: (lang: Language) => void
  cartItemCount: number
  onComplete: (result: CustomCakeCreateResponse) => void
}) {
  const formId = useId()
  const [intent, setIntent] = useState(() => {
    try { return createSubmissionIntent() } catch { return null }
  })
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    getCakeWireRepository().then(repo => repo.getCapabilities()).then(capabilities => {
      if (active) setReady(capabilities.customCakeV1)
    }).catch(() => { if (active) setReady(false) })
    return () => { active = false }
  }, [])
  const [tier, setTier] = useState<'single' | 'double'>('single')
  const [singleSize, setSingleSize] = useState<SingleTierSize>('6in')
  const [doubleSize, setDoubleSize] = useState<DoubleTierSize>('4in+6in')
  const [quantity, setQuantity] = useState(1)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('12:00')
  const [promoCode, setPromoCode] = useState('')
  const [designNote, setDesignNote] = useState('')
  const [figurineSource, setFigurineSource] = useState<'none' | 'customer' | 'shop'>('none')

  const [paidSmoreQuantity, setPaidSmoreQuantity] = useState(0)

  // Customer Contact
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const startNewIntent = () => {
    if (submitting) return
    if (!window.confirm('Start a separate request? If a previous submission timed out, check its status with the shop first to avoid a duplicate.')) return
    try {
      setIntent(createSubmissionIntent())
      setLocked(false)
      setErrorMessage('')
    } catch { setErrorMessage('Secure request creation is unavailable in this browser.') }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!intent || !ready || submitting) return
    setErrorMessage('')

    if (!privacyConsent) {
      setErrorMessage(
        language === 'ko'
          ? '개인정보 수집 및 이용에 동의해 주세요.'
          : 'Please accept the privacy consent to proceed.',
      )
      return
    }

    const trimmedName = customerName.trim()
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setErrorMessage(
        language === 'ko'
          ? '성함을 2자 이상 80자 이내로 입력해 주세요.'
          : 'Please enter a valid customer name (2–80 characters).',
      )
      return
    }

    const normalizedPhone = normalizePhone(customerPhone)
    if (!isValidPhone(normalizedPhone)) {
      setErrorMessage(
        language === 'ko'
          ? '유효한 호주 전화번호를 입력해 주세요 (예: 0412 345 678).'
          : 'Please enter a valid Australian mobile phone number (04xx xxx xxx).',
      )
      return
    }

    if (!pickupDate) {
      setErrorMessage(
        language === 'ko'
          ? '희망 픽업 날짜를 선택해 주세요.'
          : 'Please select a preferred pickup date.',
      )
      return
    }

    const { requestId, cakeLineId, smoreLineId } = intent

    const requestPayload: CustomCakeCreateRequest = {
      contractVersion: 'custom-cake.v1',
      requestId,
      customer: {
        customerName: trimmedName,
        customerPhone: normalizedPhone,
        customerEmail: customerEmail.trim().toLowerCase(),
      },
      pickup: {
        pickupDate,
        pickupTime,
      },
      requestNote: requestNote.trim(),
      promoCode,
      privacyConsent: true,
      lines: [
        {
          kind: 'custom-cake',
          lineId: cakeLineId,
          parentCakeLineId: null,
          productId: 'custom-cake',
          quantity,
          ...(tier === 'single'
            ? { tier: 'single' as const, size: singleSize }
            : { tier: 'double' as const, size: doubleSize }),
          designNote: designNote.trim(),
          figurineSource,
          photoRefs: [],
        },
        ...(paidSmoreQuantity > 0
          ? [
              {
                kind: 'cake-addon-smore' as const,
                lineId: smoreLineId,
                productId: 'smore-stick' as const,
                quantity: paidSmoreQuantity,
                parentCakeLineId: cakeLineId,
              },
            ]
          : []),
      ],
    }

    setSubmitting(true)
    setLocked(true)
    try {
      const repository = await getCakeWireRepository()
      const response = await intent.submit(repository, requestPayload)
      onComplete(response)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(
        msg === 'PROMO_CODE_INVALID'
          ? (language === 'ko' ? '프로모션 코드를 확인해 주세요.' : 'Please check the promo code.')
          : msg === 'PHOTO_LIMIT_EXCEEDED'
            ? 'Photo capacity is currently unavailable. Please contact the shop; your request has been kept for retry.'
            : 'We could not confirm receipt. Retry the same request below, or contact the shop before starting another request.',
      )
    } finally {
      setSubmitting(false)
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
      <main className="cake-detail-page custom-cake-detail-page">
        <nav className="cake-detail-breadcrumb" aria-label={language === 'ko' ? '경로' : 'Breadcrumb'}>
          <button type="button" onClick={() => navigate('cakes')}>
            <ArrowLeft size={16} aria-hidden="true" />
            {language === 'ko' ? '케이크로 돌아가기' : 'Back to cakes'}
          </button>
        </nav>

        {/* 1. Desktop Two-Column Hero with configurator */}
        <section className="cake-detail-hero" aria-label={language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}>
          <div className="cake-detail-gallery">
            <div className="cake-detail-main-image">
              <img
                src="/products/custom-cake.webp"
                alt={language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}
                width={2160}
                height={1012}
                loading="eager"
                decoding="async"
              />
            </div>

            <section className="cake-detail-trust" aria-label={language === 'ko' ? '베리굿 커스텀 제작 안내' : 'Custom cake service notes'}>
              <article>
                <span>01</span>
                <strong>{language === 'ko' ? '1:1 맞춤형 디자인 상담' : 'Bespoke design consultation'}</strong>
              </article>
              <article>
                <span>02</span>
                <strong>{language === 'ko' ? '시드니 Melrose Park 사전 약속 픽업' : 'Pre-arranged Melrose Park, Sydney pick-up'}</strong>
              </article>
              <article>
                <span>03</span>
                <strong>{language === 'ko' ? '9월 선주문 · VERYGOOD CUSTOM 코드 입력 시 10% 할인' : 'September Pre-order Offer · 10% off with code VERYGOOD CUSTOM'}</strong>
              </article>
            </section>
          </div>

          <aside className="cake-detail-purchase">
            <div className="cake-detail-configurator">
              <div className="cake-detail-intro">
                <p className="cake-detail-eyebrow">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
                <h1>{language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}</h1>
                <p className="cake-detail-price cake-detail-price-primary" aria-live="polite">From AUD $159</p>
                <p className="cake-detail-description">
                  {language === 'ko'
                    ? '원하시는 디자인과 구성으로 완성하는 특별한 맞춤형 케이크입니다.'
                    : 'Your celebration, made your way. Bespoke cakes crafted to your design and vision.'}
                </p>

                <div className="cake-detail-badges" aria-label={language === 'ko' ? '주문 안내' : 'Order notes'}>
                  <span>{language === 'ko' ? '9월 선주문 프로모션 · VERYGOOD CUSTOM 코드 입력 시 10% 할인' : 'September Pre-order Offer · 10% off with code VERYGOOD CUSTOM'}</span>
                  <span>{language === 'ko' ? '맞춤 디자인 & 피규어' : 'Bespoke & Figurines'}</span>
                </div>
              </div>

              {/* Tier Selection */}
              <fieldset disabled={locked} className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '단수 선택' : 'Choose cake tier'}</legend>
                <div className="cake-detail-options">
                  <OptionButton active={tier === 'single'} onClick={() => setTier('single')}>
                    <strong>Single Tier</strong>
                    <span>{language === 'ko' ? '1단' : '1 Tier'}</span>
                  </OptionButton>
                  <OptionButton active={tier === 'double'} onClick={() => setTier('double')}>
                    <strong>Double Tier</strong>
                    <span>{language === 'ko' ? '2단' : '2 Tiers'}</span>
                  </OptionButton>
                </div>
              </fieldset>

              {/* Size Selection */}
              <fieldset disabled={locked} className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '사이즈 선택' : 'Choose your size'}</legend>
                <div className="cake-detail-options is-stacked">
                  {tier === 'single' ? (
                    <>
                      <OptionButton active={singleSize === '6in'} onClick={() => setSingleSize('6in')}>
                        <div>
                          <strong>6 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 8–10인용' : 'Serves ~8–10'})</span>
                        </div>
                        <span>From AUD $159</span>
                      </OptionButton>
                      <OptionButton active={singleSize === '8in'} onClick={() => setSingleSize('8in')}>
                        <div>
                          <strong>8 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 14–18인용' : 'Serves ~14–18'})</span>
                        </div>
                        <span>From AUD $219</span>
                      </OptionButton>
                      <OptionButton active={singleSize === '10in'} onClick={() => setSingleSize('10in')}>
                        <div>
                          <strong>10 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 24–28인용' : 'Serves ~24–28'})</span>
                        </div>
                        <span>From AUD $319</span>
                      </OptionButton>
                    </>
                  ) : (
                    <>
                      <OptionButton active={doubleSize === '4in+6in'} onClick={() => setDoubleSize('4in+6in')}>
                        <div>
                          <strong>4 + 6 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 15–20인용' : 'Serves ~15–20'})</span>
                        </div>
                        <span>From AUD $239</span>
                      </OptionButton>
                      <OptionButton active={doubleSize === '6in+8in'} onClick={() => setDoubleSize('6in+8in')}>
                        <div>
                          <strong>6 + 8 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 25–35인용' : 'Serves ~25–35'})</span>
                        </div>
                        <span>From AUD $339</span>
                      </OptionButton>
                      <OptionButton active={doubleSize === '8in+10in'} onClick={() => setDoubleSize('8in+10in')}>
                        <div>
                          <strong>8 + 10 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 40–50인용' : 'Serves ~40–50'})</span>
                        </div>
                        <span>From AUD $459</span>
                      </OptionButton>
                    </>
                  )}
                </div>
              </fieldset>

              {/* Cake Quantity */}
              <fieldset disabled={locked} className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '케이크 수량' : 'Cake quantity'}</legend>
                <div className="cake-detail-quantity">
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '수량 줄이기' : 'Decrease quantity'}
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <output aria-live="polite">{quantity}</output>
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '수량 늘리기' : 'Increase quantity'}
                    disabled={quantity >= 5}
                    onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </fieldset>

              {/* S'more Stick Add-on */}
              <fieldset disabled={locked} className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '스모어 스틱 추가 구매' : 'S’more Stick Add-on'}</legend>
                <div className="custom-cake-smore-counter-row">
                  <div>
                    <strong>{language === 'ko' ? '유료 추가 스틱 (30% 할인가)' : 'Additional sticks (30% off)'}</strong>
                    <span className="smore-price-subtext">{language === 'ko' ? '개당 AUD $3.15 (정상가 AUD $4.50)' : 'AUD $3.15 each (Reg. AUD $4.50)'}</span>
                  </div>
                  <div className="cake-detail-quantity">
                    <button
                      type="button"
                      aria-label="Decrease smore sticks"
                      disabled={paidSmoreQuantity <= 0}
                      onClick={() => setPaidSmoreQuantity((q) => Math.max(0, q - 1))}
                    >
                      <Minus aria-hidden="true" />
                    </button>
                    <output aria-live="polite">{paidSmoreQuantity}</output>
                    <button
                      type="button"
                      aria-label="Increase smore sticks"
                      onClick={() => setPaidSmoreQuantity((q) => q + 1)}
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Provisional Quote Breakdown Card */}
            <div className="cake-detail-checkout">
              <div className="cake-detail-checkout-card">
                <div className="cake-detail-order-summary">
                  <div>
                    <span>{language === 'ko' ? '선택 구성' : 'Your selection'}</span>
                    <strong className="cake-detail-order-product">
                      {language === 'ko' ? '커스텀 케이크' : 'Custom Cake'} · {tier === 'single' ? `Single (${singleSize})` : `Double (${doubleSize})`} × {quantity}
                    </strong>
                    <div className="custom-cake-quote-lines">
                      <div className="quote-micro-line is-tbd">
                        <span>{language === 'ko' ? '디자인 / 피규어 추가비' : 'Design & figurine extra'}</span>
                        <span>{formatExtraCents(null, language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="custom-cake-summary-right">
                    <span>{language === 'ko' ? '기본 카탈로그 가격' : 'Catalogue base price'}</span>
                    <strong>From AUD $159</strong>
                  </div>
                </div>

                <a href="#custom-cake-request-form" className="primary-button cake-detail-request custom-cake-hero-cta">
                  {language === 'ko' ? '상세 요청 정보 작성하기 ↓' : 'Fill in Request Details ↓'}
                </a>
              </div>

              <p className="cake-detail-confirmation-note">
                {language === 'ko'
                  ? '지금 결제되지 않습니다. 디자인과 제작 가능 여부를 확인한 후 요청 내용을 검토해 연락드리겠습니다.'
                  : "No payment is taken now. We'll review your request and get back to you after checking the design and availability."}
              </p>
            </div>
          </aside>
        </section>

        {/* 2. Bottom Detailed Request Form Section */}
        <section id="custom-cake-request-form" className="custom-cake-request-section" aria-labelledby="custom-request-title">
          <header className="custom-cake-section-header">
            <p className="summary-kicker">{language === 'ko' ? '주문 요청서' : 'Bespoke Request'}</p>
            <h2 id="custom-request-title">{language === 'ko' ? '상세 요청 정보' : 'Request & Design Details'}</h2>
            <p>
              {language === 'ko'
                ? '희망 픽업 일정, 원하시는 디자인 및 피규어 준비 방식을 남겨주세요.'
                : 'Please provide your preferred pickup schedule, design concept, and figurine preference.'}
            </p>
          </header>

          <form className="custom-cake-form" onSubmit={handleSubmit} noValidate>
            {/* 01. Pickup Schedule */}
            <fieldset disabled={locked} className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">01</span>
                <span>{language === 'ko' ? '희망 픽업 일정' : 'Preferred Pickup Schedule'}</span>
              </legend>
              <p className="custom-cake-field-note">
                {language === 'ko'
                  ? '시드니 Melrose Park에서 사전 약속 픽업으로 진행됩니다. 정확한 전달 장소와 방법은 주문 확정 후 안내드립니다. 운영 시간: 금 18:00–20:00 · 토–일 08:00–20:00.'
                  : 'Pre-arranged pick-up in Melrose Park, Sydney. Exact handoff details are provided after your request is confirmed. Available times: Fri 18:00–20:00 · Sat–Sun 08:00–20:00.'}
              </p>
              <div className="custom-cake-grid-2col">
                <div className="custom-cake-field">
                  <label htmlFor={`${formId}-pickup-date`}>{language === 'ko' ? '픽업 희망일' : 'Pickup Date'} *</label>
                  <input
                    id={`${formId}-pickup-date`}
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                  />
                </div>
                <div className="custom-cake-field">
                  <label htmlFor={`${formId}-pickup-time`}>{language === 'ko' ? '희망 시간' : 'Pickup Time'} *</label>
                  <input
                    id={`${formId}-pickup-time`}
                    type="time"
                    required
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset disabled={locked} className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">02</span>
                <span>{language === 'ko' ? '9월 선주문 프로모션' : 'September Pre-order Offer'}</span>
              </legend>
              <p className="custom-cake-field-note">
                {language === 'ko'
                  ? '커스텀 케이크 10% 할인 · 9월 13일~30일 주문 시 9월·10월·11월 픽업 예약에 적용됩니다.'
                  : '10% OFF CUSTOM CAKES · Order from 13–30 September and reserve your cake for September, October or November pickup.'}
              </p>
              <div className="custom-cake-field">
                <label htmlFor={`${formId}-promo-code`}>{language === 'ko' ? '프로모션 코드' : 'Promo code'}</label>
                <input
                  id={`${formId}-promo-code`}
                  type="text"
                  autoComplete="off"
                  placeholder="VERYGOOD CUSTOM"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
              </div>
            </fieldset>

            {/* 02. Design & Figurine */}
            <fieldset disabled={locked} className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">03</span>
                <span>{language === 'ko' ? '디자인 및 피규어 협의' : 'Design & Figurine Details'}</span>
              </legend>
              <div className="custom-cake-field">
                <label htmlFor={`${formId}-design-note`}>
                  {language === 'ko' ? '디자인 설명 및 요청사항' : 'Design Description & Notes'}
                </label>
                <textarea
                  id={`${formId}-design-note`}
                  rows={4}
                  maxLength={1000}
                  placeholder={
                    language === 'ko'
                      ? '원하시는 색상 톤, 디자인 스타일, 케이크 문구(레터링) 등을 자유롭게 작성해 주세요.'
                      : 'Describe your preferred color palette, overall theme, piped lettering/message, etc.'
                  }
                  value={designNote}
                  onChange={(e) => setDesignNote(e.target.value)}
                />
                <span className="custom-cake-char-counter">{designNote.length} / 1000</span>
              </div>

              <div className="custom-cake-field" style={{ marginTop: '18px' }}>
                <label>{language === 'ko' ? '피규어 준비 방식' : 'Figurine Sourcing'}</label>
                <div className="cake-detail-options is-stacked">
                  <OptionButton
                    active={figurineSource === 'none'}
                    onClick={() => setFigurineSource('none')}
                  >
                    <div>
                      <strong>{language === 'ko' ? '피규어 없음' : 'No Figurine'}</strong>
                      <span className="cake-detail-option-serves">
                        {language === 'ko' ? '버터크림 및 파이핑 데코레이션으로만 제작' : 'Design crafted with piping & decor only'}
                      </span>
                    </div>
                    <span>{language === 'ko' ? '기본' : 'Included'}</span>
                  </OptionButton>
                  <OptionButton
                    active={figurineSource === 'customer'}
                    onClick={() => setFigurineSource('customer')}
                  >
                    <div>
                      <strong>{language === 'ko' ? '고객 직접 전달' : 'Customer Provided'}</strong>
                      <span className="cake-detail-option-serves">
                        {language === 'ko' ? '피규어를 직접 가져다주심 (피규어 구매비 없음, 배치 비용 별도 협의)' : 'You provide the figurines (no purchase fee; placement agreed separately)'}
                      </span>
                    </div>
                    <span>{language === 'ko' ? '협의' : 'Agreed'}</span>
                  </OptionButton>
                  <OptionButton
                    active={figurineSource === 'shop'}
                    onClick={() => setFigurineSource('shop')}
                  >
                    <div>
                      <strong>{language === 'ko' ? '매장 준비 요청' : 'Shop Sourced'}</strong>
                      <span className="cake-detail-option-serves">
                        {language === 'ko' ? '원하시는 피규어 실비를 협의하여 매장에서 준비' : 'Figurine cost agreed and sourced by verygood chocolate'}
                      </span>
                    </div>
                    <span>{language === 'ko' ? '실비 협의' : 'At cost'}</span>
                  </OptionButton>
                </div>
              </div>
            </fieldset>

            {/* 03. Reference Images */}
            <fieldset disabled={locked} className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">04</span>
                <span>{language === 'ko' ? '참고 이미지' : 'Reference Images'}</span>
              </legend>
              <p className="custom-cake-field-note">
                {language === 'ko'
                  ? '참고 이미지는 접수 후 베리굿과 별도로 공유해 주세요.'
                  : 'Reference images can be shared with Verygood after your request is received.'}
              </p>
            </fieldset>

            {/* 04. Customer Contact Details */}
            <fieldset disabled={locked} className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">05</span>
                <span>{language === 'ko' ? '주문자 연락처 정보' : 'Contact Information'}</span>
              </legend>
              <div className="custom-cake-grid-2col">
                <div className="custom-cake-field">
                  <label htmlFor={`${formId}-name`}>{language === 'ko' ? '주문자 성함' : 'Full Name'} *</label>
                  <input
                    id={`${formId}-name`}
                    type="text"
                    required
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="custom-cake-field">
                  <label htmlFor={`${formId}-phone`}>{language === 'ko' ? '호주 연락처' : 'Australian Mobile Phone'} *</label>
                  <input
                    id={`${formId}-phone`}
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="0412 345 678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="custom-cake-field" style={{ marginTop: '14px' }}>
                <label htmlFor={`${formId}-email`}>{language === 'ko' ? '이메일 주소' : 'Email Address'} *</label>
                <input
                  id={`${formId}-email`}
                  type="email"
                  required
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div className="custom-cake-field" style={{ marginTop: '14px' }}>
                <label htmlFor={`${formId}-note`}>{language === 'ko' ? '기타 요청사항 (선택)' : 'Additional Notes (Optional)'}</label>
                <input
                  id={`${formId}-note`}
                  type="text"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                />
              </div>

              <div className="custom-cake-consent-box">
                <label className="custom-cake-consent-label">
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                  />
                  <span>
                    {language === 'ko'
                      ? '[필수] 케이크 주문 접수 및 견적 안내를 위한 개인정보 수집 및 이용에 동의합니다.'
                      : '[Required] I consent to the collection and use of my contact details for order processing and quote communication.'}
                  </span>
                </label>
              </div>
            </fieldset>

            {(!ready || !intent) && <p role="status">{language === 'ko' ? '현재 온라인 접수가 불가능합니다. 매장으로 문의해 주세요.' : 'Online requests are currently unavailable. Please contact the shop.'}</p>}
            {locked && <p>{language === 'ko' ? '재시도 시 최초 접수 내용이 그대로 전송됩니다.' : 'Retry sends the same saved request. Contact and selections are locked.'}</p>}
            {locked && <button type="button" className="secondary-button" disabled={submitting} onClick={startNewIntent}>{language === 'ko' ? '별도 요청 시작' : 'Start a separate request'}</button>}
            {errorMessage && (
              <div className="custom-cake-error-box" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="custom-cake-submit-area">
              <button
                type="submit"
                className="primary-button cake-detail-request custom-cake-submit-cta"
                disabled={submitting || !ready || !intent}
              >
                {submitting
                  ? (language === 'ko' ? '접수 처리 중...' : 'Submitting Request...')
                  : (language === 'ko' ? '커스텀 케이크 견적 접수하기' : 'Submit Custom Cake Request')}
              </button>
              <p className="cake-detail-confirmation-note">
                {language === 'ko'
                  ? '접수 시 결제되지 않습니다. 디자인과 제작 가능 여부를 확인한 후 요청 내용을 검토해 연락드리겠습니다.'
                  : "Submitting a request does not charge your card. We'll review your request and get back to you after checking the design and availability."}
              </p>
            </div>
          </form>
        </section>

        {/* 3. Accordion Guide Section */}
        <section className="cake-detail-accordion" aria-labelledby="custom-cake-guide-title">
          <p className="summary-kicker">{language === 'ko' ? '주문 전 확인' : 'Good to know'}</p>
          <h2 id="custom-cake-guide-title">{language === 'ko' ? '커스텀 케이크 제작 및 픽업 안내' : 'Custom Cake Ordering & Pick-up'}</h2>
          <div>
            <details open>
              <summary>{language === 'ko' ? '픽업 장소 및 일정' : 'Pick-up Location & Hours'}</summary>
              <p>
                {language === 'ko'
                  ? '시드니 Melrose Park에서 사전 약속 픽업으로 진행됩니다. 정확한 전달 장소와 방법은 주문 확정 후 안내드립니다. 운영 시간은 금요일 18:00–20:00, 토–일 08:00–20:00이며 특정 일정 요청은 요청서에 남겨주세요.'
                  : 'Pre-arranged pick-up in Melrose Park, Sydney. Exact handoff details are provided after your request is confirmed. Available times are Friday 18:00–20:00 and Saturday–Sunday 08:00–20:00; note any special timing request in the form.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '견적 및 예약 확정 절차' : 'Quote Review & Confirmation Process'}</summary>
              <p>
                {language === 'ko'
                  ? '접수 시 표시되는 금액은 기본 잠정 견적입니다. 디자인 난이도와 피규어 실비 및 제작 가능 여부를 확인한 후 최종 견적을 안내해 드리며, 고객 동의 후 제작 일정이 확정됩니다.'
                  : 'The initial amount is a provisional quote. We review design complexity, figurine requirements, and availability before providing a final quote. Production is confirmed upon your approval.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '피규어 및 소품 준비' : 'Figurines & Custom Props'}</summary>
              <p>
                {language === 'ko'
                  ? '직접 피규어를 준비하시거나 Verygood에서 준비하도록 요청하실 수 있습니다. 고객이 준비한 피규어의 전달 방법과 일정은 주문 확정 과정에서 안내드립니다.'
                  : 'You may provide your own figurines or ask Verygood to source them. Handoff details and timing for customer-provided figurines will be arranged during order confirmation.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '9월 선주문 프로모션' : 'September Pre-order Offer'}</summary>
              <p>
                {language === 'ko'
                  ? 'VERYGOOD CUSTOM 코드를 입력하면 커스텀 케이크 기본가에 10% 할인이 적용됩니다. 적용 여부는 서버가 기록한 접수 시각과 픽업 날짜를 기준으로 확인됩니다. 9월 13일~30일 주문 시 9월·10월·11월 픽업 예약에 적용됩니다. 추가 스모어 스틱은 기존과 같이 개당 AUD $3.15에 구매할 수 있습니다.'
                  : 'Enter VERYGOOD CUSTOM for 10% off the Custom Cake base price. Eligibility is confirmed from the server-recorded receipt time and pickup date. Order from 13–30 September for September, October, or November pickup. Additional S’more sticks remain AUD $3.15 each.'}
              </p>
            </details>
          </div>
        </section>
      </main>
    </>
  )
}
