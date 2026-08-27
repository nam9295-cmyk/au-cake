export type BookingConfirmationSourceType = 'cake' | 'class'
export type BookingConfirmationStatus = 'not_sent' | 'pending' | 'sent' | 'failed' | 'uncertain'
export type BookingConfirmationSendStatus = BookingConfirmationStatus | 'already_sent'

type BookingConfirmationExecution = {
  status?: string
  responseStatusCode?: number
  responseBody?: string
}

export type BookingConfirmationExecutor = {
  createExecution(input: { functionId: string; body: string; async: false }): Promise<BookingConfirmationExecution>
}

export type BookingConfirmationResult = {
  status: BookingConfirmationSendStatus
  sentAt?: string
  recipientMasked?: string
}

export class BookingConfirmationEmailError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'BookingConfirmationEmailError'
    this.code = code
  }
}

const SOURCE_TYPES = new Set<unknown>(['cake', 'class'])
const STATUS_VALUES = new Set<unknown>(['not_sent', 'pending', 'sent', 'failed', 'uncertain', 'already_sent'])
const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const MASKED_EMAIL = /^[^@\s]{1,4}\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function invalid(): never {
  throw new BookingConfirmationEmailError('BOOKING_CONFIRMATION_REQUEST_FAILED')
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function validSourceType(value: unknown): value is BookingConfirmationSourceType {
  return SOURCE_TYPES.has(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && RESOURCE_ID.test(value)
}

export function buildSendBookingConfirmationPayload(sourceType: BookingConfirmationSourceType, reservationId: string) {
  if (!validSourceType(sourceType) || !validId(reservationId)) return invalid()
  return { action: 'send-booking-confirmation' as const, data: { sourceType, reservationId } }
}

export function buildBookingConfirmationStatusPayload(sourceType: BookingConfirmationSourceType, reservationId: string) {
  if (!validSourceType(sourceType) || !validId(reservationId)) return invalid()
  return { action: 'get-booking-confirmation-status' as const, data: { sourceType, reservationId } }
}

function parseResult(value: unknown): BookingConfirmationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  const keys = Object.keys(result)
  if (!STATUS_VALUES.has(result.status) || keys.some((key) => !['status', 'sentAt', 'recipientMasked'].includes(key))) return invalid()
  if (result.sentAt !== undefined && !validDate(result.sentAt)) return invalid()
  if (result.recipientMasked !== undefined && (typeof result.recipientMasked !== 'string' || !MASKED_EMAIL.test(result.recipientMasked))) return invalid()
  if ((result.status === 'sent' || result.status === 'already_sent') && !validDate(result.sentAt)) return invalid()
  return {
    status: result.status as BookingConfirmationSendStatus,
    ...(typeof result.sentAt === 'string' ? { sentAt: result.sentAt } : {}),
    ...(typeof result.recipientMasked === 'string' ? { recipientMasked: result.recipientMasked } : {}),
  }
}

export function parseBookingConfirmationExecution(execution: BookingConfirmationExecution): BookingConfirmationResult {
  let response: unknown
  try {
    response = JSON.parse(execution.responseBody || '')
  } catch {
    return invalid()
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) return invalid()
  const body = response as Record<string, unknown>
  if (body.ok !== true) {
    const code = typeof body.code === 'string' && /^BOOKING_CONFIRMATION_[A-Z_]{2,63}$/.test(body.code)
      ? body.code
      : 'BOOKING_CONFIRMATION_REQUEST_FAILED'
    throw new BookingConfirmationEmailError(code)
  }
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200 || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) return invalid()
  return parseResult(body.result)
}

async function execute(
  executor: BookingConfirmationExecutor,
  functionId: string,
  payload: object,
): Promise<BookingConfirmationResult> {
  if (!functionId || !validId(functionId)) return invalid()
  try {
    return parseBookingConfirmationExecution(await executor.createExecution({ functionId, body: JSON.stringify(payload), async: false }))
  } catch (error) {
    if (error instanceof BookingConfirmationEmailError) throw error
    throw new BookingConfirmationEmailError('BOOKING_CONFIRMATION_REQUEST_FAILED')
  }
}

export function sendBookingConfirmation(
  executor: BookingConfirmationExecutor,
  functionId: string,
  sourceType: BookingConfirmationSourceType,
  reservationId: string,
) {
  return execute(executor, functionId, buildSendBookingConfirmationPayload(sourceType, reservationId))
}

export function getBookingConfirmationStatus(
  executor: BookingConfirmationExecutor,
  functionId: string,
  sourceType: BookingConfirmationSourceType,
  reservationId: string,
) {
  return execute(executor, functionId, buildBookingConfirmationStatusPayload(sourceType, reservationId))
}

export function bookingConfirmationRecipientAvailable(value: string | undefined) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 120
}
