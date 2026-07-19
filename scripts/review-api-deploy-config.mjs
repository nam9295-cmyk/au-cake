const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

export const FUNCTION_SCOPES = Object.freeze([
  'databases.read',
  'databases.write',
  'documents.read',
  'documents.write',
  'files.read',
  'files.write',
])

export const ARCHIVE_SOURCE_ENTRIES = Object.freeze([
  'package.json',
  'package-lock.json',
  'src',
])

export const DEPLOYMENT_OPERATIONS = Object.freeze([
  'functions.get',
  'functions.create-or-update',
  'functions.variables.upsert',
  'functions.deployments.create',
  'functions.deployments.get',
])

export const REQUIRED_APPLY_ENVIRONMENT = Object.freeze([
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_CAKE_DATABASE_ID',
  'APPWRITE_KIDS_DATABASE_ID',
  'REVIEW_ADMIN_USER_IDS',
  'REVIEW_FRONTEND_ORIGINS',
  'REVIEW_COUPON_HMAC_SECRET',
  'REVIEW_COUPON_ENCRYPTION_KEY',
])

const ID_VARIABLES = Object.freeze({
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_REVIEW_INVITES_TABLE_ID: 'review_invites',
  APPWRITE_REVIEWS_TABLE_ID: 'reviews',
  APPWRITE_REVIEW_COUPONS_TABLE_ID: 'review_coupons',
  APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID: 'review_photo_cleanup',
  APPWRITE_REVIEW_PHOTOS_BUCKET_ID: 'review-photos',
})

const PRESERVED_FUNCTION_FIELDS = Object.freeze([
  'events',
  'schedule',
  'timeout',
  'enabled',
  'logging',
  'installationId',
  'providerRepositoryId',
  'providerBranch',
  'providerSilentMode',
  'providerRootDirectory',
  'specification',
])

function required(env, key) {
  const value = String(env[key] ?? '').trim()
  if (!value) throw new Error(`${key} is required.`)
  return value
}

function resourceId(env, key, fallback) {
  const value = String(env[key] ?? fallback ?? '').trim()
  if (!value || !RESOURCE_ID.test(value)) throw new Error(`${key} must be a valid Appwrite resource ID.`)
  return value
}

function endpoint(env) {
  const value = required(env, 'APPWRITE_ENDPOINT')
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol')
    if (parsed.username || parsed.password) {
      throw new Error('APPWRITE_ENDPOINT must not contain username/password userinfo.')
    }
  } catch (error) {
    if (error instanceof Error && /userinfo/.test(error.message)) throw error
    throw new Error('APPWRITE_ENDPOINT must be a valid HTTP(S) URL.')
  }
  return value
}

function adminUserIds(env) {
  const raw = required(env, 'REVIEW_ADMIN_USER_IDS')
  const ids = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))]
  if (ids.length === 0 || ids.some((id) => !RESOURCE_ID.test(id))) {
    throw new Error('REVIEW_ADMIN_USER_IDS must contain valid comma-separated Appwrite user IDs.')
  }
  return ids
}

function frontendOrigins(env) {
  const values = [...new Set(required(env, 'REVIEW_FRONTEND_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean))]
  if (values.length === 0) throw new Error('REVIEW_FRONTEND_ORIGINS must contain exact HTTPS origins.')
  for (const value of values) {
    let parsed
    try { parsed = new URL(value) } catch { throw new Error('REVIEW_FRONTEND_ORIGINS must contain exact HTTPS origins.') }
    if (value.includes('*') || parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password) {
      throw new Error('REVIEW_FRONTEND_ORIGINS must contain exact HTTPS origins.')
    }
  }
  return values.join(',')
}

function couponHmacSecret(env) {
  const encoded = typeof env.REVIEW_COUPON_HMAC_SECRET === 'string' ? env.REVIEW_COUPON_HMAC_SECRET : ''
  let decoded
  try {
    decoded = /^[A-Za-z0-9_-]{43,}$/.test(encoded) ? Buffer.from(encoded, 'base64url') : null
  } catch {
    decoded = null
  }
  if (!decoded || decoded.length < 32 || decoded.toString('base64url') !== encoded) {
    throw new Error('REVIEW_COUPON_HMAC_SECRET must be canonical base64url encoding of at least 32 bytes.')
  }
  return encoded
}

function couponEncryptionKey(env, hmacSecret) {
  const encoded = typeof env.REVIEW_COUPON_ENCRYPTION_KEY === 'string' ? env.REVIEW_COUPON_ENCRYPTION_KEY : ''
  let decoded
  try {
    decoded = /^[A-Za-z0-9_-]{43}$/.test(encoded) ? Buffer.from(encoded, 'base64url') : null
  } catch {
    decoded = null
  }
  if (!decoded || decoded.length !== 32 || decoded.toString('base64url') !== encoded) {
    throw new Error('REVIEW_COUPON_ENCRYPTION_KEY must be canonical unpadded base64url encoding of exactly 32 bytes.')
  }
  if (encoded === hmacSecret) {
    throw new Error('REVIEW_COUPON_ENCRYPTION_KEY must be independent from REVIEW_COUPON_HMAC_SECRET.')
  }
  return encoded
}

function sharpCompatibleRuntime(env) {
  const value = String(env.APPWRITE_REVIEW_API_RUNTIME || 'node-16.0').trim()
  if (value !== 'node-16.0') {
    throw new Error('APPWRITE_REVIEW_API_RUNTIME must be node-16.0 for this self-hosted Appwrite deployment.')
  }
  return value
}

export function resolveDeployConfig(env = {}) {
  const admins = adminUserIds(env)
  const origins = frontendOrigins(env)
  const hmacSecret = couponHmacSecret(env)
  const encryptionKey = couponEncryptionKey(env, hmacSecret)
  const cakeDatabaseId = resourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const kidsDatabaseId = resourceId(env, 'APPWRITE_KIDS_DATABASE_ID')
  const collectionIds = Object.fromEntries(
    Object.entries(ID_VARIABLES).map(([key, fallback]) => [key, resourceId(env, key, fallback)]),
  )

  return {
    endpoint: endpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    apiKey: required(env, 'APPWRITE_API_KEY'),
    functionId: resourceId(env, 'APPWRITE_REVIEW_API_FUNCTION_ID', 'review-api'),
    runtime: sharpCompatibleRuntime(env),
    adminUserIds: admins,
    runtimeVariables: {
      APPWRITE_PUBLIC_ENDPOINT: endpoint(env),
      APPWRITE_CAKE_DATABASE_ID: cakeDatabaseId,
      APPWRITE_KIDS_DATABASE_ID: kidsDatabaseId,
      ...collectionIds,
      REVIEW_ADMIN_USER_IDS: admins.join(','),
      REVIEW_FRONTEND_ORIGINS: origins,
      REVIEW_COUPON_HMAC_SECRET: hmacSecret,
      REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey,
    },
  }
}

export function buildRuntimeCandidates(configuredRuntime, runtimes = {}) {
  void runtimes
  return [configuredRuntime]
}

export function buildCreateFunctionPayload(runtime, publicExecuteRole) {
  return {
    name: 'Review API',
    runtime,
    execute: [publicExecuteRole],
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: [...FUNCTION_SCOPES],
  }
}

export function buildUpdateFunctionPayload(existing, runtime, publicExecuteRole) {
  const payload = buildCreateFunctionPayload(runtime, publicExecuteRole)
  for (const key of PRESERVED_FUNCTION_FIELDS) {
    if (existing[key] !== undefined) payload[key] = existing[key]
  }
  return payload
}

export function isSecretFunctionVariable(key) {
  return key === 'REVIEW_ADMIN_USER_IDS' ||
    key === 'REVIEW_COUPON_HMAC_SECRET' ||
    key === 'REVIEW_COUPON_ENCRYPTION_KEY'
}

export function maskValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return '(missing)'
  if (text.length <= 4) return '••••'
  return `${text.slice(0, 2)}…${text.slice(-2)}`
}

export function buildDryRunPlan(env = {}) {
  const functionId = env.APPWRITE_REVIEW_API_FUNCTION_ID || 'review-api'
  const variableValues = {
    APPWRITE_PUBLIC_ENDPOINT: env.APPWRITE_ENDPOINT,
    APPWRITE_CAKE_DATABASE_ID: env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_KIDS_DATABASE_ID: env.APPWRITE_KIDS_DATABASE_ID,
    ...Object.fromEntries(Object.entries(ID_VARIABLES).map(([key, fallback]) => [key, env[key] || fallback])),
    REVIEW_ADMIN_USER_IDS: env.REVIEW_ADMIN_USER_IDS,
    REVIEW_FRONTEND_ORIGINS: env.REVIEW_FRONTEND_ORIGINS,
    REVIEW_COUPON_HMAC_SECRET: env.REVIEW_COUPON_HMAC_SECRET,
    REVIEW_COUPON_ENCRYPTION_KEY: env.REVIEW_COUPON_ENCRYPTION_KEY,
  }
  const admins = String(env.REVIEW_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)

  return {
    mode: 'dry-run',
    network: false,
    dotenvLoaded: false,
    collectionPermissionChanges: false,
    operations: [...DEPLOYMENT_OPERATIONS],
    requiredApplyEnvironment: [...REQUIRED_APPLY_ENVIRONMENT],
    wouldFailApply: REQUIRED_APPLY_ENVIRONMENT.some((key) => !String(env[key] || '').trim()),
    function: {
      id: maskValue(functionId),
      source: 'functions/review-api/{package.json,package-lock.json,src/**}',
      entrypoint: 'src/main.js',
      installCommand: 'npm ci --omit=dev',
      scopes: [...FUNCTION_SCOPES],
      variableNames: Object.keys(variableValues),
      maskedVariables: Object.fromEntries(
        Object.entries(variableValues).map(([key, value]) => [key, maskValue(value)]),
      ),
      reviewAdminUserCount: new Set(admins).size,
    },
    notes: [
      'Creates or updates the Function idempotently while preserving non-rollout Function settings, then creates and polls one deployment.',
      'Does not create, update, or delete collection permissions.',
      'Actual apply requires explicit approval; this plan performs no client or network work.',
    ],
  }
}

export function sanitizeDeploymentLogs(logs, sensitiveValues = [], maxLength = 480) {
  let sanitized = String(logs || 'No build log was returned.')
  const values = [...new Set(sensitiveValues.map((value) => String(value || '')).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  for (const value of values) sanitized = sanitized.split(value).join('[REDACTED]')
  if (sanitized.length > maxLength) sanitized = `${sanitized.slice(0, Math.max(0, maxLength - 12))}…[truncated]`
  return sanitized
}

export function evaluateDeploymentStatus(deployment, attempt, maxAttempts, sensitiveValues = []) {
  if (deployment.status === 'ready') return 'ready'
  if (deployment.status === 'failed' || deployment.status === 'canceled') {
    const logs = sanitizeDeploymentLogs(deployment.buildLogs, sensitiveValues)
    throw new Error(`Review API build ${deployment.status}:\n${logs}`)
  }
  if (!['waiting', 'processing', 'building'].includes(deployment.status)) {
    throw new Error(`Unexpected Review API deployment status: ${maskValue(deployment.status)}`)
  }
  if (attempt >= maxAttempts) {
    throw new Error(`Review API deployment did not become ready within ${maxAttempts * 2} seconds.`)
  }
  return 'pending'
}
