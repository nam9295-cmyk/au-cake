import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import poundHeroImg from './assets/hero-cake-3.webp'
import cupcakeHeroImg from './assets/cupcake-hero.webp'
import paveHeroImg from './assets/hero-cake-2.webp'
import paveCardImg from './assets/pave-cake-card.jpg'
import paveSliceImg from './assets/chocolate-cake-slice.jpg'
import paveSlicesImg from './assets/chocolate-cake-eight-slices.jpg'
import cheesecakeHeroImg from './assets/basquecheesecake.webp'
import lemonHeroImg from './assets/lemoncake.webp'
import eiffelChocolateImg from './assets/eiffel-chocolate-card.jpg'
import gateauBasicFinishImg from './assets/options/gateau-basic.webp'
import gateauOnChocolateFinishImg from './assets/options/gateau-onchocolate.webp'
import gateauVanillaFinishImg from './assets/options/gateau-vanilla.webp'
import eiffelExtraImg from './assets/options/extra-eff.webp'
import paveExtraImg from './assets/options/extra-pave.webp'
import chocolateExtraSetImg from './assets/options/extra-2set.webp'
import CakeEditorialDetail from './CakeEditorialDetail'
import KoreanCakeReviewsSection from './KoreanCakeReviewsSection'
import {
  CAKE_SIZE_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_FINISH_OPTIONS,
  MAX_RESERVATION_QUANTITY,
  POUND_ADDON_OPTIONS,
  VANILLA_CAKE_POINT_COLOR_OPTIONS,

  formatCakeSizeLabel,
  getCupcakeFinishPrice,
  getCupcakePackSize,
  getFreshLemonCupcakePackSize,
  getProductById,
  isCupcakeProduct,
  isButtercreamCakeProduct,
  isCakePointColorProduct,
  isFreshLemonCupcakeProduct,
  usesReservationChocolateType,
} from './lib/constants'
import {
  createCakeDetailSelection,
  getCakeDetailBySlug,
  getCakeDetailSelectionTotal,
  getCakeDetailSelectionEstimatedTotal,
  selectCakeDetailProduct,
  type CakeDetailImageKey,
  type CakeDetailSelection,
} from './lib/cake-detail'
import { getIndividualPackagingPricing, isIndividualPackagingEligibleProduct } from './lib/individual-packaging'
import { CHOCOLATE_EXTRA_OPTIONS, getChocolateExtraOption, isChocolateExtraEligibleProduct } from './lib/chocolate-extras'
import { BROWNIE_CREAM_OPTIONS, isBrownieFreshCreamEligibleProduct } from './lib/brownie-cream'
import { getAuCakeCatalogCards, type CakeCatalogCard } from './lib/cake-catalog'
import { formatCurrentCakeSizeLabel, getCakeServingGuideCopy, getCurrentWholeCakeSizeOptions, isCurrentWholeCakeProduct } from './lib/cake-serving'
import { getCakeEditorialBySlug, type CakeEditorialImageKey } from './lib/cake-editorial'
import { getProductText, type Language } from './lib/i18n'
import { formatCurrency } from './lib/utils'
import type { ChocolateExtra, PoundAddon, ProductId } from './lib/types'

const detailImages: Record<CakeDetailImageKey, string> = {
  'pound-side': '/products/chocolate-pound-cake-sydney.webp',
  'pound-quick-view': '/products/details/chocolate-pound-cake-quick-view.webp',
  'pound-previous': '/products/details/chocolate-pound-cake-previous.webp',
  'pound-hero': poundHeroImg,
  'cupcake-side': '/products/chocolate-cupcakes-sydney.webp',
  'cupcake-detail': '/products/details/chocolate-cupcakes-detail-01.webp',
  'cupcake-hero': cupcakeHeroImg,
  'pave-side': '/products/pave-chocolate-cake-sydney.webp',
  'pave-quick-view': '/products/details/pave-chocolate-cake-quick-view.webp',
  'pave-previous': '/products/details/pave-chocolate-cake-previous.webp',
  'pave-hero': paveHeroImg,
  'pave-card': paveCardImg,
  'pave-slice': paveSliceImg,
  'pave-slices': paveSlicesImg,
  'cheesecake-hero': cheesecakeHeroImg,
  'cheesecake-side': '/products/chocolatiers-basque-cheesecake-sydney.webp',
  'cheesecake-quick-view': '/products/details/chocolatiers-basque-cheesecake-quick-view.webp',
  'cheesecake-previous': '/products/details/chocolatiers-basque-cheesecake-previous.webp',
  'lemon-hero': lemonHeroImg,
  'lemon-side': '/products/lemon-cake-sydney.webp',
  'lemon-quick-view': '/products/details/lemon-cake-quick-view.webp',
  'lemon-previous': '/products/details/lemon-cake-previous.webp',
  'vanilla-side': '/products/vanilla-cake-sydney.webp',
  'vanilla-quick-view': '/products/details/vanillacake-quickview.webp',
  'buttercream-side': '/products/buttercream-cake-sydney.webp',
  'buttercream-detail': '/products/details/buttercream-cake-detail-01.webp',
  'buttercream-quick-view': '/products/details/buttercream-cake-quick-view.webp',
  'signature-gateau-side': '/products/signature-gateau-au-chocolat-sydney.webp',
  'signature-gateau-detail': '/products/details/signature-gateau-au-chocolat-detail-01.webp',
  'signature-gateau-quick-view': '/products/details/chocolate-pound-cake-quick-view.webp',
  'signature-gateau-previous': '/products/details/signature-gateau-au-chocolat-previous-main.webp',
  'signature-gateau-hero': poundHeroImg,
  'fresh-strawberry-vanilla-cream-side': '/products/fresh-strawberry-vanilla-cream-cake-sydney.webp',
  'fresh-strawberry-vanilla-cream-detail': '/products/details/fresh-strawberry-vanilla-cream-cake-detail-01.webp',
  'fresh-strawberry-chocolate-cream-side': '/products/fresh-strawberry-chocolate-cream-cake-sydney.webp',
  'fresh-strawberry-chocolate-cream-detail': '/products/details/fresh-strawberry-chocolate-cream-cake-detail-01.webp',
  'brownie-side': '/products/brownie-cheesecake-sydney.webp',
  'brownie-detail': '/products/details/brownie-cheesecake-detail-01.webp',
  'brownie-quick-view': '/products/details/brownie-cheese-quick-view.webp',
}

type OptionPreviewImage = {
  src: string
  alt: string
  altKo: string
}

const poundFinishPreviewImages: Record<PoundAddon, OptionPreviewImage> = {
  none: {
    src: gateauBasicFinishImg,
    alt: 'Signature Gâteau au Chocolat with the basic finish',
    altKo: '기본 마감 시그니처 갸또 쇼콜라',
  },
  'extra-chocolate': {
    src: gateauOnChocolateFinishImg,
    alt: 'Signature Gâteau au Chocolat with extra chocolate on top',
    altKo: '윗면에 초콜릿을 추가한 시그니처 갸또 쇼콜라',
  },
  'vanilla-cream': {
    src: gateauVanillaFinishImg,
    alt: 'Signature Gâteau au Chocolat finished with vanilla cream',
    altKo: '바닐라 크림으로 마감한 시그니처 갸또 쇼콜라',
  },
}

const chocolateExtraPreviewImages: Partial<Record<ChocolateExtra, OptionPreviewImage>> = {
  'eiffel-6': {
    src: eiffelExtraImg,
    alt: 'Six Eiffel Tower chocolates',
    altKo: '에펠탑 초콜릿 6개',
  },
  'pave-100g': {
    src: paveExtraImg,
    alt: '100g tub of Pavé chocolate',
    altKo: '파베 초콜릿 100g 통',
  },
  combo: {
    src: chocolateExtraSetImg,
    alt: 'Eiffel Tower chocolates and Pavé chocolate extra set',
    altKo: '에펠탑 초콜릿과 파베 초콜릿 추가 세트',
  },
}

const detailImageDimensions: Record<CakeDetailImageKey, { width: number; height: number }> = {
  'pound-side': { width: 1080, height: 1012 },
  'pound-quick-view': { width: 1080, height: 1012 },
  'pound-previous': { width: 1080, height: 1012 },
  'pound-hero': { width: 1080, height: 1012 },
  'cupcake-side': { width: 1080, height: 1012 },
  'cupcake-detail': { width: 1080, height: 1012 },
  'cupcake-hero': { width: 1448, height: 1086 },
  'pave-side': { width: 1080, height: 1012 },
  'pave-quick-view': { width: 1080, height: 1012 },
  'pave-previous': { width: 1080, height: 1012 },
  'pave-hero': { width: 1080, height: 1012 },
  'pave-card': { width: 560, height: 520 },
  'pave-slice': { width: 1122, height: 1402 },
  'pave-slices': { width: 1000, height: 1000 },
  'cheesecake-hero': { width: 1080, height: 1012 },
  'cheesecake-side': { width: 1080, height: 1012 },
  'cheesecake-quick-view': { width: 1080, height: 1012 },
  'cheesecake-previous': { width: 1080, height: 1012 },
  'lemon-hero': { width: 1080, height: 1012 },
  'lemon-side': { width: 1080, height: 1012 },
  'lemon-quick-view': { width: 1080, height: 1012 },
  'lemon-previous': { width: 1080, height: 1012 },
  'vanilla-side': { width: 1080, height: 1012 },
  'vanilla-quick-view': { width: 1080, height: 1012 },
  'buttercream-side': { width: 1080, height: 1012 },
  'buttercream-detail': { width: 1080, height: 1012 },
  'buttercream-quick-view': { width: 1080, height: 1012 },
  'signature-gateau-side': { width: 1080, height: 1012 },
  'signature-gateau-detail': { width: 1080, height: 1012 },
  'signature-gateau-quick-view': { width: 1080, height: 1012 },
  'signature-gateau-previous': { width: 1080, height: 1012 },
  'signature-gateau-hero': { width: 1080, height: 1012 },
  'fresh-strawberry-vanilla-cream-side': { width: 1080, height: 1012 },
  'fresh-strawberry-vanilla-cream-detail': { width: 1080, height: 1012 },
  'fresh-strawberry-chocolate-cream-side': { width: 1080, height: 1012 },
  'fresh-strawberry-chocolate-cream-detail': { width: 1080, height: 1012 },
  'brownie-side': { width: 1080, height: 1012 },
  'brownie-detail': { width: 1080, height: 1012 },
  'brownie-quick-view': { width: 1080, height: 1012 },
}

const editorialImages: Record<CakeEditorialImageKey, { src: string; width: number; height: number }> = {
  'pave-quick-view': {
    src: detailImages['pave-quick-view'],
    ...detailImageDimensions['pave-quick-view'],
  },
  'pave-side': {
    src: detailImages['pave-side'],
    ...detailImageDimensions['pave-side'],
  },
  'vanilla-side': {
    src: detailImages['vanilla-side'],
    ...detailImageDimensions['vanilla-side'],
  },
  'vanilla-quick-view': {
    src: detailImages['vanilla-quick-view'],
    ...detailImageDimensions['vanilla-quick-view'],
  },
  'buttercream-side': {
    src: detailImages['buttercream-side'],
    ...detailImageDimensions['buttercream-side'],
  },
  'buttercream-quick-view': {
    src: detailImages['buttercream-quick-view'],
    ...detailImageDimensions['buttercream-quick-view'],
  },
  'cupcake-side': {
    src: detailImages['cupcake-side'],
    ...detailImageDimensions['cupcake-side'],
  },
  'cupcake-detail': {
    src: detailImages['cupcake-detail'],
    ...detailImageDimensions['cupcake-detail'],
  },
  'eiffel-chocolate': {
    src: eiffelChocolateImg,
    width: 1000,
    height: 1000,
  },
}

type CakeDetailPageProps = {
  slug: string
  language: Language
  onBack: () => void
  onBrowseCakes: () => void
  onOpenCake: (slug: string) => void
  onAddToOrder: (selection: CakeDetailSelection) => void
  onViewOrder: () => void
}

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

function OptionPhotoPreview({
  image,
  eyebrow,
  label,
  description,
  language,
}: {
  image: OptionPreviewImage
  eyebrow: string
  label: string
  description: string
  language: Language
}) {
  return (
    <div className="cake-detail-option-preview" aria-live="polite">
      <img
        key={image.src}
        src={image.src}
        alt={language === 'ko' ? image.altKo : image.alt}
        width={112}
        height={88}
        loading="eager"
        decoding="async"
      />
      <div className="cake-detail-option-preview-copy">
        <span>{eyebrow}</span>
        <strong>{label}</strong>
        <p className="cake-detail-extra-help">{description}</p>
      </div>
    </div>
  )
}

export default function CakeDetailPage({
  slug,
  language,
  onBack,
  onBrowseCakes,
  onOpenCake,
  onAddToOrder,
  onViewOrder,
}: CakeDetailPageProps) {
  const detail = useMemo(() => getCakeDetailBySlug(slug, language), [language, slug])
  const [selection, setSelection] = useState<CakeDetailSelection | null>(() => createCakeDetailSelection(slug))
  const [activeImage, setActiveImage] = useState(0)
  const [addedToOrder, setAddedToOrder] = useState(false)

  if (!detail) {
    return (
      <main className="cake-detail-not-found">
        <p className="summary-kicker">404</p>
        <h1>{language === 'ko' ? '케이크를 찾을 수 없어요' : 'We could not find that cake'}</h1>
        <button type="button" className="primary-button" onClick={onBrowseCakes}>
          {language === 'ko' ? '케이크 보기' : 'View cakes'}
        </button>
      </main>
    )
  }

  if (detail.isLegacy) {
    return (
      <main className="cake-detail-not-found">
        <p className="summary-kicker">{language === 'ko' ? '이전 컬렉션' : 'Previous collection'}</p>
        <h1>{detail.name}</h1>
        <p>{detail.description}</p>
        <div className="cake-detail-legacy-actions">
          {detail.legacyLinks?.map((link) => (
            <button type="button" className="primary-button" onClick={() => onOpenCake(link.slug)} key={link.slug}>
              {link.name}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={onBrowseCakes}>
          {language === 'ko' ? '현재 케이크 보기' : 'View current cakes'}
        </button>
      </main>
    )
  }

  if (!selection) {
    return (
      <main className="cake-detail-not-found">
        <p className="summary-kicker">404</p>
        <h1>{language === 'ko' ? '케이크를 찾을 수 없어요' : 'We could not find that cake'}</h1>
        <button type="button" className="primary-button" onClick={onBrowseCakes}>
          {language === 'ko' ? '케이크 보기' : 'View cakes'}
        </button>
      </main>
    )
  }

  const product = getProductById(selection.productId)
  const productText = getProductText(selection.productId, language)
  const selectedChocolateExtra = getChocolateExtraOption(selection.chocolateExtra)
  const selectedFinishOption = POUND_ADDON_OPTIONS.find((option) => option.value === selection.poundAddon) || POUND_ADDON_OPTIONS[0]
  const selectedFinishPreview = poundFinishPreviewImages[selection.poundAddon]
  const selectedChocolateExtraPreview = chocolateExtraPreviewImages[selection.chocolateExtra]
  const showsSignatureOrderOptions = detail.id === 'signature-gateau'
  const productTotal = getCakeDetailSelectionTotal(selection)
  const individualPackagingPricing = getIndividualPackagingPricing([{
    productId: selection.productId,
    quantity: selection.quantity,
    individualPackaging: selection.individualPackaging,
    productSubtotalCents: Math.round(productTotal * 100),
  }])
  const individualPackagingDiscount = individualPackagingPricing.individualPackagingDiscountCents / 100
  const total = getCakeDetailSelectionEstimatedTotal(selection)
  const galleryCount = detail.gallery.length
  const currentImageKey = detail.gallery[Math.min(activeImage, Math.max(0, galleryCount - 1))]
  const addLabel = language === 'ko' ? '주문에 담기' : 'Add to order'
  const editorial = getCakeEditorialBySlug(slug, language)
  const compactOrderingNotice = editorial?.layout === 'compact' ? editorial.orderingNotice : null
  const relatedProducts = editorial
    ? editorial.relatedProductSlugs
        .map((relatedSlug) => getAuCakeCatalogCards(language).find((candidate) => candidate.slug === relatedSlug))
        .filter((candidate): candidate is CakeCatalogCard => {
          if (!candidate) return false
          return candidate.slug !== slug
        })
        .slice(0, 2)
    : []
  const selectedUnitPrice = product.usesSizeOptions
    ? product.sizePrices[selection.cakeSize] || product.price
    : product.price

  function updateSelection(patch: Partial<CakeDetailSelection>) {
    setAddedToOrder(false)
    setSelection((current) => current
      ? selectCakeDetailProduct({ ...current, ...patch }, patch.productId || current.productId)
      : current)
  }

  function chooseProduct(productId: ProductId) {
    setAddedToOrder(false)
    setSelection((current) => current ? selectCakeDetailProduct(current, productId) : current)
  }

  function addToOrder() {
    if (!selection) return
    onAddToOrder(selection)
    setAddedToOrder(true)
  }

  function rotateGallery(direction: 1 | -1) {
    if (galleryCount < 2) return
    setActiveImage((current) => (current + direction + galleryCount) % galleryCount)
  }

  const isCurrentWholeCake = isCurrentWholeCakeProduct(product.id)
  const sizeOptions = isCurrentWholeCake
    ? getCurrentWholeCakeSizeOptions(product.id).map((value) => ({
        value,
        label: formatCurrentCakeSizeLabel(product.id, value) || value,
        price: product.sizePrices[value],
      }))
    : CAKE_SIZE_OPTIONS.filter((option) => Object.hasOwn(product.sizePrices, option.value))
  const packSize = getFreshLemonCupcakePackSize(product.id) || 0
  const productChoiceLabel = detail.id === 'cupcake'
    ? language === 'ko' ? '구성' : 'Pack Size'
    : detail.id === 'brownie-cheesecake'
    ? language === 'ko' ? '마감 선택' : 'Choose a finish'
    : language === 'ko' ? '종류 선택' : 'Choose a style'
  const productIntroDetail = detail

  function renderProductIntro(className: string) {
    return (
      <div className={className}>
        <p className="cake-detail-eyebrow">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
        <h1>{productIntroDetail.name}</h1>
        <p className="cake-detail-price cake-detail-price-primary" aria-live="polite">{formatCurrency(total)}</p>
        <p className="cake-detail-description">{productIntroDetail.description}</p>

        <div className="cake-detail-badges" aria-label={language === 'ko' ? '주문 안내' : 'Order notes'}>
          {productIntroDetail.trustPoints.map((point) => <span key={point}>{point}</span>)}
        </div>
      </div>
    )
  }

  return (
    <main className="cake-detail-page">
      <nav className="cake-detail-breadcrumb" aria-label={language === 'ko' ? '경로' : 'Breadcrumb'}>
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {language === 'ko' ? '케이크로 돌아가기' : 'Back to cakes'}
        </button>
      </nav>

      <section
        className={`cake-detail-hero is-desktop-three-column${showsSignatureOrderOptions ? ' has-compact-option-summary' : ''}`}
        aria-label={detail.name}
      >
        <div className="cake-detail-gallery">
          {renderProductIntro('cake-detail-intro is-desktop-gallery-intro')}
          <div className="cake-detail-main-image">
            {currentImageKey ? (
              <img
                src={detailImages[currentImageKey]}
                alt={`${detail.name} · ${activeImage + 1} of ${galleryCount}`}
                width={detailImageDimensions[currentImageKey].width}
                height={detailImageDimensions[currentImageKey].height}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="cake-detail-photo-coming" role="img" aria-label={`${detail.name} photo coming soon`}>
                <span>COMING SOON</span>
                <strong>{detail.name}</strong>
                <small>{language === 'ko' ? '사진 준비 중 · 주문 가능' : 'Photo pending · Available to request'}</small>
              </div>
            )}
            {galleryCount > 1 && (
              <>
                <button
                  type="button"
                  className="cake-detail-gallery-arrow is-previous"
                  aria-label={language === 'ko' ? '이전 사진' : 'Previous product photo'}
                  onClick={() => rotateGallery(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="cake-detail-gallery-arrow is-next"
                  aria-label={language === 'ko' ? '다음 사진' : 'Next product photo'}
                  onClick={() => rotateGallery(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {galleryCount > 1 && (
            <div className="cake-detail-thumbnails" aria-label={language === 'ko' ? '상품 사진 선택' : 'Choose a product photo'}>
              {detail.gallery.map((imageKey, index) => (
                <button
                  type="button"
                  className={index === activeImage ? 'is-selected' : ''}
                  aria-label={`${language === 'ko' ? '사진' : 'Photo'} ${index + 1}`}
                  aria-pressed={index === activeImage}
                  onClick={() => setActiveImage(index)}
                  key={`${imageKey}-${index}`}
                >
                  <img
                    src={detailImages[imageKey]}
                    alt=""
                    width={detailImageDimensions[imageKey].width}
                    height={detailImageDimensions[imageKey].height}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          )}
          <p className="cake-detail-image-count" aria-live="polite">
            {galleryCount > 0 ? `${activeImage + 1} / ${galleryCount}` : language === 'ko' ? '사진 준비 중' : 'Photo coming soon'}
          </p>
        </div>

        <aside className="cake-detail-purchase">
          <div className="cake-detail-configurator">
          {renderProductIntro('cake-detail-intro is-standard-intro')}

          {detail.productIds.length > 1 && (
            <fieldset className="cake-detail-fieldset">
              <legend>{productChoiceLabel}</legend>
              <div className="cake-detail-options is-stacked">
                {detail.productIds.map((productId) => {
                  const optionText = getProductText(productId, language)
                  const cupcakePackSize = getCupcakePackSize(productId)
                  const optionPrice = cupcakePackSize
                    ? getCupcakeFinishPrice(productId, 'basic') || 0
                    : getProductById(productId).price
                  const extraFromBase = detail.id === 'brownie-cheesecake'
                    ? optionPrice - getProductById(detail.productIds[0]!).price
                    : 0
                  return (
                    <OptionButton
                      active={selection.productId === productId}
                      onClick={() => chooseProduct(productId)}
                      key={productId}
                    >
                      <strong>{cupcakePackSize
                        ? language === 'ko' ? `${cupcakePackSize === 6 ? '하프 더즌' : '더즌'} · ${cupcakePackSize}개` : `${cupcakePackSize === 6 ? 'Half Dozen' : 'Dozen'} · ${cupcakePackSize} cupcakes`
                        : optionText.name}</strong>
                      <span>{formatCurrency(optionPrice)}{extraFromBase > 0 ? ` (+${formatCurrency(extraFromBase)})` : ''}</span>
                    </OptionButton>
                  )
                })}
              </div>
            </fieldset>
          )}

          {isBrownieFreshCreamEligibleProduct(product.id) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '생크림' : 'Fresh cream'}</legend>
              <div className="cake-detail-options">
                {BROWNIE_CREAM_OPTIONS.map((option) => (
                  <OptionButton
                    active={selection.brownieCreamOption === option.value}
                    onClick={() => updateSelection({ brownieCreamOption: option.value })}
                    key={option.value}
                  >
                    <strong>{language === 'ko' ? option.labelKo : option.label}</strong>
                    <span>{option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : language === 'ko' ? '선택 안 함' : 'No extra'}</span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}

          {product.usesSizeOptions && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '사이즈 선택' : 'Choose your size'}</legend>
              <div className="cake-detail-options">
                {sizeOptions.map((option) => (
                  <OptionButton
                    active={selection.cakeSize === option.value}
                    onClick={() => updateSelection({ cakeSize: option.value })}
                    key={option.value}
                  >
                    <strong>{formatCurrentCakeSizeLabel(product.id, option.value) || formatCakeSizeLabel(option.value)}</strong>
                    <span>{formatCurrency(product.sizePrices[option.value] ?? option.price ?? product.price)}</span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}
            {isCurrentWholeCake && (
              <details className="cake-detail-serving-guide">
                <summary>{getCakeServingGuideCopy(language).title}</summary>
                <p>{getCakeServingGuideCopy(language).body}</p>
              </details>
            )}

          {product.usesPoundAddonOptions && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '마감 선택' : 'Choose a finish'}</legend>
              <OptionPhotoPreview
                image={selectedFinishPreview}
                eyebrow={language === 'ko' ? '현재 선택한 마감' : 'Selected finish'}
                label={selectedFinishOption.label}
                description={selectedFinishOption.description}
                language={language}
              />
              <div className="cake-detail-options">
                {POUND_ADDON_OPTIONS.map((option) => (
                  <OptionButton
                    active={selection.poundAddon === option.value}
                    onClick={() => updateSelection({ poundAddon: option.value })}
                    key={option.value}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.extraPrice ? `+${formatCurrency(option.extraPrice)}` : language === 'ko' ? '기본' : 'Included'}</span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}

          {usesReservationChocolateType(product.id, selection.poundAddon) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '초콜릿 선택' : 'Choose chocolate'}</legend>
              <div className="cake-detail-options">
                {CHOCOLATE_TYPE_OPTIONS.map((option) => (
                  <OptionButton
                    active={selection.chocolateType === option.value}
                    onClick={() => updateSelection({ chocolateType: option.value })}
                    key={option.value}
                  >
                    <strong>{option.label}</strong>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}

          {isCakePointColorProduct(product.id) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{isButtercreamCakeProduct(product.id)
                ? language === 'ko' ? '케이크 컬러 선택' : 'Choose a cake colour'
                : language === 'ko' ? '포인트 컬러 선택' : 'Choose a point colour'}</legend>
              <div className="vanilla-point-color-grid">
                {VANILLA_CAKE_POINT_COLOR_OPTIONS.map((option) => {
                  const isSelected = selection.vanillaCakePointColor === option.value
                  return (
                    <button
                      type="button"
                      className={`vanilla-point-color-card${isSelected ? ' is-selected' : ''}`}
                      aria-label={language === 'ko'
                        ? `${option.labelKo} ${isButtercreamCakeProduct(product.id) ? '케이크 컬러' : '포인트 컬러'}`
                        : `${option.label} ${isButtercreamCakeProduct(product.id) ? 'cake colour' : 'point colour'}`}
                      aria-pressed={isSelected}
                      onClick={() => updateSelection({ vanillaCakePointColor: option.value })}
                      key={option.value}
                    >
                      <span className="vanilla-point-color-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
                      <strong>{option.value}</strong>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {isFreshLemonCupcakeProduct(product.id) && (
            <fieldset className="cake-detail-fieldset cake-detail-mix-fieldset">
              <legend>{language === 'ko' ? '다크 초콜릿 마감 개수' : 'Dark chocolate finish pieces'}</legend>
              <p>{language === 'ko'
                ? `레몬 제스트 아이싱 ${packSize - selection.chocolateIcingCount}개 · 다크 초콜릿 ${selection.chocolateIcingCount}개`
                : `Fresh lemon zest ${packSize - selection.chocolateIcingCount} · Dark chocolate ${selection.chocolateIcingCount}`}</p>
              <input
                type="range"
                min="0"
                max={packSize}
                value={selection.chocolateIcingCount}
                aria-label={language === 'ko' ? '다크 초콜릿 마감 개수' : 'Dark chocolate finish pieces'}
                onChange={(event) => updateSelection({ chocolateIcingCount: Number(event.target.value) })}
              />
            </fieldset>
          )}

          {isCupcakeProduct(product.id) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '마감' : 'Finish'}</legend>
              <div className="cake-detail-options">
                {CUPCAKE_FINISH_OPTIONS.map((option) => (
                  <OptionButton
                    active={selection.cupcakeFinish === option.value}
                    onClick={() => updateSelection({ cupcakeFinish: option.value })}
                    key={option.value}
                  >
                    <strong>{language === 'ko' ? option.labelKo : option.label}</strong>
                    <span>{formatCurrency(getCupcakeFinishPrice(product.id, option.value) || 0)}</span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}

          {isChocolateExtraEligibleProduct(product.id) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '초콜릿 추가 구성' : 'CHOCOLATE EXTRAS'}</legend>
              <div className="cake-detail-options is-stacked">
                {CHOCOLATE_EXTRA_OPTIONS.map((option) => (
                  <OptionButton
                    active={selection.chocolateExtra === option.value}
                    onClick={() => updateSelection({ chocolateExtra: option.value })}
                    key={option.value}
                  >
                    <strong>{language === 'ko' ? option.labelKo : option.label}</strong>
                    <span>{option.price > 0 ? `+${formatCurrency(option.price)}` : language === 'ko' ? '선택 안 함' : 'No extra'}</span>
                  </OptionButton>
                ))}
              </div>
              {selection.chocolateExtra !== 'none' && selectedChocolateExtraPreview ? (
                <OptionPhotoPreview
                  image={selectedChocolateExtraPreview}
                  eyebrow={language === 'ko' ? '현재 선택한 추가 구성' : 'Selected extra'}
                  label={language === 'ko' ? selectedChocolateExtra.labelKo : selectedChocolateExtra.label}
                  description={language === 'ko' ? selectedChocolateExtra.descriptionKo : selectedChocolateExtra.description}
                  language={language}
                />
              ) : (
                <p className="cake-detail-extra-help">{language === 'ko' ? selectedChocolateExtra.descriptionKo : selectedChocolateExtra.description}</p>
              )}
            </fieldset>
          )}

          {isIndividualPackagingEligibleProduct(product.id) && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '개별 포장' : 'Individual packaging'}</legend>
              <label className="choice-item">
                <input
                  type="checkbox"
                  name="individualPackaging"
                  checked={selection.individualPackaging}
                  onChange={(event) => updateSelection({ individualPackaging: event.target.checked })}
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

          </div>
          <div className="cake-detail-checkout">
            <div className="cake-detail-checkout-card">
          <p className="cake-detail-checkout-price" aria-live="polite">{formatCurrency(total)}</p>

          <fieldset className="cake-detail-fieldset">
            <legend>{language === 'ko' ? '수량' : 'Quantity'}</legend>
            <div className="cake-detail-quantity">
              <button
                type="button"
                aria-label={language === 'ko' ? '수량 줄이기' : 'Decrease quantity'}
                disabled={selection.quantity <= 1}
                onClick={() => updateSelection({ quantity: selection.quantity - 1 })}
              >
                <Minus aria-hidden="true" />
              </button>
              <output aria-live="polite">{selection.quantity}</output>
              <button
                type="button"
                aria-label={language === 'ko' ? '수량 늘리기' : 'Increase quantity'}
                disabled={selection.quantity >= MAX_RESERVATION_QUANTITY}
                onClick={() => updateSelection({ quantity: selection.quantity + 1 })}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          </fieldset>

          <div className="cake-detail-order-summary">
            <div>
              <span>{language === 'ko' ? '선택 상품' : 'Your selection'}</span>
              <strong className="cake-detail-order-product">{productText.name}</strong>
              {showsSignatureOrderOptions && (
                <div className="cake-detail-order-options">
                  <span>{selectedFinishOption.label}</span>
                  <span>{language === 'ko' ? selectedChocolateExtra.labelKo : selectedChocolateExtra.label}</span>
                </div>
              )}
              {individualPackagingPricing.individualPackagingDiscountCents > 0 && (
                <p className="cake-detail-packaging-discount">
                  <span>{language === 'ko' ? '포장 할인' : 'Packaging discount'}</span>
                  <strong>-{formatCurrency(individualPackagingDiscount)} · FREE</strong>
                </p>
              )}
            </div>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <button type="button" className="primary-button cake-detail-request" onClick={addToOrder}>
            {addLabel}
          </button>
          {addedToOrder && (
            <div className="cake-detail-added">
              <p role="status">
                {language === 'ko' ? '주문에 담았어요.' : 'Added to your order.'}
              </p>
              <button type="button" className="secondary-button" onClick={onViewOrder}>
                {language === 'ko' ? '주문 보기' : 'View order'}
              </button>
            </div>
          )}
            </div>
          {compactOrderingNotice ? (
            <section className="cake-detail-ordering-notice" aria-label={language === 'ko' ? '주문 및 픽업 안내' : 'Ordering and pick-up'}>
              <span className="cake-detail-ordering-notice-label">
                {language === 'ko' ? '주문 및 픽업 안내' : 'ORDERING & PICK-UP'}
              </span>
              <div className="cake-detail-ordering-notice-content">
                <strong>{compactOrderingNotice.title}</strong>
                <p>{compactOrderingNotice.body}</p>
              </div>
            </section>
          ) : (
            <p className="cake-detail-confirmation-note">
              {language === 'ko'
                ? '지금 결제되지 않습니다. 베리굿 팀이 가능 여부를 확인한 뒤 결제 정보를 안내합니다.'
                : 'No payment is taken now. Our team will confirm availability and send payment details.'}
              </p>
            )}
          </div>
        </aside>
      </section>

      {editorial ? (
        <CakeEditorialDetail
          editorial={editorial}
          language={language}
          slug={slug}
          selectedSizeLabel={formatCurrentCakeSizeLabel(selection.productId, selection.cakeSize) || formatCakeSizeLabel(selection.cakeSize)}
          selectedUnitPrice={formatCurrency(selectedUnitPrice)}
          estimatedTotal={formatCurrency(total)}
          detailAccordions={detail.accordions}
          relatedProducts={relatedProducts}
          images={editorialImages}
          addedToOrder={addedToOrder}
          onAddToOrder={addToOrder}
          onViewOrder={onViewOrder}
          onBrowseCakes={onBrowseCakes}
          onOpenCake={onOpenCake}
        />
      ) : (
        <>
        <section className="cake-detail-trust" aria-label={language === 'ko' ? '베리굿 제작 방식' : 'verygood chocolate service notes'}>
          {detail.trustPoints.map((point, index) => (
            <article key={point}>
              <span>0{index + 1}</span>
              <strong>{point}</strong>
            </article>
          ))}
        </section>

        <section className="cake-detail-story" aria-labelledby="cake-detail-story-title">
          <p className="summary-kicker">{language === 'ko' ? '제품 안내' : 'Cake notes'}</p>
          <h2 id="cake-detail-story-title">{language === 'ko' ? '이 케이크의 특징' : "Why you'll love it"}</h2>
          <div>
            {detail.features.map((feature, index) => (
              <article key={feature}>
                <span>0{index + 1}</span>
                <p>{feature}</p>
              </article>
            ))}
          </div>
        </section>

        <KoreanCakeReviewsSection slug={slug} language={language} />

        <section className="cake-detail-accordion" aria-labelledby="cake-detail-info-title">
          <p className="summary-kicker">{language === 'ko' ? '주문 전 확인' : 'Good to know'}</p>
          <h2 id="cake-detail-info-title">{language === 'ko' ? '주문과 픽업 안내' : 'Ordering and pick-up'}</h2>
          <div>
            {detail.accordions.map((item, index) => (
              <details key={item.title} open={index === 0}>
                <summary>{item.title}</summary>
                <p>{item.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cake-detail-other" aria-labelledby="cake-detail-other-title">
          <h2 id="cake-detail-other-title">{language === 'ko' ? '다른 케이크 보기' : 'Explore other cakes'}</h2>
          <button type="button" className="secondary-button" onClick={onBrowseCakes}>
            {language === 'ko' ? '전체 케이크' : 'View all cakes'}
          </button>
          <div className="cake-detail-other-links">
            {getAuCakeCatalogCards(language)
              .filter((candidate) => candidate.slug !== slug)
              .slice(0, 2)
              .map((candidate) => (
                <button type="button" onClick={() => onOpenCake(candidate.slug)} key={candidate.slug}>
                  {candidate.name}
                </button>
              ))}
          </div>
        </section>
        </>
      )}
    </main>
  )
}
