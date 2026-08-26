import { ResendTransportError, classifyResendError } from './resend-transport.js'

function existingDeliveryStatus(decision) {
  switch (decision?.kind) {
    case 'already_sent': return 'already_sent'
    case 'in_progress': return 'in_progress'
    case 'retryable': return 'retry_deferred'
    case 'identity_mismatch': return 'identity_mismatch'
    case 'reconciliation_required': return 'reconciliation_required'
    default: return 'reconciliation_required'
  }
}

function deliveryIdentity(message) {
  return {
    eventKey: message.eventKey,
    sourceType: message.sourceType,
    sourceId: message.sourceId,
    template: message.template,
    recipientHash: message.recipientHash,
    payloadHash: message.payloadHash,
  }
}

function safeEventKey(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 128) || 'unknown'
}

export async function deliverEmail({ payload, repository, transport, now = new Date(), log = () => {}, error = () => {}, logLabel = 'Email' } = {}) {
  if (!payload) return { status: 'skipped_invalid_recipient' }
  const eventKey = safeEventKey(payload.eventKey)
  let claim
  try {
    claim = await repository.getOrCreatePending(deliveryIdentity(payload), now)
  } catch {
    error(`${logLabel} ledger failure: ${eventKey}`)
    return { status: 'ledger_error' }
  }
  if (claim.kind !== 'created') {
    const status = existingDeliveryStatus(claim.decision)
    return {
      status,
      ...(status === 'already_sent' && typeof claim.delivery?.sentAt === 'string' ? { sentAt: claim.delivery.sentAt } : {}),
    }
  }

  let attempted
  try {
    attempted = await repository.markAttempt(claim.delivery, now)
  } catch {
    error(`${logLabel} attempt recording failed: ${eventKey}`)
    return { status: 'ledger_error' }
  }

  try {
    const result = await transport.send(payload)
    if (result?.kind !== 'accepted' || typeof result.providerMessageId !== 'string') {
      throw new ResendTransportError('uncertain', 'resend_invalid_success_response')
    }
    const sent = await repository.markSent(attempted, { now, providerMessageId: result.providerMessageId })
    log(`${logLabel} sent: ${eventKey}`)
    return {
      status: 'sent',
      providerMessageId: result.providerMessageId,
      ...(typeof sent?.sentAt === 'string' ? { sentAt: sent.sentAt } : { sentAt: now.toISOString() }),
    }
  } catch (sendError) {
    const classified = classifyResendError(sendError)
    try {
      if (classified.kind === 'failed') {
        await repository.markFailed(attempted, { now, errorCode: classified.code })
        error(`${logLabel} failed: ${eventKey} (${classified.code})`)
        return { status: 'failed' }
      }
      await repository.markUncertain(attempted, { now, errorCode: classified.code })
      error(`${logLabel} uncertain: ${eventKey} (${classified.code})`)
      return { status: 'uncertain' }
    } catch {
      error(`${logLabel} result recording failed: ${eventKey}`)
      return { status: 'ledger_error' }
    }
  }
}

export async function deliverEmails({ payloads, repository, transport, now = new Date(), log = () => {}, error = () => {}, logLabel = 'Email' } = {}) {
  const deliveries = await Promise.allSettled(
    (payloads || []).map((payload) => deliverEmail({ payload, repository, transport, now, log, error, logLabel })),
  )
  return deliveries.map((delivery, index) => {
    if (delivery.status === 'fulfilled') return delivery.value
    try { error(`${logLabel} unexpected: ${safeEventKey(payloads?.[index]?.eventKey)}`) } catch {}
    return { status: 'delivery_error' }
  })
}
