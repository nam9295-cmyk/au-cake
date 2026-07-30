import {
  CUPCAKE_PACK_SIZE,
  formatCacaoLabel,
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
} from '../lib/constants'
import { cakeCopy, formatChocolateTypeText, formatPoundAddonText, getProductText, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import type { Reservation } from '../lib/types'

export function ProductDetailRows({ reservation, language = 'ko' }: {
  reservation: Pick<Reservation, 'productId' | 'quantity' | 'cakeSize' | 'cacaoPercent' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'vanillaCakeSheet' | 'vanillaCakeFlavor'>
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
      {isCupcakeDozenProduct(product.id) && (
        <div>
          <dt>{language === 'ko' ? '마감 구성' : 'Finishing mix'}</dt>
          <dd>{language === 'ko'
            ? `기본 ${basicCupcakeCount}개 / 바닐라 크림 ${cupcakeFinishCounts.vanillaCreamCount}개 / 파티용 데코 ${cupcakeFinishCounts.partyDecorationCount}개`
            : `Basic ${basicCupcakeCount} / Vanilla cream ${cupcakeFinishCounts.vanillaCreamCount} / Party decoration ${cupcakeFinishCounts.partyDecorationCount}`}</dd>
        </div>
      )}
      {(product.usesSizeOptions || isCheesecakeProduct(product.id)) && (
        <div>
          <dt>{copy.size}</dt>
          <dd>{formatCakeSizeLabel(reservation.cakeSize)}</dd>
        </div>
      )}
      {isVanillaFreshCreamCakeProduct(product.id) && (
        <>
          <div>
            <dt>{language === 'ko' ? '케이크 시트' : 'Cake sheet'}</dt>
            <dd>{language === 'ko'
              ? reservation.vanillaCakeSheet === 'chocolate' ? '초코 케이크 시트' : '바닐라 케이크 시트'
              : formatVanillaCakeSheet(reservation.vanillaCakeSheet)}</dd>
          </div>
          <div>
            <dt>{language === 'ko' ? '맛' : 'Flavour'}</dt>
            <dd>{language === 'ko'
              ? reservation.vanillaCakeFlavor === 'nutella-chocolate-chip' ? '누텔라 초코칩' : '트리플베리'
              : formatVanillaCakeFlavor(reservation.vanillaCakeFlavor)}</dd>
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
