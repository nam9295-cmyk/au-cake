const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const MAX_REQUEST_BYTES = 1024
const MAX_JWT_LENGTH = 4096
const MAX_PREVIEW_BYTES = 1_500_000
const UNAVAILABLE = Object.freeze({ ok: false, code: 'PHOTO_PREVIEW_UNAVAILABLE' })

function configurationError() {
  const error = new Error('FUNCTION_CONFIGURATION_ERROR')
  error.code = 'FUNCTION_CONFIGURATION_ERROR'
  return error
}

export function parseFrontendOrigins(value) {
  const origins = [...new Set(String(value || '').split(',').map((origin) => origin.trim()).filter(Boolean))]
  if (origins.length === 0) throw configurationError()
  for (const origin of origins) {
    let url
    try { url = new URL(origin) } catch { throw configurationError() }
    if (origin === '*' || origin.includes('*') || url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
      throw configurationError()
    }
  }
  return origins
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  }
}

function jsonFailure(status, origin, includeCors = true) {
  return {
    status,
    headers: {
      ...(includeCors ? corsHeaders(origin) : {}),
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    json: UNAVAILABLE,
  }
}

function parseExactRequest(req) {
  if (req.method !== 'POST') return null
  const bytes = Buffer.byteLength(typeof req.bodyText === 'string' ? req.bodyText : '', 'utf8')
  if (bytes < 1 || bytes > MAX_REQUEST_BYTES) return null
  let body
  try { body = JSON.parse(req.bodyText) } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !RESOURCE_ID.test(body.reviewId)) return null
  const jwt = req.headers?.['x-appwrite-user-jwt']
  if (typeof jwt !== 'string' || jwt.length < 1 || jwt.length > MAX_JWT_LENGTH || /[\r\n]/.test(jwt)) return null
  return { reviewId: body.reviewId, jwt }
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  throw new Error('INVALID_PREVIEW')
}

export function createAdminPhotoPreviewDependencies({
  endpoint,
  projectId,
  bucketId,
  repository,
  storage,
  ClientClass,
  AccountClass,
}) {
  return {
    async authenticateJwt(jwt) {
      const client = new ClientClass().setEndpoint(endpoint).setProject(projectId).setJWT(jwt)
      return new AccountClass(client).get()
    },
    getReview(reviewId) {
      return repository.getReview(reviewId)
    },
    getFilePreview(fileId) {
      return storage.getFilePreview({ bucketId, fileId, output: 'webp' })
    },
  }
}

export function createAdminPhotoPreviewHandler(dependencies, env = process.env) {
  const origins = parseFrontendOrigins(env.REVIEW_FRONTEND_ORIGINS)
  const adminIds = new Set(String(env.REVIEW_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean))
  if (adminIds.size === 0 || [...adminIds].some((id) => !RESOURCE_ID.test(id))) throw configurationError()

  return async function handle(req) {
    const origin = req.headers?.origin
    if (typeof origin !== 'string' || !origins.includes(origin)) {
      return req.method === 'OPTIONS'
        ? { status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, json: UNAVAILABLE }
        : jsonFailure(403, '', false)
    }
    if (req.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          ...corsHeaders(origin),
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, x-appwrite-user-jwt',
          'access-control-max-age': '600',
        },
      }
    }

    const parsed = parseExactRequest(req)
    if (!parsed) return jsonFailure(400, origin)
    let user
    try { user = await dependencies.authenticateJwt(parsed.jwt) } catch { return jsonFailure(403, origin, false) }
    if (!user || typeof user.$id !== 'string' || !adminIds.has(user.$id)) return jsonFailure(403, origin, false)

    let review
    try { review = await dependencies.getReview(parsed.reviewId) } catch { return jsonFailure(404, origin) }
    if (!review || (review.$id || review.id) !== parsed.reviewId ||
        typeof review.photoFileId !== 'string' || !RESOURCE_ID.test(review.photoFileId)) {
      return jsonFailure(404, origin)
    }

    let preview
    try { preview = toBuffer(await dependencies.getFilePreview(review.photoFileId)) } catch { return jsonFailure(404, origin) }
    if (preview.byteLength < 1 || preview.byteLength > MAX_PREVIEW_BYTES) return jsonFailure(404, origin)
    return {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        'content-type': 'image/webp',
        'content-length': String(preview.byteLength),
        'cache-control': 'private, no-store, max-age=0',
        pragma: 'no-cache',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'referrer-policy': 'no-referrer',
      },
      binary: preview,
    }
  }
}
