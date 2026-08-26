import type { ReviewSourceType } from './types.js'

export const CANONICAL_REVIEW_ORIGIN = 'https://au.verygood-chocolate.com'
export const ADMIN_REVIEW_INVITE_ALREADY_USED_MESSAGE = '이미 리뷰를 작성했거나 링크를 사용할 수 없습니다.'
export const ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE = '리뷰 요청 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'

type ReviewInviteErrorLike = { code?: unknown }

export function firstNameFromFullName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there'
}

export function buildReviewLink(token: string, origin = CANONICAL_REVIEW_ORIGIN): string {
  return `${origin.replace(/\/+$/, '')}/review#${encodeURIComponent(token)}`
}

export function buildReviewRequestMessage(
  _sourceType: ReviewSourceType,
  fullName: string,
  token: string,
): string {
  const firstName = firstNameFromFullName(fullName)
  const link = buildReviewLink(token)

  return `[한국어]\n\n안녕하세요, ${firstName}님.\n\n베리굿을 이용해주셔서 감사합니다.\n좋았던 점이나 아쉬웠던 점 모두 솔직하게 들려주세요. 남겨주신 후기는 베리굿을 더 좋은 경험으로 만드는 데 큰 도움이 됩니다.\n\n텍스트 후기\n→ 다음 케이크 주문 5% 할인 쿠폰\n\n사진과 함께 남긴 후기\n→ 다음 케이크 주문 10% 할인 쿠폰\n\n후기 남기기\n${link}\n\n개인 후기 링크는 발급일로부터 30일 동안 유효합니다.\n후기 작성 후 발급되는 리워드 쿠폰도 발급일로부터 30일 동안 사용할 수 있습니다.\n쿠폰은 다음 케이크 주문에 1회 사용할 수 있습니다.\n\n감사합니다.\nVerygood Chocolate Sydney\n\n---\n\n[English]\n\nHi ${firstName},\n\nThank you for choosing Verygood Chocolate.\nWe’d love to hear your honest feedback — what you loved and anything we could improve.\n\nText review\n→ 5% off your next cake order\n\nReview with a photo\n→ 10% off your next cake order\n\nLeave a review\n${link}\n\nYour personal review link is valid for 30 days.\nAfter you submit your review, your reward coupon will be valid for 30 days from the date it is issued.\nThe coupon can be used once on your next cake order.\n\nThank you,\nVerygood Chocolate Sydney`
}

export function canCreateReviewInvite(sourceType: ReviewSourceType, status: string): boolean {
  return sourceType === 'cake' ? status === '픽업완료' : status === 'Completed'
}

export function reviewInviteErrorMessage(error: unknown): string {
  const code = (error as ReviewInviteErrorLike | null)?.code
  if (code === 'REVIEW_ALREADY_SUBMITTED') {
    return ADMIN_REVIEW_INVITE_ALREADY_USED_MESSAGE
  }
  if (code === 'REVIEW_INVITE_EMAIL_MISSING') return 'Email address is missing.'
  if (code === 'REVIEW_INVITE_EMAIL_INVALID') return 'Email address is invalid.'
  if (code === 'REVIEW_INVITE_EXPIRED') return 'Review link expired.'
  if (code === 'REVIEW_INVITE_UNRECOVERABLE') return 'Existing review link cannot be recovered.'
  return ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE
}
