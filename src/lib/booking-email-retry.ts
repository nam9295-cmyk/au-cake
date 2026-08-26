import type { BookingConfirmationExecutor, BookingConfirmationSourceType } from './booking-confirmation-email'

export type BookingEmailKind =
  | 'booking-received-operator'
  | 'booking-received-customer'
  | 'booking-confirmed-customer'

export type BookingEmailRetryState =
  | 'not_needed'
  | 'wait'
  | 'eligible'
  | 'expired_window'
  | 'recipient_changed'
  | 'payload_changed'
  | 'terminal_error'
  | 'manual_fallback'

export type BookingEmailStatus = 'not_sent' | 'pending' | 'sent' | 'failed' | 'uncertain'

export type BookingEmailDeliveryResult = {
  status: BookingEmailStatus
  retry: BookingEmailRetryState
  sentAt?: string
  lastAttemptAt?: string
  retryUntil?: string
  recipientMasked?: string
  safeErrorCode?: string
}

type Execution = {
  status?: string
  responseStatusCode?: number
  responseBody?: string
}

const SOURCE_TYPES = new Set<unknown>(['cake', 'class'])
const EMAIL_KINDS = new Set<unknown>([
  'booking-received-operator', 'booking-received-customer', 'booking-confirmed-customer',
])
const STATUSES = new Set<unknown>(['not_sent', 'pending', 'sent', 'failed', 'uncertain'])
const RETRIES = new Set<unknown>([
  'not_needed', 'wait', 'eligible', 'expired_window', 'recipient_changed', 'payload_changed', 'terminal_error', 'manual_fallback',
])
const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const MASKED_EMAIL = /^[^@\s]{1,4}\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const SAFE_ERROR = /^[A-Za-z0-9_.-]{1,80}$/

function invalid(): never { throw new Error('BOOKING_EMAIL_RETRY_REQUEST_FAILED') }

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

function validInput(sourceType: unknown, reservationId: unknown, emailKind: unknown): asserts sourceType is BookingConfirmationSourceType {
  if (!SOURCE_TYPES.has(sourceType) || typeof reservationId !== 'string' || !RESOURCE_ID.test(reservationId) || !EMAIL_KINDS.has(emailKind)) invalid()
}

export function buildBookingEmailStatusPayload(sourceType: BookingConfirmationSourceType, reservationId: string, emailKind: BookingEmailKind) {
  validInput(sourceType, reservationId, emailKind)
  return { action: 'get-booking-email-status' as const, data: { sourceType, reservationId, emailKind } }
}

export function buildRetryBookingEmailPayload(sourceType: BookingConfirmationSourceType, reservationId: string, emailKind: BookingEmailKind) {
  validInput(sourceType, reservationId, emailKind)
  return { action: 'retry-booking-email' as const, data: { sourceType, reservationId, emailKind } }
}

function parseResult(value: unknown): BookingEmailDeliveryResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const input = value as Record<string, unknown>
  const allowed = ['status', 'retry', 'sentAt', 'lastAttemptAt', 'retryUntil', 'recipientMasked', 'safeErrorCode']
  if (!STATUSES.has(input.status) || !RETRIES.has(input.retry) || Object.keys(input).some((key) => !allowed.includes(key))) return invalid()
  for (const key of ['sentAt', 'lastAttemptAt', 'retryUntil'] as const) {
    if (input[key] !== undefined && !validDate(input[key])) return invalid()
  }
  if (input.recipientMasked !== undefined && (typeof input.recipientMasked !== 'string' || !MASKED_EMAIL.test(input.recipientMasked))) return invalid()
  if (input.safeErrorCode !== undefined && (typeof input.safeErrorCode !== 'string' || !SAFE_ERROR.test(input.safeErrorCode))) return invalid()
  return {
    status: input.status as BookingEmailStatus,
    retry: input.retry as BookingEmailRetryState,
    ...(typeof input.sentAt === 'string' ? { sentAt: input.sentAt } : {}),
    ...(typeof input.lastAttemptAt === 'string' ? { lastAttemptAt: input.lastAttemptAt } : {}),
    ...(typeof input.retryUntil === 'string' ? { retryUntil: input.retryUntil } : {}),
    ...(typeof input.recipientMasked === 'string' ? { recipientMasked: input.recipientMasked } : {}),
    ...(typeof input.safeErrorCode === 'string' ? { safeErrorCode: input.safeErrorCode } : {}),
  }
}

export function parseBookingEmailExecution(execution: Execution): BookingEmailDeliveryResult {
  let envelope: unknown
  try { envelope = JSON.parse(execution.responseBody || '') } catch { return invalid() }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return invalid()
  const body = envelope as Record<string, unknown>
  if (body.ok !== true) return invalid()
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200 || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) return invalid()
  return parseResult(body.result)
}

async function execute(executor: BookingConfirmationExecutor, functionId: string, payload: object) {
  if (typeof functionId !== 'string' || !RESOURCE_ID.test(functionId)) return invalid()
  try {
    return parseBookingEmailExecution(await executor.createExecution({ functionId, body: JSON.stringify(payload), async: false }))
  } catch {
    throw new Error('BOOKING_EMAIL_RETRY_REQUEST_FAILED')
  }
}

export function getBookingEmailStatus(executor: BookingConfirmationExecutor, functionId: string, sourceType: BookingConfirmationSourceType, reservationId: string, emailKind: BookingEmailKind) {
  return execute(executor, functionId, buildBookingEmailStatusPayload(sourceType, reservationId, emailKind))
}

export function retryBookingEmail(executor: BookingConfirmationExecutor, functionId: string, sourceType: BookingConfirmationSourceType, reservationId: string, emailKind: BookingEmailKind) {
  return execute(executor, functionId, buildRetryBookingEmailPayload(sourceType, reservationId, emailKind))
}
