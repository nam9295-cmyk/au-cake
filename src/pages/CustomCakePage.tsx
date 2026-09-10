import { useState, useId, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Camera, Minus, Plus, Trash2 } from 'lucide-react'
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
  const [requestId] = useState<string>(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  )
  const [tier, setTier] = useState<'single' | 'double'>('single')
  const [singleSize, setSingleSize] = useState<SingleTierSize>('6in')
  const [doubleSize, setDoubleSize] = useState<DoubleTierSize>('4in+6in')
  const [quantity, setQuantity] = useState(1)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('12:00')
  const [designNote, setDesignNote] = useState('')
  const [figurineSource, setFigurineSource] = useState<'none' | 'customer' | 'shop'>('none')

  type StagedPhoto = {
    photoRef: string
    uploadId: string
    name: string
    previewUrl: string
    width: number
    height: number
    byteLength: number
  }
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoSession, setPhotoSession] = useState<{
    uploadSessionId: string
    uploadToken: string
    expiresAt: string
  } | null>(null)

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
  const paidSmoreCents = paidSmoreQuantity * 315
  const estimatedKnownCents = baseTotalCents - cakeDiscountCents + paidSmoreCents

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setErrorMessage('')
    const files = Array.from(e.target.files)
    e.target.value = ''

    if (stagedPhotos.length + files.length > 5) {
      setErrorMessage(
        language === 'ko'
          ? '사진은 최대 5장까지 첨부할 수 있습니다.'
          : 'You can upload a maximum of 5 photos per request.',
      )
      return
    }

    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

    for (const file of files) {
      const lowerName = file.name.toLowerCase()
      if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || !ALLOWED_MIMES.includes(file.type)) {
        setErrorMessage(
          language === 'ko'
            ? `"${file.name}": 지원되지 않는 형식입니다. JPEG, PNG, WebP 이미지만 업로드 가능합니다 (HEIC 제외).`
            : `"${file.name}": Invalid format. Only JPEG, PNG, or WebP allowed (No HEIC).`,
        )
        return
      }

      // Max 10 MiB (10,485,760 bytes)
      if (file.size > 10485760 || file.size === 0) {
        setErrorMessage(
          language === 'ko'
            ? `"${file.name}": 파일 크기는 10MB 이하여야 합니다.`
            : `"${file.name}": File size exceeds the 10MB limit.`,
        )
        return
      }
    }

    setPhotoUploading(true)
    try {
      let session = photoSession
      if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
        const newSession = await customCakeService.createPhotoSession(requestId)
        session = {
          uploadSessionId: newSession.uploadSessionId,
          uploadToken: newSession.uploadToken,
          expiresAt: newSession.expiresAt,
        }
        setPhotoSession(session)
      }

      const newStaged: StagedPhoto[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dim = await new Promise<{ valid: boolean; width: number; height: number }>((resolve) => {
          const img = new Image()
          const objectUrl = URL.createObjectURL(file)
          img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            const pixels = img.width * img.height
            resolve({ valid: pixels <= 20000000, width: img.width, height: img.height })
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({ valid: true, width: 1200, height: 1200 })
          }
          img.src = objectUrl
        })

        if (!dim.valid) {
          setErrorMessage(
            language === 'ko'
              ? `"${file.name}": 이미지 해상도가 너무 큽니다 (최대 2000만 픽셀 허용).`
              : `"${file.name}": Image resolution exceeds limit (max 20MP).`,
          )
          continue
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const raw = reader.result as string
            const idx = raw.indexOf(',')
            resolve(idx >= 0 ? raw.slice(idx + 1) : raw)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const uploadId = `upload_${Date.now()}_${i}`
        const uploaded = await customCakeService.uploadPhoto(
          {
            'x-custom-cake-upload-session': session.uploadSessionId,
            'x-custom-cake-upload-token': session.uploadToken,
          },
          {
            contractVersion: 'custom-cake-photo.v1',
            requestId,
            uploadId,
            mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
            base64,
          },
        )

        newStaged.push({
          photoRef: uploaded.photoRef,
          uploadId,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          width: uploaded.width,
          height: uploaded.height,
          byteLength: uploaded.byteLength,
        })
      }

      setStagedPhotos((prev) => [...prev, ...newStaged])
    } catch (err) {
      setErrorMessage(
        language === 'ko'
          ? `사진 업로드 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`
          : `Failed to upload photo: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setPhotoUploading(false)
    }
  }

  const removePhoto = async (photoRef: string) => {
    setStagedPhotos((prev) => {
      const target = prev.find((p) => p.photoRef === photoRef)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.photoRef !== photoRef)
    })
    try {
      await customCakeService.deletePhoto({
        contractVersion: 'custom-cake-photo.v1',
        requestNumber: 'PENDING',
        photoRef,
        authorization: { kind: 'admin' },
      })
    } catch {
      // Ignore cleanup error for pre-submission photo
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
          photoRefs: stagedPhotos.map((p) => p.photoRef),
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
                <strong>{language === 'ko' ? '시드니 멜로즈 파크 픽업' : 'Melrose Park, Sydney pick-up'}</strong>
              </article>
              <article>
                <span>03</span>
                <strong>{language === 'ko' ? '9월 프로모션: 5% 할인 + 스모어 2개 증정' : 'September promo: 5% off + 2 free S’mores'}</strong>
              </article>
            </section>
          </div>

          <aside className="cake-detail-purchase">
            <div className="cake-detail-configurator">
              <div className="cake-detail-intro">
                <p className="cake-detail-eyebrow">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
                <h1>{language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}</h1>
                <p className="cake-detail-price cake-detail-price-primary" aria-live="polite">From AUD $155</p>
                <p className="cake-detail-description">
                  {language === 'ko'
                    ? '원하시는 디자인과 구성으로 완성하는 특별한 맞춤형 케이크입니다.'
                    : 'Your celebration, made your way. Bespoke cakes crafted to your design and vision.'}
                </p>

                <div className="cake-detail-badges" aria-label={language === 'ko' ? '주문 안내' : 'Order notes'}>
                  <span>{language === 'ko' ? '9월 5% 할인' : 'September 5% Off'}</span>
                  <span>{language === 'ko' ? '스모어 2개 증정' : '2 Free S’mores / cake'}</span>
                  <span>{language === 'ko' ? '맞춤 디자인 & 피규어' : 'Bespoke & Figurines'}</span>
                </div>
              </div>

              {/* Tier Selection */}
              <fieldset className="cake-detail-fieldset">
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
              <fieldset className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '사이즈 선택' : 'Choose your size'}</legend>
                <div className="cake-detail-options is-stacked">
                  {tier === 'single' ? (
                    <>
                      <OptionButton active={singleSize === '6in'} onClick={() => setSingleSize('6in')}>
                        <div>
                          <strong>6 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 8–10인용' : 'Serves ~8–10'})</span>
                        </div>
                        <span>From AUD $155</span>
                      </OptionButton>
                      <OptionButton active={singleSize === '8in'} onClick={() => setSingleSize('8in')}>
                        <div>
                          <strong>8 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 14–18인용' : 'Serves ~14–18'})</span>
                        </div>
                        <span>From AUD $200</span>
                      </OptionButton>
                      <OptionButton active={singleSize === '10in'} onClick={() => setSingleSize('10in')}>
                        <div>
                          <strong>10 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 24–28인용' : 'Serves ~24–28'})</span>
                        </div>
                        <span>From AUD $250</span>
                      </OptionButton>
                    </>
                  ) : (
                    <>
                      <OptionButton active={doubleSize === '4in+6in'} onClick={() => setDoubleSize('4in+6in')}>
                        <div>
                          <strong>4 + 6 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 15–20인용' : 'Serves ~15–20'})</span>
                        </div>
                        <span>From AUD $255</span>
                      </OptionButton>
                      <OptionButton active={doubleSize === '6in+8in'} onClick={() => setDoubleSize('6in+8in')}>
                        <div>
                          <strong>6 + 8 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 25–35인용' : 'Serves ~25–35'})</span>
                        </div>
                        <span>From AUD $365</span>
                      </OptionButton>
                      <OptionButton active={doubleSize === '8in+10in'} onClick={() => setDoubleSize('8in+10in')}>
                        <div>
                          <strong>8 + 10 inch</strong>
                          <span className="cake-detail-option-serves"> ({language === 'ko' ? '약 40–50인용' : 'Serves ~40–50'})</span>
                        </div>
                        <span>From AUD $475</span>
                      </OptionButton>
                    </>
                  )}
                </div>
              </fieldset>

              {/* Cake Quantity */}
              <fieldset className="cake-detail-fieldset">
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
              <fieldset className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '스모어 스틱 추가 구매' : 'S’more Stick Add-on'}</legend>
                <div className="custom-cake-smore-banner">
                  <div>
                    <strong>{language === 'ko' ? '9월 프로모션 무료 증정' : 'September Gift Included'}</strong>
                    <p>{language === 'ko' ? `케이크 1개당 2개 무료 증정 (총 ${quantity * 2}개)` : `2 free sticks per cake (${quantity * 2} free sticks total)`}</p>
                  </div>
                  <span className="smore-promo-tag">{language === 'ko' ? '무료' : 'FREE'}</span>
                </div>
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
                {paidSmoreQuantity > 0 && (
                  <p className="smore-extra-total-line">
                    + AUD ${(paidSmoreQuantity * 3.15).toFixed(2)}
                  </p>
                )}
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
                      <div className="quote-micro-line">
                        <span>{language === 'ko' ? '기본 금액' : 'Base subtotal'}</span>
                        <span>{formatCents(baseTotalCents)}</span>
                      </div>
                      <div className="quote-micro-line is-discount">
                        <span>{language === 'ko' ? '9월 5% 할인' : 'September 5% discount'}</span>
                        <span>-{formatCents(cakeDiscountCents)}</span>
                      </div>
                      {paidSmoreQuantity > 0 && (
                        <div className="quote-micro-line">
                          <span>{language === 'ko' ? '유료 추가 스모어' : 'Paid S’more sticks'} ({paidSmoreQuantity})</span>
                          <span>{formatCents(paidSmoreCents)}</span>
                        </div>
                      )}
                      <div className="quote-micro-line is-gift">
                        <span>{language === 'ko' ? '무료 증정 스모어' : 'Gift S’more sticks'}</span>
                        <span>{quantity * 2} {language === 'ko' ? '개 무료' : 'free sticks'}</span>
                      </div>
                      <div className="quote-micro-line is-tbd">
                        <span>{language === 'ko' ? '디자인 / 피규어 추가비' : 'Design & figurine extra'}</span>
                        <span>{formatExtraCents(null, language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="custom-cake-summary-right">
                    <span className="known-total-label">{language === 'ko' ? '잠정 확인 금액' : 'Estimated Known Total'}</span>
                    <strong>{formatCents(estimatedKnownCents)}</strong>
                  </div>
                </div>

                <a href="#custom-cake-request-form" className="primary-button cake-detail-request custom-cake-hero-cta">
                  {language === 'ko' ? '상세 요청 정보 작성하기 ↓' : 'Fill in Request Details ↓'}
                </a>
              </div>

              <p className="cake-detail-confirmation-note">
                {language === 'ko'
                  ? '지금 결제되지 않습니다. 요청 접수 후 담당자가 24시간 이내에 세부 견적과 일정을 안내해 드립니다.'
                  : 'No payment is taken now. Our team will review your request and confirm quote & availability within 24 hours.'}
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
                ? '희망 픽업 일정, 원하시는 디자인 및 피규어 준비 방식, 참고 사진을 남겨주세요.'
                : 'Please provide your preferred pickup schedule, design concept, figurine preference, and reference photos.'}
            </p>
          </header>

          <form className="custom-cake-form" onSubmit={handleSubmit} noValidate>
            {/* 01. Pickup Schedule */}
            <fieldset className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">01</span>
                <span>{language === 'ko' ? '희망 픽업 일정' : 'Preferred Pickup Schedule'}</span>
              </legend>
              <p className="custom-cake-field-note">
                {language === 'ko'
                  ? '시드니 멜로즈 파크 픽업 (금 18:00–20:00 · 토–일 08:00–20:00). 최종 가능 일정은 접수 후 안내됩니다.'
                  : 'Melrose Park, Sydney pickup (Fri 18:00–20:00 · Sat–Sun 08:00–20:00). Final availability confirmed on review.'}
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

            {/* 02. Design & Figurine */}
            <fieldset className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">02</span>
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

            {/* 03. Reference Photos */}
            <fieldset className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">03</span>
                <span>{language === 'ko' ? '참고 사진 첨부 (선택, 최대 5장)' : 'Reference Photos (Optional, up to 5)'}</span>
              </legend>
              <p className="custom-cake-field-note">
                {language === 'ko'
                  ? 'JPEG, PNG, WebP 지원 · 파일당 최대 10MB · 최대 2000만 화소 (HEIC 제외)'
                  : 'JPEG, PNG, WebP supported · Max 10MB per file · Max 20MP (No HEIC)'}
              </p>

              <div className="custom-cake-uploader-wrap">
                <label
                  className={`custom-cake-upload-box ${stagedPhotos.length >= 5 || photoUploading ? 'is-disabled' : ''}`}
                  htmlFor={`${formId}-photos`}
                >
                  <Camera size={22} aria-hidden="true" />
                  <span className="upload-box-text">
                    {photoUploading
                      ? (language === 'ko' ? '업로드 처리 중...' : 'Uploading...')
                      : (language === 'ko' ? `사진 추가하기 (${stagedPhotos.length}/5)` : `Add Photo (${stagedPhotos.length}/5)`)}
                  </span>
                  <input
                    id={`${formId}-photos`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={stagedPhotos.length >= 5 || photoUploading}
                    className="visually-hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>

                {stagedPhotos.length > 0 && (
                  <div className="custom-cake-staged-photos">
                    {stagedPhotos.map((photo) => (
                      <div className="custom-cake-photo-thumb" key={photo.photoRef}>
                        <img src={photo.previewUrl} alt={photo.name} />
                        <button
                          type="button"
                          className="photo-remove-button"
                          aria-label={language === 'ko' ? '사진 삭제' : 'Remove photo'}
                          onClick={() => removePhoto(photo.photoRef)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>

            {/* 04. Customer Contact Details */}
            <fieldset className="custom-cake-fieldset">
              <legend className="custom-cake-legend">
                <span className="legend-number">04</span>
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

            {errorMessage && (
              <div className="custom-cake-error-box" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="custom-cake-submit-area">
              <button
                type="submit"
                className="primary-button cake-detail-request custom-cake-submit-cta"
                disabled={submitting}
              >
                {submitting
                  ? (language === 'ko' ? '접수 처리 중...' : 'Submitting Request...')
                  : (language === 'ko' ? '커스텀 케이크 견적 접수하기' : 'Submit Custom Cake Request')}
              </button>
              <p className="cake-detail-confirmation-note">
                {language === 'ko'
                  ? '접수 완료 후 담당자가 24시간 이내에 세부 견적과 제작 가능 여부를 안내해 드립니다.'
                  : 'Submitting a request does not charge your card. We will review your request and reply with a finalized quote within 24 hours.'}
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
                  ? '시드니 멜로즈 파크 매장에서 픽업 가능합니다 (금요일 18:00–20:00, 토–일 08:00–20:00). 특정 일정 조율이 필요한 경우 요청서에 메모를 남겨주세요.'
                  : 'Pick-up is available from our Melrose Park, Sydney kitchen (Friday 18:00–20:00, Saturday–Sunday 08:00–20:00). Please note any special timing requests in your notes.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '견적 및 예약 확정 절차' : 'Quote Review & Confirmation Process'}</summary>
              <p>
                {language === 'ko'
                  ? '접수 시 표시되는 금액은 기본 잠정 견적입니다. 요청서가 접수되면 디자인 난이도 및 피규어 실비를 검토하여 최종 견적을 24시간 이내에 안내해 드립니다. 고객 동의 후 제작 일정이 최종 확정됩니다.'
                  : 'The initial amount is a provisional quote. Once submitted, our team reviews design complexity and figurine requirements to issue a final quote within 24 hours. Production is confirmed upon your approval.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '피규어 및 소품 준비' : 'Figurines & Custom Props'}</summary>
              <p>
                {language === 'ko'
                  ? '직접 피규어를 준비하시거나 매장에서 준비하도록 요청하실 수 있습니다. 직접 전달 시 픽업 2~3일 전까지 매장으로 전달해 주셔야 안전하게 세팅할 수 있습니다.'
                  : 'You may provide your own figurines or request us to source them at cost. Customer-provided figurines should arrive 2–3 days before pick-up for safe sanitization and placement.'}
              </p>
            </details>
            <details>
              <summary>{language === 'ko' ? '9월 프로모션 혜택 안내' : 'September Promotion Details'}</summary>
              <p>
                {language === 'ko'
                  ? '9월 한 달간 커스텀 케이크 기본가 5% 할인과 케이크 1개당 스모어 스틱 2개 무료 증정 혜택이 제공됩니다. 추가 스모어 스틱도 30% 할인가(AUD $3.15)로 함께 주문하실 수 있습니다.'
                  : 'Throughout September, enjoy 5% off the custom cake base subtotal plus 2 complimentary S’more sticks per cake. Additional S’more sticks can be added at the 30% discounted price of AUD $3.15 each.'}
              </p>
            </details>
          </div>
        </section>
      </main>
    </>
  )
}
