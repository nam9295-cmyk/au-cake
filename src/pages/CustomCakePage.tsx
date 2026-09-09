import { useState, useId, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Check, Info, Sparkles, Trash2 } from 'lucide-react'
import { SiteHeader } from '../components/SiteChrome.js'
import type { Page } from '../lib/app-routes.js'
import type { Language } from '../lib/i18n.js'
import {
  CUSTOM_CAKE_BASE_PRICES,
  customCakeService,
  formatCents,
  formatExtraCents,
} from '../lib/custom-cake-client.js'
import type {
  CustomCakeCreateRequest,
  CustomCakeCreateResponse,
} from '../lib/custom-cake-contract.js'
import { isValidPhone, normalizePhone } from '../lib/utils.js'

type SingleTierSize = '6in' | '8in' | '10in'
type DoubleTierSize = '4in+6in' | '6in+8in' | '8in+10in'

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
  const [tier, setTier] = useState<'single' | 'double'>('single')
  const [singleSize, setSingleSize] = useState<SingleTierSize>('6in')
  const [doubleSize, setDoubleSize] = useState<DoubleTierSize>('4in+6in')
  const [quantity, setQuantity] = useState(1)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('12:00')
  const [designNote, setDesignNote] = useState('')
  const [figurineSource, setFigurineSource] = useState<'none' | 'customer' | 'shop'>('none')
  const [photoFiles, setPhotoFiles] = useState<{ id: string; name: string; previewUrl: string }[]>([])
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

  // Derived client preview amounts for instant feedback before submission
  const baseUnitCents = tier === 'single'
    ? CUSTOM_CAKE_BASE_PRICES.single[singleSize]
    : CUSTOM_CAKE_BASE_PRICES.double[doubleSize]
  const baseTotalCents = baseUnitCents * quantity
  // 5% discount on Custom Cake base subtotal only (September promotion)
  const cakeDiscountCents = Math.round((baseTotalCents * 5) / 100)
  const giftSmoreCount = quantity * 2
  const paidSmoreCents = paidSmoreQuantity * 315
  const estimatedKnownCents = baseTotalCents - cakeDiscountCents + paidSmoreCents

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const newItems = files.map((file, idx) => ({
      id: `photo_${Date.now()}_${idx}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }))
    setPhotoFiles((prev) => [...prev, ...newItems])
    e.target.value = ''
  }

  const removePhoto = (id: string) => {
    setPhotoFiles((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!privacyConsent) {
      setErrorMessage(
        language === 'ko'
          ? '개인정보 수집 및 처리에 동의해 주세요.'
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

    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const cakeLineId = `line_${Date.now()}_cake`
    const smoreLineId = `line_${Date.now()}_smore`

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
          photoRefs: photoFiles.map((p) => p.id),
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
    try {
      const response = await customCakeService.createRequest(requestPayload)
      onComplete(response)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(
        msg || (language === 'ko' ? '접수 처리 중 오류가 발생했습니다.' : 'Failed to submit request.'),
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
      <main className="custom-cake-page">
        <header className="custom-cake-header">
          <p className="summary-kicker">05 CUSTOM & CREATIVE</p>
          <h1>{language === 'ko' ? '커스텀 케이크 주문 접수' : 'Custom Cake Request'}</h1>
          <p className="custom-cake-hero-lead">
            {language === 'ko'
              ? '원하시는 디자인과 구성으로 완성하는 특별한 맞춤형 케이크입니다.'
              : 'Your celebration, made your way. Bespoke cakes crafted to your design and vision.'}
          </p>

          <div className="custom-cake-promo-banner" role="region" aria-label="Promotion">
            <Sparkles size={20} className="promo-sparkle" />
            <div>
              <strong>
                {language === 'ko' ? '9월 특별 프로모션' : 'September Special Event'}
              </strong>
              <p>
                {language === 'ko'
                  ? '커스텀 케이크 기본가 5% 할인 + 케이크 1개당 스모어 스틱 2개 무료 증정!'
                  : '5% discount on Custom Cake base price + 2 complimentary S’more Sticks per cake!'}
              </p>
            </div>
          </div>
        </header>

        <form className="custom-cake-form" onSubmit={handleSubmit} noValidate>
          {/* 1. Tier & Size Selection */}
          <section className="form-section">
            <h2>1. {language === 'ko' ? '단수 및 사이즈 선택' : 'Tier & Size'}</h2>
            
            <fieldset className="tier-selector">
              <legend className="visually-hidden">Select Cake Tier</legend>
              <button
                type="button"
                className={`tier-pill ${tier === 'single' ? 'active' : ''}`}
                onClick={() => setTier('single')}
              >
                {language === 'ko' ? 'Single Tier (1단)' : 'Single Tier'}
              </button>
              <button
                type="button"
                className={`tier-pill ${tier === 'double' ? 'active' : ''}`}
                onClick={() => setTier('double')}
              >
                {language === 'ko' ? 'Double Tier (2단)' : 'Double Tier'}
              </button>
            </fieldset>

            <div className="size-cards-grid">
              {tier === 'single' ? (
                <>
                  <label className={`size-card ${singleSize === '6in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="6in"
                      checked={singleSize === '6in'}
                      onChange={() => setSingleSize('6in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">6 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 8–10인용' : 'Serves ~8–10'}</span>
                      <strong className="size-price">From AUD $155</strong>
                    </div>
                  </label>

                  <label className={`size-card ${singleSize === '8in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="8in"
                      checked={singleSize === '8in'}
                      onChange={() => setSingleSize('8in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">8 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 14–18인용' : 'Serves ~14–18'}</span>
                      <strong className="size-price">From AUD $200</strong>
                    </div>
                  </label>

                  <label className={`size-card ${singleSize === '10in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="10in"
                      checked={singleSize === '10in'}
                      onChange={() => setSingleSize('10in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">10 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 24–28인용' : 'Serves ~24–28'}</span>
                      <strong className="size-price">From AUD $250</strong>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label className={`size-card ${doubleSize === '4in+6in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="4in+6in"
                      checked={doubleSize === '4in+6in'}
                      onChange={() => setDoubleSize('4in+6in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">4 + 6 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 15–20인용' : 'Serves ~15–20'}</span>
                      <strong className="size-price">From AUD $255</strong>
                    </div>
                  </label>

                  <label className={`size-card ${doubleSize === '6in+8in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="6in+8in"
                      checked={doubleSize === '6in+8in'}
                      onChange={() => setDoubleSize('6in+8in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">6 + 8 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 25–35인용' : 'Serves ~25–35'}</span>
                      <strong className="size-price">From AUD $365</strong>
                    </div>
                  </label>

                  <label className={`size-card ${doubleSize === '8in+10in' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cakeSize"
                      value="8in+10in"
                      checked={doubleSize === '8in+10in'}
                      onChange={() => setDoubleSize('8in+10in')}
                    />
                    <div className="size-card-body">
                      <span className="size-title">8 + 10 inch</span>
                      <span className="size-serves">{language === 'ko' ? '약 40–50인용' : 'Serves ~40–50'}</span>
                      <strong className="size-price">From AUD $475</strong>
                    </div>
                  </label>
                </>
              )}
            </div>

            <div className="field-group quantity-row">
              <label htmlFor={`${formId}-quantity`}>
                {language === 'ko' ? '케이크 수량' : 'Cake Quantity'}
              </label>
              <select
                id={`${formId}-quantity`}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(5, Number(e.target.value))))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {language === 'ko' ? '개' : n === 1 ? 'cake' : 'cakes'}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* 2. Pickup Date & Time */}
          <section className="form-section">
            <h2>2. {language === 'ko' ? '희망 픽업 일정' : 'Preferred Pickup'}</h2>
            <p className="section-note">
              {language === 'ko'
                ? '시드니 멜로즈 파크 픽업 (금 18:00–20:00 · 토–일 08:00–20:00). 커스텀 일정 확정은 접수 후 안내됩니다.'
                : 'Melrose Park, Sydney pickup (Fri 18:00–20:00 · Sat–Sun 08:00–20:00). Final availability confirmed upon review.'}
            </p>
            <div className="pickup-grid">
              <div className="field-group">
                <label htmlFor={`${formId}-pickup-date`}>
                  {language === 'ko' ? '픽업 희망일' : 'Pickup Date'}
                </label>
                <input
                  id={`${formId}-pickup-date`}
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label htmlFor={`${formId}-pickup-time`}>
                  {language === 'ko' ? '희망 시간' : 'Pickup Time'}
                </label>
                <input
                  id={`${formId}-pickup-time`}
                  type="time"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 3. Design & Figurine Details */}
          <section className="form-section">
            <h2>3. {language === 'ko' ? '디자인 및 피규어 협의' : 'Design & Figurines'}</h2>

            <div className="field-group">
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
                    : 'Describe your color theme, overall style, piped messages or wording, etc.'
                }
                value={designNote}
                onChange={(e) => setDesignNote(e.target.value)}
              />
            </div>

            <fieldset className="field-group figurine-group">
              <legend>{language === 'ko' ? '피규어 준비 방식' : 'Figurine Options'}</legend>
              <div className="radio-cards">
                <label className={`radio-card ${figurineSource === 'none' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="figurineSource"
                    value="none"
                    checked={figurineSource === 'none'}
                    onChange={() => setFigurineSource('none')}
                  />
                  <div>
                    <strong>{language === 'ko' ? '피규어 없음' : 'No Figurine'}</strong>
                    <span>{language === 'ko' ? '버터크림 및 데코레이션으로만 제작' : 'Design crafted with piping & decor only'}</span>
                  </div>
                </label>

                <label className={`radio-card ${figurineSource === 'customer' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="figurineSource"
                    value="customer"
                    checked={figurineSource === 'customer'}
                    onChange={() => setFigurineSource('customer')}
                  />
                  <div>
                    <strong>{language === 'ko' ? '고객 직접 전달' : 'Customer Provided'}</strong>
                    <span>
                      {language === 'ko'
                        ? '피규어를 직접 가져다주심 (피규어 구매비 없음, 디자인 배치 비용 별도 협의)'
                        : 'You provide the figurines (no figurine purchase fee; placement agreed separately)'}
                    </span>
                  </div>
                </label>

                <label className={`radio-card ${figurineSource === 'shop' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="figurineSource"
                    value="shop"
                    checked={figurineSource === 'shop'}
                    onChange={() => setFigurineSource('shop')}
                  />
                  <div>
                    <strong>{language === 'ko' ? '매장 준비 요청' : 'Shop Sourced'}</strong>
                    <span>
                      {language === 'ko'
                        ? '원하시는 피규어 실비를 협의하여 매장에서 준비'
                        : 'Figurine cost agreed and purchased by verygood chocolate'}
                    </span>
                  </div>
                </label>
              </div>
            </fieldset>

            {/* Reference Photos */}
            <div className="field-group">
              <label htmlFor={`${formId}-photos`}>
                {language === 'ko' ? '참고 사진 첨부 (선택)' : 'Reference Photos (Optional)'}
              </label>
              <div className="photo-uploader">
                <label className="photo-upload-button" htmlFor={`${formId}-photos`}>
                  <Camera size={20} />
                  <span>{language === 'ko' ? '사진 추가' : 'Add Photo'}</span>
                  <input
                    id={`${formId}-photos`}
                    type="file"
                    accept="image/*"
                    multiple
                    className="visually-hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
                {photoFiles.length > 0 && (
                  <div className="photo-preview-list">
                    {photoFiles.map((photo) => (
                      <div className="photo-preview-item" key={photo.id}>
                        <img src={photo.previewUrl} alt={photo.name} />
                        <button
                          type="button"
                          className="photo-remove-btn"
                          aria-label="Remove photo"
                          onClick={() => removePhoto(photo.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4. S'more Add-on Option */}
          <section className="form-section smore-section">
            <h2>4. {language === 'ko' ? '스모어 스틱 추가 구매' : 'S’more Stick Add-on'}</h2>
            <div className="smore-info-box">
              <p>
                <strong>
                  {language === 'ko'
                    ? '케이크 주문 고객 상시 30% 할인'
                    : 'Permanent 30% Off for Cake Orders'}
                </strong>
                <br />
                {language === 'ko'
                  ? '정상가 AUD $4.50 → 케이크 추가 구매가 AUD $3.15 (개당)'
                  : 'Regular AUD $4.50 → Cake Add-on AUD $3.15 each'}
              </p>
            </div>

            <div className="smore-gifts-row">
              <span className="gift-badge">
                <Check size={16} />
                {language === 'ko' ? '9월 프로모션 증정품' : 'Complimentary Event Gift'}
              </span>
              <span>
                {language === 'ko'
                  ? `무료 증정: ${giftSmoreCount}개 (케이크 1개당 2개)`
                  : `Free Gift: ${giftSmoreCount} sticks (2 per cake)`}
              </span>
            </div>

            <div className="field-group smore-quantity-row">
              <label htmlFor={`${formId}-smore-qty`}>
                {language === 'ko' ? '유료 추가 수량' : 'Additional Paid S’more Sticks'}
              </label>
              <div className="smore-qty-control">
                <button
                  type="button"
                  onClick={() => setPaidSmoreQuantity((q) => Math.max(0, q - 1))}
                  disabled={paidSmoreQuantity <= 0}
                >
                  -
                </button>
                <span>{paidSmoreQuantity}</span>
                <button
                  type="button"
                  onClick={() => setPaidSmoreQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
              {paidSmoreQuantity > 0 && (
                <span className="smore-subtotal-text">
                  = AUD ${(paidSmoreQuantity * 3.15).toFixed(2)}
                </span>
              )}
            </div>
          </section>

          {/* 5. Authoritative Quote Breakdown Card */}
          <section className="quote-breakdown-card" aria-label="Provisional Quote Breakdown">
            <header className="breakdown-header">
              <h3>{language === 'ko' ? '잠정 견적 내역 (Provisional Quote)' : 'Provisional Quote Breakdown'}</h3>
              <span className="quote-badge provisional">Provisional (잠정)</span>
            </header>

            <dl className="breakdown-list">
              <div className="breakdown-row">
                <dt>{language === 'ko' ? '커스텀 케이크 기본 가격' : 'Custom Cake Base Price'}</dt>
                <dd>{formatCents(baseTotalCents)}</dd>
              </div>

              <div className="breakdown-row discount-row">
                <dt>{language === 'ko' ? '9월 커스텀 5% 특별 할인' : 'September Custom 5% Discount'}</dt>
                <dd>-{formatCents(cakeDiscountCents)}</dd>
              </div>

              <div className="breakdown-row extra-row">
                <dt>
                  {language === 'ko' ? '디자인 추가비' : 'Design Extra'}
                  <small className="help-text"> ({language === 'ko' ? '난이도에 따라 협의' : 'Agreed per design'})</small>
                </dt>
                <dd className="tbd-text">{formatExtraCents(null, language)}</dd>
              </div>

              <div className="breakdown-row extra-row">
                <dt>
                  {language === 'ko' ? '피규어 추가비' : 'Figurine Extra'}
                  <small className="help-text"> ({language === 'ko' ? '준비 방식에 따라 협의' : 'Agreed per sourcing'})</small>
                </dt>
                <dd className="tbd-text">{formatExtraCents(null, language)}</dd>
              </div>

              <div className="breakdown-row gift-row">
                <dt>{language === 'ko' ? '무료 증정 스모어 스틱' : 'Gift S’more Sticks'}</dt>
                <dd>
                  {giftSmoreCount} {language === 'ko' ? '개 (무료 증정)' : 'sticks (Complimentary)'}
                </dd>
              </div>

              {paidSmoreQuantity > 0 && (
                <div className="breakdown-row">
                  <dt>
                    {language === 'ko' ? '유료 추가 스모어 스틱' : 'Paid Add-on S’more'} ({paidSmoreQuantity}{language === 'ko' ? '개' : ' sticks'})
                  </dt>
                  <dd>{formatCents(paidSmoreCents)}</dd>
                </div>
              )}

              <div className="breakdown-divider" />

              <div className="breakdown-row total-row">
                <dt>
                  <strong>{language === 'ko' ? '잠정 확인 금액 (Known Total)' : 'Estimated Known Total'}</strong>
                  <p className="breakdown-subtext">
                    {language === 'ko'
                      ? '기본가 - 할인 + 유료 스모어 (미확정 추가비 제외)'
                      : 'Base - discount + paid S’more (excludes pending extras)'}
                  </p>
                </dt>
                <dd>
                  <strong>{formatCents(estimatedKnownCents)}</strong>
                </dd>
              </div>

              <div className="breakdown-row final-row">
                <dt>{language === 'ko' ? '최종 확정 견적 (Final Quote)' : 'Final Quote'}</dt>
                <dd className="tbd-highlight">{language === 'ko' ? '협의 후 확정 안내' : 'To be confirmed'}</dd>
              </div>
            </dl>

            <div className="quote-clarification-notice">
              <Info size={16} />
              <p>
                {language === 'ko'
                  ? '잠정 견적은 예약 확정이나 결제 요청이 아닙니다. 추가 디자인 및 피규어 협의가 완료된 후 최종 견적을 안내해 드립니다.'
                  : 'This provisional quote is NOT a final total or payment request. Final quote will be issued after design & figurine confirmation.'}
              </p>
            </div>
          </section>

          {/* 6. Customer Contact & Privacy */}
          <section className="form-section">
            <h2>5. {language === 'ko' ? '고객 연락처 정보' : 'Contact Information'}</h2>

            <div className="field-group">
              <label htmlFor={`${formId}-name`}>
                {language === 'ko' ? '주문자 성함' : 'Full Name'} *
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                required
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor={`${formId}-phone`}>
                {language === 'ko' ? '호주 연락처' : 'Australian Mobile Phone'} *
              </label>
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

            <div className="field-group">
              <label htmlFor={`${formId}-email`}>
                {language === 'ko' ? '이메일 주소' : 'Email Address'} *
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                required
                autoComplete="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor={`${formId}-note`}>
                {language === 'ko' ? '추가 요청사항 (선택)' : 'Additional Notes (Optional)'}
              </label>
              <input
                id={`${formId}-note`}
                type="text"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
              />
            </div>

            <div className="privacy-consent-box">
              <label className="checkbox-label">
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
          </section>

          {errorMessage && (
            <div className="error-banner" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button full-width custom-submit-btn"
              disabled={submitting}
            >
              {submitting
                ? (language === 'ko' ? '접수 처리 중...' : 'Submitting Request...')
                : (language === 'ko' ? '커스텀 케이크 견적 접수하기' : 'Submit Custom Cake Request')}
            </button>
            <p className="submit-disclaimer">
              {language === 'ko'
                ? '접수 완료 후 담당자가 24시간 이내에 세부 견적과 제작 가능 여부를 안내해 드립니다.'
                : 'Submitting a request does not reserve a cake. We will review your request and reply with a finalized quote within 24 hours.'}
            </p>
          </div>
        </form>
      </main>
    </>
  )
}
