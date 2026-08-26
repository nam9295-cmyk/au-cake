import {
  ReviewApiError,
  assertReviewInviteSource,
  getReviewInviteLifecycle,
  issueReviewInvite,
} from './business.js'
import {
  buildReviewInviteCopyMessage,
  buildReviewInviteEmailPayload,
  reviewInviteRecipientForReservation,
} from './review-invite-email.js'
import { buildEmailDeliveryEventKey } from '../shared/email-delivery/email-delivery.js'
import { deliverEmail } from '../shared/email-delivery/email-delivery-sender.js'

const TEMPLATE = 'review-invite-customer'

function fail(code, status = 400) {
  throw new ReviewApiError(code, status)
}

function actionInput(request) {
  const sourceType = request?.sourceType
  const sourceReservationId = typeof request?.sourceReservationId === 'string' ? request.sourceReservationId.trim() : ''
  if (!['cake', 'class'].includes(sourceType) || !sourceReservationId) fail('INVALID_REQUEST')
  return { sourceType, sourceReservationId }
}

function recipientForSource(source, sourceType) {
  const raw = sourceType === 'cake' ? source?.customerEmail : source?.parentEmail
  try {
    return reviewInviteRecipientForReservation(source, sourceType)
  } catch {
    fail(typeof raw === 'string' && raw.trim() ? 'REVIEW_INVITE_EMAIL_INVALID' : 'REVIEW_INVITE_EMAIL_MISSING')
  }
}

function maskRecipient(email) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1) || '*'}***@${domain}`
}

function statusResult(status, recipient = null, sentAt = null, recipientAvailable) {
  return {
    status,
    ...(sentAt ? { sentAt } : {}),
    ...(recipient && ['sent', 'already_sent'].includes(status) ? { recipientMasked: maskRecipient(recipient) } : {}),
    ...(typeof recipientAvailable === 'boolean' ? { recipientAvailable } : {}),
  }
}

function deliveryResult(result, recipient) {
  switch (result?.status) {
    case 'sent': return statusResult('sent', recipient, result.sentAt)
    case 'already_sent': return statusResult('already_sent', recipient, result.sentAt)
    case 'in_progress': return statusResult('pending', null, null)
    case 'retry_deferred': return statusResult('failed', null, null)
    case 'reconciliation_required': return statusResult('uncertain', null, null)
    case 'identity_mismatch': fail('REVIEW_INVITE_EMAIL_IDENTITY_MISMATCH', 409); break
    default: return statusResult('uncertain', null, null)
  }
}

async function authoritativeSource(repository, sourceType, sourceReservationId) {
  return assertReviewInviteSource(sourceType, await repository.getSource(sourceType, sourceReservationId))
}

export async function sendReviewInviteEmail({
  repository,
  deliveryRepository,
  transport,
  request,
  createdByUserId,
  tokenEncryptionKey,
  from,
  replyTo = null,
  reviewOrigin,
  now = new Date(),
  tokenFactory,
  idFactory,
  isConflict,
  log,
  error,
} = {}) {
  const input = actionInput(request)
  recipientForSource(await authoritativeSource(repository, input.sourceType, input.sourceReservationId), input.sourceType)
  const invite = await issueReviewInvite(repository, input, {
    createdByUserId,
    tokenEncryptionKey,
    now,
    ...(tokenFactory ? { tokenFactory } : {}),
    ...(idFactory ? { idFactory } : {}),
    ...(isConflict ? { isConflict } : {}),
  })
  const source = await authoritativeSource(repository, input.sourceType, input.sourceReservationId)
  const recipient = recipientForSource(source, input.sourceType)
  const payload = buildReviewInviteEmailPayload({
    reservation: source, sourceType: input.sourceType, token: invite.token, from, replyTo, reviewOrigin,
  })
  return deliveryResult(await deliverEmail({ payload, repository: deliveryRepository, transport, now, log, error, logLabel: 'Review invite email delivery' }), recipient)
}

export async function copyReviewInviteRequest({
  repository,
  request,
  createdByUserId,
  tokenEncryptionKey,
  reviewOrigin,
  now = new Date(),
  tokenFactory,
  idFactory,
  isConflict,
} = {}) {
  const input = actionInput(request)
  const invite = await issueReviewInvite(repository, input, {
    createdByUserId,
    tokenEncryptionKey,
    now,
    ...(tokenFactory ? { tokenFactory } : {}),
    ...(idFactory ? { idFactory } : {}),
    ...(isConflict ? { isConflict } : {}),
  })
  const source = await authoritativeSource(repository, input.sourceType, input.sourceReservationId)
  return { message: buildReviewInviteCopyMessage({ reservation: source, sourceType: input.sourceType, token: invite.token, reviewOrigin }) }
}

export async function getReviewInviteEmailStatus({
  repository,
  deliveryRepository,
  request,
  tokenEncryptionKey,
  now = new Date(),
} = {}) {
  const input = actionInput(request)
  const lifecycle = await getReviewInviteLifecycle(repository, input, { now, tokenEncryptionKey })
  let recipient = null
  try { recipient = recipientForSource(lifecycle.source, input.sourceType) } catch (caught) {
    if (!(caught instanceof ReviewApiError)) throw caught
  }
  const recipientAvailable = Boolean(recipient)
  if (lifecycle.state !== 'active') return statusResult(lifecycle.state, null, null, recipientAvailable)
  const eventKey = buildEmailDeliveryEventKey({ template: TEMPLATE, sourceType: input.sourceType, sourceId: input.sourceReservationId })
  const delivery = await deliveryRepository.getByEventKey(eventKey)
  if (!delivery) return statusResult('not_sent', null, null, recipientAvailable)
  switch (delivery.status) {
    case 'sent': return statusResult('sent', recipient, delivery.sentAt, recipientAvailable)
    case 'pending': return statusResult('pending', null, null, recipientAvailable)
    case 'failed': return statusResult('failed', null, null, recipientAvailable)
    case 'uncertain': return statusResult('uncertain', null, null, recipientAvailable)
    default: return statusResult('uncertain', null, null, recipientAvailable)
  }
}
