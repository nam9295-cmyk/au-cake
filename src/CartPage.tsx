import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  CUPCAKE_PACK_SIZE,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  formatVanillaCakeFlavor,

  getFreshLemonCupcakePackSize,
  getLemonIcingCount,
  getProductById,
  isCheesecakeProduct,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  isVanillaFreshCreamCakeProduct,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  usesReservationChocolateType,
} from './lib/constants'
import { getCakeDetailSelectionTotal } from './lib/cake-detail'
import { getCartEstimatedSubtotal, type CartLine } from './lib/cart'
import {
  cakeCopy,
  formatChocolateTypeText,
  formatPoundAddonText,
  formatVanillaCakePointColorText,
  getProductText,
  type Language,
} from './lib/i18n'
import { formatCurrency } from './lib/utils'

type CartPageProps = {
  language: Language
  lines: readonly CartLine[]
  cakeOrderLinesAvailable: boolean | null
  onUpdate: (lineKey: string, quantity: number) => void
  onRemove: (lineKey: string) => void
  onContinue: () => void
  onBrowseCakes: () => void
}

function CartLineOptions({ line, language }: { line: CartLine; language: Language }) {
  const selection = line.selection
  const product = getProductById(selection.productId)
  const copy = cakeCopy(language)
  const cupcakeFinishes = normalizeCupcakeFinishCounts(
    product.id,
    selection.vanillaCreamCount,
    selection.partyDecorationCount,
  )
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - cupcakeFinishes.vanillaCreamCount - cupcakeFinishes.partyDecorationCount
  const chocolateIcingCount = normalizeChocolateIcingCount(product.id, selection.chocolateIcingCount)

  return (
    <dl className="cart-line-options">
      {(product.usesSizeOptions || isCheesecakeProduct(product.id)) && (
        <div>
          <dt>{copy.size}</dt>
          <dd>{formatCakeSizeLabel(selection.cakeSize)}</dd>
        </div>
      )}
      {product.usesPoundAddonOptions && (
        <div>
          <dt>{copy.finish}</dt>
          <dd>{formatPoundAddonText(selection.poundAddon, language)}</dd>
        </div>
      )}
      {usesReservationChocolateType(product.id, selection.poundAddon) && (
        <div>
          <dt>{copy.chocolate}</dt>
          <dd>{formatChocolateTypeText(selection.chocolateType, language)}</dd>
        </div>
      )}
      {isVanillaFreshCreamCakeProduct(product.id) && (
        <>
          <div>
            <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
            <dd>{language === 'ko'
              ? selection.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
              : formatVanillaCakeFlavor(selection.vanillaCakeFlavor)}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '포인트 컬러' : 'Point colour'}</dt>
            <dd>{formatVanillaCakePointColorText(selection.vanillaCakePointColor, language)}</dd>
          </div>
        </>
      )}
      {isFreshLemonCupcakeProduct(product.id) && (
        <>
          <div>
            <dt>{language === 'ko' ? '구성' : 'Pack size'}</dt>
            <dd>{getFreshLemonCupcakePackSize(product.id)} {language === 'ko' ? '개' : 'pieces'}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
            <dd>{language === 'ko'
              ? `생레몬 제스트 아이싱 ${getLemonIcingCount(product.id, chocolateIcingCount)}개 / 다크 커버춰 초콜릿 ${chocolateIcingCount}개`
              : `Fresh lemon zest icing ${getLemonIcingCount(product.id, chocolateIcingCount)} / Dark couverture chocolate ${chocolateIcingCount}`}</dd>
          </div>
        </>
      )}
      {isCupcakeDozenProduct(product.id) && (
        <div>
          <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
          <dd>{language === 'ko'
            ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishes.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishes.partyDecorationCount}개`
            : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishes.vanillaCreamCount} / Party decoration ${cupcakeFinishes.partyDecorationCount}`}</dd>
        </div>
      )}
    </dl>
  )
}

export default function CartPage({
  language,
  lines,
  cakeOrderLinesAvailable,
  onUpdate,
  onRemove,
  onContinue,
  onBrowseCakes,
}: CartPageProps) {
  const canContinue = lines.length === 1 || (lines.length > 1 && cakeOrderLinesAvailable === true)
  const subtotal = getCartEstimatedSubtotal(lines)
  const copy = language === 'ko'
    ? {
        title: '주문 목록',
        empty: '주문에 담긴 케이크가 없어요.',
        browse: '케이크 보기',
        quantity: '수량',
        remove: '삭제',
        lineTotal: '상품 합계',
        subtotal: '예상 소계',
        continue: '주문 신청 계속하기',
        multiNotice: cakeOrderLinesAvailable === null
          ? '여러 케이크 동시 신청 가능 여부를 확인하고 있어요.'
          : cakeOrderLinesAvailable
            ? '여러 케이크를 한 번에 신청할 수 있어요.'
            : '현재 여러 케이크 동시 신청을 사용할 수 없어요. 잠시 후 다시 확인해 주세요.',
        confirmation: '지금 결제되지 않습니다. 주문 신청 후 Jenny가 가능 여부를 확인하고 결제 정보를 안내합니다.',
      }
    : {
        title: 'Your order',
        empty: 'Your order is empty.',
        browse: 'Browse cakes',
        quantity: 'Quantity',
        remove: 'Remove',
        lineTotal: 'Line total',
        subtotal: 'Estimated subtotal',
        continue: 'Continue to reservation',
        multiNotice: cakeOrderLinesAvailable === null
          ? 'Checking whether multiple-cake requests are available.'
          : cakeOrderLinesAvailable
            ? 'You can request all of these cakes together.'
            : 'Multiple-cake requests are currently unavailable. Please check again shortly.',
        confirmation: 'No payment is taken now. Jenny will confirm availability and send payment details after you submit your request.',
      }

  return (
    <main className="cart-page">
      <section className="cart-panel" aria-labelledby="cart-title">
        <p className="summary-kicker">Verygood Chocolate</p>
        <h1 id="cart-title">{copy.title}</h1>

        {lines.length === 0 ? (
          <div className="cart-empty">
            <p>{copy.empty}</p>
            <button type="button" className="primary-button" onClick={onBrowseCakes}>{copy.browse}</button>
          </div>
        ) : (
          <>
            <div className="cart-list">
              {lines.map((line) => {
                const productText = getProductText(line.selection.productId, language)
                return (
                  <article className="cart-line" key={line.lineKey}>
                    <header className="cart-line-heading">
                      <div>
                        <h2>{productText.name}</h2>
                        <span>{copy.lineTotal}</span>
                      </div>
                      <strong>{formatCurrency(getCakeDetailSelectionTotal(line.selection))}</strong>
                    </header>

                    <CartLineOptions line={line} language={language} />

                    <div className="cart-line-actions">
                      <div>
                        <span>{copy.quantity}</span>
                        <div className="cart-quantity">
                          <button
                            type="button"
                            aria-label={language === 'ko' ? '수량 줄이기' : 'Decrease quantity'}
                            disabled={line.selection.quantity <= 1}
                            onClick={() => onUpdate(line.lineKey, line.selection.quantity - 1)}
                          >
                            <Minus aria-hidden="true" />
                          </button>
                          <output aria-live="polite">{line.selection.quantity}</output>
                          <button
                            type="button"
                            aria-label={language === 'ko' ? '수량 늘리기' : 'Increase quantity'}
                            disabled={line.selection.quantity >= MAX_RESERVATION_QUANTITY}
                            onClick={() => onUpdate(line.lineKey, line.selection.quantity + 1)}
                          >
                            <Plus aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => onRemove(line.lineKey)}>
                        <Trash2 size={16} aria-hidden="true" />
                        {copy.remove}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            <section className="cart-summary" aria-label={copy.subtotal}>
              <div className="cart-summary-total">
                <span>{copy.subtotal}</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              {lines.length > 1 && <p className="cart-multi-notice" role="status">{copy.multiNotice}</p>}
              <button
                type="button"
                className="primary-button"
                disabled={!canContinue}
                onClick={() => canContinue && onContinue()}
              >
                {copy.continue}
              </button>
              <p className="cart-checkout-note">{copy.confirmation}</p>
              <button type="button" className="secondary-button" onClick={onBrowseCakes}>{copy.browse}</button>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
