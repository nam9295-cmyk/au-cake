import {
  buildEmailDeliveryEventKey,
  normalizeRecipientEmail,
  payloadHashForEmail,
  recipientHashForEmail,
  resendIdempotencyKeyForEvent,
} from '../shared/email-delivery/email-delivery.js'

const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const REVIEW_TOKEN = /^[A-Za-z0-9_-]{43}$/
const TEMPLATE = 'review-invite-customer'
const SUBJECT = '[Verygood] 후기 부탁드려요 | We’d love your review'

function plainTextCell(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, 120)
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

function sourceId(reservation) {
  const id = reservation?.$id || reservation?.$rowId || reservation?.id
  if (!APPWRITE_ID.test(id || '')) throw new Error('INVALID_REVIEW_INVITE_SOURCE_ID')
  return id
}

function sourceName(reservation, sourceType) {
  return plainTextCell(sourceType === 'cake' ? reservation?.customerName : reservation?.parentName)
}

function reviewLink(token, reviewOrigin) {
  if (typeof token !== 'string' || !REVIEW_TOKEN.test(token)) throw new Error('INVALID_REVIEW_INVITE_TOKEN')
  let origin
  try { origin = new URL(String(reviewOrigin || '').trim()) } catch { throw new Error('INVALID_REVIEW_ORIGIN') }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.origin !== String(reviewOrigin).trim().replace(/\/+$/, '')) {
    throw new Error('INVALID_REVIEW_ORIGIN')
  }
  return `${origin.origin}/review#${encodeURIComponent(token)}`
}

function templateCopy(name, url) {
  const greeting = name || 'there'
  const korean = [
    '[한국어]',
    '',
    `안녕하세요, ${greeting}님.`,
    '',
    '베리굿을 이용해주셔서 감사합니다.',
    '좋았던 점이나 아쉬웠던 점 모두 솔직하게 들려주세요. 남겨주신 후기는 베리굿을 더 좋은 경험으로 만드는 데 큰 도움이 됩니다.',
    '',
    '텍스트 후기',
    '다음 케이크 주문 5% 할인 쿠폰',
    '',
    '사진과 함께 남긴 후기',
    '다음 케이크 주문 10% 할인 쿠폰',
    '',
    `후기 남기기: ${url}`,
    '',
    '개인 후기 링크는 발급일로부터 30일 동안 유효합니다.',
    '후기 작성 후 발급되는 리워드 쿠폰도 발급일로부터 30일 동안 사용할 수 있습니다.',
    '쿠폰은 다음 케이크 주문에 1회 사용할 수 있습니다.',
    '',
    '감사합니다.',
    'Verygood Chocolate Sydney',
  ]
  const english = [
    '[English]',
    '',
    `Hi ${greeting},`,
    '',
    'Thank you for choosing Verygood Chocolate.',
    'We’d love to hear your honest feedback — what you loved and anything we could improve.',
    '',
    'Text review',
    '5% off your next cake order',
    '',
    'Review with a photo',
    '10% off your next cake order',
    '',
    `Leave a review: ${url}`,
    '',
    'Your personal review link is valid for 30 days.',
    'After you submit your review, your reward coupon will be valid for 30 days from the date it is issued.',
    'The coupon can be used once on your next cake order.',
    '',
    'Thank you,',
    'Verygood Chocolate Sydney',
  ]
  return { korean, english, text: [...korean, '', '--------------------', '', ...english].join('\n') }
}

function buildHtml(name, url) {
  const safeName = escapeHtml(name || 'there')
  const safeUrl = escapeHtml(url)
  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a1710;line-height:1.6;max-width:640px;margin:0 auto;">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">후기를 들려주세요</h1>
      <p style="margin:0 0 14px;">안녕하세요, ${safeName}님.</p>
      <p style="margin:0 0 14px;">베리굿을 이용해주셔서 감사합니다.</p>
      <p style="margin:0 0 18px;">좋았던 점이나 아쉬웠던 점 모두 솔직하게 들려주세요. 남겨주신 후기는 베리굿을 더 좋은 경험으로 만드는 데 큰 도움이 됩니다.</p>
      <div style="border:1px solid #e8ded5;border-radius:8px;padding:14px;margin:0 0 18px;">
        <p style="margin:0 0 8px;"><strong>텍스트 후기</strong><br>다음 케이크 주문 5% 할인 쿠폰</p>
        <p style="margin:0;"><strong>사진과 함께 남긴 후기</strong><br>다음 케이크 주문 10% 할인 쿠폰</p>
      </div>
      <p style="margin:0 0 18px;"><a href="${safeUrl}" style="display:inline-block;background:#5b2417;color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">후기 남기기</a></p>
      <p style="margin:0 0 8px;">개인 후기 링크는 발급일로부터 30일 동안 유효합니다.</p>
      <p style="margin:0 0 8px;">후기 작성 후 발급되는 리워드 쿠폰도 발급일로부터 30일 동안 사용할 수 있습니다.</p>
      <p style="margin:0;">쿠폰은 다음 케이크 주문에 1회 사용할 수 있습니다.</p>
      <hr style="border:0;border-top:1px solid #e8ded5;margin:28px 0;">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">We’d love your review</h1>
      <p style="margin:0 0 14px;">Hi ${safeName},</p>
      <p style="margin:0 0 14px;">Thank you for choosing Verygood Chocolate.</p>
      <p style="margin:0 0 18px;">We’d love to hear your honest feedback — what you loved and anything we could improve.</p>
      <div style="border:1px solid #e8ded5;border-radius:8px;padding:14px;margin:0 0 18px;">
        <p style="margin:0 0 8px;"><strong>Text review</strong><br>5% off your next cake order</p>
        <p style="margin:0;"><strong>Review with a photo</strong><br>10% off your next cake order</p>
      </div>
      <p style="margin:0 0 18px;"><a href="${safeUrl}" style="display:inline-block;background:#5b2417;color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">Leave a review</a></p>
      <p style="margin:0 0 8px;">Your personal review link is valid for 30 days.</p>
      <p style="margin:0 0 8px;">After you submit your review, your reward coupon will be valid for 30 days from the date it is issued.</p>
      <p style="margin:0;">The coupon can be used once on your next cake order.</p>
      <p style="margin:22px 0 0;">Thank you,<br>Verygood Chocolate Sydney</p>
    </div>
  `
}

export function buildReviewInviteEmailPayload({
  reservation,
  sourceType,
  token,
  from,
  replyTo = null,
  reviewOrigin,
} = {}) {
  if (!reservation || !['cake', 'class'].includes(sourceType)) throw new Error('INVALID_REVIEW_INVITE_PAYLOAD')
  const id = sourceId(reservation)
  const recipient = reviewInviteRecipientForReservation(reservation, sourceType)
  const normalizedFrom = plainTextCell(from)
  if (!normalizedFrom) throw new Error('INVALID_RESEND_FROM_EMAIL')
  const normalizedReplyTo = replyTo === null || replyTo === undefined || !String(replyTo).trim()
    ? null
    : normalizeRecipientEmail(replyTo)
  const name = sourceName(reservation, sourceType)
  const url = reviewLink(token, reviewOrigin)
  const copy = templateCopy(name, url)
  const eventKey = buildEmailDeliveryEventKey({ template: TEMPLATE, sourceType, sourceId: id })
  const templateVersion = `${TEMPLATE}-${sourceType}-v1`
  const html = buildHtml(name, url)
  return {
    from: normalizedFrom,
    to: [recipient],
    replyTo: normalizedReplyTo,
    subject: SUBJECT,
    text: copy.text,
    html,
    template: TEMPLATE,
    templateVersion,
    eventKey,
    sourceType,
    sourceId: id,
    recipientHash: recipientHashForEmail(recipient),
    payloadHash: payloadHashForEmail({
      from: normalizedFrom,
      recipientEmail: recipient,
      replyTo: normalizedReplyTo,
      subject: SUBJECT,
      text: copy.text,
      html,
      template: TEMPLATE,
      templateVersion,
    }),
    idempotencyKey: resendIdempotencyKeyForEvent(eventKey),
  }
}

export function reviewInviteRecipientForReservation(reservation, sourceType) {
  if (!reservation || !['cake', 'class'].includes(sourceType)) throw new Error('INVALID_REVIEW_INVITE_PAYLOAD')
  return normalizeRecipientEmail(sourceType === 'cake' ? reservation.customerEmail : reservation.parentEmail)
}

export function buildReviewInviteCopyMessage({ reservation, sourceType, token, reviewOrigin } = {}) {
  if (!reservation || !['cake', 'class'].includes(sourceType)) throw new Error('INVALID_REVIEW_INVITE_PAYLOAD')
  return templateCopy(sourceName(reservation, sourceType), reviewLink(token, reviewOrigin)).text
}
