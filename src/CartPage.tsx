import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  CUPCAKE_PACK_SIZE,
  MAX_RESERVATION_QUANTITY,
  formatCakeSizeLabel,
  formatVanillaCakeFlavor,
  formatVanillaCakeSheet,
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
  getProductText,
  type Language,
} from './lib/i18n'
import { formatCurrency } from './lib/utils'

type CartPageProps = {
  language: Language
  lines: readonly CartLine[]
  onUpdate: (lineKey: string, quantity: number) => void
  onRemove: (lineKey: string) => void
  onContinue: (line: CartLine) => void
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
    <dl className="detail-list">
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
            <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
            <dd>{language === 'ko'
              ? selection.vanillaCakeSheet === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트'
              : formatVanillaCakeSheet(selection.vanillaCakeSheet)}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
            <dd>{language === 'ko'
              ? selection.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
              : formatVanillaCakeFlavor(selection.vanillaCakeFlavor)}</dd>
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
  onUpdate,
  onRemove,
  onContinue,
  onBrowseCakes,
}: CartPageProps) {
  const canContinue = lines.length === 1
  const subtotal = getCartEstimatedSubtotal(lines)
  const copy = language === 'ko'
    ? {
        title: '장바구니',
        empty: '아직 장바구니에 담긴 케이크가 없어요.',
        browse: '케이크 보기',
        quantity: '수량',
        remove: '삭제',
        lineTotal: '상품 합계',
        subtotal: '예상 소계',
        continue: '이 케이크 요청 계속하기',
        multiNotice: '한 번에 한 가지 케이크 구성만 요청할 수 있어요. 여러 상품을 함께 요청하는 기능은 곧 제공될 예정입니다.',
        confirmation: '지금 결제되지 않습니다. Jenny가 가능 여부를 확인한 뒤 결제 정보를 안내합니다.',
      }
    : {
        title: 'Your cart',
        empty: 'Your cart is empty.',
        browse: 'Browse cakes',
        quantity: 'Quantity',
        remove: 'Remove',
        lineTotal: 'Line total',
        subtotal: 'Estimated subtotal',
        continue: 'Continue with this cake request',
        multiNotice: 'Only one cake configuration can be requested at a time. Multi-item requests are coming soon.',
        confirmation: 'No payment is taken now. Jenny will confirm availability and send payment details.',
      }

  return (
    <main className="narrow-page">
      <section className="complete-panel" aria-labelledby="cart-title">
        <p className="summary-kicker">Verygood Chocolate</p>
        <h1 id="cart-title">{copy.title}</h1>

        {lines.length === 0 ? (
          <>
            <p>{copy.empty}</p>
            <button type="button" className="primary-button" onClick={onBrowseCakes}>{copy.browse}</button>
          </>
        ) : (
          <>
            {lines.map((line) => {
              const productText = getProductText(line.selection.productId, language)
              return (
                <article className="cake-detail-order-summary" key={line.lineKey}>
                  <div>
                    <strong>{productText.name}</strong>
                    <CartLineOptions line={line} language={language} />
                    <span>{copy.quantity}</span>
                    <div className="cake-detail-quantity">
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
                    <button type="button" className="secondary-button" onClick={() => onRemove(line.lineKey)}>
                      <Trash2 size={16} aria-hidden="true" />
                      {copy.remove}
                    </button>
                  </div>
                  <div>
                    <span>{copy.lineTotal}</span>
                    <strong>{formatCurrency(getCakeDetailSelectionTotal(line.selection))}</strong>
                  </div>
                </article>
              )
            })}

            <div className="cake-detail-order-summary">
              <span>{copy.subtotal}</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            {lines.length > 1 && <p role="status">{copy.multiNotice}</p>}
            <button
              type="button"
              className="primary-button"
              disabled={!canContinue}
              onClick={() => canContinue && onContinue(lines[0])}
            >
              {copy.continue}
            </button>
            <p className="cake-detail-confirmation-note">{copy.confirmation}</p>
            <button type="button" className="secondary-button" onClick={onBrowseCakes}>{copy.browse}</button>
          </>
        )}
      </section>
    </main>
  )
}
