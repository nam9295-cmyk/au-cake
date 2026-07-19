export type AdminReviewStatus = 'pending' | 'published' | 'hidden'
export type AdminReviewFilter = AdminReviewStatus
export type AdminRewardStatus = 'active' | 'redeemed' | 'expired' | 'revoked' | 'unavailable'

export type AdminReview = {
  id: string
  sourceType: 'cake' | 'class'
  rating: 1 | 2 | 3 | 4 | 5
  body: string
  displayName: string
  hasPhoto: boolean
  photoPublishConsent: boolean
  publishConsent: boolean
  moderationStatus: AdminReviewStatus
  rewardPercent: 5 | 10
  rewardCodeLast4: string | null
  rewardStatus: AdminRewardStatus
  rewardExpiresAt: string | null
  rewardMessageAvailable: boolean
  createdAt: string
  updatedAt: string
}

export type AdminReviewPage = { reviews: AdminReview[]; nextCursor: string | null }

type ReviewExecution = { status?: string; responseStatusCode?: number; responseBody?: string }
export type AdminReviewExecutor = {
  createExecution(input: { functionId: string; body: string; async: false }): Promise<ReviewExecution>
}

const REVIEW_KEYS = new Set([
  'id', 'sourceType', 'rating', 'body', 'displayName', 'hasPhoto', 'photoPublishConsent',
  'publishConsent', 'moderationStatus', 'rewardPercent', 'rewardCodeLast4', 'rewardStatus',
  'rewardExpiresAt', 'rewardMessageAvailable', 'createdAt', 'updatedAt',
])
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const STATUSES = new Set<unknown>(['pending', 'published', 'hidden'])
const REWARD_STATUSES = new Set<unknown>(['active', 'redeemed', 'expired', 'revoked', 'unavailable'])

function invalid(): never { throw new Error('INVALID_ADMIN_REVIEWS_RESPONSE') }
function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

export function parseAdminReviewResult(value: unknown): AdminReview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const review = value as Record<string, unknown>
  const keys = Object.keys(review)
  if (keys.length !== REVIEW_KEYS.size || keys.some((key) => !REVIEW_KEYS.has(key))) return invalid()
  if (typeof review.id !== 'string' || !REF_PATTERN.test(review.id)) return invalid()
  if (review.sourceType !== 'cake' && review.sourceType !== 'class') return invalid()
  if (!Number.isInteger(review.rating) || Number(review.rating) < 1 || Number(review.rating) > 5) return invalid()
  if (typeof review.body !== 'string' || !review.body.trim() || review.body.length > 2000) return invalid()
  if (typeof review.displayName !== 'string' || review.displayName.length > 50) return invalid()
  if (typeof review.hasPhoto !== 'boolean' || typeof review.photoPublishConsent !== 'boolean' || typeof review.publishConsent !== 'boolean') return invalid()
  if (!STATUSES.has(review.moderationStatus) || (review.rewardPercent !== 5 && review.rewardPercent !== 10)) return invalid()
  if (!REWARD_STATUSES.has(review.rewardStatus) || typeof review.rewardMessageAvailable !== 'boolean') return invalid()
  if (review.rewardStatus === 'unavailable') {
    if (review.rewardCodeLast4 !== null || review.rewardExpiresAt !== null || review.rewardMessageAvailable) return invalid()
  } else if (
    typeof review.rewardCodeLast4 !== 'string' || !/^[A-Z2-9]{4}$/.test(review.rewardCodeLast4) ||
    !validDate(review.rewardExpiresAt) ||
    (review.rewardStatus === 'active' && Date.parse(review.rewardExpiresAt) <= Date.now()) ||
    (review.rewardMessageAvailable && review.rewardStatus !== 'active')
  ) return invalid()
  if (!validDate(review.createdAt) || !validDate(review.updatedAt)) return invalid()
  return {
    id: review.id,
    sourceType: review.sourceType,
    rating: review.rating as AdminReview['rating'],
    body: review.body,
    displayName: review.displayName,
    hasPhoto: review.hasPhoto,
    photoPublishConsent: review.photoPublishConsent,
    publishConsent: review.publishConsent,
    moderationStatus: review.moderationStatus as AdminReviewStatus,
    rewardPercent: review.rewardPercent,
    rewardCodeLast4: review.rewardCodeLast4 as string | null,
    rewardStatus: review.rewardStatus as AdminRewardStatus,
    rewardExpiresAt: review.rewardExpiresAt as string | null,
    rewardMessageAvailable: review.rewardMessageAvailable,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }
}

export function parseAdminReviewListResult(value: unknown): AdminReviewPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const page = value as Record<string, unknown>
  if (Object.keys(page).length !== 2 || !Array.isArray(page.reviews) || page.reviews.length > 20) return invalid()
  if (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !REF_PATTERN.test(page.nextCursor))) return invalid()
  return { reviews: page.reviews.map(parseAdminReviewResult), nextCursor: page.nextCursor as string | null }
}

export function buildListAdminReviewsPayload(moderationStatus: AdminReviewFilter, cursor?: string) {
  return {
    action: 'list-admin-reviews' as const,
    data: { moderationStatus, limit: 20 as const, ...(cursor ? { cursor } : {}) },
  }
}

export function buildModerateReviewPayload(reviewId: string, moderationStatus: AdminReviewStatus) {
  return { action: 'moderate-review' as const, data: { reviewId, moderationStatus } }
}

export function buildCopyReviewRewardMessagePayload(reviewId: string) {
  return { action: 'copy-review-reward-message' as const, data: { reviewId } }
}

export type AdminRewardMessage = { message: string }

export function parseCopyReviewRewardMessageResult(value: unknown): AdminRewardMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== 1 || typeof result.message !== 'string' ||
      !result.message || result.message.length > 500 || result.message.includes('\0')) return invalid()
  return { message: result.message }
}

async function execute<T>(executor: AdminReviewExecutor, functionId: string, payload: object, parse: (value: unknown) => T): Promise<T> {
  try {
    const execution = await executor.createExecution({ functionId, body: JSON.stringify(payload), async: false })
    if (execution.status !== 'completed' || execution.responseStatusCode !== 200) return invalid()
    const envelope = JSON.parse(execution.responseBody || '') as unknown
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return invalid()
    const body = envelope as Record<string, unknown>
    if (Object.keys(body).length !== 2 || body.ok !== true || !Object.hasOwn(body, 'result')) return invalid()
    return parse(body.result)
  } catch {
    throw new Error('ADMIN_REVIEWS_REQUEST_FAILED')
  }
}

export function listAdminReviews(executor: AdminReviewExecutor, functionId: string, status: AdminReviewFilter, cursor?: string) {
  return execute(executor, functionId, buildListAdminReviewsPayload(status, cursor), parseAdminReviewListResult)
}

export function moderateAdminReview(executor: AdminReviewExecutor, functionId: string, reviewId: string, status: AdminReviewStatus) {
  return execute(executor, functionId, buildModerateReviewPayload(reviewId, status), parseAdminReviewResult)
}

export function copyReviewRewardMessage(executor: AdminReviewExecutor, functionId: string, reviewId: string) {
  return execute(executor, functionId, buildCopyReviewRewardMessagePayload(reviewId), parseCopyReviewRewardMessageResult)
}

export function mergeAdminReviewPages(current: AdminReview[], incoming: AdminReview[]) {
  const merged = new Map(current.map((review) => [review.id, review]))
  for (const review of incoming) merged.set(review.id, review)
  return [...merged.values()]
}

export function moderationCompletionPlan(
  startedGeneration: number,
  currentGeneration: number,
  currentFilter: AdminReviewFilter,
) {
  return {
    applyToStartedGeneration: startedGeneration === currentGeneration,
    refetchFilter: currentFilter,
    refetchGeneration: currentGeneration,
  }
}

export function adminRewardStatusLabel(status: AdminRewardStatus) {
  if (status === 'active') return '사용 가능'
  if (status === 'redeemed') return '사용 완료'
  if (status === 'expired') return '만료'
  if (status === 'revoked') return '취소'
  return '확인 불가'
}

export function formatAdminRewardExpiry(value: string | null) {
  if (!value || !validDate(value)) return '확인 불가'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

type ClipboardWriter = { writeText(value: string): Promise<void> }
type EphemeralTextarea = {
  value: string
  style: Record<string, string> | CSSStyleDeclaration
  setAttribute(name: string, value: string): void
  select(): void
  remove(): void
}
type ClipboardDocument = {
  body?: { appendChild(node: EphemeralTextarea): unknown }
  createElement(tag: 'textarea'): EphemeralTextarea
  execCommand?(command: 'copy'): boolean
}

export async function copyAdminRewardMessage(
  message: string,
  dependencies: { clipboard?: ClipboardWriter; document?: ClipboardDocument } = {},
) {
  if (typeof message !== 'string' || !message) throw new Error('ADMIN_REWARD_COPY_FAILED')
  const clipboard = dependencies.clipboard ?? globalThis.navigator?.clipboard
  const documentLike: ClipboardDocument | undefined = dependencies.document ??
    (globalThis.document as unknown as ClipboardDocument | undefined)
  if (clipboard) {
    try {
      await clipboard.writeText(message)
      return
    } catch {
      // Insecure Tailscale HTTP origins can expose the API but reject writes. Fall through.
    }
  }
  if (!documentLike?.body || typeof documentLike.execCommand !== 'function') {
    throw new Error('ADMIN_REWARD_COPY_FAILED')
  }
  const textarea = documentLike.createElement('textarea')
  textarea.value = message
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  documentLike.body.appendChild(textarea)
  try {
    textarea.select()
    if (!documentLike.execCommand('copy')) throw new Error('ADMIN_REWARD_COPY_FAILED')
  } catch {
    throw new Error('ADMIN_REWARD_COPY_FAILED')
  } finally {
    textarea.remove()
  }
}
