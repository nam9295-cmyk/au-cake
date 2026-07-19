export type PublicReview = {
  id: string
  sourceType: 'cake' | 'class'
  rating: 1 | 2 | 3 | 4 | 5
  body: string
  displayName: string
  createdAt: string
  incentivised: true
  hasPhoto: boolean
  thumbnailUrl: string | null
  photoUrl: string | null
}

export type PublicReviewsPage = {
  reviews: PublicReview[]
  nextCursor: string | null
  hasMore: boolean
}

type ReviewExecution = {
  status?: string
  responseStatusCode?: number
  responseBody?: string
}

export type PublicReviewExecutor = {
  createExecution(input: { functionId: string; body: string; async: false }): Promise<ReviewExecution>
}

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const PUBLIC_REVIEW_KEYS = new Set([
  'id', 'sourceType', 'rating', 'body', 'displayName', 'createdAt', 'incentivised', 'hasPhoto', 'thumbnailUrl', 'photoUrl',
])
const PUBLIC_PAGE_KEYS = new Set(['reviews', 'nextCursor', 'hasMore'])

function invalidResponse(): never {
  throw new Error('INVALID_PUBLIC_REVIEWS_RESPONSE')
}

function trustedPhotoUrl(value: string, functionEndpoint: string, pageOrigin: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const trustedOrigins = new Set<string>()
    for (const candidate of [functionEndpoint, pageOrigin]) {
      try {
        const origin = new URL(candidate).origin
        if (origin.startsWith('https://')) trustedOrigins.add(origin)
      } catch { /* an absent optional origin is not trusted */ }
    }
    return trustedOrigins.has(url.origin)
  } catch {
    return false
  }
}

export function buildListPublicReviewsPayload(limit = 3, cursor?: string) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 6 ||
      (cursor !== undefined && !OPAQUE_ID_PATTERN.test(cursor))) invalidResponse()
  return {
    action: 'list-public-page' as const,
    limit,
    ...(cursor ? { cursor } : {}),
  }
}

function parsePublicReview(item: unknown, functionEndpoint: string, pageOrigin: string): PublicReview {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return invalidResponse()
  const review = item as Record<string, unknown>
  const keys = Object.keys(review)
  if (keys.length !== PUBLIC_REVIEW_KEYS.size || keys.some((key) => !PUBLIC_REVIEW_KEYS.has(key))) return invalidResponse()
  if (typeof review.id !== 'string' || !OPAQUE_ID_PATTERN.test(review.id)) return invalidResponse()
  if (review.sourceType !== 'cake' && review.sourceType !== 'class') return invalidResponse()
  if (!Number.isInteger(review.rating) || Number(review.rating) < 1 || Number(review.rating) > 5) return invalidResponse()
  if (typeof review.body !== 'string' || !review.body.trim() || review.body.length > 2000) return invalidResponse()
  if (typeof review.displayName !== 'string' || !review.displayName.trim() || review.displayName.length > 50) return invalidResponse()
  if (typeof review.createdAt !== 'string' || Number.isNaN(Date.parse(review.createdAt))) return invalidResponse()
  if (review.incentivised !== true || typeof review.hasPhoto !== 'boolean') return invalidResponse()
  if (review.hasPhoto === false && (review.thumbnailUrl !== null || review.photoUrl !== null)) return invalidResponse()
  if (review.hasPhoto === true && (
    typeof review.thumbnailUrl !== 'string' || !trustedPhotoUrl(review.thumbnailUrl, functionEndpoint, pageOrigin) ||
    typeof review.photoUrl !== 'string' || !trustedPhotoUrl(review.photoUrl, functionEndpoint, pageOrigin)
  )) return invalidResponse()

  return {
    id: review.id,
    sourceType: review.sourceType,
    rating: review.rating as PublicReview['rating'],
    body: review.body,
    displayName: review.displayName,
    createdAt: review.createdAt,
    incentivised: true,
    hasPhoto: review.hasPhoto,
    thumbnailUrl: review.thumbnailUrl as string | null,
    photoUrl: review.photoUrl as string | null,
  }
}

export function parsePublicReviewsPageResult(
  value: unknown,
  limit: number,
  functionEndpoint: string,
  pageOrigin = '',
): PublicReviewsPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  const page = value as Record<string, unknown>
  const pageKeys = Object.keys(page)
  if (pageKeys.length !== PUBLIC_PAGE_KEYS.size || pageKeys.some((key) => !PUBLIC_PAGE_KEYS.has(key))) return invalidResponse()
  if (!Array.isArray(page.reviews) || page.reviews.length > limit || typeof page.hasMore !== 'boolean') return invalidResponse()
  const reviews = page.reviews.map((item) => parsePublicReview(item, functionEndpoint, pageOrigin))
  if (page.hasMore) {
    if (reviews.length === 0 || typeof page.nextCursor !== 'string' || !OPAQUE_ID_PATTERN.test(page.nextCursor) ||
        page.nextCursor !== reviews.at(-1)?.id) return invalidResponse()
  } else if (page.nextCursor !== null) {
    return invalidResponse()
  }
  return { reviews, nextCursor: page.nextCursor as string | null, hasMore: page.hasMore }
}

export async function listPublicReviewsPage(
  executor: PublicReviewExecutor,
  functionId: string,
  functionEndpoint: string,
  options: { limit?: number; cursor?: string; pageOrigin?: string } = {},
): Promise<PublicReviewsPage> {
  const limit = options.limit ?? 3
  const execution = await executor.createExecution({
    functionId,
    body: JSON.stringify(buildListPublicReviewsPayload(limit, options.cursor)),
    async: false,
  })
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200) return invalidResponse()
  let response: unknown
  try {
    response = JSON.parse(execution.responseBody || '')
  } catch {
    return invalidResponse()
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) return invalidResponse()
  const envelope = response as Record<string, unknown>
  if (Object.keys(envelope).length !== 2 || envelope.ok !== true || !Object.hasOwn(envelope, 'result')) return invalidResponse()
  const pageOrigin = options.pageOrigin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  return parsePublicReviewsPageResult(envelope.result, limit, functionEndpoint, pageOrigin)
}
