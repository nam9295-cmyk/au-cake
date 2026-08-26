import { decryptReviewCouponCode } from './coupon-envelope.js'
import {
  buildEmailDeliveryEventKey,
  normalizeRecipientEmail,
  payloadHashForEmail,
  recipientHashForEmail,
  resendIdempotencyKeyForEvent,
} from '../shared/email-delivery/email-delivery.js'
import { deliverEmail } from '../shared/email-delivery/email-delivery-sender.js'

const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const TEMPLATE = 'review-reward-customer'
const TEMPLATE_VERSION = 'review-reward-customer-v1'
const SUBJECT = '[Verygood] 리뷰 리워드가 도착했어요 | Your review reward is ready'
const SYDNEY_TIME_ZONE = 'Australia/Sydney'
const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
])

function plainTextCell(value, maxLength = 120) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function recordId(record) {
  const value = record?.$id || record?.$rowId || record?.id
  if (!APPWRITE_ID.test(value || '')) throw new Error('INVALID_REVIEW_REWARD_RECORD')
  return value
}

function sydneyCalendarDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_REVIEW_REWARD_EXPIRY')
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]))
  if (!Number.isInteger(values.year) || !Number.isInteger(values.month) || !Number.isInteger(values.day) ||
      values.month < 1 || values.month > 12) throw new Error('INVALID_REVIEW_REWARD_EXPIRY')
  return {
    korean: `${values.year}년 ${values.month}월 ${values.day}일`,
    english: `${values.day} ${MONTH_NAMES[values.month - 1]} ${values.year}`,
  }
}

function canonicalCakeOrderUrl(value) {
  const raw = String(value || '').trim()
  let url
  try { url = new URL(raw) } catch { throw new Error('INVALID_CAKE_ORDER_URL') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.pathname !== '/') {
    throw new Error('INVALID_CAKE_ORDER_URL')
  }
  return url.toString()
}

function rewardPercent(review, coupon) {
  if (![5, 10].includes(review?.rewardPercent) || coupon?.rewardPercent !== review.rewardPercent) {
    throw new Error('INVALID_REVIEW_REWARD_PERCENT')
  }
  return review.rewardPercent
}

function rewardCouponCode(value) {
  const code = plainTextCell(value, 32)
  if (!/^[A-Z0-9]{8,32}$/.test(code)) throw new Error('INVALID_REVIEW_REWARD_CODE')
  return code
}

function sourceName(reservation, sourceType) {
  return plainTextCell(sourceType === 'cake' ? reservation?.customerName : reservation?.parentName)
}

function templateCopy({ name, percent, code, issued, expiry, cakeOrderUrl }) {
  const koreanGreeting = name || '고객'
  const englishGreeting = name || 'there'
  const korean = [
    '[한국어]',
    '',
    `안녕하세요, ${koreanGreeting}님.`,
    '',
    '소중한 후기를 남겨주셔서 감사합니다.',
    `다음 케이크 주문에 사용할 수 있는 ${percent}% 할인 쿠폰을 준비했어요.`,
    '',
    `리워드: ${percent}% 할인`,
    `쿠폰 코드: ${code}`,
    `발급일: ${issued.korean}`,
    `유효기간: ${expiry.korean}까지`,
    '',
    '이 쿠폰은 발급일로부터 30일 동안 유효하며, 다음 케이크 주문에 1회 사용할 수 있습니다.',
    `케이크 주문하기: ${cakeOrderUrl}`,
    '',
    '소중한 의견 감사합니다.',
    'Verygood Chocolate Sydney',
  ]
  const english = [
    '[English]',
    '',
    `Hi ${englishGreeting},`,
    '',
    'Thank you for sharing your feedback with us.',
    `Here’s your ${percent}% reward coupon for your next cake order.`,
    '',
    `Reward: ${percent}% off`,
    `Coupon code: ${code}`,
    `Issued: ${issued.english}`,
    `Valid until: ${expiry.english}`,
    '',
    'Your coupon is valid for 30 days from the date it was issued and can be used once on your next cake order.',
    `Order a cake: ${cakeOrderUrl}`,
    '',
    'Thank you,',
    'Verygood Chocolate Sydney',
  ]
  return { korean, english, text: [...korean, '', '--------------------', '', ...english].join('\n') }
}

function buildHtml({ name, percent, code, issued, expiry, cakeOrderUrl }) {
  const safeKoreanName = escapeHtml(name || '고객')
  const safeEnglishName = escapeHtml(name || 'there')
  const safePercent = escapeHtml(percent)
  const safeCode = escapeHtml(code)
  const safeKoreanIssued = escapeHtml(issued.korean)
  const safeKoreanExpiry = escapeHtml(expiry.korean)
  const safeEnglishIssued = escapeHtml(issued.english)
  const safeEnglishExpiry = escapeHtml(expiry.english)
  const safeOrderUrl = escapeHtml(cakeOrderUrl)
  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a1710;line-height:1.6;max-width:640px;margin:0 auto;">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">리뷰 리워드가 도착했어요</h1>
      <p style="margin:0 0 14px;">안녕하세요, ${safeKoreanName}님.</p>
      <p style="margin:0 0 14px;">소중한 후기를 남겨주셔서 감사합니다.</p>
      <p style="margin:0 0 18px;">다음 케이크 주문에 사용할 수 있는 ${safePercent}% 할인 쿠폰을 준비했어요.</p>
      <div style="border:1px solid #e8ded5;border-radius:8px;padding:14px;margin:0 0 18px;">
        <p style="margin:0 0 8px;"><strong>리워드</strong><br>${safePercent}% 할인</p>
        <p style="margin:0 0 8px;"><strong>쿠폰 코드</strong><br><span style="font-size:20px;letter-spacing:0.06em;font-weight:700;">${safeCode}</span></p>
        <p style="margin:0 0 8px;"><strong>발급일</strong><br>${safeKoreanIssued}</p>
        <p style="margin:0;"><strong>유효기간</strong><br>${safeKoreanExpiry}까지</p>
      </div>
      <p style="margin:0 0 18px;">이 쿠폰은 발급일로부터 30일 동안 유효하며, 다음 케이크 주문에 1회 사용할 수 있습니다.</p>
      <p style="margin:0 0 18px;"><a href="${safeOrderUrl}" style="display:inline-block;background:#5b2417;color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">케이크 주문하기</a></p>
      <hr style="border:0;border-top:1px solid #e8ded5;margin:28px 0;">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">Your review reward is ready</h1>
      <p style="margin:0 0 14px;">Hi ${safeEnglishName},</p>
      <p style="margin:0 0 14px;">Thank you for sharing your feedback with us.</p>
      <p style="margin:0 0 18px;">Here’s your ${safePercent}% reward coupon for your next cake order.</p>
      <div style="border:1px solid #e8ded5;border-radius:8px;padding:14px;margin:0 0 18px;">
        <p style="margin:0 0 8px;"><strong>Reward</strong><br>${safePercent}% off</p>
        <p style="margin:0 0 8px;"><strong>Coupon code</strong><br><span style="font-size:20px;letter-spacing:0.06em;font-weight:700;">${safeCode}</span></p>
        <p style="margin:0 0 8px;"><strong>Issued</strong><br>${safeEnglishIssued}</p>
        <p style="margin:0;"><strong>Valid until</strong><br>${safeEnglishExpiry}</p>
      </div>
      <p style="margin:0 0 18px;">Your coupon is valid for 30 days from the date it was issued and can be used once on your next cake order.</p>
      <p style="margin:0 0 18px;"><a href="${safeOrderUrl}" style="display:inline-block;background:#5b2417;color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">Order a cake</a></p>
      <p style="margin:22px 0 0;">Thank you,<br>Verygood Chocolate Sydney</p>
    </div>
  `
}

export function reviewRewardRecipientForReservation(reservation, sourceType) {
  if (!reservation || !['cake', 'class'].includes(sourceType)) throw new Error('INVALID_REVIEW_REWARD_SOURCE')
  return normalizeRecipientEmail(sourceType === 'cake' ? reservation.customerEmail : reservation.parentEmail)
}

export function buildReviewRewardEmailPayload({
  review,
  coupon,
  reservation,
  couponCode,
  from,
  replyTo = null,
  cakeOrderUrl,
} = {}) {
  const reviewId = recordId(review)
  const couponId = recordId(coupon)
  if (!['cake', 'class'].includes(review?.sourceType) || !APPWRITE_ID.test(review?.sourceReservationId || '') ||
      review.couponId !== couponId || coupon.sourceReviewId !== reviewId || coupon.status !== 'active') {
    throw new Error('INVALID_REVIEW_REWARD_RECORD')
  }
  const percent = rewardPercent(review, coupon)
  const code = rewardCouponCode(couponCode)
  const recipient = reviewRewardRecipientForReservation(reservation, review.sourceType)
  const normalizedFrom = plainTextCell(from)
  if (!normalizedFrom) throw new Error('INVALID_RESEND_FROM_EMAIL')
  const normalizedReplyTo = replyTo === null || replyTo === undefined || !String(replyTo).trim()
    ? null
    : normalizeRecipientEmail(replyTo)
  const orderUrl = canonicalCakeOrderUrl(cakeOrderUrl)
  const issued = sydneyCalendarDate(coupon.createdAt)
  const expiry = sydneyCalendarDate(coupon.expiresAt)
  const name = sourceName(reservation, review.sourceType)
  const copy = templateCopy({ name, percent, code, issued, expiry, cakeOrderUrl: orderUrl })
  const html = buildHtml({ name, percent, code, issued, expiry, cakeOrderUrl: orderUrl })
  const eventKey = buildEmailDeliveryEventKey({ template: TEMPLATE, sourceType: 'review', sourceId: reviewId })
  return {
    from: normalizedFrom,
    to: [recipient],
    replyTo: normalizedReplyTo,
    subject: SUBJECT,
    text: copy.text,
    html,
    template: TEMPLATE,
    templateVersion: TEMPLATE_VERSION,
    eventKey,
    sourceType: 'review',
    sourceId: reviewId,
    recipientHash: recipientHashForEmail(recipient),
    payloadHash: payloadHashForEmail({
      from: normalizedFrom,
      recipientEmail: recipient,
      replyTo: normalizedReplyTo,
      subject: SUBJECT,
      text: copy.text,
      html,
      template: TEMPLATE,
      templateVersion: TEMPLATE_VERSION,
    }),
    idempotencyKey: resendIdempotencyKeyForEvent(eventKey),
  }
}

function safeCommittedIds(committed) {
  const reviewId = plainTextCell(committed?.reviewId, 36)
  const couponId = plainTextCell(committed?.couponId, 36)
  if (!APPWRITE_ID.test(reviewId) || !APPWRITE_ID.test(couponId)) throw new Error('INVALID_REVIEW_REWARD_COMMIT')
  return { reviewId, couponId }
}

function safeLog(error, message) {
  try { error(message) } catch {}
}

function recipientAvailability(reservation, sourceType) {
  const raw = sourceType === 'cake' ? reservation?.customerEmail : reservation?.parentEmail
  try {
    reviewRewardRecipientForReservation(reservation, sourceType)
    return { available: true }
  } catch {
    return { available: false, status: typeof raw === 'string' && raw.trim() ? 'skipped_invalid_recipient' : 'skipped_missing_recipient' }
  }
}

export async function attemptReviewRewardEmail({
  repository,
  deliveryRepository,
  transport,
  committed,
  encryptionKey,
  from,
  replyTo = null,
  cakeOrderUrl,
  now = new Date(),
  log = () => {},
  error = () => {},
} = {}) {
  let ids
  try {
    ids = safeCommittedIds(committed)
  } catch {
    safeLog(error, 'Review reward email unavailable: invalid committed identity')
    return { status: 'skipped_invalid_commit' }
  }
  const eventKey = `review-reward-customer:review:${ids.reviewId}`
  let review
  let coupon
  try {
    [review, coupon] = await Promise.all([
      repository.getReview(ids.reviewId),
      repository.getCoupon(ids.couponId),
    ])
    if (!review || !coupon) throw new Error('MISSING_COMMITTED_REWARD')
    if (recordId(review) !== ids.reviewId || recordId(coupon) !== ids.couponId ||
        review.couponId !== ids.couponId || coupon.sourceReviewId !== ids.reviewId ||
        !['cake', 'class'].includes(review.sourceType) || !APPWRITE_ID.test(review.sourceReservationId || '') ||
        coupon.status !== 'active' || coupon.rewardPercent !== review.rewardPercent ||
        ![5, 10].includes(review.rewardPercent)) {
      throw new Error('INVALID_COMMITTED_REWARD')
    }
  } catch {
    safeLog(error, `Review reward email unavailable: ${eventKey}`)
    return { status: 'skipped_coupon_unavailable' }
  }

  let couponCode
  try {
    couponCode = decryptReviewCouponCode({ envelope: coupon, couponId: ids.couponId, reviewId: ids.reviewId, key: encryptionKey })
  } catch {
    safeLog(error, `Review reward email unavailable: ${eventKey}`)
    return { status: 'skipped_coupon_unrecoverable' }
  }

  let reservation
  try {
    reservation = await repository.getSource(review.sourceType, review.sourceReservationId)
    if (!reservation || recordId(reservation) !== review.sourceReservationId) throw new Error('MISSING_REWARD_SOURCE')
  } catch {
    safeLog(error, `Review reward email unavailable: ${eventKey}`)
    return { status: 'skipped_source_unavailable' }
  }
  const recipient = recipientAvailability(reservation, review.sourceType)
  if (!recipient.available) {
    safeLog(error, `Review reward email unavailable: ${eventKey}`)
    return { status: recipient.status }
  }

  try {
    const payload = buildReviewRewardEmailPayload({
      review, coupon, reservation, couponCode, from, replyTo, cakeOrderUrl,
    })
    return await deliverEmail({
      payload,
      repository: deliveryRepository,
      transport,
      now,
      log,
      error,
      logLabel: 'Review reward email delivery',
    })
  } catch {
    safeLog(error, `Review reward email unavailable: ${eventKey}`)
    return { status: 'delivery_error' }
  }
}

export function createReviewRewardPostCommit(options = {}) {
  return async (committed) => attemptReviewRewardEmail({ ...options, committed })
}
