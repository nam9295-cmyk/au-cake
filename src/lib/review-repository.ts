import type { ReviewSourceType } from './types.js'
import {
  buildLoadReviewInvitePayload,
  buildRemoveReviewPhotoPayload,
  buildSubmitReviewPayload,
  buildUploadReviewPhotoPayload,
  parseLoadReviewInviteResult,
  parseSubmitReviewResult,
  type ReviewInviteContext,
  type ReviewSubmissionInput,
  type ReviewSubmissionResult,
} from './review-page.js'
import { blobToBase64, type ReviewPhotoUploadMimeType } from './review-photo.js'

export const REVIEW_INVITE_REQUEST_FAILED = 'REVIEW_INVITE_REQUEST_FAILED'

type CreateReviewInviteInput = {
  sourceType: ReviewSourceType
  sourceReservationId: string
}

type ReviewInviteExecution = {
  status?: string
  responseStatusCode?: number
  responseBody?: string
}

export type ReviewFunctionErrorCode = string

type FunctionsExecutor = {
  createExecution(input: {
    functionId: string
    body: string
    async: false
  }): Promise<ReviewInviteExecution>
}

export type ReviewInviteResult = {
  token: string
  expiresAt: string
}

export type ReviewInviteEmailDeliveryStatus =
  | 'not_sent'
  | 'pending'
  | 'sent'
  | 'already_sent'
  | 'failed'
  | 'uncertain'
  | 'used'
  | 'expired'
  | 'legacy_invite_unrecoverable'

export type ReviewInviteEmailResult = {
  status: ReviewInviteEmailDeliveryStatus
  sentAt?: string
  recipientMasked?: string
  recipientAvailable?: boolean
}

export type ReviewInviteCopyResult = { message: string }

export class ReviewInviteApiError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'ReviewInviteApiError'
    this.code = code
  }
}

export function buildCreateReviewInvitePayload(input: CreateReviewInviteInput) {
  return {
    action: 'create-invite' as const,
    data: {
      sourceType: input.sourceType,
      sourceReservationId: input.sourceReservationId,
    },
  }
}

const REVIEW_INVITE_SOURCE_TYPES = new Set<unknown>(['cake', 'class'])
const REVIEW_INVITE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const REVIEW_INVITE_EMAIL_STATUSES = new Set<unknown>([
  'not_sent', 'pending', 'sent', 'already_sent', 'failed', 'uncertain', 'used', 'expired', 'legacy_invite_unrecoverable',
])
const MASKED_EMAIL = /^[^@\s]{1,4}\*{3}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function validReviewInviteSource(sourceType: unknown): sourceType is ReviewSourceType {
  return REVIEW_INVITE_SOURCE_TYPES.has(sourceType)
}

function validReviewInviteId(sourceReservationId: unknown): sourceReservationId is string {
  return typeof sourceReservationId === 'string' && REVIEW_INVITE_RESOURCE_ID.test(sourceReservationId)
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

export function buildSendReviewInviteEmailPayload(sourceType: ReviewSourceType, sourceReservationId: string) {
  if (!validReviewInviteSource(sourceType) || !validReviewInviteId(sourceReservationId)) return failed()
  return { action: 'send-review-invite-email' as const, data: { sourceType, sourceReservationId } }
}

export function buildReviewInviteEmailStatusPayload(sourceType: ReviewSourceType, sourceReservationId: string) {
  if (!validReviewInviteSource(sourceType) || !validReviewInviteId(sourceReservationId)) return failed()
  return { action: 'get-review-invite-email-status' as const, data: { sourceType, sourceReservationId } }
}

export function buildCopyReviewInviteRequestPayload(sourceType: ReviewSourceType, sourceReservationId: string) {
  if (!validReviewInviteSource(sourceType) || !validReviewInviteId(sourceReservationId)) return failed()
  return { action: 'copy-review-invite-request' as const, data: { sourceType, sourceReservationId } }
}

function failed(): never {
  throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
}

export function parseReviewInviteExecution(execution: ReviewInviteExecution): ReviewInviteResult {
  let response: unknown
  try {
    response = JSON.parse(execution.responseBody || '')
  } catch {
    return failed()
  }

  if (!response || typeof response !== 'object' || Array.isArray(response)) return failed()
  const body = response as { ok?: unknown; code?: unknown; result?: unknown }

  if (body.ok !== true) {
    const code = typeof body.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(body.code)
      ? body.code
      : REVIEW_INVITE_REQUEST_FAILED
    throw new ReviewInviteApiError(code)
  }

  if (execution.status !== 'completed' || execution.responseStatusCode !== 200) return failed()
  if (!body.result || typeof body.result !== 'object' || Array.isArray(body.result)) return failed()
  const result = body.result as { token?: unknown; expiresAt?: unknown }
  if (typeof result.token !== 'string' || !result.token || typeof result.expiresAt !== 'string' || !result.expiresAt) {
    return failed()
  }

  return { token: result.token, expiresAt: result.expiresAt }
}

export async function createReviewInvite(
  executor: FunctionsExecutor,
  functionId: string,
  input: CreateReviewInviteInput,
): Promise<ReviewInviteResult> {
  try {
    const execution = await executor.createExecution({
      functionId,
      body: JSON.stringify(buildCreateReviewInvitePayload(input)),
      async: false,
    })
    return parseReviewInviteExecution(execution)
  } catch (error) {
    if (error instanceof ReviewInviteApiError) throw error
    throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
  }
}

async function executeReviewAction<T>(
  executor: FunctionsExecutor,
  functionId: string,
  payload: object,
  parseResult: (value: unknown) => T,
): Promise<T> {
  try {
    const execution = await executor.createExecution({ functionId, body: JSON.stringify(payload), async: false })
    let response: unknown
    try {
      response = JSON.parse(execution.responseBody || '')
    } catch {
      return failed()
    }
    if (!response || typeof response !== 'object' || Array.isArray(response)) return failed()
    const body = response as { ok?: unknown; code?: unknown; result?: unknown }
    if (body.ok !== true) {
      const code = typeof body.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(body.code)
        ? body.code
        : REVIEW_INVITE_REQUEST_FAILED
      throw new ReviewInviteApiError(code)
    }
    if (execution.status !== 'completed' || execution.responseStatusCode !== 200) return failed()
    return parseResult(body.result)
  } catch (error) {
    if (error instanceof ReviewInviteApiError) throw error
    throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
  }
}

function parseReviewInviteEmailResult(value: unknown): ReviewInviteEmailResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failed()
  const result = value as Record<string, unknown>
  const keys = Object.keys(result)
  if (!REVIEW_INVITE_EMAIL_STATUSES.has(result.status) ||
    keys.some((key) => !['status', 'sentAt', 'recipientMasked', 'recipientAvailable'].includes(key))) return failed()
  if (result.sentAt !== undefined && !validDate(result.sentAt)) return failed()
  if (result.recipientMasked !== undefined && (typeof result.recipientMasked !== 'string' || !MASKED_EMAIL.test(result.recipientMasked))) return failed()
  if (result.recipientAvailable !== undefined && typeof result.recipientAvailable !== 'boolean') return failed()
  if ((result.status === 'sent' || result.status === 'already_sent') &&
    (!validDate(result.sentAt) || typeof result.recipientMasked !== 'string')) return failed()
  return {
    status: result.status as ReviewInviteEmailDeliveryStatus,
    ...(typeof result.sentAt === 'string' ? { sentAt: result.sentAt } : {}),
    ...(typeof result.recipientMasked === 'string' ? { recipientMasked: result.recipientMasked } : {}),
    ...(typeof result.recipientAvailable === 'boolean' ? { recipientAvailable: result.recipientAvailable } : {}),
  }
}

function parseReviewInviteCopyResult(value: unknown): ReviewInviteCopyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failed()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== 1 || typeof result.message !== 'string' ||
    !result.message || result.message.length > 5000 || result.message.includes('\0')) return failed()
  return { message: result.message }
}

export function parseReviewInviteEmailExecution(execution: ReviewInviteExecution): ReviewInviteEmailResult {
  let response: unknown
  try { response = JSON.parse(execution.responseBody || '') } catch { return failed() }
  if (!response || typeof response !== 'object' || Array.isArray(response)) return failed()
  const body = response as Record<string, unknown>
  if (body.ok !== true) {
    const code = typeof body.code === 'string' && /^REVIEW_[A-Z_]{2,63}$/.test(body.code)
      ? body.code : REVIEW_INVITE_REQUEST_FAILED
    throw new ReviewInviteApiError(code)
  }
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200 || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) return failed()
  return parseReviewInviteEmailResult(body.result)
}

export function parseReviewInviteCopyExecution(execution: ReviewInviteExecution): ReviewInviteCopyResult {
  let response: unknown
  try { response = JSON.parse(execution.responseBody || '') } catch { return failed() }
  if (!response || typeof response !== 'object' || Array.isArray(response)) return failed()
  const body = response as Record<string, unknown>
  if (body.ok !== true) {
    const code = typeof body.code === 'string' && /^REVIEW_[A-Z_]{2,63}$/.test(body.code)
      ? body.code : REVIEW_INVITE_REQUEST_FAILED
    throw new ReviewInviteApiError(code)
  }
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200 || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) return failed()
  return parseReviewInviteCopyResult(body.result)
}

async function executeReviewInviteEmailAction<T extends ReviewInviteEmailResult | ReviewInviteCopyResult>(
  executor: FunctionsExecutor,
  functionId: string,
  payload: object,
  parseResult: (execution: ReviewInviteExecution) => T,
): Promise<T> {
  if (!functionId || !validReviewInviteId(functionId)) return failed()
  try {
    return parseResult(await executor.createExecution({ functionId, body: JSON.stringify(payload), async: false }))
  } catch (error) {
    if (error instanceof ReviewInviteApiError) throw error
    throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
  }
}

export function sendReviewInviteEmail(
  executor: FunctionsExecutor,
  functionId: string,
  sourceType: ReviewSourceType,
  sourceReservationId: string,
): Promise<ReviewInviteEmailResult> {
  return executeReviewInviteEmailAction(
    executor, functionId, buildSendReviewInviteEmailPayload(sourceType, sourceReservationId), parseReviewInviteEmailExecution,
  )
}

export function getReviewInviteEmailStatus(
  executor: FunctionsExecutor,
  functionId: string,
  sourceType: ReviewSourceType,
  sourceReservationId: string,
): Promise<ReviewInviteEmailResult> {
  return executeReviewInviteEmailAction(
    executor, functionId, buildReviewInviteEmailStatusPayload(sourceType, sourceReservationId), parseReviewInviteEmailExecution,
  )
}

export function copyReviewInviteRequest(
  executor: FunctionsExecutor,
  functionId: string,
  sourceType: ReviewSourceType,
  sourceReservationId: string,
): Promise<ReviewInviteCopyResult> {
  return executeReviewInviteEmailAction(
    executor, functionId, buildCopyReviewInviteRequestPayload(sourceType, sourceReservationId), parseReviewInviteCopyExecution,
  )
}

export function loadReviewInvite(
  executor: FunctionsExecutor,
  functionId: string,
  token: string,
): Promise<ReviewInviteContext> {
  return executeReviewAction(executor, functionId, buildLoadReviewInvitePayload(token), parseLoadReviewInviteResult)
}

export function submitCustomerReview(
  executor: FunctionsExecutor,
  functionId: string,
  input: ReviewSubmissionInput,
): Promise<ReviewSubmissionResult> {
  return executeReviewAction(executor, functionId, buildSubmitReviewPayload(input), parseSubmitReviewResult)
}

export type ReviewPhotoUploadResult = { uploaded: true; hasPhoto: true }
export type ReviewPhotoRemoveResult = { removed: true; hasPhoto: false }

function parsePhotoUploadResult(value: unknown): ReviewPhotoUploadResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  const result = value as Record<string, unknown>
  if (result.uploaded !== true || result.hasPhoto !== true) throw new Error('INVALID_REVIEW_RESPONSE')
  return { uploaded: true, hasPhoto: true }
}

function parsePhotoRemoveResult(value: unknown): ReviewPhotoRemoveResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REVIEW_RESPONSE')
  const result = value as Record<string, unknown>
  if (result.removed !== true || result.hasPhoto !== false) throw new Error('INVALID_REVIEW_RESPONSE')
  return { removed: true, hasPhoto: false }
}

export async function uploadReviewPhoto(
  executor: FunctionsExecutor,
  functionId: string,
  token: string,
  blob: Blob,
  mimeType: ReviewPhotoUploadMimeType = 'image/webp',
): Promise<ReviewPhotoUploadResult> {
  const uploadTypes = new Set<ReviewPhotoUploadMimeType>(['image/webp', 'image/heic', 'image/heif', 'image/avif', 'application/octet-stream'])
  if (!uploadTypes.has(mimeType) || blob.size < 1 ||
    (mimeType !== 'application/octet-stream' && blob.type && blob.type.toLowerCase() !== mimeType)) {
    throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
  }
  const base64 = await blobToBase64(blob)
  return executeReviewAction(
    executor,
    functionId,
    buildUploadReviewPhotoPayload(token, base64, blob.size, mimeType),
    parsePhotoUploadResult,
  )
}

export function removeReviewPhoto(
  executor: FunctionsExecutor,
  functionId: string,
  token: string,
): Promise<ReviewPhotoRemoveResult> {
  return executeReviewAction(executor, functionId, buildRemoveReviewPhotoPayload(token), parsePhotoRemoveResult)
}
