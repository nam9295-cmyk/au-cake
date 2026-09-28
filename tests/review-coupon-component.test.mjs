import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const reservationDrawer = await readFile(new URL('../src/ReservationDrawer.tsx', import.meta.url), 'utf8')
const reserve = await readFile(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const complete = await readFile(new URL('../src/pages/CompletePage.tsx', import.meta.url), 'utf8')
const classReserve = await readFile(new URL('../src/pages/ClassReservePage.tsx', import.meta.url), 'utf8')
const classComplete = await readFile(new URL('../src/pages/ClassCompletePage.tsx', import.meta.url), 'utf8')
const review = await readFile(new URL('../src/ReviewPage.tsx', import.meta.url), 'utf8')
const i18n = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('cake promo control is unconditional and uses the exact bilingual customer label', () => {
  assert.match(reserve, /shouldShowPromoInput\('cake', selectedProduct\.id\)/)
  assert.doesNotMatch(reserve, /isPromoEligibleProduct\(selectedProduct\.id\)\s*&&/)
  assert.match(i18n, /Promo or review reward code \(optional\)/)
  assert.match(i18n, /프로모 또는 후기 리워드 코드 \(선택\)/)
})

test('review success passes the coupon and server-returned reward to App memory without URL or browser storage', () => {
  assert.match(review, /onOrderCake\(success\.couponCode, success\.rewardPercent\)/)
  assert.match(review, /successBindingRef\.current/)
  assert.match(review, /generationController\.isCurrent\(binding\)/)
  assert.match(app, /<ReviewPage onOrderCake=\{orderCakeFromReview\}/)
  assert.match(app, /initialPromoCode=\{pendingReviewCoupon\}/)
  assert.match(app, /onInitialPromoConsumed=\{\(\) => setPendingReviewCoupon\(''\)\}/)
  assert.doesNotMatch(app, /useState\(consumeInitialPromoCode\)/)
  assert.match(review, /href="\/reserve"/)
  assert.match(review, /copy\.rewardValidity/)
  assert.doesNotMatch(review, /queueReviewCouponForCakeOrder/)
  assert.doesNotMatch(review + app, /couponCode[^\n]*(?:searchParams|localStorage|sessionStorage)/)
  assert.doesNotMatch(review, /href=\{[^}]*couponCode/)
})

test('promo input and reward feedback meet the mobile accessibility contract', () => {
  assert.match(reserve, /spellCheck=\{false\}/)
  assert.match(reserve, /autoCapitalize="characters"/)
  assert.match(reserve, /autoComplete="off"/)
  assert.match(reserve, /Review reward ready/)
  assert.match(reserve, /One-time coupon ready/)
  assert.match(reserve, /isManualCouponPending/)
  assert.doesNotMatch(app + reserve + review, /startsWith\(['"]VG10-/)
  assert.match(app, /initialRewardPercent=\{pendingReviewRewardPercent\}/)
  assert.match(reserve, /const promoProductId = orderSelections\?\.find\([^\n]*getValidPromoCode/)
  assert.match(reserve, /getPromoEntryState\(promoProductId, form\.promoCode, undefined, knownReviewRewardPercent\)/)
})

test('confirmation renders an authoritative semantic review reward summary without raw code', () => {
  assert.match(complete, /className="discount-summary"/)
  assert.match(complete, /Review reward.*% off.*code ending/)
  assert.match(complete, /reservation\?\.promotionKind === 'review-reward'/)
  assert.match(reserve, /promoEntry\.normalizedCode\.startsWith\('JENNIE'\)\s*\? 'manual-coupon'\s*: 'review-reward'/)
  assert.doesNotMatch(reserve, /onComplete\(reservation, submittedPromo/)
  assert.doesNotMatch(complete, /pricingAudit[^\n]*reviewCouponId/)
})

test('class booking path has no promo or review coupon payload', () => {
  assert.doesNotMatch(classReserve + classComplete, /promoCode|reviewCoupon/i)
})

test('canonical npm test includes server and client review coupon suites', () => {
  assert.match(packageJson.scripts['test:reservation-api'], /tests\/reservation-review-coupon\.test\.mjs/)
  assert.match(packageJson.scripts.test, /test:review-coupon-client/)
})

test('pending review coupon never feeds its estimate into the final summary or bank amount', () => {
  assert.match(reserve, /const basePromoPriceDisplay = getPromoPriceDisplay\(currentPrice, promoEntry\)/)
  assert.match(reserve, /orderSelections && promoEntry\.kind === 'static-valid'/)
  assert.match(reserve, /BankAccountBox settings=\{settings\} totalPrice=\{promoPriceDisplay\.finalPrice\}/)
  assert.doesNotMatch(reserve, /BankAccountBox settings=\{settings\} totalPrice=\{discountedPrice\}/)
})

test('coupon and versioned-order admin drawer disables repricing with the matching generic wording', () => {
  assert.match(reservationDrawer, /const hasOneTimeCoupon = Boolean\(reservation\.reviewCouponId\)/)
  assert.match(reservationDrawer, /const isVersionedOrder = Array\.isArray\(reservation\.orderLines\)/)
  assert.match(reservationDrawer, /fieldset disabled=\{hasOneTimeCoupon \|\| isVersionedOrder\}/)
  assert.match(reservationDrawer, /서버 산출 주문은 제품·옵션·수량을 수정할 수 없습니다\./)
  assert.match(reservationDrawer, /일회용 쿠폰 예약은 서버 재가격 계산 기능이 준비될 때까지 제품·옵션·수량·카카오·금액을 수정할 수 없습니다\./)
  assert.doesNotMatch(reservationDrawer, /리워드 쿠폰 ID/)
})
