import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as reviewModule from '../src/lib/korean-cake-reviews.js'

const {
  getKoreanCakeReviewsBySlug,
} = reviewModule

type PublicRecord = Readonly<Record<string, unknown>>
type ExpectedReview = Readonly<{
  id: string
  cakeSlugs: readonly string[]
  originalKo: string
  translationEn: string
  reviewDate: string
  orderContextKo: string
  orderContextEn: string
}>

const getReviews = (slug: string) => getKoreanCakeReviewsBySlug(slug) as unknown as readonly ExpectedReview[]

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
  return []
}

test('Pave and Basque pages receive the approved compact review sets in page order', () => {
  const pave = getReviews('pave-chocolate-cake')
  const basque = getReviews('chocolatiers-basque-cheesecake')

  assert.equal(pave.length, 3)
  assert.equal(basque.length, 4)
  assert.deepEqual(pave.map((review) => review.reviewDate), ['2026-08-02', '2026-08-03', '2026-08-01'])
  assert.deepEqual(basque.map((review) => review.reviewDate), ['2026-07-27', '2026-07-25', '2026-07-10', '2026-08-03'])
})

test('complete Korean originals and faithful Australian English translations are preserved', () => {
  const pave = getReviews('pave-chocolate-cake')
  const basque = getReviews('chocolatiers-basque-cheesecake')

  assert.equal(pave.length, 3)
  assert.equal(basque.length, 4)
  assert.equal(pave[0].originalKo, '파베초코케이크가 맛있어요. 대구에 이렇게 디저트 제대로 하는 집이 있다는 게 감사하네요! 가끔 초콜릿 케이크 먹고 싶으면 무조건 여기서 시켜야겠습니다')
  assert.equal(pave[1].originalKo, '맛있게 잘 먹었습니다')
  assert.equal(pave[2].originalKo, "초코가'꾸떡 치즈케도꾸덕 초코하나는달콤 또하나는쌉살하면서꾸덕 다각각맛있네요")
  assert.equal(basque[0].originalKo, '맛있게 잘 먹었습니다')
  assert.equal(basque[1].originalKo, '날이더워서 피스타치오가 녹았지만 꾸덕하니 그래도 맛났어용 방문해서먹고싶네용')
  assert.equal(basque[2].originalKo, '와~~ 바스크치츠케이크 진짜 맛있네요 말차라떼 진하게먹고싶었는데 요청사항들어주셔서 감사합니다. 여기 사장님 정말 금손 인정♡♡')
  assert.equal(basque[3].originalKo, '너무 달지않고 맛있어요')

  assert.equal(pave[0].translationEn, "The Pave Chocolate Cake is delicious. I'm so glad there's a place in Daegu that does desserts this well! Whenever I'm craving chocolate cake, I'll definitely order from here.")
  assert.equal(pave[1].translationEn, 'Really enjoyed it. It was delicious.')
  assert.equal(pave[2].translationEn, 'The chocolate cakes were dense and fudgy, and so was the cheesecake. One chocolate cake was sweet; the other was bittersweet and fudgy. Each one was delicious in its own way.')
  assert.equal(basque[0].translationEn, 'It was delicious. I really enjoyed it.')
  assert.equal(basque[1].translationEn, "The pistachio had melted in the hot weather, but it was still rich, dense and delicious. I'd love to visit and have it in-store.")
  assert.equal(basque[2].translationEn, 'Wow, the Basque cheesecake is really delicious. I wanted a strong matcha latte, and they accommodated my request. Thank you. The owner is seriously talented. ♡♡')
  assert.equal(basque[3].translationEn, 'Delicious and not overly sweet.')
})

test('mixed-order reviews are canonical records with bilingual order disclosure and curated page placement', () => {
  const canonicalValue = (reviewModule as Record<string, unknown>).KOREAN_CAKE_REVIEWS
  assert.ok(Array.isArray(canonicalValue))
  const canonical = canonicalValue as readonly ExpectedReview[]
  assert.equal(canonical.length, 7)

  const pave = getReviews('pave-chocolate-cake')
  const basque = getReviews('chocolatiers-basque-cheesecake')
  const twoCake = canonical.find((review) => review.originalKo === '너무 달지않고 맛있어요')
  const threeCake = canonical.find((review) => review.originalKo.startsWith("초코가'꾸떡"))

  assert.ok(twoCake)
  assert.ok(threeCake)
  assert.deepEqual(twoCake.cakeSlugs, ['pave-chocolate-cake', 'chocolatiers-basque-cheesecake'])
  assert.equal(twoCake.orderContextKo, '파베·바스크 함께 주문')
  assert.equal(twoCake.orderContextEn, 'Order included Pave + Basque')
  assert.equal(threeCake.orderContextKo, '파베·바스크·갸또 함께 주문')
  assert.equal(threeCake.orderContextEn, 'Order included Pave + Basque + Gâteau')
  assert.strictEqual(basque[3], twoCake)
  assert.strictEqual(pave[2], threeCake)
  assert.ok(!pave.includes(twoCake))
  assert.ok(!basque.includes(threeCake))
})

test('direct and mixed comments disclose their full source-order context', () => {
  const pave = getReviews('pave-chocolate-cake')
  const basque = getReviews('chocolatiers-basque-cheesecake')

  assert.equal(pave[0].orderContextKo, '파베·갸또 함께 주문')
  assert.equal(pave[0].orderContextEn, 'Order included Pave + Gâteau')
  assert.equal(pave[1].orderContextKo, '파베·갸또 함께 주문')
  assert.equal(pave[1].orderContextEn, 'Order included Pave + Gâteau')
  assert.equal(pave[2].orderContextKo, '파베·바스크·갸또 함께 주문')
  assert.equal(pave[2].orderContextEn, 'Order included Pave + Basque + Gâteau')
  assert.equal(basque[0].orderContextKo, '바스크 주문')
  assert.equal(basque[0].orderContextEn, 'Basque order')
  assert.equal(basque[1].orderContextKo, '바스크 주문')
  assert.equal(basque[1].orderContextEn, 'Basque order')
  assert.equal(basque[2].orderContextKo, '바스크 주문')
  assert.equal(basque[2].orderContextEn, 'Basque order')
  assert.equal(basque[3].orderContextKo, '파베·바스크 함께 주문')
  assert.equal(basque[3].orderContextEn, 'Order included Pave + Basque')
  assert.ok(pave.every((review) => review.cakeSlugs.includes('pave-chocolate-cake')))
  assert.ok(basque.every((review) => review.cakeSlugs.includes('chocolatiers-basque-cheesecake')))
})

test('unmatched, inherited, and unsupported products fail closed with no Korean review', () => {
  assert.deepEqual(getKoreanCakeReviewsBySlug('chocolate-pound-cake-and-cupcakes'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('lemon-cake'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('vanilla-fresh-cream-cake'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('not-a-cake'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('constructor'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('toString'), [])
  assert.deepEqual(getKoreanCakeReviewsBySlug('__proto__'), [])
})

test('public review records use safe synthetic IDs and exclude private or promotional fields', () => {
  const canonical = (reviewModule as Record<string, unknown>).KOREAN_CAKE_REVIEWS
  assert.ok(Array.isArray(canonical))
  const reviews = canonical as readonly PublicRecord[]

  assert.equal(new Set(reviews.map((review) => review.id)).size, reviews.length)
  for (const review of reviews) {
    assert.match(String(review.id), /^daegu-review-[a-z-]+$/)
    assert.match(String(review.reviewDate), /^2026-\d{2}-\d{2}$/)
    assert.equal(review.attribution, 'Korean customer')
    assert.equal(review.source, 'Daegu store, Korea')
    assert.equal(review.photo, null)
    assert.doesNotMatch(Object.keys(review).join(' '), /username|platform|orderId|reviewId|record|image|stars|rating|score|verified|title/i)
    const shippedText = collectStrings(review).join(' ')
    assert.doesNotMatch(shippedText, /리뷰번호|주문번호|cake-review-assets|baemin|coupang|배달의민족|platform|verified|—|–/i)
  }
})

test('clampReviewStart clamps empty, desktop three-card, and mobile one-card ranges', () => {
  const clampReviewStart = (reviewModule as Record<string, unknown>).clampReviewStart
  assert.equal(typeof clampReviewStart, 'function')
  const clamp = clampReviewStart as (requested: number, total: number, visibleCount: number) => number

  assert.equal(clamp(4, 0, 3), 0)
  assert.equal(clamp(-1, 4, 3), 0)
  assert.equal(clamp(0, 4, 3), 0)
  assert.equal(clamp(1, 4, 3), 1)
  assert.equal(clamp(2, 4, 3), 1)
  assert.equal(clamp(3, 4, 1), 3)
  assert.equal(clamp(9, 4, 1), 3)
})

test('getReviewRangeLabel reports empty, desktop, and mobile carousel positions', () => {
  const getReviewRangeLabel = (reviewModule as Record<string, unknown>).getReviewRangeLabel
  assert.equal(typeof getReviewRangeLabel, 'function')
  const getLabel = getReviewRangeLabel as (start: number, total: number, visibleCount: number) => string

  assert.equal(getLabel(0, 0, 3), '0 / 0')
  assert.equal(getLabel(0, 4, 3), '1-3 / 4')
  assert.equal(getLabel(1, 4, 3), '2-4 / 4')
  assert.equal(getLabel(0, 4, 1), '1 / 4')
  assert.equal(getLabel(3, 4, 1), '4 / 4')
  assert.equal(getLabel(9, 4, 1), '4 / 4')
})
