import type { AdminReview } from './admin-reviews.js'

export const adminReviewDemoPhotoUrl = new URL('../assets/demo-review-cake.webp', import.meta.url).href

const DEMO_REVIEWS: readonly AdminReview[] = [
  { id: 'demo-cake-published', sourceType: 'cake', rating: 5, body: 'The chocolate cake felt personal, beautifully finished, and made our family celebration extra special.', displayName: 'Amelia', hasPhoto: true, photoPublishConsent: true, publishConsent: true, moderationStatus: 'published', rewardPercent: 10, rewardCodeLast4: 'Q2MK', rewardStatus: 'active', rewardExpiresAt: '2026-09-17T00:00:00.000Z', rewardMessageAvailable: true, createdAt: '2026-07-17T04:30:00.000Z', updatedAt: '2026-07-17T05:00:00.000Z' },
  { id: 'demo-class-published', sourceType: 'class', rating: 5, body: 'A calm, thoughtful class. My child was proud to bring home a cake they had planned and made themselves.', displayName: 'Ruby', hasPhoto: false, photoPublishConsent: false, publishConsent: true, moderationStatus: 'published', rewardPercent: 5, rewardCodeLast4: 'W4VE', rewardStatus: 'redeemed', rewardExpiresAt: '2026-09-10T00:00:00.000Z', rewardMessageAvailable: false, createdAt: '2026-07-12T06:15:00.000Z', updatedAt: '2026-07-12T07:00:00.000Z' },
  { id: 'demo-cake-pending', sourceType: 'cake', rating: 3, body: 'The finish was lovely, but pickup communication could have been clearer.', displayName: 'Alex', hasPhoto: true, photoPublishConsent: false, publishConsent: true, moderationStatus: 'pending', rewardPercent: 10, rewardCodeLast4: null, rewardStatus: 'unavailable', rewardExpiresAt: null, rewardMessageAvailable: false, createdAt: '2026-07-18T01:00:00.000Z', updatedAt: '2026-07-18T01:00:00.000Z' },
]

const DEMO_REWARD_CODES: Readonly<Record<string, string>> = Object.freeze({
  'demo-cake-published': 'FOXKIWI7Q2MK',
})

export function adminReviewDemoFixtures(demoEnabled = true, development = true): AdminReview[] {
  return demoEnabled && development ? DEMO_REVIEWS.map((review) => ({ ...review })) : []
}

export function buildDemoAdminRewardMessage(reviewId: string) {
  const review = DEMO_REVIEWS.find((item) => item.id === reviewId)
  const code = DEMO_REWARD_CODES[reviewId]
  if (!review || !code || review.rewardStatus !== 'active' || !review.rewardMessageAvailable || !review.rewardExpiresAt) {
    throw new Error('ADMIN_REWARD_COPY_FAILED')
  }
  const expiry = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(review.rewardExpiresAt))
  return `DEMO — not saved.\nThank you for sharing your review with Very Good Chocolate.\nYour ${review.rewardPercent}% cake reward code is ${code}.\nIt can be used once on your next cake order until ${expiry}.`
}
