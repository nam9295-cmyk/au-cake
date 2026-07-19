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
  sourceType: ReviewSourceType,
  fullName: string,
  token: string,
): string {
  const firstName = firstNameFromFullName(fullName)
  const link = buildReviewLink(token)

  if (sourceType === 'cake') {
    return `Hi ${firstName}, thank you again for ordering from Verygood Chocolate.\n\nWe’d love to hear how your cake was. An honest review earns 5% off your next order, or 10% if you include a cake photo. We look forward to your honest feedback.\n\nWrite your review: ${link}\nThe link is valid for 30 days.`
  }

  return `Hi ${firstName}, thank you for joining Jenny’s cake class.\n\nWe’d love to hear how the class went. An honest review earns 5% off your next order, or 10% if you include a photo of the finished cake. We look forward to your honest feedback.\n\nWrite your review: ${link}\nThe link is valid for 30 days.`
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
