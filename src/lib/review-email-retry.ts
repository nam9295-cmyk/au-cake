import type { ReviewSourceType } from './types.js'

export type ReviewEmailKind = 'review-invite-customer' | 'review-reward-customer'
export type ReviewEmailStatus =
  | 'not_sent' | 'pending' | 'sent' | 'failed' | 'uncertain'
  | 'used' | 'expired' | 'legacy_invite_unrecoverable'
export type ReviewEmailRetryState =
  | 'not_needed' | 'wait' | 'eligible' | 'expired_window'
  | 'recipient_changed' | 'payload_changed' | 'terminal_error' | 'manual_fallback'

export type ReviewEmailDeliveryResult = {
  status: ReviewEmailStatus
  retry: ReviewEmailRetryState
  sentAt?: string
  lastAttemptAt?: string
  retryUntil?: string
  recipientMasked?: string
  safeErrorCode?: string
}

type Executor = {
  createExecution(input: { functionId: string; body: string; async: false }): Promise<{
    status?: string
    responseStatusCode?: number
    responseBody?: string
  }>
}

type InviteInput = { emailKind: 'review-invite-customer'; sourceType: ReviewSourceType; reservationId: string }
type RewardInput = { emailKind: 'review-reward-customer'; reviewId: string }
export type ReviewEmailInput = InviteInput | RewardInput

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const STATUSES = new Set<unknown>(['not_sent', 'pending', 'sent', 'failed', 'uncertain', 'used', 'expired', 'legacy_invite_unrecoverable'])
const RETRIES = new Set<unknown>(['not_needed', 'wait', 'eligible', 'expired_window', 'recipient_changed', 'payload_changed', 'terminal_error', 'manual_fallback'])
const MASKED_EMAIL = /^[^@\s]{1,4}\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const SAFE_ERROR = /^[A-Za-z0-9_.-]{1,80}$/

function invalid(): never { throw new Error('REVIEW_EMAIL_RETRY_REQUEST_FAILED') }
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

function validInput(input: ReviewEmailInput) {
  if (input?.emailKind === 'review-invite-customer') {
    if (!['cake', 'class'].includes(input.sourceType) || !ID.test(input.reservationId) ||
        Object.keys(input).some((key) => !['emailKind', 'sourceType', 'reservationId'].includes(key))) invalid()
    return
  }
  if (input?.emailKind === 'review-reward-customer' && ID.test(input.reviewId) &&
      Object.keys(input).every((key) => ['emailKind', 'reviewId'].includes(key))) return
  invalid()
}

function payload(action: 'get-review-email-status' | 'retry-review-email', input: ReviewEmailInput) {
  validInput(input)
  return { action, data: input.emailKind === 'review-invite-customer'
    ? { emailKind: input.emailKind, sourceType: input.sourceType, reservationId: input.reservationId }
    : { emailKind: input.emailKind, reviewId: input.reviewId } }
}

export function buildReviewEmailStatusPayload(input: ReviewEmailInput) {
  return payload('get-review-email-status', input)
}

export function buildRetryReviewEmailPayload(input: ReviewEmailInput) {
  return payload('retry-review-email', input)
}

function parse(value: unknown): ReviewEmailDeliveryResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  const allowed = ['status', 'retry', 'sentAt', 'lastAttemptAt', 'retryUntil', 'recipientMasked', 'safeErrorCode']
  if (!STATUSES.has(result.status) || !RETRIES.has(result.retry) || Object.keys(result).some((key) => !allowed.includes(key))) return invalid()
  for (const key of ['sentAt', 'lastAttemptAt', 'retryUntil'] as const) if (result[key] !== undefined && !validDate(result[key])) return invalid()
  if (result.recipientMasked !== undefined && (typeof result.recipientMasked !== 'string' || !MASKED_EMAIL.test(result.recipientMasked))) return invalid()
  if (result.safeErrorCode !== undefined && (typeof result.safeErrorCode !== 'string' || !SAFE_ERROR.test(result.safeErrorCode))) return invalid()
  return {
    status: result.status as ReviewEmailStatus,
    retry: result.retry as ReviewEmailRetryState,
    ...(typeof result.sentAt === 'string' ? { sentAt: result.sentAt } : {}),
    ...(typeof result.lastAttemptAt === 'string' ? { lastAttemptAt: result.lastAttemptAt } : {}),
    ...(typeof result.retryUntil === 'string' ? { retryUntil: result.retryUntil } : {}),
    ...(typeof result.recipientMasked === 'string' ? { recipientMasked: result.recipientMasked } : {}),
    ...(typeof result.safeErrorCode === 'string' ? { safeErrorCode: result.safeErrorCode } : {}),
  }
}

export function parseReviewEmailExecution(execution: { status?: string; responseStatusCode?: number; responseBody?: string }): ReviewEmailDeliveryResult {
  let envelope: unknown
  try { envelope = JSON.parse(execution.responseBody || '') } catch { return invalid() }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return invalid()
  const body = envelope as Record<string, unknown>
  if (body.ok !== true || execution.status !== 'completed' || execution.responseStatusCode !== 200 ||
      Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) return invalid()
  return parse(body.result)
}

async function execute(executor: Executor, functionId: string, request: object) {
  if (!ID.test(functionId || '')) return invalid()
  try {
    return parseReviewEmailExecution(await executor.createExecution({ functionId, body: JSON.stringify(request), async: false }))
  } catch {
    throw new Error('REVIEW_EMAIL_RETRY_REQUEST_FAILED')
  }
}

export function getReviewEmailStatus(executor: Executor, functionId: string, input: ReviewEmailInput) {
  return execute(executor, functionId, buildReviewEmailStatusPayload(input))
}

export function retryReviewEmail(executor: Executor, functionId: string, input: ReviewEmailInput) {
  return execute(executor, functionId, buildRetryReviewEmailPayload(input))
}
