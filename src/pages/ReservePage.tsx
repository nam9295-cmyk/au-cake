import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PickupDatePicker } from '../components/WeekendDatePicker'
import { BankAccountBox } from '../components/BankAccountBox'
import { SiteHeader, VanillaFreshCreamCakeSilhouette } from '../components/SiteChrome'
import { getCakeDetailSelectionTotal, type CakeDetailSelection } from '../lib/cake-detail'
import { getAuCakeCatalogCards } from '../lib/cake-catalog'
import {
  getIndividualPackagingPieceCount,
  getIndividualPackagingPricing,
  isIndividualPackagingEligibleProduct,
} from '../lib/individual-packaging'
import { marketConfig } from '../lib/market'
import { CHOCOLATE_EXTRA_OPTIONS, DEFAULT_CHOCOLATE_EXTRA, formatChocolateExtra, getChocolateExtraOption, getChocolateExtraPrice, isChocolateExtraEligibleProduct, normalizeChocolateExtra } from '../lib/chocolate-extras'
import { BROWNIE_CREAM_OPTIONS, DEFAULT_BROWNIE_CREAM_OPTION, formatBrownieCreamOption, getBrownieCreamOption, isBrownieCheesecakeProduct, isBrownieFreshCreamEligibleProduct, normalizeBrownieCreamOption } from '../lib/brownie-cream'
import { type Page } from '../lib/app-routes'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_FINISH_OPTIONS,
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_CUPCAKE_FINISH,
  DEFAULT_POUND_ADDON,
  DEFAULT_VANILLA_CAKE_FLAVOR,
  DEFAULT_VANILLA_CAKE_POINT_COLOR,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  isPromoEligibleProduct,
  getChocolateIcingSurcharge,
  getLemonIcingCount,
  getProductById,
  getFreshLemonCupcakePackSize,
  getCupcakePackSize,
  isCheesecakeProduct,
  isCupcakeProduct,
  isButtercreamCakeProduct,
  isFreshLemonCupcakeProduct,
  isCakePointColorProduct,
  isCreamLayerCakeProduct,
  isVanillaFreshCreamCakeProduct,
  getReservationPrice,
  getReservationUnitPrice,
  getValidPromoCode,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinish,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  POUND_ADDON_OPTIONS,
  PRODUCT_GROUPS,
  VANILLA_CAKE_POINT_COLOR_OPTIONS,

  usesReservationChocolateType,
} from '../lib/constants'
import { formatCurrentCakeSizeLabel, getCurrentWholeCakeSizeOptions } from '../lib/cake-serving'
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
  formatCupcakeFinishText,
  getCakeSizeText,
  getChocolateTypeText,
  getPoundAddonText,
  formatVanillaCakePointColorText,
  getProductText,
  type Language,
} from '../lib/i18n'
import {
  CAKE_ORDER_LINES_UNAVAILABLE_ERROR,
  createCakeOrder,
  createReservation,
} from '../lib/repository'
import { trackEvent } from '../lib/analytics'
import type { BrownieCreamOption, CacaoPercent, CakeSize, ChocolateExtra, ChocolateType, CupcakeFinish, PoundAddon, ProductId, Reservation, StoreSettings, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet } from '../lib/types'
import {
  customerTimeOptionsForDate,
  firstCustomerPickupDate,
  formatCurrency,
  generateRequestId,
  isCakePickupServiceTime,
  isPickupTimeAllowed,
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
  const initialFormProductId = initialSelection?.productId || initialProductId
  const initialFormCakeSize = initialSelection?.cakeSize || getCurrentWholeCakeSizeOptions(initialFormProductId)[0] || DEFAULT_CAKE_SIZE as CakeSize
  const [form, setForm] = useState({
    productId: initialFormProductId,
    cacaoPercent: '기본' as CacaoPercent,
    cakeSize: initialFormCakeSize,
    chocolateType: initialSelection?.chocolateType || DEFAULT_CHOCOLATE_TYPE as ChocolateType,
    poundAddon: initialSelection?.poundAddon || DEFAULT_POUND_ADDON as PoundAddon,
    chocolateExtra: normalizeChocolateExtra(initialFormProductId, initialSelection?.chocolateExtra || DEFAULT_CHOCOLATE_EXTRA) as ChocolateExtra,
    brownieCreamOption: normalizeBrownieCreamOption(initialFormProductId, initialSelection?.brownieCreamOption || DEFAULT_BROWNIE_CREAM_OPTION) as BrownieCreamOption,
    cupcakeFinish: initialSelection?.cupcakeFinish || DEFAULT_CUPCAKE_FINISH as CupcakeFinish,
    chocolateIcingCount: initialSelection?.chocolateIcingCount || 0,
    vanillaCreamCount: initialSelection?.vanillaCreamCount || 0,
    partyDecorationCount: initialSelection?.partyDecorationCount || 0,
    vanillaCakeSheet: normalizeVanillaCakeSheet(initialSelection?.productId || initialProductId, initialSelection?.vanillaCakeSheet) as VanillaCakeSheet,
    vanillaCakeFlavor: initialSelection?.vanillaCakeFlavor || DEFAULT_VANILLA_CAKE_FLAVOR as VanillaCakeFlavor,
    vanillaCakePointColor: normalizeVanillaCakePointColor(initialSelection?.productId || initialProductId, initialSelection?.vanillaCakePointColor || DEFAULT_VANILLA_CAKE_POINT_COLOR) as VanillaCakePointColor,
    individualPackaging: initialSelection?.individualPackaging === true,
    pickupDate: todayInputValue(),
    pickupTime: '',
    quantity: initialSelection?.quantity || 1,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
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

  useEffect(() => {
    if (initialPromoCode) onInitialPromoConsumed()
  }, [initialPromoCode, onInitialPromoConsumed])
  const now = useCurrentTime()
  const minPickupDate = useMemo(() => firstCustomerPickupDate(settings, now), [settings, now])
  const pickupDate = form.pickupDate && form.pickupDate >= minPickupDate ? form.pickupDate : minPickupDate
  const baseTimes = useMemo(() => customerTimeOptionsForDate(pickupDate, settings, now), [pickupDate, settings, now])
  const times = baseTimes
  const selectedPickupTime = times.includes(form.pickupTime) ? form.pickupTime : times[0] || ''

  async function submitReservation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const phone = normalizePhone(form.customerPhone)
    const customerEmail = form.customerEmail.trim().toLowerCase()

    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      setError(copy.errors.name)
      return
    }
    if (!isValidPhone(phone)) {
      setError(`${copy.errors.phone} ${copy.phoneHelp}`)
      return
    }
    if (customerEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setError(language === 'ko' ? '유효한 이메일 주소를 입력해 주세요.' : 'Please enter a valid email address.')
      return
    }
    if (!pickupDate || pickupDate < minPickupDate) {
      setError(copy.errors.pickupDate)
      return
    }
    if (!selectedPickupTime) {
      setError(copy.errors.pickupTime)
      return
    }
    if (!isCakePickupServiceTime(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupTimeUnavailable)
      return
    }
    if (!isPickupTimeAllowed(pickupDate, selectedPickupTime)) {
      setError(copy.errors.pickupLeadTime)
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
        customerEmail,
        productId: form.productId,
        cakeSize: form.cakeSize,
        chocolateType: form.chocolateType,
        poundAddon: form.poundAddon,
        chocolateExtra: form.chocolateExtra,
        brownieCreamOption: form.brownieCreamOption,
        cupcakeFinish: form.cupcakeFinish,
        chocolateIcingCount: form.chocolateIcingCount,
        vanillaCreamCount: form.vanillaCreamCount,
        partyDecorationCount: form.partyDecorationCount,
        vanillaCakeSheet: form.vanillaCakeSheet,
        vanillaCakeFlavor: form.vanillaCakeFlavor,
        vanillaCakePointColor: form.vanillaCakePointColor,
        individualPackaging: form.individualPackaging,
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
      const demoProductPricing = reviewDemoMode ? getDemoReviewPricingAudit(currentPrice, submittedPromo) : null
      const demoPackagingPricing = getIndividualPackagingPricing([{
        productId: form.productId,
        quantity: form.quantity,
        individualPackaging: form.individualPackaging,
        productSubtotalCents: Math.round(currentPrice * 100),
      }])
      const demoPricing = demoProductPricing
        ? {
            ...demoProductPricing,
            individualPackagingPieces: demoPackagingPricing.selectedPackagingPieces,
            individualPackagingFeeCents: demoPackagingPricing.individualPackagingFeeCents,
            totalPriceCents: demoProductPricing.totalPriceCents + demoPackagingPricing.individualPackagingFeeCents,
          }
        : null
      const reservation: Reservation = demoPricing
        ? {
            id: 'demo-reservation',
            reservationNumber: 'VG-C-AU-DEMO',
            customerName: form.customerName.trim(),
            customerPhone: phone,
            customerEmail,
            productId: form.productId,
            cakeSize: form.cakeSize,
            chocolateType: form.chocolateType,
            poundAddon: form.poundAddon,
            chocolateExtra: form.chocolateExtra,
            brownieCreamOption: form.brownieCreamOption,
            cupcakeFinish: form.cupcakeFinish,
            chocolateIcingCount: form.chocolateIcingCount,
            vanillaCreamCount: form.vanillaCreamCount,
            partyDecorationCount: form.partyDecorationCount,
            vanillaCakeSheet: form.vanillaCakeSheet,
            vanillaCakeFlavor: form.vanillaCakeFlavor,
            vanillaCakePointColor: form.vanillaCakePointColor,
            individualPackaging: form.individualPackaging,
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
              customerEmail,
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
                chocolateExtra: selection.chocolateExtra,
                brownieCreamOption: selection.brownieCreamOption,
                cupcakeFinish: selection.cupcakeFinish,
                chocolateIcingCount: selection.chocolateIcingCount,
                vanillaCreamCount: selection.vanillaCreamCount,
                partyDecorationCount: selection.partyDecorationCount,
                vanillaCakeSheet: selection.vanillaCakeSheet,
                vanillaCakeFlavor: selection.vanillaCakeFlavor,
                vanillaCakePointColor: selection.vanillaCakePointColor,
                individualPackaging: selection.individualPackaging,
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
      if (submitError instanceof Error && submitError.message === PICKUP_TIME_UNAVAILABLE_ERROR) {
        setError(copy.errors.pickupTimeUnavailable)
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
  const currentWholeCakeSizeOptions = getCurrentWholeCakeSizeOptions(selectedProduct.id)
  const reserveCakeSizeOptions = currentWholeCakeSizeOptions.length
    ? currentWholeCakeSizeOptions.map((value) => ({
        value,
        label: formatCurrentCakeSizeLabel(selectedProduct.id, value) || String(value),
        price: selectedProduct.sizePrices[value] || 0,
        description: '',
      }))
    : CAKE_SIZE_OPTIONS.map((option) => {
        const optionText = getCakeSizeText(option, language)
        return {
          value: option.value,
          label: optionText.label,
          price: selectedProduct.sizePrices[option.value] || option.price,
          description: optionText.description,
        }
      })
  const catalogCards = marketConfig.market === 'AU' ? getAuCakeCatalogCards(language) : []
  const selectedCatalogCard = catalogCards.find((card) => card.productId === selectedProduct.id)
  const selectedProductImage = selectedCatalogCard?.isPhotoComingSoon
    ? null
    : selectedCatalogCard?.imagePath || (selectedProduct.id === 'pound-cake'
    ? productCardImages.pound
    : isCupcakeProduct(selectedProduct.id)
      ? productCardImages.cupcakes
      : isCheesecakeProduct(selectedProduct.id)
        ? productCardImages.basque
        : isFreshLemonCupcakeProduct(selectedProduct.id)
          ? productCardImages.lemon
          : productCardImages.pave)
  const priceOptions = {
    cacaoPercent: form.cacaoPercent,
    cakeSize: form.cakeSize,
    chocolateType: form.chocolateType,
    poundAddon: form.poundAddon,
    cupcakeFinish: form.cupcakeFinish,
    brownieCreamOption: form.brownieCreamOption,
    chocolateIcingCount: form.chocolateIcingCount,
    vanillaCreamCount: form.vanillaCreamCount,
    partyDecorationCount: form.partyDecorationCount,
    vanillaCakeSheet: form.vanillaCakeSheet,
    vanillaCakeFlavor: form.vanillaCakeFlavor,
    }
  const unitPrice = getReservationUnitPrice(selectedProduct.id, priceOptions)
  const singleSelectionPrice = getReservationPrice(selectedProduct.id, priceOptions, form.quantity) + getChocolateExtraPrice(form.chocolateExtra)
  const currentPrice = orderSelections
    ? orderSelections.reduce((sum, selection) => sum + getCakeDetailSelectionTotal(selection), 0)
    : singleSelectionPrice
  const packagingPricing = orderSelections
    ? getIndividualPackagingPricing(orderSelections.map((selection) => ({
        productId: selection.productId,
        quantity: selection.quantity,
        individualPackaging: selection.individualPackaging,
        productSubtotalCents: Math.round(getReservationPrice(selection.productId, selection, selection.quantity) * 100),
      })))
    : getIndividualPackagingPricing([{
        productId: selectedProduct.id,
        quantity: form.quantity,
        individualPackaging: form.individualPackaging,
        productSubtotalCents: Math.round(singleSelectionPrice * 100),
      }])
  const packagingFee = packagingPricing.individualPackagingFeeCents / 100
  const packagingBaseFee = packagingPricing.individualPackagingBaseFeeCents / 100
  const packagingDiscount = packagingPricing.individualPackagingDiscountCents / 100
  const promoProductId = orderSelections?.find((selection) => getValidPromoCode(selection.productId, form.promoCode))?.productId || selectedProduct.id
  const promoEntry = getPromoEntryState(promoProductId, form.promoCode, undefined, knownReviewRewardPercent)
  const isManualCouponPending = promoEntry.kind === 'review-pending' && promoEntry.normalizedCode.startsWith('JENNIE')
  const isPromoApplied = promoEntry.kind === 'static-valid' || promoEntry.kind === 'review-pending'
  const basePromoPriceDisplay = getPromoPriceDisplay(currentPrice, promoEntry)
  const productPromoPriceDisplay = orderSelections && promoEntry.kind === 'static-valid'
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
  const promoPriceDisplay = {
    finalPrice: productPromoPriceDisplay.finalPrice + packagingFee,
    estimatedPrice: productPromoPriceDisplay.estimatedPrice === null
      ? null
      : productPromoPriceDisplay.estimatedPrice + packagingFee,
  }
  const promoPreviewPrice = productPromoPriceDisplay.estimatedPrice ?? productPromoPriceDisplay.finalPrice
  const promoDiscountAmount = Math.max(0, currentPrice - promoPreviewPrice)
  const lemonPackSize = getFreshLemonCupcakePackSize(selectedProduct.id) || 0
  const chocolateIcingCount = normalizeChocolateIcingCount(selectedProduct.id, form.chocolateIcingCount)
  const lemonIcingCount = getLemonIcingCount(selectedProduct.id, chocolateIcingCount)
  const chocolateIcingSurcharge = getChocolateIcingSurcharge(selectedProduct.id, chocolateIcingCount)
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
      isCupcakeProduct(selectedProduct.id)
        ? copy.quantityHelpCupcake(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit)
        : copy.quantityHelp(formatCurrency(unitPrice), MAX_RESERVATION_QUANTITY, copy.quantityUnit),
    pickupDate: copy.pickupDate,
    pickupTime: copy.pickupTime,
    customerName: copy.customerName,
    phone: copy.phone,
    email: language === 'ko' ? '이메일 주소' : 'Email address',
    emailHelp: language === 'ko'
      ? '예약 안내와 리뷰 리워드를 이 주소로 보내드려요.'
      : 'We’ll send your booking details and review reward to this address.',
    emailPrivacy: language === 'ko'
      ? '이메일은 예약 안내와 리뷰·쿠폰 전달에 사용됩니다.'
      : 'Your email is used for booking details and review reward/coupon delivery.',
    requestNote: copy.requestNote,
    promoCode: copy.promoCode,
    promoPlaceholder: copy.promoPlaceholder,
    promoApplied: copy.promoApplied,
    promoHint: copy.promoHint,
  }

  function selectProduct(productId: ProductId) {
    const product = getProductById(productId)
    const productWholeCakeSizeOptions = getCurrentWholeCakeSizeOptions(productId)
    const cakeSize = productWholeCakeSizeOptions.includes(form.cakeSize as typeof productWholeCakeSizeOptions[number])
      ? form.cakeSize
      : productWholeCakeSizeOptions[0] || DEFAULT_CAKE_SIZE as CakeSize
    setShowCakeSelector(false)
    setForm({
      ...form,
      productId,
      cacaoPercent: product.usesCacaoOptions ? form.cacaoPercent : '기본',
      cakeSize: product.usesSizeOptions ? cakeSize : DEFAULT_CAKE_SIZE,
      chocolateType: usesReservationChocolateType(product.id, form.poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
      poundAddon: product.usesPoundAddonOptions ? form.poundAddon : DEFAULT_POUND_ADDON,
      chocolateExtra: normalizeChocolateExtra(productId, form.chocolateExtra),
      brownieCreamOption: normalizeBrownieCreamOption(productId, form.brownieCreamOption),
      chocolateIcingCount: normalizeChocolateIcingCount(productId, form.chocolateIcingCount),
      cupcakeFinish: normalizeCupcakeFinish(productId, form.cupcakeFinish),
      vanillaCreamCount: 0,
      partyDecorationCount: 0,
      vanillaCakeSheet: normalizeVanillaCakeSheet(productId, form.vanillaCakeSheet),
      vanillaCakeFlavor: normalizeVanillaCakeFlavor(productId, form.vanillaCakeFlavor),
      vanillaCakePointColor: normalizeVanillaCakePointColor(productId, form.vanillaCakePointColor),
      individualPackaging: isIndividualPackagingEligibleProduct(productId) && form.individualPackaging,
      quantity: form.quantity,
    })
  }

  function selectChocolateIcingCount(value: number) {
    setForm({
      ...form,
      chocolateIcingCount: normalizeChocolateIcingCount(form.productId, value),
    })
  }

  function selectPoundAddon(poundAddon: PoundAddon) {
    setForm({
      ...form,
      poundAddon,
      chocolateType: usesReservationChocolateType(form.productId, poundAddon) ? form.chocolateType : DEFAULT_CHOCOLATE_TYPE,
    })
  }
  function selectChocolateExtra(chocolateExtra: ChocolateExtra) {
    setForm({
      ...form,
      chocolateExtra: normalizeChocolateExtra(form.productId, chocolateExtra),
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
              {isVanillaFreshCreamCakeProduct(selectedProduct.id) || !selectedProductImage
                ? <VanillaFreshCreamCakeSilhouette productName={selectedProductText.name} />
                : <img src={selectedProductImage} alt={selectedProductText.name} width={1080} height={1012} loading="eager" decoding="async" />}
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
                      <span className="original-price">{formatCurrency(currentPrice + packagingFee)}</span>
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
              {packagingPricing.selectedPackagingPieces > 0 && (
                <>
                  <div>
                    <dt>{language === 'ko' ? '개별 포장' : 'Individual packaging'}</dt>
                    <dd>{packagingPricing.selectedPackagingPieces} {language === 'ko' ? '개' : 'pieces'} · {formatCurrency(packagingBaseFee)}</dd>
                  </div>
                  {packagingPricing.individualPackagingDiscountCents > 0 && (
                    <div>
                      <dt>{language === 'ko' ? '포장 할인' : 'Packaging discount'}</dt>
                      <dd>-{formatCurrency(packagingDiscount)} · FREE</dd>
                    </div>
                  )}
                </>
              )}
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
              {isCupcakeProduct(selectedProduct.id) && (
                <>
                  <div>
                    <dt>{language === 'ko' ? '구성' : 'Pack'}</dt>
                    <dd>{language === 'ko'
                      ? `${getCupcakePackSize(selectedProduct.id) === 6 ? '하프 더즌' : '더즌'} · ${getCupcakePackSize(selectedProduct.id)}개`
                      : `${getCupcakePackSize(selectedProduct.id) === 6 ? 'Half Dozen' : 'Dozen'} · ${getCupcakePackSize(selectedProduct.id)} cupcakes`}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '마감' : 'Finish'}</dt>
                    <dd>{formatCupcakeFinishText(form.cupcakeFinish, language)}</dd>
                  </div>
                </>
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
                  <dd>{formatCurrentCakeSizeLabel(selectedProduct.id, form.cakeSize) || formatCakeSizeLabel(form.cakeSize)}</dd>
                </div>
              )}
              {isCreamLayerCakeProduct(selectedProduct.id) && (
                <>
                  <div>
                    <dt>{language === 'ko' ? '시트' : 'Layers'}</dt>
                    <dd>{language === 'ko' ? '시그니처 갸또 쇼콜라 시트' : 'Signature Gâteau au Chocolat layers'}</dd>
                  </div>
                  <div>
                    <dt>{language === 'ko' ? '필링' : 'Filling'}</dt>
                    <dd>{selectedProduct.id === 'buttercream-cake'
                      ? language === 'ko' ? '초콜릿 버터크림' : 'Chocolate Buttercream'
                      : language === 'ko' ? '실제 바닐라빈을 넣은 바닐라 생크림' : 'Vanilla fresh cream with real vanilla bean'}</dd>
                  </div>
                  <div>
                    <dt>{selectedProduct.id === 'buttercream-cake'
                      ? language === 'ko' ? '케이크 컬러' : 'Cake colour'
                      : language === 'ko' ? '포인트 컬러' : 'Point colour'}</dt>
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
              {isChocolateExtraEligibleProduct(selectedProduct.id) && form.chocolateExtra !== 'none' && (
                <div>
                  <dt>{language === 'ko' ? '초콜릿 추가 구성' : 'Chocolate extras'}</dt>
                  <dd>{formatChocolateExtra(form.chocolateExtra, language)} · +{formatCurrency(getChocolateExtraOption(form.chocolateExtra).price)}</dd>
                </div>
              )}
              {isBrownieCheesecakeProduct(selectedProduct.id) && form.brownieCreamOption === 'fresh-cream' && (
                <div>
                  <dt>{language === 'ko' ? '생크림' : 'Fresh cream'}</dt>
                  <dd>{formatBrownieCreamOption(selectedProduct.id, form.brownieCreamOption, language)} · +{formatCurrency(getBrownieCreamOption(selectedProduct.id, form.brownieCreamOption).extraPrice)}</dd>
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
                      <strong>{selection.quantity}{copy.quantityUnit} · {formatCurrency(getCakeDetailSelectionTotal(selection))}</strong>
                      {selection.individualPackaging && (
                        <small>{language === 'ko' ? '개별 포장' : 'Individual packaging'} · {getIndividualPackagingPieceCount(selection.productId, selection.quantity)} {language === 'ko' ? '개' : 'pieces'}</small>
                      )}
                      {selection.chocolateExtra !== 'none' && (
                        <small>{language === 'ko' ? '초콜릿 추가 구성' : 'Chocolate extras'} · {formatChocolateExtra(selection.chocolateExtra, language)} · +{formatCurrency(getChocolateExtraOption(selection.chocolateExtra).price)}</small>
                      )}
                      {isBrownieCheesecakeProduct(selection.productId) && selection.brownieCreamOption === 'fresh-cream' && (
                        <small>{language === 'ko' ? '생크림' : 'Fresh cream'} · +{formatCurrency(getBrownieCreamOption(selection.productId, selection.brownieCreamOption).extraPrice)}</small>
                      )}
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
                    const catalogCard = catalogCards.find((card) => card.productId === group.defaultProductId)
                    const groupName = catalogCard?.name || (group.id === 'pave'
                      ? getProductText('pave-cake', language).name
                      : group.id === 'vanilla-fresh-cream'
                        ? getProductText('vanilla-fresh-cream-cake', language).name
                        : group.id === 'pound-cupcake'
                        ? language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes'
                        : group.id === 'cheesecake'
                          ? language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake"
                          : language === 'ko' ? '레몬 케이크' : 'Lemon Cake')
                    const groupImage = catalogCard?.imagePath || (group.id === 'pave'
                      ? productCardImages.pave
                      : group.id === 'vanilla-fresh-cream'
                        ? ''
                        : group.id === 'pound-cupcake'
                        ? productCardImages.pound
                        : group.id === 'cheesecake' ? productCardImages.basque : productCardImages.lemon)
                    const groupPrice = catalogCard?.priceLabel || (group.id === 'pave'
                      ? formatCurrency(79)
                      : group.id === 'vanilla-fresh-cream'
                        ? `From ${formatCurrency(69)}`
                        : group.id === 'pound-cupcake'
                        ? `From ${formatCurrency(45)}`
                        : group.id === 'cheesecake' ? `From ${formatCurrency(55)}` : `From ${formatCurrency(36)}`)
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
                          {group.id === 'vanilla-fresh-cream' || catalogCard?.isPhotoComingSoon
                            ? <VanillaFreshCreamCakeSilhouette productName={groupName} />
                            : <img src={groupImage} alt="" width={1080} height={1012} loading="lazy" decoding="async" />}
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
              <legend>{selectedProductGroup.id === 'cupcake'
                  ? language === 'ko' ? '구성' : 'Pack Size'
                  : selectedProductGroup.id === 'fresh-lemon-cupcakes'
                  ? language === 'ko' ? '구성 선택' : 'Choose pack size'
                  : selectedProductGroup.id === 'brownie-cheesecake'
                    ? language === 'ko' ? '마감 선택' : 'Choose a finish'
                  : language === 'ko' ? '종류 선택' : 'Choose type'}</legend>
                <div className="choice-list">
                  {selectedProductGroup.productIds.map((productId) => {
                    const optionProduct = getProductById(productId)
                    const optionText = getProductText(productId, language)
                    const isCupcakePack = isCupcakeProduct(productId)
                    const isLemonPack = isFreshLemonCupcakeProduct(productId)
                    const packSize = getFreshLemonCupcakePackSize(productId)
                    const cupcakePackSize = getCupcakePackSize(productId)
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
                            {isCupcakePack
                              ? `${language === 'ko' ? cupcakePackSize === 6 ? '하프 더즌' : '더즌' : cupcakePackSize === 6 ? 'Half Dozen' : 'Dozen'} · ${cupcakePackSize} ${language === 'ko' ? '개' : 'cupcakes'} · ${formatCurrency(optionProduct.price)}`
                              : isLemonPack
                              ? `${packSize} ${language === 'ko' ? '개' : 'pieces'} · ${formatCurrency(optionProduct.price)}`
                              : `${optionText.name} · ${formatCurrency(optionProduct.price)}${extraFromBase > 0 ? ` (+${formatCurrency(extraFromBase)})` : ''}`}
                            {productId === 'fresh-lemon-cupcakes-12' && <span className="pack-choice-badge">Most Popular</span>}
                          </strong>
                          <span>{isCupcakePack
                            ? language === 'ko' ? '박스 전체 마감을 다음 단계에서 선택' : 'Choose one finish for the whole box next'
                            : isLemonPack
                            ? language === 'ko' ? '레몬 글레이즈와 꽃 장식 포함' : 'Lemon glaze and floral decoration included'
                            : optionText.priceNote}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {isBrownieFreshCreamEligibleProduct(selectedProduct.id) && (
              <fieldset>
                <legend>{language === 'ko' ? '생크림' : 'Fresh cream'}</legend>
                <div className="choice-list">
                  {BROWNIE_CREAM_OPTIONS.map((option) => (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="brownieCreamOption"
                        checked={form.brownieCreamOption === option.value}
                        onChange={() => setForm({ ...form, brownieCreamOption: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>{language === 'ko' ? option.labelKo : option.label}{option.extraPrice > 0 ? ` (+${formatCurrency(option.extraPrice)})` : ''}</strong>
                      </span>
                    </label>
                  ))}
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

            {isCupcakeProduct(selectedProduct.id) && (
              <fieldset>
                <legend>{language === 'ko' ? '마감' : 'Finish'}</legend>
                <div className="choice-list">
                  {CUPCAKE_FINISH_OPTIONS.map((option) => (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="cupcakeFinish"
                        checked={form.cupcakeFinish === option.value}
                        onChange={() => setForm({ ...form, cupcakeFinish: option.value })}
                      />
                      <span className="choice-copy">
                        <strong>{language === 'ko' ? option.labelKo : option.label}</strong>
                        <span>{formatCurrency(getReservationUnitPrice(selectedProduct.id, { ...priceOptions, cupcakeFinish: option.value }))}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {isIndividualPackagingEligibleProduct(selectedProduct.id) && (
              <fieldset>
                <legend>{language === 'ko' ? '개별 포장' : 'Individual packaging'}</legend>
                <label className="choice-item">
                  <input
                    type="checkbox"
                    name="individualPackaging"
                    checked={form.individualPackaging}
                    onChange={(event) => setForm({ ...form, individualPackaging: event.target.checked })}
                  />
                  <span className="choice-copy">
                    <strong>{language === 'ko' ? '개별 포장 추가' : 'Add individual packaging'}</strong>
                    <span>{language === 'ko'
                      ? '개당 AUD 0.50 · 개별 포장 선택 상품 AUD 100.00 이상 무료'
                      : 'AUD 0.50 per piece · FREE with AUD 100.00+ of individually packaged cupcakes or Lemon Cake'}</span>
                  </span>
                </label>
              </fieldset>
            )}

            {selectedProduct.usesSizeOptions && (
              <fieldset>
              <legend>{labels.sizeSelect}</legend>
              <div className="choice-list">
                {reserveCakeSizeOptions.map((option) => {
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
                          {option.label} · {formatCurrency(option.price)}
                        </strong>
                        {option.description && !isVanillaFreshCreamCakeProduct(selectedProduct.id) && <span>{option.description}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="field-help">{copy.sizeHelp}</p>
              </fieldset>
            )}

            {isCakePointColorProduct(selectedProduct.id) && (
              <fieldset>
                <legend>{isButtercreamCakeProduct(selectedProduct.id)
                  ? language === 'ko' ? '케이크 포인트 컬러 선택' : 'Choose a point colour'
                  : language === 'ko' ? '포인트 컬러 선택' : 'Choose point colour'}</legend>
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
                      <strong>{option.value}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>
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
            {isChocolateExtraEligibleProduct(selectedProduct.id) && (
              <fieldset>
                <legend>{language === 'ko' ? '초콜릿 추가 구성' : 'CHOCOLATE EXTRAS'}</legend>
                <div className="choice-list">
                  {CHOCOLATE_EXTRA_OPTIONS.map((option) => (
                    <label className="choice-item" key={option.value}>
                      <input
                        type="radio"
                        name="chocolateExtra"
                        checked={form.chocolateExtra === option.value}
                        onChange={() => selectChocolateExtra(option.value)}
                      />
                      <span className="choice-copy">
                        <strong>
                          {language === 'ko' ? option.labelKo : option.label}
                          {option.price > 0 && ` (+${formatCurrency(option.price)})`}
                        </strong>
                        <span>{language === 'ko' ? option.descriptionKo : option.description}</span>
                      </span>
                    </label>
                  ))}
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
                  availabilityNote={language === 'ko'
                    ? '케이크 픽업 · 매일 08:00–20:00'
                    : 'Cake pick-up · Every day 08:00–20:00'}
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
                  disabled={times.length === 0}
                >
                  {times.length === 0 && (
                    <option value="" disabled>
                      {copy.pickupAvailabilityNone}
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
              {times.length === 0 ? (
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
              {labels.email}
              <input
                type="email"
                autoComplete="email"
                maxLength={120}
                required
                value={form.customerEmail}
                onChange={(event) => setForm({ ...form, customerEmail: event.target.value })}
              />
              <span className="field-help">{labels.emailHelp}</span>
            </label>

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
                {copy.privacyNotice} {labels.emailPrivacy}
              </span>
            </label>

            {error && <p className="error-text" role="alert">{error}</p>}

            <BankAccountBox settings={settings} totalPrice={promoPriceDisplay.finalPrice} language={language} />

            <button
              className="primary-button full-width"
              type="submit"
              disabled={submitting || !selectedPickupTime}
            >
              {submitting ? copy.submitting : copy.reserveCta}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}
