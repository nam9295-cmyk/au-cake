import type { PublicReview } from './public-reviews.js'

const DEMO_REVIEW_PHOTO_URL = new URL('../assets/demo-review-cake.webp', import.meta.url).href

const DEMO_REVIEWS: readonly PublicReview[] = [
  {
    id: 'sample-cake-review',
    sourceType: 'cake',
    rating: 5,
    body: 'The chocolate cake felt personal, beautifully finished, and made our family celebration extra special.',
    displayName: 'Amelia',
    createdAt: '2026-07-17T04:30:00.000Z',
    incentivised: true,
    hasPhoto: true,
    thumbnailUrl: DEMO_REVIEW_PHOTO_URL,
    photoUrl: DEMO_REVIEW_PHOTO_URL,
  },
  {
    id: 'sample-class-review',
    sourceType: 'class',
    rating: 5,
    body: 'A calm, thoughtful class. My child was proud to bring home a cake they had planned and made themselves.',
    displayName: 'Ruby',
    createdAt: '2026-07-12T06:15:00.000Z',
    incentivised: true,
    hasPhoto: false,
    thumbnailUrl: null,
    photoUrl: null,
  },
]

export function publicReviewDemoFixtures(demoEnabled = true, development = true): PublicReview[] {
  return demoEnabled && development ? DEMO_REVIEWS.map((review) => ({ ...review })) : []
}
