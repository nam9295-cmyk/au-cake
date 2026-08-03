export type SupportedSlug = 'pave-chocolate-cake' | 'chocolatiers-basque-cheesecake'

export type KoreanCakeReview = Readonly<{
  id: string
  cakeSlugs: readonly SupportedSlug[]
  originalKo: string
  translationEn: string
  reviewDate: string
  orderContextKo: string
  orderContextEn: string
  source: 'Daegu store, Korea'
  attribution: 'Korean customer'
  photo: null
}>

export const KOREAN_CAKE_REVIEWS: readonly KoreanCakeReview[] = [
  {
    id: 'daegu-review-pave-chocolate',
    cakeSlugs: ['pave-chocolate-cake'],
    originalKo: '파베초코케이크가 맛있어요. 대구에 이렇게 디저트 제대로 하는 집이 있다는 게 감사하네요! 가끔 초콜릿 케이크 먹고 싶으면 무조건 여기서 시켜야겠습니다',
    translationEn: "The Pave Chocolate Cake is delicious. I'm so glad there's a place in Daegu that does desserts this well! Whenever I'm craving chocolate cake, I'll definitely order from here.",
    reviewDate: '2026-08-02',
    orderContextKo: '파베·갸또 함께 주문',
    orderContextEn: 'Order included Pave + Gâteau',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-pave-gateau',
    cakeSlugs: ['pave-chocolate-cake'],
    originalKo: '맛있게 잘 먹었습니다',
    translationEn: 'Really enjoyed it. It was delicious.',
    reviewDate: '2026-08-03',
    orderContextKo: '파베·갸또 함께 주문',
    orderContextEn: 'Order included Pave + Gâteau',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-basque-enjoyed',
    cakeSlugs: ['chocolatiers-basque-cheesecake'],
    originalKo: '맛있게 잘 먹었습니다',
    translationEn: 'It was delicious. I really enjoyed it.',
    reviewDate: '2026-07-27',
    orderContextKo: '바스크 주문',
    orderContextEn: 'Basque order',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-basque-pistachio',
    cakeSlugs: ['chocolatiers-basque-cheesecake'],
    originalKo: '날이더워서 피스타치오가 녹았지만 꾸덕하니 그래도 맛났어용 방문해서먹고싶네용',
    translationEn: "The pistachio had melted in the hot weather, but it was still rich, dense and delicious. I'd love to visit and have it in-store.",
    reviewDate: '2026-07-25',
    orderContextKo: '바스크 주문',
    orderContextEn: 'Basque order',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-basque-matcha',
    cakeSlugs: ['chocolatiers-basque-cheesecake'],
    originalKo: '와~~ 바스크치츠케이크 진짜 맛있네요 말차라떼 진하게먹고싶었는데 요청사항들어주셔서 감사합니다. 여기 사장님 정말 금손 인정♡♡',
    translationEn: 'Wow, the Basque cheesecake is really delicious. I wanted a strong matcha latte, and they accommodated my request. Thank you. The owner is seriously talented. ♡♡',
    reviewDate: '2026-07-10',
    orderContextKo: '바스크 주문',
    orderContextEn: 'Basque order',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-pave-basque',
    cakeSlugs: ['pave-chocolate-cake', 'chocolatiers-basque-cheesecake'],
    originalKo: '너무 달지않고 맛있어요',
    translationEn: 'Delicious and not overly sweet.',
    reviewDate: '2026-08-03',
    orderContextKo: '파베·바스크 함께 주문',
    orderContextEn: 'Order included Pave + Basque',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
  {
    id: 'daegu-review-pave-basque-gateau',
    cakeSlugs: ['pave-chocolate-cake', 'chocolatiers-basque-cheesecake'],
    originalKo: "초코가'꾸떡 치즈케도꾸덕 초코하나는달콤 또하나는쌉살하면서꾸덕 다각각맛있네요",
    translationEn: 'The chocolate cakes were dense and fudgy, and so was the cheesecake. One chocolate cake was sweet; the other was bittersweet and fudgy. Each one was delicious in its own way.',
    reviewDate: '2026-08-01',
    orderContextKo: '파베·바스크·갸또 함께 주문',
    orderContextEn: 'Order included Pave + Basque + Gâteau',
    source: 'Daegu store, Korea',
    attribution: 'Korean customer',
    photo: null,
  },
]

const REVIEW_ORDER_BY_SLUG: Readonly<Record<SupportedSlug, readonly KoreanCakeReview['id'][]>> = {
  'pave-chocolate-cake': [
    'daegu-review-pave-chocolate',
    'daegu-review-pave-gateau',
    'daegu-review-pave-basque-gateau',
  ],
  'chocolatiers-basque-cheesecake': [
    'daegu-review-basque-enjoyed',
    'daegu-review-basque-pistachio',
    'daegu-review-basque-matcha',
    'daegu-review-pave-basque',
  ],
}

export function getKoreanCakeReviewsBySlug(slug: string): readonly KoreanCakeReview[] {
  if (!Object.hasOwn(REVIEW_ORDER_BY_SLUG, slug)) return []
  const supportedSlug = slug as SupportedSlug
  const reviewById = new Map(KOREAN_CAKE_REVIEWS.map((review) => [review.id, review]))
  return REVIEW_ORDER_BY_SLUG[supportedSlug]
    .map((id) => reviewById.get(id))
    .filter((review): review is KoreanCakeReview => Boolean(review?.cakeSlugs.includes(supportedSlug)))
}

export function clampReviewStart(requested: number, total: number, visibleCount: number): number {
  const safeTotal = Math.max(0, Math.floor(total))
  const safeVisibleCount = Math.max(1, Math.floor(visibleCount))
  const maxStart = Math.max(0, safeTotal - safeVisibleCount)
  const safeRequested = Number.isFinite(requested) ? Math.floor(requested) : maxStart
  return Math.min(Math.max(0, safeRequested), maxStart)
}

export function getReviewRangeLabel(start: number, total: number, visibleCount: number): string {
  const safeTotal = Math.max(0, Math.floor(total))
  if (safeTotal === 0) return '0 / 0'
  const safeVisibleCount = Math.max(1, Math.floor(visibleCount))
  const safeStart = clampReviewStart(start, safeTotal, safeVisibleCount)
  const first = safeStart + 1
  const last = Math.min(safeTotal, safeStart + safeVisibleCount)
  return first === last ? `${first} / ${safeTotal}` : `${first}-${last} / ${safeTotal}`
}
