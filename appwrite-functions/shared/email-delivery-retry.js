import {
  evaluateEmailDeliveryRetry,
} from './email-delivery.js'
import { ResendTransportError, classifyResendError } from './resend-transport.js'

function identityForPayload(payload) {
  return {
    eventKey: payload?.eventKey,
    sourceType: payload?.sourceType,
    sourceId: payload?.sourceId,
    template: payload?.template,
    recipientHash: payload?.recipientHash,
    payloadHash: payload?.payloadHash,
  }
}
function safeEventKey(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 128) || 'unknown'
}

async function completeClaim(repository, claim, status, now, errorCode) {
  if (!repository || typeof repository.markCompleted !== 'function' || !claim) return
  try { await repository.markCompleted(claim, { status, now, errorCode }) } catch { /* immutable claim remains fail-closed */ }
}

export async function retryEmail({
  payload,
  delivery,
  deliveryRepository,
  retryClaimRepository,
  claimedByUserId,
  transport,
  now = new Date(),
  log = () => {},
  error = () => {},
  logLabel = 'Email retry',
} = {}) {
  const identity = identityForPayload(payload)
  let existingClaim = null
  try {
    if (typeof retryClaimRepository?.getByEventKey === 'function') {
      existingClaim = await retryClaimRepository.getByEventKey(identity.eventKey)
    }
  } catch {
    error(logLabel + ' claim lookup failed: ' + safeEventKey(identity.eventKey))
    return { status: 'uncertain', retry: 'manual_fallback', safeErrorCode: 'retry_claim_unavailable' }
  }

  let decision
  try {
    decision = evaluateEmailDeliveryRetry({ delivery, identity, retryClaim: existingClaim, now })
  } catch {
    error(logLabel + ' eligibility failed: ' + safeEventKey(identity.eventKey))
    return { status: 'uncertain', retry: 'manual_fallback', safeErrorCode: 'retry_eligibility_unavailable' }
  }
  if (decision.retry !== 'eligible') return decision

  let claim
  try {
    claim = await retryClaimRepository.getOrCreateClaim({ ...identity, claimedByUserId }, now)
  } catch {
    error(logLabel + ' claim failed: ' + safeEventKey(identity.eventKey))
    return { ...decision, retry: 'manual_fallback', safeErrorCode: 'retry_claim_unavailable' }
  }
  if (claim.kind !== 'created') {
    return evaluateEmailDeliveryRetry({ delivery, identity, retryClaim: claim.claim, now })
  }

  let attempted
  try {
    attempted = await deliveryRepository.markAttempt(delivery, now)
  } catch {
    await completeClaim(retryClaimRepository, claim.claim, 'uncertain', now, 'retry_attempt_recording_failed')
    error(logLabel + ' attempt recording failed: ' + safeEventKey(identity.eventKey))
    return { ...decision, retry: 'manual_fallback', safeErrorCode: 'retry_attempt_recording_failed' }
  }

  try {
    const result = await transport.send(payload)
    if (result?.kind !== 'accepted' || typeof result.providerMessageId !== 'string') {
      throw new ResendTransportError('uncertain', 'resend_invalid_success_response')
    }
    const sent = await deliveryRepository.markSent(attempted, { now, providerMessageId: result.providerMessageId })
    await completeClaim(retryClaimRepository, claim.claim, 'sent', now, null)
    log(logLabel + ' sent: ' + safeEventKey(identity.eventKey))
    return {
      status: 'sent',
      retry: 'not_needed',
      ...(typeof sent?.sentAt === 'string' ? { sentAt: sent.sentAt } : { sentAt: now.toISOString() }),
    }
  } catch (caught) {
    const classified = classifyResendError(caught)
    const status = classified.kind === 'failed' ? 'failed' : 'uncertain'
    try {
      if (status === 'failed') await deliveryRepository.markFailed(attempted, { now, errorCode: classified.code })
      else await deliveryRepository.markUncertain(attempted, { now, errorCode: classified.code })
    } catch {
      error(logLabel + ' result recording failed: ' + safeEventKey(identity.eventKey))
    }
    await completeClaim(retryClaimRepository, claim.claim, status, now, classified.code)
    error(logLabel + ' ' + status + ': ' + safeEventKey(identity.eventKey) + ' (' + classified.code + ')')
    return { status, retry: 'manual_fallback', safeErrorCode: classified.code }
  }
}
