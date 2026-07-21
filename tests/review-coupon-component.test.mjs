import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const review = await readFile(new URL('../src/ReviewPage.tsx', import.meta.url), 'utf8')
const i18n = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8')
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('cake promo control is unconditional and uses the exact bilingual customer label', () => {
  assert.match(app, /shouldShowPromoInput\('cake', selectedProduct\.id\)/)
  assert.doesNotMatch(app, /isPromoEligibleProduct\(selectedProduct\.id\)\s*&&/)
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
  assert.doesNotMatch(review, /queueReviewCouponForCakeOrder/)
  assert.doesNotMatch(review + app, /couponCode[^\n]*(?:searchParams|localStorage|sessionStorage)/)
  assert.doesNotMatch(review, /href=\{[^}]*couponCode/)
})

test('promo input and reward feedback meet the mobile accessibility contract', () => {
  assert.match(app, /spellCheck=\{false\}/)
  assert.match(app, /autoCapitalize="characters"/)
  assert.match(app, /autoComplete="off"/)
  assert.match(app, /Review reward ready/)
  assert.match(app, /One-time coupon ready/)
  assert.match(app, /isManualCouponPending/)
  assert.doesNotMatch(app + review, /startsWith\(['"]VG10-/)
  assert.match(app, /initialRewardPercent=\{pendingReviewRewardPercent\}/)
  assert.match(app, /getPromoEntryState\(selectedProduct\.id, form\.promoCode, undefined, knownReviewRewardPercent\)/)
})

test('confirmation renders an authoritative semantic review reward summary without raw code', () => {
  assert.match(app, /className="discount-summary"/)
  assert.match(app, /Review reward.*% off.*code ending/)
  assert.match(app, /reservation\?\.promotionKind === 'review-reward'/)
  assert.match(app, /promoEntry\.normalizedCode\.startsWith\('JENNIE'\)\s*\? 'manual-coupon'\s*: 'review-reward'/)
  assert.doesNotMatch(app, /onComplete\(reservation, submittedPromo/)
  assert.doesNotMatch(app, /pricingAudit[^\n]*reviewCouponId/)
})

test('class booking path has no promo or review coupon payload', () => {
  const classStart = app.indexOf('function ClassReservePage')
  const cakeStart = app.indexOf('function ReservePage')
  assert.ok(classStart >= 0 && cakeStart > classStart)
  const classSource = app.slice(classStart, cakeStart)
  assert.doesNotMatch(classSource, /promoCode|reviewCoupon/i)
})

test('canonical npm test includes server and client review coupon suites', () => {
  assert.match(packageJson.scripts['test:reservation-api'], /tests\/reservation-review-coupon\.test\.mjs/)
  assert.match(packageJson.scripts.test, /test:review-coupon-client/)
})

test('pending review coupon never feeds its estimate into the final summary or bank amount', () => {
  assert.match(app, /const promoPriceDisplay = getPromoPriceDisplay\(currentPrice, promoEntry\)/)
  assert.match(app, /BankAccountBox settings=\{settings\} totalPrice=\{promoPriceDisplay\.finalPrice\}/)
  assert.doesNotMatch(app, /BankAccountBox settings=\{settings\} totalPrice=\{discountedPrice\}/)
})

test('one-time coupon admin drawer disables repricing and uses generic coupon wording', () => {
  assert.match(app, /const hasOneTimeCoupon = Boolean\(reservation\.reviewCouponId\)/)
  assert.match(app, /fieldset disabled=\{hasOneTimeCoupon\}/)
  assert.match(app, /일회용 쿠폰 예약은 서버 재가격 계산 기능이 준비될 때까지 제품·옵션·수량·카카오·금액을 수정할 수 없습니다\./)
  assert.doesNotMatch(app, /리워드 쿠폰 ID/)
})
