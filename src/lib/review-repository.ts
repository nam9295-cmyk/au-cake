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
import { blobToBase64 } from './review-photo.js'

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
): Promise<ReviewPhotoUploadResult> {
  if (blob.type !== 'image/webp' || blob.size < 1) throw new ReviewInviteApiError(REVIEW_INVITE_REQUEST_FAILED)
  const base64 = await blobToBase64(blob)
  return executeReviewAction(
    executor,
    functionId,
    buildUploadReviewPhotoPayload(token, base64, blob.size),
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
