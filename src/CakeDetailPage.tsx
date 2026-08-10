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
import KoreanCakeReviewsSection from './KoreanCakeReviewsSection'
import {
  CAKE_SIZE_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_PACK_SIZE,
  MAX_RESERVATION_QUANTITY,
  POUND_ADDON_OPTIONS,
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_SHEET_OPTIONS,
  formatCakeSizeLabel,
  getFreshLemonCupcakePackSize,
  getProductById,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  isVanillaFreshCreamCakeProduct,
  usesReservationChocolateType,
} from './lib/constants'
import {
  createCakeDetailSelection,
  getCakeDetailBySlug,
  getCakeDetailSelectionTotal,
  selectCakeDetailProduct,
  type CakeDetailImageKey,
  type CakeDetailSelection,
} from './lib/cake-detail'
import { getProductText, type Language } from './lib/i18n'
import { formatCurrency } from './lib/utils'
import type { ProductId } from './lib/types'

const detailImages: Record<CakeDetailImageKey, string> = {
  'pound-side': '/products/chocolate-pound-cake-sydney.webp',
  'pound-quick-view': '/products/details/chocolate-pound-cake-quick-view.webp',
  'pound-previous': '/products/details/chocolate-pound-cake-previous.webp',
  'pound-hero': poundHeroImg,
  'cupcake-side': '/products/chocolate-cupcakes-sydney.webp',
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
}

const detailImageDimensions: Record<CakeDetailImageKey, { width: number; height: number }> = {
  'pound-side': { width: 1080, height: 1012 },
  'pound-quick-view': { width: 1080, height: 1012 },
  'pound-previous': { width: 1080, height: 1012 },
  'pound-hero': { width: 1080, height: 1012 },
  'cupcake-side': { width: 1080, height: 1012 },
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

  if (!detail || !selection) {
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
  const total = getCakeDetailSelectionTotal(selection)
  const galleryCount = detail.gallery.length
  const currentImageKey = detail.gallery[Math.min(activeImage, Math.max(0, galleryCount - 1))]
  const addLabel = language === 'ko' ? '주문에 담기' : 'Add to order'

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

  const sizeOptions = CAKE_SIZE_OPTIONS.filter((option) => Object.hasOwn(product.sizePrices, option.value))
  const packSize = getFreshLemonCupcakePackSize(product.id) || 0
  const vanillaCreamCount = selection.vanillaCreamCount
  const partyDecorationCount = selection.partyDecorationCount
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - vanillaCreamCount - partyDecorationCount

  return (
    <main className="cake-detail-page">
      <nav className="cake-detail-breadcrumb" aria-label={language === 'ko' ? '경로' : 'Breadcrumb'}>
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {language === 'ko' ? '케이크로 돌아가기' : 'Back to cakes'}
        </button>
      </nav>

      <section className="cake-detail-hero" aria-labelledby="cake-detail-title">
        <div className="cake-detail-gallery">
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
          <p className="cake-detail-eyebrow">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
          <h1 id="cake-detail-title">{detail.name}</h1>
          <p className="cake-detail-price" aria-live="polite">{formatCurrency(total)}</p>
          <p className="cake-detail-description">{detail.description}</p>

          <div className="cake-detail-badges" aria-label={language === 'ko' ? '주문 안내' : 'Order notes'}>
            {detail.trustPoints.map((point) => <span key={point}>{point}</span>)}
          </div>

          {detail.productIds.length > 1 && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '종류 선택' : 'Choose a style'}</legend>
              <div className="cake-detail-options is-stacked">
                {detail.productIds.map((productId) => {
                  const optionText = getProductText(productId, language)
                  return (
                    <OptionButton
                      active={selection.productId === productId}
                      onClick={() => chooseProduct(productId)}
                      key={productId}
                    >
                      <strong>{optionText.name}</strong>
                      <span>{formatCurrency(getProductById(productId).price)}</span>
                    </OptionButton>
                  )
                })}
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
                    <strong>{formatCakeSizeLabel(option.value)}</strong>
                    <span>{formatCurrency(product.sizePrices[option.value] || option.price)}</span>
                  </OptionButton>
                ))}
              </div>
            </fieldset>
          )}

          {product.usesPoundAddonOptions && (
            <fieldset className="cake-detail-fieldset">
              <legend>{language === 'ko' ? '마감 선택' : 'Choose a finish'}</legend>
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

          {isVanillaFreshCreamCakeProduct(product.id) && (
            <>
              <fieldset className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</legend>
                <div className="cake-detail-options">
                  {VANILLA_CAKE_SHEET_OPTIONS.map((option) => (
                    <OptionButton
                      active={selection.vanillaCakeSheet === option.value}
                      onClick={() => updateSelection({ vanillaCakeSheet: option.value })}
                      key={option.value}
                    >
                      <strong>{option.label}</strong>
                    </OptionButton>
                  ))}
                </div>
              </fieldset>
              <fieldset className="cake-detail-fieldset">
                <legend>{language === 'ko' ? '맛 선택' : 'Choose a flavour'}</legend>
                <div className="cake-detail-options">
                  {VANILLA_CAKE_FLAVOR_OPTIONS.map((option) => (
                    <OptionButton
                      active={selection.vanillaCakeFlavor === option.value}
                      onClick={() => updateSelection({ vanillaCakeFlavor: option.value })}
                      key={option.value}
                    >
                      <strong>{option.label}</strong>
                    </OptionButton>
                  ))}
                </div>
              </fieldset>
            </>
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

          {isCupcakeDozenProduct(product.id) && (
            <fieldset className="cake-detail-fieldset cake-detail-mix-fieldset">
              <legend>{language === 'ko' ? '컵케이크 마감 구성' : 'Cupcake finishing mix'}</legend>
              <p>{language === 'ko'
                ? `기본 ${basicCupcakeCount}개 · 바닐라 크림 ${vanillaCreamCount}개 · 파티 데코 ${partyDecorationCount}개`
                : `Basic ${basicCupcakeCount} · Vanilla cream ${vanillaCreamCount} · Party decoration ${partyDecorationCount}`}</p>
              <div className="cake-detail-number-fields">
                <label>
                  <span>{language === 'ko' ? '바닐라 크림' : 'Vanilla cream'}</span>
                  <input
                    type="number"
                    min="0"
                    max={CUPCAKE_PACK_SIZE}
                    value={vanillaCreamCount}
                    onChange={(event) => updateSelection({ vanillaCreamCount: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>{language === 'ko' ? '파티 데코' : 'Party decoration'}</span>
                  <input
                    type="number"
                    min="0"
                    max={CUPCAKE_PACK_SIZE - vanillaCreamCount}
                    value={partyDecorationCount}
                    onChange={(event) => updateSelection({ partyDecorationCount: Number(event.target.value) })}
                  />
                </label>
              </div>
            </fieldset>
          )}

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
              <strong>{productText.name}</strong>
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
          <p className="cake-detail-confirmation-note">
            {language === 'ko'
              ? '지금 결제되지 않습니다. Jenny가 가능 여부를 확인한 뒤 결제 정보를 안내합니다.'
              : 'No payment is taken now. Jenny will confirm availability and send payment details.'}
          </p>
        </aside>
      </section>

      <section className="cake-detail-trust" aria-label={language === 'ko' ? '베리굿 제작 방식' : 'Verygood service notes'}>
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
          {['pave-chocolate-cake', 'chocolatiers-basque-cheesecake', 'lemon-cake']
            .filter((candidate) => candidate !== slug)
            .slice(0, 2)
            .map((candidate) => {
              const candidateDetail = getCakeDetailBySlug(candidate, language)
              return candidateDetail ? (
                <button type="button" onClick={() => onOpenCake(candidate)} key={candidate}>
                  {candidateDetail.name}
                </button>
              ) : null
            })}
        </div>
      </section>
    </main>
  )
}
