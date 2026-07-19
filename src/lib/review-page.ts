import { normalizeReviewCouponCode } from './review-coupon-client.js'

export type ReviewLanguage = 'en' | 'ko'
export type ReviewSourceType = 'cake' | 'class'

export type ReviewInviteContext = {
  sourceType: ReviewSourceType
  label: string
  experienceDate: string
  hasPhoto: boolean
}

export type ReviewSubmissionInput = {
  token: string
  rating: number
  body: string
  displayName: string
  publishConsent: boolean
  photoPublishConsent: boolean
  website: string
}

export type ReviewSubmissionResult = {
  rewardPercent: 5 | 10
  couponCode: string
  couponExpiresAt: string
}

export type ReviewGenerationBinding = Readonly<{
  generation: number
  token: string
}>

export function createReviewGenerationController() {
  let generation = 0
  let active = true

  return {
    activate() {
      active = true
    },
    begin(token: string): ReviewGenerationBinding {
      generation += 1
      return { generation, token }
    },
    invalidate() {
      generation += 1
    },
    commit(binding: ReviewGenerationBinding, update: () => void): boolean {
      if (!active || binding.generation !== generation) return false
      update()
      return true
    },
    isCurrent(binding: ReviewGenerationBinding): boolean {
      return active && binding.generation === generation
    },
    dispose() {
      active = false
      generation += 1
    },
  }
}

export type ReviewOperation = 'submit' | 'photo'
type ReviewOperationFlag = { current: boolean }

export function tryBeginReviewOperation(
  operation: ReviewOperation,
  submitting: ReviewOperationFlag,
  photo: ReviewOperationFlag,
): boolean {
  if (submitting.current || photo.current) return false
  if (operation === 'submit') submitting.current = true
  else photo.current = true
  return true
}

export function finishReviewOperation(
  operation: ReviewOperation,
  submitting: ReviewOperationFlag,
  photo: ReviewOperationFlag,
): void {
  if (operation === 'submit') submitting.current = false
  else photo.current = false
}

export function getReviewDocumentLanguage(language: ReviewLanguage): 'en-AU' | 'ko-KR' {
  return language === 'ko' ? 'ko-KR' : 'en-AU'
}

export async function copyReviewCoupon(
  clipboard: { writeText(value: string): Promise<void> } | undefined,
  couponCode: string,
): Promise<boolean> {
  if (!clipboard?.writeText) return false
  try {
    await clipboard.writeText(couponCode)
    return true
  } catch {
    return false
  }
}

export const REVIEW_COPY = {
  en: {
    languageName: '한국어',
    title: 'Tell us how it went',
    intro: 'Share an honest review of your Very Good experience.',
    rating: 'Rating',
    body: 'Your review',
    bodyHint: 'Required · maximum 2,000 characters',
    displayName: 'Display name (optional)',
    publishConsent: 'You may publish my review on Very Good channels.',
    disclosure: 'Your reward is based only on photo presence, not your rating or whether your review is positive or negative.',
    incentivisedNotice: 'Published reviews will be labelled as incentivised.',
    photoTitle: 'Add a cake photo',
    photoChoose: 'Choose photo',
    photoReplace: 'Replace photo',
    photoRemove: 'Remove photo',
    photoAttached: 'Photo attached',
    photoCompressing: 'Preparing photo…',
    photoUploading: 'Uploading privately…',
    photoRemoving: 'Removing photo…',
    photoPrivate: 'Your photo stays private until approved. Photos showing children’s faces may not be published.',
    photoPublishConsent: 'You may publish my attached photo with this review. I understand photos showing children’s faces may not be published.',
    photoInvalid: 'Choose a JPG, PNG, WebP, HEIC or HEIF image.',
    photoTooLarge: 'That photo is too large to prepare. Please choose a smaller image.',
    photoDimensionsTooLarge: 'That photo has too many pixels for safe mobile processing. Please choose a photo under 20 megapixels.',
    photoError: 'We could not update the private photo. Please try again.',
    rewardFive: 'No photo attached · 5% reward',
    rewardTen: 'Photo attached · 10% reward',
    submit: 'Submit honest review',
    submitting: 'Submitting…',
    loading: 'Checking your private review link…',
    invalidTitle: 'This review link is not available',
    invalidBody: 'The link may be invalid, expired or already used. For privacy, we cannot show more detail.',
    retry: 'Try again',
    genericError: 'We could not complete that request. Please try again.',
    submissionUncertain: 'Your review may have been received, but we could not confirm it. Please retry with this page open.',
    successTitle: 'Thank you for your honest review',
    reward: 'Your next cake reward',
    expires: 'Coupon expires',
    copy: 'Copy code',
    copied: 'Copied',
    copyError: 'We could not copy the code. Please select and copy it manually.',
    order: 'Order another cake',
    home: 'Home',
  },
  ko: {
    languageName: 'English',
    title: '어떠셨는지 들려주세요',
    intro: 'Very Good 경험에 대한 솔직한 후기를 들려주세요.',
    rating: '별점',
    body: '후기 내용',
    bodyHint: '필수 · 최대 2,000자',
    displayName: '표시 이름 (선택)',
    publishConsent: 'Very Good 채널에 제 후기를 공개해도 됩니다.',
    disclosure: '혜택은 오직 사진 유무에 따라 정해지며, 별점이나 긍정적·부정적 후기 여부와는 관계없습니다.',
    incentivisedNotice: '공개되는 후기에는 혜택 제공 후기임을 표시합니다.',
    photoTitle: '케이크 사진 추가',
    photoChoose: '사진 선택',
    photoReplace: '사진 바꾸기',
    photoRemove: '사진 삭제',
    photoAttached: '사진 첨부됨',
    photoCompressing: '사진 준비 중…',
    photoUploading: '비공개로 업로드 중…',
    photoRemoving: '사진 삭제 중…',
    photoPrivate: '사진은 승인 전까지 비공개로 보관됩니다. 어린이 얼굴이 나온 사진은 공개되지 않을 수 있습니다.',
    photoPublishConsent: '첨부한 사진을 이 후기와 함께 공개해도 됩니다. 어린이 얼굴이 나온 사진은 공개되지 않을 수 있음을 이해합니다.',
    photoInvalid: 'JPG, PNG, WebP, HEIC 또는 HEIF 사진을 선택해 주세요.',
    photoTooLarge: '사진을 준비하기에 너무 큽니다. 더 작은 사진을 선택해 주세요.',
    photoDimensionsTooLarge: '모바일에서 안전하게 처리하기에는 사진 해상도가 너무 큽니다. 2천만 화소 이하 사진을 선택해 주세요.',
    photoError: '비공개 사진을 변경하지 못했습니다. 다시 시도해 주세요.',
    rewardFive: '사진 미첨부 · 5% 혜택',
    rewardTen: '사진 첨부 · 10% 혜택',
    submit: '솔직한 후기 제출',
    submitting: '제출 중…',
    loading: '비공개 후기 링크를 확인하고 있습니다…',
    invalidTitle: '이 후기 링크를 사용할 수 없습니다',
    invalidBody: '유효하지 않거나 만료되었거나 이미 사용된 링크일 수 있습니다. 개인정보 보호를 위해 자세한 사유는 표시하지 않습니다.',
    retry: '다시 시도',
    genericError: '요청을 완료하지 못했습니다. 다시 시도해 주세요.',
    submissionUncertain: '후기가 접수되었을 수 있지만 확인하지 못했습니다. 이 페이지를 연 상태에서 다시 시도해 주세요.',
    successTitle: '솔직한 후기를 남겨주셔서 감사합니다',
    reward: '다음 케이크 혜택',
    expires: '쿠폰 만료일',
    copy: '코드 복사',
    copied: '복사됨',
    copyError: '코드를 복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요.',
    order: '케이크 다시 주문하기',
    home: '홈',
  },
} as const

export function getReviewSourceLabel(sourceType: ReviewSourceType, language: ReviewLanguage): string {
  if (language === 'ko') {
    return sourceType === 'cake' ? '확인된 케이크 주문' : '확인된 클래스 예약'
  }
  return sourceType === 'cake' ? 'Verified cake order' : 'Verified class booking'
}

export function getStarAriaLabel(value: number, language: ReviewLanguage): string {
  if (language === 'ko') return `별점 ${value}점`
  return `${value} ${value === 1 ? 'star' : 'stars'}`
}

export function shouldLoadStoreSettings(page: string): boolean {
  return page !== 'review'
}

export function extractReviewToken(fragment: string): string | null {
  const candidate = fragment.startsWith('#') ? fragment.slice(1) : fragment
  return /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : null
}

export function buildLoadReviewInvitePayload(token: string) {
  return { action: 'load-invite' as const, data: { token } }
}

export function buildSubmitReviewPayload(input: ReviewSubmissionInput) {
  return {
    action: 'submit-review' as const,
    data: {
      token: input.token,
      review: {
        rating: input.rating,
        body: input.body,
        displayName: input.displayName,
        publishConsent: input.publishConsent,
        photoPublishConsent: input.photoPublishConsent,
        website: input.website,
      },
    },
  }
}

export function buildUploadReviewPhotoPayload(token: string, base64: string, byteLength: number) {
  return { action: 'upload-photo' as const, token, mimeType: 'image/webp' as const, base64, byteLength }
}

export function buildRemoveReviewPhotoPayload(token: string) {
  return { action: 'remove-photo' as const, token }
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('INVALID_REVIEW_RESPONSE')
  return value
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseGregorianDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return date
}

function requiredGregorianDateOnly(value: unknown): string {
  if (typeof value !== 'string' || !parseGregorianDateOnly(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  return value
}

const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/


function parseValidIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = ISO_TIMESTAMP_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[9] === undefined ? 0 : Number(match[9])
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (
    month < 1 || month > 12
    || day < 1 || day > daysInMonth[month - 1]
    || hour > 23 || minute > 59 || second > 59
    || offsetHour > 23 || offsetMinute > 59
  ) return null

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

function requiredCouponCode(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_REVIEW_RESPONSE')
  const normalized = normalizeReviewCouponCode(value)
  if (!normalized || normalized !== value) throw new Error('INVALID_REVIEW_RESPONSE')
  return normalized
}

function requiredIsoTimestamp(value: unknown): string {
  if (!parseValidIsoTimestamp(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  return value as string
}

export function formatCouponExpiry(value: unknown, language: ReviewLanguage): string {
  const date = parseValidIsoTimestamp(value)
  if (!date) return language === 'ko' ? '만료일 확인 불가' : 'Expiry unavailable'
  try {
    return new Intl.DateTimeFormat(getReviewDocumentLanguage(language), {
      dateStyle: 'long',
      timeZone: 'Australia/Sydney',
    }).format(date)
  } catch {
    return language === 'ko' ? '만료일 확인 불가' : 'Expiry unavailable'
  }
}

export function formatExperienceDate(value: unknown, language: ReviewLanguage): string {
  const date = parseGregorianDateOnly(value)
  if (!date) return language === 'ko' ? '날짜 확인 불가' : 'Date unavailable'
  try {
    return new Intl.DateTimeFormat(getReviewDocumentLanguage(language), {
      dateStyle: 'long',
      timeZone: 'Australia/Sydney',
    }).format(date)
  } catch {
    return language === 'ko' ? '날짜 확인 불가' : 'Date unavailable'
  }
}

export function parseLoadReviewInviteResult(value: unknown): ReviewInviteContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  const result = value as Record<string, unknown>
  if (result.sourceType !== 'cake' && result.sourceType !== 'class') throw new Error('INVALID_REVIEW_RESPONSE')
  if (typeof result.hasPhoto !== 'boolean') throw new Error('INVALID_REVIEW_RESPONSE')
  return {
    sourceType: result.sourceType,
    label: requiredString(result.label),
    experienceDate: requiredGregorianDateOnly(result.experienceDate),
    hasPhoto: result.hasPhoto,
  }
}

export function parseSubmitReviewResult(value: unknown): ReviewSubmissionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  const result = value as Record<string, unknown>
  if (result.rewardPercent !== 5 && result.rewardPercent !== 10) throw new Error('INVALID_REVIEW_RESPONSE')
  const rewardPercent = result.rewardPercent
  return {
    rewardPercent,
    couponCode: requiredCouponCode(result.couponCode),
    couponExpiresAt: requiredIsoTimestamp(result.couponExpiresAt),
  }
}

export function isReviewDemoMode(value: string | undefined): boolean {
  return value === 'true'
}
