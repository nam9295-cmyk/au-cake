export type PublicReview = {
  sourceType: 'cake' | 'class'
  rating: 1 | 2 | 3 | 4 | 5
  body: string
  displayName: string
  createdAt: string
  incentivised: true
  hasPhoto: boolean
  photoUrl: string | null
}

type ReviewExecution = {
  status?: string
  responseStatusCode?: number
  responseBody?: string
}

export type PublicReviewExecutor = {
  createExecution(input: { functionId: string; body: string; async: false }): Promise<ReviewExecution>
}

const PUBLIC_REVIEW_KEYS = new Set([
  'sourceType', 'rating', 'body', 'displayName', 'createdAt', 'incentivised', 'hasPhoto', 'photoUrl',
])

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

export function buildListPublicReviewsPayload() {
  return { action: 'list-public' as const, limit: 3 as const }
}

export function parsePublicReviewsResult(value: unknown, functionEndpoint: string, pageOrigin = ''): PublicReview[] {
  if (!Array.isArray(value) || value.length > 3) return invalidResponse()

  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return invalidResponse()
    const review = item as Record<string, unknown>
    const keys = Object.keys(review)
    if (keys.length !== PUBLIC_REVIEW_KEYS.size || keys.some((key) => !PUBLIC_REVIEW_KEYS.has(key))) return invalidResponse()
    if (review.sourceType !== 'cake' && review.sourceType !== 'class') return invalidResponse()
    if (!Number.isInteger(review.rating) || Number(review.rating) < 1 || Number(review.rating) > 5) return invalidResponse()
    if (typeof review.body !== 'string' || !review.body.trim() || review.body.length > 2000) return invalidResponse()
    if (typeof review.displayName !== 'string' || !review.displayName.trim() || review.displayName.length > 50) return invalidResponse()
    if (typeof review.createdAt !== 'string' || Number.isNaN(Date.parse(review.createdAt))) return invalidResponse()
    if (review.incentivised !== true || typeof review.hasPhoto !== 'boolean') return invalidResponse()
    if (review.hasPhoto === false && review.photoUrl !== null) return invalidResponse()
    if (review.hasPhoto === true && (typeof review.photoUrl !== 'string' || !trustedPhotoUrl(review.photoUrl, functionEndpoint, pageOrigin))) {
      return invalidResponse()
    }

    return {
      sourceType: review.sourceType,
      rating: review.rating as PublicReview['rating'],
      body: review.body,
      displayName: review.displayName,
      createdAt: review.createdAt,
      incentivised: true,
      hasPhoto: review.hasPhoto,
      photoUrl: review.photoUrl as string | null,
    }
  })
}

export async function listPublicReviews(
  executor: PublicReviewExecutor,
  functionId: string,
  functionEndpoint: string,
  pageOrigin = typeof window === 'undefined' ? '' : window.location.origin,
): Promise<PublicReview[]> {
  const execution = await executor.createExecution({
    functionId,
    body: JSON.stringify(buildListPublicReviewsPayload()),
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
  return parsePublicReviewsResult(envelope.result, functionEndpoint, pageOrigin)
}
