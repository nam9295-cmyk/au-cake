import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PickupDatePicker } from '../components/WeekendDatePicker'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader, VanillaFreshCreamCakeSilhouette } from '../components/SiteChrome'
import { type CakeDetailSelection } from '../lib/cake-detail'
import { type Page } from '../lib/app-routes'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_PACK_SIZE,
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_VANILLA_CAKE_FLAVOR,
  DEFAULT_VANILLA_CAKE_POINT_COLOR,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  isPromoEligibleProduct,
  formatVanillaCakeFlavor,
  formatVanillaCakeSheet,
  getChocolateIcingSurcharge,
  getCupcakeFinishSurcharge,
  getLemonIcingCount,
  getProductById,
  getFreshLemonCupcakePackSize,
  isCheesecakeProduct,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  isVanillaFreshCreamCakeProduct,
  getReservationPrice,
  getReservationUnitPrice,
  getValidPromoCode,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  POUND_ADDON_OPTIONS,
  PRODUCT_GROUPS,
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_POINT_COLOR_OPTIONS,

  usesReservationChocolateType,
} from '../lib/constants'
import {
  normalizeReviewCouponCode,
  getPromoEntryState,
  getPromoPriceDisplay,
  getDemoReviewPricingAudit,
  promoErrorMessage,
  shouldShowPromoInput,
} from '../lib/review-coupon-client'
import {
  cakeCopy,
  formatChocolateTypeText,
  formatPoundAddonText,
  getCakeSizeText,
  getChocolateTypeText,
  getPoundAddonText,
  formatVanillaCakePointColorText,
  getProductText,
  type Language,
} from '../lib/i18n'
import {
  CAKE_ORDER_LINES_UNAVAILABLE_ERROR,
  PICKUP_TIME_CLASS_CONFLICT_ERROR,
  createCakeOrder,
  createReservation,
  listCakePickupOpenings,
  listClassBookedSlots,
} from '../lib/repository'
import { trackEvent } from '../lib/analytics'
import type { CacaoPercent, CakeSize, ChocolateType, PoundAddon, ProductId, Reservation, StoreSettings, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet } from '../lib/types'
import {
  filterCakePickupTimesForClass,
  isCakePickupBlockedByClass,
  isCakePickupDateUnavailable,
  type CakePickupOpening,
  type ClassBookedSlot,
} from '../lib/class-utils'
import {
  customerTimeOptionsForDate,
  firstCustomerPickupDate,
  formatCurrency,
  generateRequestId,
  isCakePickupServiceTime,
  isPickupTimeAllowed,
  isSchoolPickupWindowClosed,
  PICKUP_TIME_TOO_SOON_ERROR,
  PICKUP_TIME_UNAVAILABLE_ERROR,
  isValidPhone,
  normalizePhone,
  todayInputValue,
} from '../lib/utils'

const productCardImages = {
  pave: '/products/pave-chocolate-cake-sydney.webp',
  pound: '/products/chocolate-pound-cake-sydney.webp',
  cupcakes: '/products/chocolate-cupcakes-sydney.webp',
  basque: '/products/chocolatiers-basque-cheesecake-sydney.webp',
  lemon: '/products/lemon-cake-sydney.webp',
} as const

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refreshNow = () => setNow(new Date())
    const interval = window.setInterval(refreshNow, 60_000)
    window.addEventListener('focus', refreshNow)
    document.addEventListener('visibilitychange', refreshNow)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshNow)
      document.removeEventListener('visibilitychange', refreshNow)
    }
  }, [])

  return now
}

export function ReservePage({
  navigate,
  settings,
  initialProductId,
  initialSelection,
  initialOrderLines,
  initialPromoCode,
  initialRewardPercent,
  onInitialPromoConsumed,
  reviewDemoMode,
  onComplete,
  language,
  setLanguage,
  cartItemCount,
}: {
  navigate: (page: Page) => void
  settings: StoreSettings
  initialProductId: ProductId
  initialSelection: CakeDetailSelection | null
  initialOrderLines: readonly CakeDetailSelection[] | null
  initialPromoCode: string
  initialRewardPercent: 5 | 10 | null
  onInitialPromoConsumed: () => void
  reviewDemoMode: boolean
  onComplete: (reservation: Reservation) => void
  language: Language
  setLanguage: (language: Language) => void
  cartItemCount: number
}) {
  const orderSelections = initialOrderLines && initialOrderLines.length > 1 ? initialOrderLines : null
  const isMultiOrder = orderSelections !== null
  const [requestId] = useState(generateRequestId)
  const copy = cakeCopy(language)
  const [form, setForm] = useState({
    productId: initialSelection?.productId || initialProductId,
    cacaoPercent: '기본' as CacaoPercent,
    cakeSize: initialSelection?.cakeSize || DEFAULT_CAKE_SIZE as CakeSize,
    chocolateType: initialSelection?.chocolateType || DEFAULT_CHOCOLATE_TYPE as ChocolateType,
    poundAddon: initialSelection?.poundAddon || DEFAULT_POUND_ADDON as PoundAddon,
    chocolateIcingCount: initialSelection?.chocolateIcingCount || 0,
    vanillaCreamCount: initialSelection?.vanillaCreamCount || 0,
    partyDecorationCount: initialSelection?.partyDecorationCount || 0,
    vanillaCakeSheet: normalizeVanillaCakeSheet(initialSelection?.productId || initialProductId, initialSelection?.vanillaCakeSheet) as VanillaCakeSheet,
    vanillaCakeFlavor: initialSelection?.vanillaCakeFlavor || DEFAULT_VANILLA_CAKE_FLAVOR as VanillaCakeFlavor,
    vanillaCakePointColor: normalizeVanillaCakePointColor(initialSelection?.productId || initialProductId, initialSelection?.vanillaCakePointColor || DEFAULT_VANILLA_CAKE_POINT_COLOR) as VanillaCakePointColor,
    pickupDate: todayInputValue(),
    pickupTime: '',
    quantity: initialSelection?.quantity || 1,
    customerName: '',
    customerPhone: '',
    requestNote: '',
    promoCode: initialPromoCode,
    privacy: false,
    website: '',
  })
  const [reviewRewardHandoff] = useState(() => ({
    couponCode: normalizeReviewCouponCode(initialPromoCode),
    rewardPercent: initialRewardPercent,
  }))
  const currentReviewCoupon = normalizeReviewCouponCode(form.promoCode)
  const knownReviewRewardPercent = currentReviewCoupon && currentReviewCoupon === reviewRewardHandoff.couponCode
    ? reviewRewardHandoff.rewardPercent
    : null
  const [showCakeSelector, setShowCakeSelector] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pickupAvailability, setPickupAvailability] = useState<{
    dataDate: string
    loading: boolean
    error: boolean
    bookedSlots: ClassBookedSlot[]
    pickupOpenings: CakePickupOpening[]
  }>({
    dataDate: '',
    loading: true,
    error: false,
    bookedSlots: [],
    pickupOpenings: [],
  })
  const [pickupCalendarAvailability, setPickupCalendarAvailability] = useState<{
    loading: boolean
    error: boolean
    bookedSlots: ClassBookedSlot[]
    pickupOpenings: CakePickupOpening[]
  }>({ loading: true, error: false, bookedSlots: [], pickupOpenings: [] })
  const [pickupAvailabilityRefetchKey, setPickupAvailabilityRefetchKey] = useState(0)

  useEffect(() => {
    if (initialPromoCode) onInitialPromoConsumed()
  }, [initialPromoCode, onInitialPromoConsumed])
  const now = useCurrentTime()
  const minPickupDate = useMemo(() => firstCustomerPickupDate(settings, now), [settings, now])
  const pickupDate = form.pickupDate && form.pickupDate >= minPickupDate ? form.pickupDate : minPickupDate
  const baseTimes = useMemo(() => customerTimeOptionsForDate(pickupDate, settings, now), [pickupDate, settings, now])
  const pickupAvailabilityIsCurrent = pickupAvailability.dataDate === pickupDate
  const pickupAvailabilityLoading = pickupAvailability.loading || !pickupAvailabilityIsCurrent
  const pickupAvailabilityError = pickupAvailabilityIsCurrent && pickupAvailability.error
  const times = useMemo(() => {
    if (pickupAvailabilityLoading || pickupAvailabilityError) return []
    return filterCakePickupTimesForClass(
      pickupDate,
      baseTimes,
      pickupAvailability.bookedSlots,
      pickupAvailability.pickupOpenings,
    )
  }, [
    baseTimes,
    pickupAvailability.bookedSlots,
    pickupAvailability.pickupOpenings,
    pickupAvailabilityError,
    pickupAvailabilityLoading,
    pickupDate,
  ])
  const selectedPickupTime = times.includes(form.pickupTime) ? form.pickupTime : times[0] || ''
  const isPickupCalendarDateDisabled = useCallback((date: string) => {
    const dateTimes = customerTimeOptionsForDate(date, settings, now)
    if (pickupCalendarAvailability.loading) return true
    if (pickupCalendarAvailability.error) return dateTimes.length === 0
    return isCakePickupDateUnavailable(
      date,
      dateTimes,
      pickupCalendarAvailability.bookedSlots,
      pickupCalendarAvailability.pickupOpenings,
    )
  }, [now, pickupCalendarAvailability, settings])

  const refetchPickupAvailability = useCallback(() => {
    setPickupAvailability({
      dataDate: '',
      loading: true,
      error: false,
      bookedSlots: [],
      pickupOpenings: [],
    })
    setPickupCalendarAvailability((current) => ({ ...current, loading: true, error: false }))
    setPickupAvailabilityRefetchKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listClassBookedSlots(pickupDate),
      listCakePickupOpenings(pickupDate),
    ])
      .then(([bookedSlots, pickupOpenings]) => {
        if (cancelled) return
        setPickupAvailability({
          dataDate: pickupDate,
          loading: false,
          error: false,
          bookedSlots,
          pickupOpenings,
        })
      })
      .catch(() => {
        if (cancelled) return
        setPickupAvailability({
          dataDate: pickupDate,
          loading: false,
          error: true,
          bookedSlots: [],
          pickupOpenings: [],
        })
      })

    return () => {
      cancelled = true
    }
  }, [pickupAvailabilityRefetchKey, pickupDate])

  useEffect(() => {
    let cancelled = false

    Promise.all([listClassBookedSlots(), listCakePickupOpenings()])
      .then(([bookedSlots, pickupOpenings]) => {
        if (cancelled) return
        setPickupCalendarAvailability({ loading: false, error: false, bookedSlots, pickupOpenings })
      })
      .catch(() => {
        if (cancelled) return
        setPickupCalendarAvailability({ loading: false, error: true, bookedSlots: [], pickupOpenings: [] })
      })

    return () => {
      cancelled = true
    }
  }, [pickupAvailabilityRefetchKey])

  async function submitReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.customerPhone)

    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      setError(copy.errors.name)
      return
    }
    if (!isValidPhone(phone)) {
      setError(`${copy.errors.phone} ${copy.phoneHelp}`)
      return
    }
    if (!pickupDate || pickupDate < minPickupDate) {
      setError(copy.errors.pickupDate)
      return
    }
    if (pickupAvailabilityLoading || pickupAvailabilityError) {
      setError(copy.pickupAvailabilityError)
      return
    }
    if (!selectedPickupTime) {
      setError(copy.errors.pickupTime)
      return
    }
    if (!isCakePickupServiceTime(pickupDate, selectedPickupTime) || isSchoolPickupWindowClosed(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupTimeUnavailable)
      return
    }
    if (!isPickupTimeAllowed(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupLeadTime)
      return
    }
    if (isCakePickupBlockedByClass(
      pickupDate,
      selectedPickupTime,
      pickupAvailability.bookedSlots,
      pickupAvailability.pickupOpenings,
    )) {
      setError(copy.errors.pickupTimeUnavailable)
      return
    }
    if (!isMultiOrder && (form.quantity < 1 || form.quantity > MAX_RESERVATION_QUANTITY)) {
      setError(copy.errors.quantity(MAX_RESERVATION_QUANTITY))
      return
    }
    if (!form.privacy) {
      setError(copy.errors.privacy)
      return
    }
    const submittedPromo = getPromoEntryState(promoProductId, form.promoCode, undefined, knownReviewRewardPercent)
    if (submittedPromo.kind === 'invalid') {
      setError(promoErrorMessage('PROMO_CODE_INVALID', language) || copy.errors.submit)
      return
    }

    setSubmitting(true)
    try {
      const reservationInput = {
        customerName: form.customerName,
        customerPhone: phone,
        productId: form.productId,
        cakeSize: form.cakeSize,
        chocolateType: form.chocolateType,
        poundAddon: form.poundAddon,
        chocolateIcingCount: form.chocolateIcingCount,
        vanillaCreamCount: form.vanillaCreamCount,
        partyDecorationCount: form.partyDecorationCount,
        vanillaCakeSheet: form.vanillaCakeSheet,
        vanillaCakeFlavor: form.vanillaCakeFlavor,
        vanillaCakePointColor: form.vanillaCakePointColor,
        quantity: form.quantity,
        pickupDate,
        pickupTime: selectedPickupTime,
        cacaoPercent: form.cacaoPercent,
        requestNote: form.requestNote,
        promoCode: submittedPromo.normalizedCode,
        privacyConsent: form.privacy,
        requestId,
        website: form.website,
      }
      const demoPricing = reviewDemoMode ? getDemoReviewPricingAudit(currentPrice, submittedPromo) : null
      const reservation: Reservation = demoPricing
        ? {
            id: 'demo-reservation',
            reservationNumber: 'VG-C-AU-DEMO',
            customerName: form.customerName.trim(),
            customerPhone: phone,
            productId: form.productId,
            cakeSize: form.cakeSize,
            chocolateType: form.chocolateType,
            poundAddon: form.poundAddon,
            chocolateIcingCount: form.chocolateIcingCount,
            vanillaCreamCount: form.vanillaCreamCount,
            partyDecorationCount: form.partyDecorationCount,
            vanillaCakeSheet: form.vanillaCakeSheet,
            vanillaCakeFlavor: form.vanillaCakeFlavor,
            vanillaCakePointColor: form.vanillaCakePointColor,
            quantity: form.quantity,
            pickupDate,
            pickupTime: selectedPickupTime,
            cacaoPercent: form.cacaoPercent,
            requestNote: form.requestNote,
            status: '예약신청',
            paymentStatus: '입금대기',
            totalPrice: demoPricing.totalPriceCents / 100,
            ...demoPricing,
            promotionKind: promoEntry.normalizedCode.startsWith('JENNIE') ? 'manual-coupon' : 'review-reward',
            adminMemo: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : orderSelections
          ? await createCakeOrder({
              customerName: form.customerName,
              customerPhone: phone,
              pickupDate,
              pickupTime: selectedPickupTime,
              requestNote: form.requestNote,
              promoCode: submittedPromo.normalizedCode,
              privacyConsent: form.privacy,
              requestId,
              website: form.website,
              orderLines: orderSelections.map((selection) => ({
                productId: selection.productId,
                cakeSize: selection.cakeSize,
                chocolateType: selection.chocolateType,
                poundAddon: selection.poundAddon,
                chocolateIcingCount: selection.chocolateIcingCount,
                vanillaCreamCount: selection.vanillaCreamCount,
                partyDecorationCount: selection.partyDecorationCount,
                vanillaCakeSheet: selection.vanillaCakeSheet,
                vanillaCakeFlavor: selection.vanillaCakeFlavor,
                vanillaCakePointColor: selection.vanillaCakePointColor,
                quantity: selection.quantity,
              })),
            })
          : await createReservation(reservationInput)
      trackEvent('cake_booking_request', {
        product_id: form.productId,
        quantity: orderSelections?.reduce((sum, selection) => sum + selection.quantity, 0) || form.quantity,
        value: reservation.totalPrice,
        currency: 'AUD',
      })
      setForm((current) => ({ ...current, promoCode: '' }))
      onComplete(reservation)
      navigate('complete')
    } catch (submitError) {
      if (submitError instanceof Error && (
        submitError.message === PICKUP_TIME_CLASS_CONFLICT_ERROR ||
        submitError.message === PICKUP_TIME_UNAVAILABLE_ERROR
      )) {
        setError(copy.errors.pickupTimeUnavailable)
        refetchPickupAvailability()
      } else if (submitError instanceof Error && submitError.message === PICKUP_TIME_TOO_SOON_ERROR) {
        setError(copy.errors.pickupLeadTime)
      } else if (submitError instanceof Error && submitError.message === CAKE_ORDER_LINES_UNAVAILABLE_ERROR) {
        setError(language === 'ko'
          ? '여러 케이크 동시 신청을 현재 사용할 수 없어요. 장바구니에서 잠시 후 다시 확인해 주세요.'
          : 'Multiple-cake requests are currently unavailable. Please return to your order and try again shortly.')
      } else {
        setError(submitError instanceof Error
          ? promoErrorMessage(submitError.message, language) || copy.errors.submit
          : copy.errors.submit)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedProduct = getProductById(form.productId)
  const selectedProductText = getProductText(selectedProduct.id, language)
  const selectedProductImage = selectedProduct.id === 'pound-cake'
    ? productCardImages.pound
    : selectedProduct.id === 'cupcake-dozen'
      ? productCardImages.cupcakes
      : isCheesecakeProduct(selectedProduct.id)
        ? productCardImages.basque
        : isFreshLemonCupcakeProduct(selectedProduct.id)
          ? productCardImages.lemon
          : productCardImages.pave
  const priceOptions = {
    cacaoPercent: form.cacaoPercent,
    cakeSize: form.cakeSize,
    chocolateType: form.chocolateType,
    poundAddon: form.poundAddon,
    chocolateIcingCount: form.chocolateIcingCount,
    vanillaCreamCount: form.vanillaCreamCount,
    partyDecorationCount: form.partyDecorationCount,
    vanillaCakeSheet: form.vanillaCakeSheet,
    vanillaCakeFlavor: form.vanillaCakeFlavor,
    }
  const unitPrice = getReservationUnitPrice(selectedProduct.id, priceOptions)
  const singleSelectionPrice = getReservationPrice(selectedProduct.id, priceOptions, form.quantity)
  const currentPrice = orderSelections
    ? orderSelections.reduce((sum, selection) => sum + getReservationPrice(selection.productId, selection, selection.quantity), 0)
    : singleSelectionPrice
  const promoProductId = orderSelections?.find((selection) => getValidPromoCode(selection.productId, form.promoCode))?.productId || selectedProduct.id
  const promoEntry = getPromoEntryState(promoProductId, form.promoCode, undefined, knownReviewRewardPercent)
  const isManualCouponPending = promoEntry.kind === 'review-pending' && promoEntry.normalizedCode.startsWith('JENNIE')
  const isPromoApplied = promoEntry.kind === 'static-valid' || promoEntry.kind === 'review-pending'
  const basePromoPriceDisplay = getPromoPriceDisplay(currentPrice, promoEntry)
  const promoPriceDisplay = orderSelections && promoEntry.kind === 'static-valid'
    ? (() => {
        const eligibleBasisCents = orderSelections.reduce((sum, selection) => {
          if (!getValidPromoCode(selection.productId, promoEntry.normalizedCode)) return sum
          return sum + Math.round(getReservationPrice(selection.productId, selection, selection.quantity) * 100)
        }, 0)
        return {
          finalPrice: Math.max(0, Math.round(currentPrice * 100) - Math.round(eligibleBasisCents * promoEntry.discountPercent / 100)) / 100,
          estimatedPrice: null,
        }
      })()
    : basePromoPriceDisplay
  const promoPreviewPrice = promoPriceDisplay.estimatedPrice ?? promoPriceDisplay.finalPrice
  const promoDiscountAmount = Math.max(0, currentPrice - promoPreviewPrice)
  const lemonPackSize = getFreshLemonCupcakePackSize(selectedProduct.id) || 0
  const chocolateIcingCount = normalizeChocolateIcingCount(selectedProduct.id, form.chocolateIcingCount)
  const lemonIcingCount = getLemonIcingCount(selectedProduct.id, chocolateIcingCount)
  const chocolateIcingSurcharge = getChocolateIcingSurcharge(selectedProduct.id, chocolateIcingCount)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    selectedProduct.id,
    form.vanillaCreamCount,
    form.partyDecorationCount,
  )
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - cupcakeFinishCounts.vanillaCreamCount - cupcakeFinishCounts.partyDecorationCount
  const cupcakeFinishSurcharge = getCupcakeFinishSurcharge(
    selectedProduct.id,
    cupcakeFinishCounts.vanillaCreamCount,
    cupcakeFinishCounts.partyDecorationCount,
  )
  const promoHint = isPromoEligibleProduct(selectedProduct.id)
    ? isFreshLemonCupcakeProduct(selectedProduct.id)
      ? language === 'ko' ? 'Lemoni · 대소문자 구분 없음 · 7월 16일까지 유효' : 'Lemoni · Not case-sensitive · Valid through 16 July'
      : language === 'ko' ? 'Chocolate · 대소문자 구분 없음 · 7월 15일까지 유효' : 'Chocolate · Not case-sensitive · Valid through 15 July'
    : copy.promoHint
  const showChocolateTypeOptions = usesReservationChocolateType(selectedProduct.id, form.poundAddon)
  const selectedProductGroup = PRODUCT_GROUPS.find((group) => group.productIds.includes(selectedProduct.id)) || PRODUCT_GROUPS[0]
  const labels = {
    back: copy.back,
    title: copy.title,
    product: copy.product,
    totalPrice: copy.totalPrice,
    quantity: copy.quantity,
    size: copy.size,
    options: copy.options,
    production: copy.production,
    cakeSelect: copy.cakeSelect,
    changeCake: copy.changeCake,
    selectedCake: copy.selectedCake,
    sizeSelect: copy.sizeSelect,
    cacaoSelect: copy.cacaoSelect,
    chocolateSelect: copy.chocolateSelect,
    finishSelect: copy.finishSelect,
    orderQuantity: copy.orderQuantity,
    quantityHelp:
      selectedProduct.id === 'cupcake-dozen'
        ? copy.quantityHelpCupcake(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit)
        : copy.quantityHelp(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit),
    pickupDate: copy.pickupDate,
    pickupTime: copy.pickupTime,
    customerName: copy.customerName,
    phone: copy.phone,
    requestNote: copy.requestNote,
    promoCode: copy.promoCode,
    promoPlaceholder: copy.promoPlaceholder,
    promoApplied: copy.promoApplied,
    promoHint: copy.promoHint,
  }

  function selectProduct(productId: ProductId) {
    const product = getProductById(productId)
    setShowCakeSelector(false)
    setForm({
      ...form,
      productId,
      cacaoPercent: product.usesCacaoOptions ? form.cacaoPercent : '기본',
      cakeSize: product.usesSizeOptions ? form.cakeSize : DEFAULT_CAKE_SIZE,
      chocolateType: usesReservationChocolateType(product.id, form.poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
      poundAddon: product.usesPoundAddonOptions ? form.poundAddon : DEFAULT_POUND_ADDON,
      chocolateIcingCount: normalizeChocolateIcingCount(productId, form.chocolateIcingCount),
      ...normalizeCupcakeFinishCounts(productId, form.vanillaCreamCount, form.partyDecorationCount),
      vanillaCakeSheet: normalizeVanillaCakeSheet(productId, form.vanillaCakeSheet),
      vanillaCakeFlavor: normalizeVanillaCakeFlavor(productId, form.vanillaCakeFlavor),
      vanillaCakePointColor: normalizeVanillaCakePointColor(productId, form.vanillaCakePointColor),
      quantity: form.quantity,
    })
  }

  function selectChocolateIcingCount(value: number) {
    setForm({
      ...form,
      chocolateIcingCount: normalizeChocolateIcingCount(form.productId, value),
    })
  }

  function selectCupcakeFinishCount(kind: 'vanilla' | 'party', value: number) {
    const counts = normalizeCupcakeFinishCounts(
      form.productId,
      kind === 'vanilla' ? value : form.vanillaCreamCount,
      kind === 'party' ? value : form.partyDecorationCount,
    )
    setForm({ ...form, ...counts })
  }

  function selectPoundAddon(poundAddon: PoundAddon) {
    setForm({
      ...form,
      poundAddon,
      chocolateType: usesReservationChocolateType(form.productId, poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
    })
  }

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="form-page">
        <button className="text-button" type="button" onClick={() => navigate('home')}>
          <ArrowLeft size={16} /> {labels.back}
        </button>
        <section className="reservation-layout">
          <aside className="summary-panel">
            <div className="summary-product-photo">
              {isVanillaFreshCreamCakeProduct(selectedProduct.id) ? <VanillaFreshCreamCakeSilhouette /> : <img src={selectedProductImage} alt={selectedProductText.name} width={1080} height={1012} loading="eager" decoding="async" />}
            </div>
            <p className="summary-kicker">{copy.productSectionTitle}</p>
            <h1>{labels.title}</h1>
            <dl>
              <div>
                <dt>{labels.product}</dt>
                <dd>{isMultiOrder
                  ? language === 'ko' ? `${orderSelections.length}개 구성` : `${orderSelections.length} selections`
                  : selectedProductText.name}</dd>
              </div>
              <div>
                <dt>{labels.totalPrice}</dt>
                <dd>
                  {promoEntry.kind === 'static-valid' ? (
                    <span className="promo-price-summary">
                      <span className="original-price">{formatCurrency(currentPrice)}</span>
                      <strong>{formatCurrency(promoPriceDisplay.finalPrice)}</strong>
                    </span>
                  ) : (
                    <>
                      {formatCurrency(promoPriceDisplay.finalPrice)}
                      {promoPriceDisplay.estimatedPrice !== null && (
                        <small className="promo-estimate-summary">
                          {language === 'ko'
                            ? `서버 확인 후 예상 ${formatCurrency(promoPriceDisplay.estimatedPrice)}`
                            : `Estimated ${formatCurrency(promoPriceDisplay.estimatedPrice)} after server validation`}
                        </small>
                      )}
                    </>
                  )}
                </dd>
              </div>
              {!isMultiOrder && (<>
              {isFreshLemonCupcakeProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '구성' : 'Pack size'}</dt>
                  <dd>{getFreshLemonCupcakePackSize(selectedProduct.id)} {language === 'ko' ? '개' : 'pieces'}</dd>
                </div>
              )}
              {isFreshLemonCupcakeProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
                  <dd>{language === 'ko'
                    ? `생레몬 제스트 아이싱 ${lemonIcingCount}개 / 다크 커버춰 초콜릿 ${chocolateIcingCount}개`
                    : `Fresh lemon zest icing ${lemonIcingCount} / Dark couverture chocolate ${chocolateIcingCount}`}</dd>
                </div>
              )}
              {isCupcakeDozenProduct(selectedProduct.id) && (
                <div>
                  <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
                  <dd>{language === 'ko'
                    ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개`
                    : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount} / Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</dd>
                </div>
              )}
              <div>
                <dt>{labels.quantity}</dt>
                <dd>
                  {form.quantity}
                  {copy.quantityUnit}
                </dd>
              </div>
              {(selectedProduct.usesSizeOptions || isCheesecakeProduct(selectedProduct.id)) && (
                <div>
                  <dt>{labels.size}</dt>
                  <dd>{formatCakeSizeLabel(form.cakeSize)}</dd>
                </div>
              )}
              {isVanillaFreshCreamCakeProduct(selectedProduct.id) && (
                <>
                  <div>
                    <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
                    <dd>{language === 'ko'
                      ? form.vanillaCakeSheet === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트'
                      : formatVanillaCakeSheet(form.vanillaCakeSheet)}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
                    <dd>{language === 'ko'
                      ? form.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
                      : formatVanillaCakeFlavor(form.vanillaCakeFlavor)}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '포인트 컬러' : 'Point colour'}</dt>
                    <dd>{formatVanillaCakePointColorText(form.vanillaCakePointColor, language)}</dd>
                  </div>
                </>
              )}
              {showChocolateTypeOptions && (
                <div>
                  <dt>{copy.chocolate}</dt>
                  <dd>{formatChocolateTypeText(form.chocolateType, language)}</dd>
                </div>
              )}
              {selectedProduct.usesPoundAddonOptions && (
                <div>
                  <dt>{copy.finish}</dt>
                  <dd>{formatPoundAddonText(form.poundAddon, language)}</dd>
                </div>
              )}
              <div>
                <dt>{labels.options}</dt>
                <dd>{selectedProductText.priceNote}</dd>
              </div>
              </>)}
              <div>
                <dt>{labels.production}</dt>
                <dd>{language === 'ko' ? copy.dailyLimitText : settings.dailyLimitText}</dd>
              </div>
            </dl>
            <button className="change-cake-button" type="button" onClick={() => isMultiOrder ? navigate('cart') : setShowCakeSelector(true)}>
              {isMultiOrder ? (language === 'ko' ? '장바구니에서 수정' : 'Edit order') : labels.changeCake}
            </button>
            <p>{language === 'ko' ? copy.reservationCompleteText : settings.reservationNotice}</p>
          </aside>

        <form className="reservation-form" onSubmit={submitReservation}>
          <label className="website-field" aria-hidden="true">
            Leave this field blank
            <input name="website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>
            {isMultiOrder && (
              <section className="multi-order-summary" aria-labelledby="multi-order-title">
                <h2 id="multi-order-title">{language === 'ko' ? '신청 상품' : 'Order items'}</h2>
                <p>{language === 'ko' ? '장바구니에서 선택한 구성은 이 화면에서 변경되지 않아요.' : 'Selections from your order are read-only on this form.'}</p>
                <ul>
                  {orderSelections.map((selection, index) => (
                    <li key={`${selection.productId}-${index}`}>
                      <span>{getProductText(selection.productId, language).name}</span>
                      <strong>{selection.quantity}{copy.quantityUnit} · {formatCurrency(getReservationPrice(selection.productId, selection, selection.quantity))}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!isMultiOrder && (<>
            {showCakeSelector && (
              <fieldset className="cake-selector-fieldset">
                <legend>{labels.cakeSelect}</legend>
                <div className="product-choice-list">
                  {PRODUCT_GROUPS.map((group) => {
                    const isSelected = group.id === selectedProductGroup.id
                    const groupName = group.id === 'pave'
                      ? getProductText('pave-cake', language).name
                      : group.id === 'vanilla-fresh-cream'
                        ? getProductText('vanilla-fresh-cream-cake', language).name
                        : group.id === 'pound-cupcake'
                        ? language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes'
                        : group.id === 'cheesecake'
                          ? language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake"
                          : language === 'ko' ? '레몬 케이크' : 'Lemon Cake'
                    const groupImage = group.id === 'pave'
                      ? productCardImages.pave
                      : group.id === 'vanilla-fresh-cream'
                        ? ''
                        : group.id === 'pound-cupcake'
                        ? productCardImages.pound
                        : group.id === 'cheesecake' ? productCardImages.basque : productCardImages.lemon
                    const groupPrice = group.id === 'pave'
                      ? formatCurrency(75)
                      : group.id === 'vanilla-fresh-cream'
                        ? 'From AUD 75'
                        : group.id === 'pound-cupcake'
                        ? 'From AUD 45'
                        : group.id === 'cheesecake' ? 'From AUD 55' : 'From AUD 36'
                    return (
                      <label
                        className={`product-choice-card${isSelected ? ' is-selected' : ''}`}
                        key={group.id}
                        onClick={() => selectProduct(group.defaultProductId)}
                      >
                        <input
                          type="radio"
                          name="productGroup"
                          checked={isSelected}
                          onChange={() => selectProduct(group.defaultProductId)}
                        />
                        <span className="product-choice-thumb" aria-hidden="true">
                          {group.id === 'vanilla-fresh-cream' ? <VanillaFreshCreamCakeSilhouette /> : <img src={groupImage} alt="" width={1080} height={1012} loading="lazy" decoding="async" />}
                        </span>
                        <span className="product-choice-copy">
                          <span className="product-choice-topline">
                            <strong>{groupName}</strong>
                            {isSelected && <span className="selected-cake-badge">{labels.selectedCake}</span>}
                          </span>
                          <span>{groupPrice}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {selectedProductGroup.productIds.length > 1 && (
              <fieldset>
                <legend>{selectedProductGroup.id === 'fresh-lemon-cupcakes'
                  ? language === 'ko' ? '구성 선택' : 'Choose pack size'
                  : language === 'ko' ? '종류 선택' : 'Choose type'}</legend>
                <div className="choice-list">
                  {selectedProductGroup.productIds.map((productId) => {
                    const optionProduct = getProductById(productId)
                    const optionText = getProductText(productId, language)
                    const isLemonPack = isFreshLemonCupcakeProduct(productId)
                    const packSize = getFreshLemonCupcakePackSize(productId)
                    const extraFromBase = optionProduct.price - getProductById(selectedProductGroup.defaultProductId).price
                    return (
                      <label className="choice-item" key={productId}>
                        <input
                          type="radio"
                          name="productType"
                          checked={form.productId === productId}
                          onChange={() => selectProduct(productId)}
                        />
                        <span className="choice-copy">
                          <strong>
                            {isLemonPack
                              ? `${packSize} ${language === 'ko' ? '개' : 'pieces'} · ${formatCurrency(optionProduct.price)}`
                              : `${optionText.name} · ${formatCurrency(optionProduct.price)}${extraFromBase > 0 ? ` (+${formatCurrency(extraFromBase)})` : ''}`}
                            {productId === 'fresh-lemon-cupcakes-12' && <span className="pack-choice-badge">Most Popular</span>}
                          </strong>
                          <span>{isLemonPack
                            ? language === 'ko' ? '레몬 크림과 꽃무늬 장식 포함' : 'Lemon cream and floral decoration included'
                            : optionText.priceNote}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {isFreshLemonCupcakeProduct(selectedProduct.id) && (
              <fieldset className="icing-mix-fieldset">
                <legend>{language === 'ko' ? '마감 구성 선택' : 'Choose finishing'}</legend>
                <p className="field-help">
                  {language === 'ko'
                    ? '기본 마감은 생레몬 제스트 아이싱이며, 스페셜 다크 커버춰 초콜릿은 개당 AUD 0.50이 추가돼요.'
                    : 'Basic finishing: Fresh lemon zest icing. Special finishing: Dark couverture chocolate (+AUD 0.50 per piece).'}
                </p>
                <div className="icing-mix-summary" aria-live="polite">
                  <div><span>{language === 'ko' ? '기본 · 생레몬 제스트 아이싱' : 'Basic · Fresh lemon zest icing'}</span><strong>{lemonIcingCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '스페셜 · 다크 커버춰 초콜릿' : 'Special · Dark couverture chocolate'}</span><strong>{chocolateIcingCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                </div>
                <div className="icing-count-stepper">
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '다크 커버춰 초콜릿 한 개 줄이기' : 'Remove one dark couverture chocolate finishing'}
                    disabled={chocolateIcingCount === 0}
                    onClick={() => selectChocolateIcingCount(chocolateIcingCount - 1)}
                  >−</button>
                  <output>
                    <strong>{language === 'ko' ? `스페셜 ${chocolateIcingCount}개` : `${chocolateIcingCount} special`}</strong>
                    <span>+{formatCurrency(chocolateIcingSurcharge)}</span>
                  </output>
                  <button
                    type="button"
                    aria-label={language === 'ko' ? '다크 커버춰 초콜릿 한 개 늘리기' : 'Add one dark couverture chocolate finishing'}
                    disabled={chocolateIcingCount === lemonPackSize}
                    onClick={() => selectChocolateIcingCount(chocolateIcingCount + 1)}
                  >+</button>
                </div>
                <div className="icing-quick-choices">
                  <button type="button" className={chocolateIcingCount === 0 ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(0)}>
                    {language === 'ko' ? '전부 기본' : 'All basic'}
                  </button>
                  <button type="button" className={chocolateIcingCount === lemonPackSize / 2 ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(lemonPackSize / 2)}>
                    {language === 'ko' ? '반반' : 'Half & half'}
                  </button>
                  <button type="button" className={chocolateIcingCount === lemonPackSize ? 'is-selected' : ''} onClick={() => selectChocolateIcingCount(lemonPackSize)}>
                    {language === 'ko' ? '전부 스페셜' : 'All special'}
                  </button>
                </div>
              </fieldset>
            )}

            {isCupcakeDozenProduct(selectedProduct.id) && (
              <fieldset className="icing-mix-fieldset">
                <legend>{language === 'ko' ? '컵케이크 마감 선택' : 'Choose cupcake finishing'}</legend>
                <p className="field-help">
                  {language === 'ko'
                    ? '기본 마감은 무료예요. 바닐라 크림은 개당 AUD 0.50, 파티용 데코는 개당 AUD 1.00이 추가돼요.'
                    : 'Basic finishing is included. Vanilla cream is +AUD 0.50 each and party decoration is +AUD 1.00 each.'}
                </p>
                <div className="icing-mix-summary" aria-live="polite">
                  <div><span>{language === 'ko' ? '기본 마감' : 'Basic finishing'}</span><strong>{basicCupcakeCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '바닐라 크림' : 'Vanilla cream'}</span><strong>{cupcakeFinishCounts.vanillaCreamCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                  <div><span>{language === 'ko' ? '파티용 데코' : 'Party decoration'}</span><strong>{cupcakeFinishCounts.partyDecorationCount}{language === 'ko' ? '개' : ' pieces'}</strong></div>
                </div>
                <div className="icing-count-stepper">
                  <button type="button" aria-label={language === 'ko' ? '바닐라 크림 한 개 줄이기' : 'Remove one vanilla cream finish'} disabled={cupcakeFinishCounts.vanillaCreamCount === 0} onClick={() => selectCupcakeFinishCount('vanilla', cupcakeFinishCounts.vanillaCreamCount - 1)}>−</button>
                  <output><strong>{language === 'ko' ? `바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개` : `Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount}`}</strong><span>+{formatCurrency(cupcakeFinishCounts.vanillaCreamCount * 0.5)}</span></output>
                  <button type="button" aria-label={language === 'ko' ? '바닐라 크림 한 개 늘리기' : 'Add one vanilla cream finish'} disabled={basicCupcakeCount === 0} onClick={() => selectCupcakeFinishCount('vanilla', cupcakeFinishCounts.vanillaCreamCount + 1)}>+</button>
                </div>
                <div className="icing-count-stepper">
                  <button type="button" aria-label={language === 'ko' ? '파티용 데코 한 개 줄이기' : 'Remove one party decoration'} disabled={cupcakeFinishCounts.partyDecorationCount === 0} onClick={() => selectCupcakeFinishCount('party', cupcakeFinishCounts.partyDecorationCount - 1)}>−</button>
                  <output><strong>{language === 'ko' ? `파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개` : `Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</strong><span>+{formatCurrency(cupcakeFinishCounts.partyDecorationCount)}</span></output>
                  <button type="button" aria-label={language === 'ko' ? '파티용 데코 한 개 늘리기' : 'Add one party decoration'} disabled={basicCupcakeCount === 0} onClick={() => selectCupcakeFinishCount('party', cupcakeFinishCounts.partyDecorationCount + 1)}>+</button>
                </div>
                <div className="icing-quick-choices">
                  <button type="button" className={basicCupcakeCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: 0, partyDecorationCount: 0 })}>{language === 'ko' ? '전부 기본' : 'All basic'}</button>
                  <button type="button" className={cupcakeFinishCounts.vanillaCreamCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: CUPCAKE_PACK_SIZE, partyDecorationCount: 0 })}>{language === 'ko' ? '전부 바닐라' : 'All vanilla'}</button>
                  <button type="button" className={cupcakeFinishCounts.partyDecorationCount === CUPCAKE_PACK_SIZE ? 'is-selected' : ''} onClick={() => setForm({ ...form, vanillaCreamCount: 0, partyDecorationCount: CUPCAKE_PACK_SIZE })}>{language === 'ko' ? '전부 파티 데코' : 'All party'}</button>
                </div>
                <p className="field-help">{language === 'ko' ? `마감 추가금 ${formatCurrency(cupcakeFinishSurcharge)}` : `Finishing surcharge ${formatCurrency(cupcakeFinishSurcharge)}`}</p>
              </fieldset>
            )}

            {selectedProduct.usesSizeOptions && (
              <fieldset>
              <legend>{labels.sizeSelect}</legend>
              <div className="choice-list">
                {CAKE_SIZE_OPTIONS.map((option) => {
                  const optionText = getCakeSizeText(option, language)
                  return (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="cakeSize"
                        checked={form.cakeSize === option.value}
                        onChange={() => setForm({ ...form, cakeSize: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>
                          {optionText.label} · {formatCurrency(selectedProduct.sizePrices[option.value] || option.price)}
                        </strong>
                        {!isVanillaFreshCreamCakeProduct(selectedProduct.id) && <span>{optionText.description}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="field-help">{copy.sizeHelp}</p>
              </fieldset>
            )}

            {isVanillaFreshCreamCakeProduct(selectedProduct.id) && (
              <>
                <fieldset>
                  <legend>{language === 'ko' ? '맛 선택' : 'Choose flavour'}</legend>
                  <div className="choice-list">
                    {VANILLA_CAKE_FLAVOR_OPTIONS.map((option) => (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="vanillaCakeFlavor"
                          checked={form.vanillaCakeFlavor === option.value}
                          onChange={() => setForm({ ...form, vanillaCakeFlavor: option.value })}
                        />
                        <span className="choice-copy">
                          <strong>{language === 'ko' ? option.value === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리' : option.label}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{language === 'ko' ? '포인트 컬러 선택' : 'Choose point colour'}</legend>
                  <div className="vanilla-point-color-grid">
                    {VANILLA_CAKE_POINT_COLOR_OPTIONS.map((option) => (
                      <label
                        className={`vanilla-point-color-card${form.vanillaCakePointColor === option.value ? ' is-selected' : ''}`}
                        key={option.value}
                      >
                        <input
                          type="radio"
                          name="vanillaCakePointColor"
                          value={option.value}
                          checked={form.vanillaCakePointColor === option.value}
                          onChange={() => setForm({ ...form, vanillaCakePointColor: option.value })}
                        />
                        <span className="vanilla-point-color-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
                        <strong>{language === 'ko' ? option.labelKo : option.label}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {selectedProduct.usesCacaoOptions && (
              <fieldset>
                <legend>{labels.cacaoSelect}</legend>
                <div className="choice-list">
                  {CACAO_OPTIONS.map((option) => (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="cacao"
                        checked={form.cacaoPercent === option.value}
                        onChange={() => setForm({ ...form, cacaoPercent: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>
                          {option.label} {option.extraPrice > 0 && `(+${formatCurrency(option.extraPrice)})`}
                        </strong>
                        <span>{option.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="field-help">{copy.cacaoHelp}</p>
              </fieldset>
            )}

            {selectedProduct.usesPoundAddonOptions && (
              <fieldset>
                <legend>{labels.finishSelect}</legend>
                <div className="choice-list">
                  {POUND_ADDON_OPTIONS.map((option) => {
                    const optionText = getPoundAddonText(option, language)
                    return (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="poundAddon"
                          checked={form.poundAddon === option.value}
                          onChange={() => selectPoundAddon(option.value)}
                        />
                        <span className="choice-copy">
                          <strong>
                            {optionText.label} {option.extraPrice > 0 && `(+${formatCurrency(option.extraPrice)})`}
                          </strong>
                          <span>{optionText.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="field-help">{copy.finishHelp}</p>
              </fieldset>
            )}

            {showChocolateTypeOptions && (
              <fieldset>
                <legend>{labels.chocolateSelect}</legend>
                <div className="choice-list">
                  {CHOCOLATE_TYPE_OPTIONS.map((option) => {
                    const optionText = getChocolateTypeText(option, language)
                    return (
                      <label className="choice-item" key={option.value}>
                        <input
                          type="radio"
                          name="chocolateType"
                          checked={form.chocolateType === option.value}
                          onChange={() => setForm({ ...form, chocolateType: option.value })}
                        />
                        <span className="choice-copy">
                          <strong>{optionText.label}</strong>
                          <span>{optionText.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend>{labels.quantity}</legend>
              <label>
                {labels.orderQuantity}
                <select
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                >
                  {Array.from({ length: MAX_RESERVATION_QUANTITY }, (_, index) => index + 1).map((quantity) => (
                    <option value={quantity} key={quantity}>
                      {quantity}
                      {copy.quantityUnit}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-help">{labels.quantityHelp}</p>
            </fieldset>
            </>)}

            <div className="field-row">
              <div className="pickup-date-field">
                <span>{labels.pickupDate}</span>
                <PickupDatePicker
                  label={labels.pickupDate}
                  minDate={minPickupDate}
                  value={pickupDate}
                  locale={language === 'ko' ? 'ko-KR' : 'en-AU'}
                  loading={pickupCalendarAvailability.loading}
                  isDateDisabled={isPickupCalendarDateDisabled}
                  onChange={(nextDate) => setForm({
                    ...form,
                    pickupDate: nextDate,
                    pickupTime: '',
                  })}
                />
              </div>
              <label>
                {labels.pickupTime}
                <select
                  value={selectedPickupTime}
                  onChange={(event) => setForm({ ...form, pickupTime: event.target.value })}
                  disabled={pickupAvailabilityLoading || pickupAvailabilityError || times.length === 0}
                >
                  {times.length === 0 && (
                    <option value="" disabled>
                      {pickupAvailabilityLoading
                        ? copy.pickupAvailabilityChecking
                        : pickupAvailabilityError
                          ? copy.pickupAvailabilityError
                          : copy.pickupAvailabilityNone}
                    </option>
                  )}
                  {baseTimes.map((time) => (
                      <option value={time} key={time} disabled={!times.includes(time)}>
                        {time}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div aria-live="polite">
              {pickupAvailabilityLoading ? (
                <p className="field-help">{copy.pickupAvailabilityChecking}</p>
              ) : pickupAvailabilityError ? (
                <>
                  <p className="error-text">{copy.pickupAvailabilityError}</p>
                  <button className="text-button" type="button" onClick={refetchPickupAvailability}>
                    {copy.pickupAvailabilityRetry}
                  </button>
                </>
              ) : times.length === 0 ? (
                <p className="field-help">{copy.pickupAvailabilityNone}</p>
              ) : null}
            </div>
            <p className="field-help">{copy.pickupLeadTimeHelp}</p>
            {settings.pickupNotice.trim() && <p className="field-help">{settings.pickupNotice}</p>}

            <div className="field-row">
              <label>
                {labels.customerName}
                <input
                  value={form.customerName}
                  onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                  placeholder={copy.namePlaceholder}
                />
              </label>
              <label>
                {labels.phone}
                <input
                  inputMode="tel"
                  value={form.customerPhone}
                  onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
                  placeholder={copy.phonePlaceholder}
                />
              </label>
            </div>

            <label>
              {labels.requestNote}
              <textarea
                value={form.requestNote}
                onChange={(event) => setForm({ ...form, requestNote: event.target.value })}
                placeholder={copy.requestPlaceholder}
              />
            </label>

            {shouldShowPromoInput('cake', selectedProduct.id) && (
              <label className="promo-code-field">
                {labels.promoCode}
                <input
                  value={form.promoCode}
                  onChange={(event) => setForm({ ...form, promoCode: event.target.value })}
                  placeholder={labels.promoPlaceholder}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span
                  className={isPromoApplied ? 'promo-message is-applied' : 'promo-message'}
                  role={promoEntry.kind === 'invalid' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {promoEntry.kind === 'review-pending'
                    ? isManualCouponPending
                      ? language === 'ko'
                        ? `일회용 쿠폰 준비됨 · 예상 ${promoEntry.discountPercent}% 할인 (-${formatCurrency(promoDiscountAmount)}) · 주문 시 확인됩니다`
                        : `One-time coupon ready · estimated ${promoEntry.discountPercent}% off (-${formatCurrency(promoDiscountAmount)}) · Verified when you place the order`
                      : language === 'ko'
                        ? `후기 리워드 준비됨 · 예상 ${promoEntry.discountPercent}% 할인 (-${formatCurrency(promoDiscountAmount)}) · 주문 시 확인됩니다`
                        : `Review reward ready · estimated ${promoEntry.discountPercent}% off (-${formatCurrency(promoDiscountAmount)}) · Verified when you place the order`
                    : promoEntry.kind === 'static-valid'
                      ? `${labels.promoApplied}: ${promoEntry.discountPercent}% (${formatCurrency(promoDiscountAmount)} off)`
                      : promoEntry.kind === 'invalid'
                        ? promoErrorMessage('PROMO_CODE_INVALID', language)
                        : promoHint}
                </span>
              </label>
            )}

            <label className="agree-row">
              <input
                type="checkbox"
                checked={form.privacy}
                onChange={(event) => setForm({ ...form, privacy: event.target.checked })}
              />
              <span>
                {copy.privacyNotice}
              </span>
            </label>

            {error && <p className="error-text" role="alert">{error}</p>}

            <BankAccountBox settings={settings} totalPrice={promoPriceDisplay.finalPrice} language={language} />

            <button
              className="primary-button full-width"
              type="submit"
              disabled={submitting || pickupAvailabilityLoading || pickupAvailabilityError || !selectedPickupTime}
            >
              {submitting ? copy.submitting : copy.reserveCta}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}
