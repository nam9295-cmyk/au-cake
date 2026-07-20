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

  return `Hi ${firstName}!\n\nThanks so much for ordering with us! We hope you enjoyed every single bite.\nWe'd love to know how everything turned out.\n\nLeave us an honest review and get 5% off your next order — or make it 10% off if you add a photo or two!\n\n${link}\n\nYour unique code will be valid for 30 days once issued!\n\n-very good chocolate team-`
}

export function canCreateReviewInvite(sourceType: ReviewSourceType, status: string): boolean {
  return sourceType === 'cake' ? status === '픽업완료' : status === 'Completed'
}

export function reviewInviteErrorMessage(error: unknown): string {
  if ((error as ReviewInviteErrorLike | null)?.code === 'REVIEW_ALREADY_SUBMITTED') {
    return ADMIN_REVIEW_INVITE_ALREADY_USED_MESSAGE
  }
  return ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE
}
