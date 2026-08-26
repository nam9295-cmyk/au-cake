import {
  buildEmailDeliveryEventKey,
  evaluateEmailDeliveryRetry,
  normalizeRecipientEmail,
} from '../shared/email-delivery/email-delivery.js'
import { retryEmail } from '../shared/email-delivery/email-delivery-retry.js'
import {
  getReviewInviteLifecycle,
  recoverReviewInviteToken,
} from './business.js'
import {
  buildReviewInviteEmailPayload,
  reviewInviteRecipientForReservation,
} from './review-invite-email.js'
import { rebuildReviewRewardEmailPayload } from './review-reward-email.js'

const REVIEW_INVITE_TEMPLATE = 'review-invite-customer'
const REVIEW_REWARD_TEMPLATE = 'review-reward-customer'
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

function actionInput(request) {
  const emailKind = request?.emailKind
  if (emailKind === REVIEW_INVITE_TEMPLATE) {
    const sourceType = request?.sourceType
    const reservationId = typeof request?.reservationId === 'string'
      ? request.reservationId.trim()
      : typeof request?.sourceReservationId === 'string'
        ? request.sourceReservationId.trim()
        : ''
    if (!['cake', 'class'].includes(sourceType) || !APPWRITE_ID.test(reservationId)) return null
    return { emailKind, sourceType, reservationId }
  }
  if (emailKind === REVIEW_REWARD_TEMPLATE) {
    const reviewId = typeof request?.reviewId === 'string' ? request.reviewId.trim() : ''
    if (!APPWRITE_ID.test(reviewId)) return null
    return { emailKind, reviewId }
  }
  return null
}

function maskRecipient(payload) {
  try {
    const email = normalizeRecipientEmail(payload?.to?.[0])
    const [local, domain] = email.split('@')
    return `${local.slice(0, 1)}***@${domain}`
  } catch {
    return null
  }
}

function resultForDelivery(result, payload = null) {
  return {
    status: result.status,
    retry: result.retry,
    ...(typeof result.sentAt === 'string' ? { sentAt: result.sentAt } : {}),
    ...(typeof result.lastAttemptAt === 'string' ? { lastAttemptAt: result.lastAttemptAt } : {}),
    ...(typeof result.retryUntil === 'string' ? { retryUntil: result.retryUntil } : {}),
    ...(maskRecipient(payload) ? { recipientMasked: maskRecipient(payload) } : {}),
    ...(typeof result.safeErrorCode === 'string' ? { safeErrorCode: result.safeErrorCode } : {}),
  }
}

function unavailableResult(delivery, safeErrorCode) {
  return {
    status: delivery?.status === 'pending' ? 'uncertain' : delivery?.status || 'failed',
    retry: 'terminal_error',
    safeErrorCode,
  }
}

async function rebuildInvitePayload({ repository, input, tokenEncryptionKey, from, replyTo, reviewOrigin, now }) {
  const lifecycle = await getReviewInviteLifecycle(repository, {
    sourceType: input.sourceType,
    sourceReservationId: input.reservationId,
  }, { now: now || new Date(), tokenEncryptionKey })
  if (lifecycle.state !== 'active') return { kind: 'lifecycle', status: lifecycle.state }
  const token = recoverReviewInviteToken(
    lifecycle.invite,
    input.sourceType,
    input.reservationId,
    tokenEncryptionKey,
  )
  if (!token) return { kind: 'unavailable', safeErrorCode: 'token_recovery_unavailable' }
  try {
    reviewInviteRecipientForReservation(lifecycle.source, input.sourceType)
    return {
      kind: 'ready',
      payload: buildReviewInviteEmailPayload({
        reservation: lifecycle.source,
        sourceType: input.sourceType,
        token,
        from,
        replyTo,
        reviewOrigin,
      }),
    }
  } catch {
    return { kind: 'unavailable', safeErrorCode: 'recipient_recovery_unavailable' }
  }
}

function eventKeyForInput(input) {
  return input.emailKind === REVIEW_INVITE_TEMPLATE
    ? buildEmailDeliveryEventKey({ template: input.emailKind, sourceType: input.sourceType, sourceId: input.reservationId })
    : buildEmailDeliveryEventKey({ template: input.emailKind, sourceType: 'review', sourceId: input.reviewId })
}

async function rebuildPayload({
  repository,
  input,
  tokenEncryptionKey,
  encryptionKey,
  from,
  replyTo,
  reviewOrigin,
  cakeOrderUrl,
  now,
  rebuildPayload: override,
}) {
  if (override) return override(input)
  if (input.emailKind === REVIEW_INVITE_TEMPLATE) {
    return rebuildInvitePayload({ repository, input, tokenEncryptionKey, from, replyTo, reviewOrigin, now })
  }
  return rebuildReviewRewardEmailPayload({
    repository,
    reviewId: input.reviewId,
    encryptionKey,
    from,
    replyTo,
    cakeOrderUrl,
  })
}

export async function getReviewEmailStatus(options = {}) {
  const input = actionInput(options.request)
  if (!input) return { status: 'not_sent', retry: 'not_needed' }
  const eventKey = eventKeyForInput(input)
  let reconstructed
  try {
    reconstructed = await rebuildPayload({ ...options, input })
  } catch {
    const delivery = await options.deliveryRepository.getByEventKey(eventKey)
    return unavailableResult(delivery, 'payload_recovery_unavailable')
  }
  if (reconstructed?.kind === 'lifecycle') return { status: reconstructed.status, retry: 'not_needed' }
  const delivery = await options.deliveryRepository.getByEventKey(eventKey)
  if (!delivery) return resultForDelivery({ status: 'not_sent', retry: 'not_needed' }, reconstructed?.payload)
  if (reconstructed?.kind !== 'ready') return unavailableResult(delivery, reconstructed?.safeErrorCode || 'payload_recovery_unavailable')
  let claim = null
  try { claim = await options.retryClaimRepository.getByEventKey(eventKey) } catch {
    return unavailableResult(delivery, 'retry_claim_unavailable')
  }
  return resultForDelivery(evaluateEmailDeliveryRetry({
    delivery,
    identity: reconstructed.payload,
    retryClaim: claim,
    now: options.now || new Date(),
  }), reconstructed.payload)
}

export async function retryReviewEmail(options = {}) {
  const input = actionInput(options.request)
  if (!input) return { status: 'not_sent', retry: 'not_needed' }
  const eventKey = eventKeyForInput(input)
  let reconstructed
  try {
    reconstructed = await rebuildPayload({ ...options, input })
  } catch {
    const delivery = await options.deliveryRepository.getByEventKey(eventKey)
    return unavailableResult(delivery, 'payload_recovery_unavailable')
  }
  if (reconstructed?.kind === 'lifecycle') return { status: reconstructed.status, retry: 'not_needed' }
  const delivery = await options.deliveryRepository.getByEventKey(eventKey)
  if (!delivery) return { status: 'not_sent', retry: 'not_needed' }
  if (reconstructed?.kind !== 'ready') return unavailableResult(delivery, reconstructed?.safeErrorCode || 'payload_recovery_unavailable')
  const result = await retryEmail({
    payload: reconstructed.payload,
    delivery,
    deliveryRepository: options.deliveryRepository,
    retryClaimRepository: options.retryClaimRepository,
    claimedByUserId: options.claimedByUserId,
    transport: options.transport,
    now: options.now || new Date(),
    log: options.log,
    error: options.error,
    logLabel: 'Review email retry',
  })
  return resultForDelivery(result, reconstructed.payload)
}
