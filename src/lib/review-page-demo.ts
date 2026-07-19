import type { ReviewInviteContext, ReviewSubmissionResult } from './review-page.js'

export function reviewDemoFixture(): ReviewInviteContext {
  return { sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01', hasPhoto: false }
}

export function reviewDemoSubmission(hasPhoto = false): ReviewSubmissionResult {
  const rewardPercent = hasPhoto ? 10 : 5
  return {
    rewardPercent,
    couponCode: 'FOXKIWI7Q2MK',
    couponExpiresAt: '2026-09-01T00:00:00.000Z',
  }
}
