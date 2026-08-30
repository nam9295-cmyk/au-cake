import {
  CUPCAKE_PACK_SIZE,
  formatCacaoLabel,
  formatVanillaCakeFlavor,
  formatVanillaCakeSheet,
  getFreshLemonCupcakePackSize,
  getCupcakePackSize,
  getLemonIcingCount,
  getProductById,
  isCheesecakeProduct,
  isCupcakeProduct,
  isFreshLemonCupcakeProduct,
  isCreamLayerCakeProduct,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  usesReservationChocolateType,
} from '../lib/constants'
import { cakeCopy, formatChocolateTypeText, formatCupcakeFinishText, formatPoundAddonText, formatVanillaCakePointColorText, getProductText, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import { formatCurrency } from '../lib/utils'
import { formatStoredCakeSizeLabel } from '../lib/cake-serving'
import type { CakeOrderLineRequest, CakeOrderLineResult, PublicReservation, Reservation } from '../lib/types'
import { getIndividualPackagingPieceCount } from '../lib/individual-packaging'
import { formatBrownieCreamOption, getBrownieCreamOption, isBrownieCheesecakeProduct } from '../lib/brownie-cream'

type OrderAwareReservation = (Reservation | PublicReservation) & {
  orderLines?: Array<CakeOrderLineRequest | CakeOrderLineResult>
}

export function ProductDetailRows({ reservation, language = 'ko' }: {
  reservation: Pick<Reservation, 'productId' | 'quantity' | 'cakeSize' | 'cacaoPercent' | 'chocolateType' | 'poundAddon' | 'cupcakeFinish' | 'brownieCreamOption' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'vanillaCakeSheet' | 'vanillaCakeFlavor' | 'vanillaCakePointColor' | 'individualPackaging' | 'individualPackagingPieces' | 'individualPackagingFeeCents'>
  language?: Language
}) {
  const product = getProductById(reservation.productId)
  const productText = getProductText(product.id, language)
  const copy = cakeCopy(language)
  const showChocolate = usesReservationChocolateType(product.id, reservation.poundAddon)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    product.id,
    reservation.vanillaCreamCount,
    reservation.partyDecorationCount,
  )
  const basicCupcakeCount = CUPCAKE_PACK_SIZE - cupcakeFinishCounts.vanillaCreamCount - cupcakeFinishCounts.partyDecorationCount
  const isCurrentVanilla = product.id === 'vanilla-fresh-cream-cake'
    && reservation.vanillaCakeSheet === 'chocolate'
    && reservation.vanillaCakeFlavor === 'plain'

  return (
    <>
      <div>
        <dt>{copy.product}</dt>
        <dd>{productText.name}</dd>
      </div>
      {isFreshLemonCupcakeProduct(product.id) ? (
        <>
          <div>
            <dt>{language === 'ko' ? '구성' : 'Pack size'}</dt>
            <dd>{getFreshLemonCupcakePackSize(product.id)} {language === 'ko' ? '개' : 'pieces'}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
            <dd>{language === 'ko'
              ? `생레몬 제스트 아이싱 ${getLemonIcingCount(product.id, reservation.chocolateIcingCount)}개 / 다크 커버춰 초콜릿 ${normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount)}개`
              : `Fresh lemon zest icing ${getLemonIcingCount(product.id, reservation.chocolateIcingCount)} / Dark couverture chocolate ${normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount)}`}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>{copy.quantity}</dt>
          <dd>
            {reservation.quantity}
            {copy.quantityUnit}
          </dd>
        </div>
      )}
      {isCupcakeProduct(product.id) && (reservation.cupcakeFinish !== undefined ? (
        <>
          <div>
            <dt>{language === 'ko' ? '구성' : 'Pack'}</dt>
            <dd>{language === 'ko'
              ? `${getCupcakePackSize(product.id) === 6 ? '하프 더즌' : '더즌'} · ${getCupcakePackSize(product.id)}개`
              : `${getCupcakePackSize(product.id) === 6 ? 'Half Dozen' : 'Dozen'} · ${getCupcakePackSize(product.id)} cupcakes`}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '마감' : 'Finish'}</dt>
            <dd>{formatCupcakeFinishText(reservation.cupcakeFinish, language)}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
          <dd>{language === 'ko'
            ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개`
            : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount} / Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</dd>
        </div>
      ))}
      {isBrownieCheesecakeProduct(product.id) && reservation.brownieCreamOption === 'fresh-cream' && (
        <div>
          <dt>{language === 'ko' ? '생크림' : 'Fresh cream'}</dt>
          <dd>{formatBrownieCreamOption(product.id, reservation.brownieCreamOption, language)} · +{formatCurrency(getBrownieCreamOption(product.id, reservation.brownieCreamOption).extraPrice)}</dd>
        </div>
      )}
      {reservation.individualPackaging && (
        <div>
          <dt>{language === 'ko' ? '개별 포장' : 'Individual packaging'}</dt>
          <dd>{reservation.individualPackagingPieces ?? getIndividualPackagingPieceCount(product.id, reservation.quantity)} {language === 'ko' ? '개' : 'pieces'} · {reservation.individualPackagingFeeCents === 0
            ? 'FREE'
            : Number.isSafeInteger(reservation.individualPackagingFeeCents)
              ? formatCurrency(reservation.individualPackagingFeeCents! / 100)
              : language === 'ko' ? '서버 계산' : 'Calculated by server'}</dd>
        </div>
      )}
      {(product.usesSizeOptions || isCheesecakeProduct(product.id)) && (
        <div>
          <dt>{copy.size}</dt>
          <dd>{formatStoredCakeSizeLabel(product.id, reservation.cakeSize)}</dd>
        </div>
      )}
      {isCreamLayerCakeProduct(product.id) && (
        <>
          {product.id === 'buttercream-cake' || isCurrentVanilla ? (
            <>
              <div>
                <dt>{language === 'ko' ? '시트' : 'Layers'}</dt>
                <dd>{language === 'ko' ? '시그니처 갸또 쇼콜라 시트' : 'Signature Gâteau au Chocolat layers'}</dd>
              </div>
              <div>
                <dt>{language === 'ko' ? '필링' : 'Filling'}</dt>
                <dd>{product.id === 'buttercream-cake'
                  ? language === 'ko' ? '초콜릿 버터크림' : 'Chocolate Buttercream'
                  : language === 'ko' ? '실제 바닐라빈을 넣은 바닐라 생크림' : 'Vanilla fresh cream with real vanilla bean'}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
                <dd>{language === 'ko'
                  ? reservation.vanillaCakeSheet === 'chocolate' ? '초콜릿 케이크 시트' : '바닐라 케이크 시트'
                  : formatVanillaCakeSheet(reservation.vanillaCakeSheet)}</dd>
              </div>
              <div>
                <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
                <dd>{language === 'ko'
                  ? reservation.vanillaCakeFlavor === 'plain'
                    ? '플레인 생크림 (과거 주문)'
                    : reservation.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
                  : reservation.vanillaCakeFlavor === 'plain' ? 'Plain fresh cream (legacy)' : formatVanillaCakeFlavor(reservation.vanillaCakeFlavor)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>{product.id === 'buttercream-cake'
              ? language === 'ko' ? '케이크 컬러' : 'Cake colour'
              : language === 'ko' ? '포인트 컬러' : 'Point colour'}</dt>
            <dd>{formatVanillaCakePointColorText(reservation.vanillaCakePointColor, language)}</dd>
          </div>
        </>
      )}
      {product.usesCacaoOptions && (
        <div>
          <dt>{marketConfig.market === 'KR' ? '카카오 농도' : 'Cacao'}</dt>
          <dd>{formatCacaoLabel(reservation.cacaoPercent)}</dd>
        </div>
      )}
      {showChocolate && (
        <div>
          <dt>{copy.chocolate}</dt>
          <dd>{formatChocolateTypeText(reservation.chocolateType, language)}</dd>
        </div>
      )}
      {product.usesPoundAddonOptions && (
        <div>
          <dt>{copy.finish}</dt>
          <dd>{formatPoundAddonText(reservation.poundAddon, language)}</dd>
        </div>
      )}
    </>
  )
}

export function OrderDetailRows({ reservation, language = 'ko' }: {
  reservation: Reservation | PublicReservation
  language?: Language
}) {
  const orderReservation = reservation as OrderAwareReservation
  const lines = orderReservation.orderLines?.length ? orderReservation.orderLines : [reservation]
  return lines.map((line, index) => {
    const pricedLine = line as Partial<CakeOrderLineResult>
    return (
      <div className="order-detail-line" key={`${line.productId}-${index}`}>
        {lines.length > 1 && (
          <div className="order-detail-line-heading">
            <dt>{language === 'ko' ? `선택 ${index + 1}` : `Selection ${index + 1}`}</dt>
            <dd />
          </div>
        )}
        <ProductDetailRows reservation={{ ...line, cacaoPercent: reservation.cacaoPercent }} language={language} />
        {Number.isSafeInteger(pricedLine.totalPriceCents) && (
          <div>
            <dt>{language === 'ko' ? '품목 합계' : 'Line total'}</dt>
            <dd>{formatCurrency(pricedLine.totalPriceCents! / 100)}</dd>
          </div>
        )}
      </div>
    )
  })
}
