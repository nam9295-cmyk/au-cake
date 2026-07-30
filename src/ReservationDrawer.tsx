import { useState } from 'react'
import { Clipboard } from 'lucide-react'
import { ReviewInviteButton } from './ReviewInviteButton'
import { buildAdminReservationUpdate } from './lib/admin-reservation-edit'
import {
  CAKE_SIZE_OPTIONS,
  CACAO_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  CUPCAKE_PACK_SIZE,
  MAX_RESERVATION_QUANTITY,
  PAYMENT_STATUSES,
  POUND_ADDON_OPTIONS,
  PRODUCTS,
  RESERVATION_STATUSES,
  getFreshLemonCupcakePackSize,
  getProductById,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  usesReservationChocolateType,
} from './lib/constants'
import { getOptionalReservationPricingAudit } from './lib/review-coupon-client'
import { updateReservation } from './lib/repository'
import type {
  CacaoPercent,
  CakeSize,
  ChocolateType,
  PoundAddon,
  ProductId,
  Reservation,
  StoreSettings,
} from './lib/types'
import { buildSmsMessage, formatCurrency, timeOptionsForDate } from './lib/utils'

export function ReservationDrawer({
  reservation,
  onClose,
  onSave,
  onCopy,
  settings,
}: {
  reservation: Reservation
  onClose: () => void
  onSave: (id: string, updates: Parameters<typeof updateReservation>[1]) => Promise<void>
  onCopy: (reservation: Reservation) => Promise<void>
  settings: StoreSettings
}) {
  const [productId, setProductId] = useState<ProductId>(reservation.productId)
  const [cakeSize, setCakeSize] = useState<CakeSize>(reservation.cakeSize)
  const [chocolateType, setChocolateType] = useState<ChocolateType>(reservation.chocolateType)
  const [poundAddon, setPoundAddon] = useState<PoundAddon>(reservation.poundAddon)
  const [chocolateIcingCount, setChocolateIcingCount] = useState(reservation.chocolateIcingCount || 0)
  const [vanillaCreamCount, setVanillaCreamCount] = useState(reservation.vanillaCreamCount || 0)
  const [partyDecorationCount, setPartyDecorationCount] = useState(reservation.partyDecorationCount || 0)
  const [quantity, setQuantity] = useState(reservation.quantity)
  const [pickupDate, setPickupDate] = useState(reservation.pickupDate)
  const [pickupTime, setPickupTime] = useState(reservation.pickupTime)
  const [cacaoPercent, setCacaoPercent] = useState<CacaoPercent>(reservation.cacaoPercent)
  const [status, setStatus] = useState(reservation.status)
  const [paymentStatus, setPaymentStatus] = useState(reservation.paymentStatus)
  const [memo, setMemo] = useState(reservation.adminMemo)
  const hasOneTimeCoupon = Boolean(reservation.reviewCouponId)
  const reservationPricingAudit = getOptionalReservationPricingAudit(reservation)

  const draftUpdate = buildAdminReservationUpdate(reservation, {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    quantity,
    pickupDate,
    pickupTime,
    cacaoPercent,
    status,
    paymentStatus,
    adminMemo: memo,
  })
  const draftReservation: Reservation = { ...reservation, ...draftUpdate }
  const selectedProduct = getProductById(draftUpdate.productId)
  const timeOptions = timeOptionsForDate(pickupDate, settings)
  const displayedTimeOptions = timeOptions.includes(pickupTime) ? timeOptions : [pickupTime, ...timeOptions].filter(Boolean)

  async function saveAll() {
    await onSave(reservation.id, draftUpdate)
  }

  return (
    <div className="drawer-backdrop">
      <aside className="drawer">
        <div className="drawer-header">
          <h2>{reservation.reservationNumber}</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <dl className="detail-list">
          <div>
            <dt>예약자명</dt>
            <dd>{reservation.customerName}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>{reservation.customerPhone}</dd>
          </div>
          <div>
            <dt>요청사항</dt>
            <dd>{reservation.requestNote || '-'}</dd>
          </div>
          {reservationPricingAudit && reservationPricingAudit.discountCents > 0 && (
            <div>
              <dt>할인 감사 정보</dt>
              <dd>
                소계 {formatCurrency(reservationPricingAudit.subtotalCents / 100)} ·
                {' '}{reservationPricingAudit.discountPercent}% 할인 ·
                {' '}- {formatCurrency(reservationPricingAudit.discountCents / 100)}
                {reservationPricingAudit.appliedPromoCodeLast4
                  ? ` · 코드 끝 4자리 ${reservationPricingAudit.appliedPromoCodeLast4}`
                  : ''}
                {reservation.reviewCouponId
                  ? ` · 일회용 쿠폰 ID ${reservation.reviewCouponId}`
                  : ''}
              </dd>
            </div>
          )}
        </dl>

        <section className="admin-edit-card" aria-label="예약 수정">
          <h3>예약 내용 수정</h3>
          {hasOneTimeCoupon && (
            <p className="notice-line" role="status">
              일회용 쿠폰 예약은 서버 재가격 계산 기능이 준비될 때까지 제품·옵션·수량·카카오·금액을 수정할 수 없습니다.
            </p>
          )}
          <div className="admin-edit-grid">
            <fieldset disabled={hasOneTimeCoupon} className="admin-repricing-fields">
            <label>
              제품
              <select value={productId} onChange={(event) => setProductId(event.target.value as ProductId)}>
                {Object.values(PRODUCTS).filter((product) => product.id !== 'fresh-lemon-cupcakes-4' || product.id === reservation.productId).map((product) => (
                  <option value={product.id} key={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            {selectedProduct.usesSizeOptions && (
              <label>
                사이즈
                <select value={cakeSize} onChange={(event) => setCakeSize(event.target.value as CakeSize)}>
                  {CAKE_SIZE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {selectedProduct.usesPoundAddonOptions && (
              <label>
                옵션
                <select value={poundAddon} onChange={(event) => setPoundAddon(event.target.value as PoundAddon)}>
                  {POUND_ADDON_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {usesReservationChocolateType(draftUpdate.productId, draftUpdate.poundAddon) && (
              <label>
                초콜릿
                <select value={chocolateType} onChange={(event) => setChocolateType(event.target.value as ChocolateType)}>
                  {CHOCOLATE_TYPE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {selectedProduct.usesCacaoOptions && (
              <label>
                카카오
                <select value={cacaoPercent} onChange={(event) => setCacaoPercent(event.target.value as CacaoPercent)}>
                  {CACAO_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            )}
            {isFreshLemonCupcakeProduct(draftUpdate.productId) && (
              <label>
                다크 커버춰 초콜릿 개수
                <input
                  type="number"
                  min="0"
                  max={getFreshLemonCupcakePackSize(draftUpdate.productId) || 0}
                  value={draftUpdate.chocolateIcingCount}
                  onChange={(event) => setChocolateIcingCount(Number(event.target.value || 0))}
                />
              </label>
            )}
            {isCupcakeDozenProduct(draftUpdate.productId) && (
              <>
                <label>
                  바닐라 크림 개수 (+AUD 0.50)
                  <input type="number" min="0" max={CUPCAKE_PACK_SIZE - (draftUpdate.partyDecorationCount || 0)} value={draftUpdate.vanillaCreamCount || 0} onChange={(event) => setVanillaCreamCount(Number(event.target.value || 0))} />
                </label>
                <label>
                  파티용 데코 개수 (+AUD 1.00)
                  <input type="number" min="0" max={CUPCAKE_PACK_SIZE - (draftUpdate.vanillaCreamCount || 0)} value={draftUpdate.partyDecorationCount || 0} onChange={(event) => setPartyDecorationCount(Number(event.target.value || 0))} />
                </label>
              </>
            )}
            {!isFreshLemonCupcakeProduct(draftUpdate.productId) && (
              <label>
                수량
                <input type="number" min="1" max={MAX_RESERVATION_QUANTITY} value={quantity} onChange={(event) => setQuantity(Number(event.target.value || 1))} />
              </label>
            )}
            </fieldset>
            <label>
              픽업 날짜
              <input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
            </label>
            <label>
              픽업 시간
              <select value={pickupTime} onChange={(event) => setPickupTime(event.target.value)}>
                {displayedTimeOptions.map((time) => <option value={time} key={time}>{time}</option>)}
              </select>
            </label>
            <label>
              예약상태
              <select value={status} onChange={(event) => setStatus(event.target.value as Reservation['status'])}>
                {RESERVATION_STATUSES.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              입금상태
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as Reservation['paymentStatus'])}>
                {PAYMENT_STATUSES.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-edit-price-row">
            <span>수정 후 금액</span>
            <strong>{formatCurrency(draftUpdate.totalPrice)}</strong>
          </div>
        </section>

        <label>
          관리자 메모
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>

        <ReviewInviteButton sourceType="cake" sourceReservationId={reservation.id} customerName={reservation.customerName} status={reservation.status} />
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => onCopy(draftReservation)}>
            <Clipboard size={16} /> 확정 문자 복사
          </button>
          <button className="primary-button" type="button" onClick={saveAll}>
            예약 수정 저장
          </button>
        </div>
        <div className="sms-preview">
          <pre>{buildSmsMessage(draftReservation, settings)}</pre>
        </div>
      </aside>
    </div>
  )
}
