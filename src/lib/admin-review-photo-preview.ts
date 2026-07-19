const MAX_PREVIEW_BYTES = 1_500_000
const REVIEW_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

type JwtAccount = { createJWT(): Promise<{ jwt: string }> }

type PreviewRequest = {
  directUrl: string
  development: boolean
  reviewId: string
  account: JwtAccount
  fetchFn?: typeof fetch
  signal?: AbortSignal
}

function invalidResponse(): never {
  throw new Error('INVALID_REVIEW_PHOTO_RESPONSE')
}

export function validateAdminReviewPhotoUrl(value: string, development: boolean): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('INVALID_REVIEW_PHOTO_URL')
  }
  const localDevelopment = development && url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
  if ((url.protocol !== 'https:' && !localDevelopment) || url.username || url.password) {
    throw new Error('INVALID_REVIEW_PHOTO_URL')
  }
  return url.toString()
}

export async function fetchAdminReviewPhotoBlob({
  directUrl,
  development,
  reviewId,
  account,
  fetchFn = fetch,
  signal,
}: PreviewRequest): Promise<Blob> {
  const url = validateAdminReviewPhotoUrl(directUrl, development)
  if (!REVIEW_ID.test(reviewId)) invalidResponse()
  const jwtResult = await account.createJWT()
  if (!jwtResult || typeof jwtResult.jwt !== 'string' || !jwtResult.jwt) invalidResponse()
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-appwrite-user-jwt': jwtResult.jwt,
    },
    body: JSON.stringify({ reviewId }),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (response.status !== 200 || response.headers.get('content-type')?.trim().toLowerCase() !== 'image/webp') {
    invalidResponse()
  }
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_PREVIEW_BYTES)) {
    invalidResponse()
  }
  const blob = await response.blob()
  if (blob.type.toLowerCase() !== 'image/webp' || blob.size > MAX_PREVIEW_BYTES) invalidResponse()
  return blob
}

type PreviewControllerDependencies = {
  loadBlob(reviewId: string, signal: AbortSignal): Promise<Blob>
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

export function createAdminPhotoPreviewController(dependencies: PreviewControllerDependencies) {
  let generation = 0
  let activeAbort: AbortController | null = null
  let activeUrl: string | null = null
  let disposed = false

  function clear() {
    generation += 1
    activeAbort?.abort()
    activeAbort = null
    if (activeUrl) dependencies.revokeObjectURL(activeUrl)
    activeUrl = null
  }

  return {
    async load(reviewId: string) {
      clear()
      if (disposed) return null
      const currentGeneration = generation
      const abort = new AbortController()
      activeAbort = abort
      try {
        const blob = await dependencies.loadBlob(reviewId, abort.signal)
        if (disposed || abort.signal.aborted || currentGeneration !== generation) return null
        const nextUrl = dependencies.createObjectURL(blob)
        if (disposed || abort.signal.aborted || currentGeneration !== generation) {
          dependencies.revokeObjectURL(nextUrl)
          return null
        }
        if (activeUrl) dependencies.revokeObjectURL(activeUrl)
        activeUrl = nextUrl
        return nextUrl
      } finally {
        if (activeAbort === abort) activeAbort = null
      }
    },
    clear,
    dispose() {
      disposed = true
      clear()
    },
  }
}
