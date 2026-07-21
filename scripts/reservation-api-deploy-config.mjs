const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

export const FUNCTION_SCOPES = Object.freeze([
  'databases.read',
  'databases.write',
  'collections.read',
  'attributes.read',
  'indexes.read',
  'documents.read',
  'documents.write',
])

const ID_VARIABLES = Object.freeze({
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
  APPWRITE_SETTINGS_TABLE_ID: 'settings',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_KIDS_BOOKED_DATES_TABLE_ID: 'class_booked_dates',
  APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID: 'cake_pickup_openings',
  APPWRITE_REVIEW_COUPONS_TABLE_ID: 'review_coupons',
  APPWRITE_MANUAL_COUPONS_TABLE_ID: 'manual_coupons',
})

export const REQUIRED_APPLY_ENVIRONMENT = Object.freeze([
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_CAKE_DATABASE_ID',
  'APPWRITE_KIDS_DATABASE_ID',
  'CALENDAR_VIEW_PIN',
  'CALENDAR_TOKEN_SECRET',
  'REVIEW_COUPON_HMAC_SECRET',
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
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('APPWRITE_ENDPOINT must be a valid HTTP(S) URL without userinfo.')
  }
  return value
}

function transactionCompatibleRuntime(env) {
  const value = String(env.APPWRITE_RESERVATION_API_RUNTIME || 'node-16.0').trim()
  if (value !== 'node-16.0') {
    throw new Error('APPWRITE_RESERVATION_API_RUNTIME must be node-16.0 for this self-hosted Appwrite deployment.')
  }
  return value
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

export function isSecretFunctionVariable(key) {
  return key === 'CALENDAR_VIEW_PIN' || key === 'CALENDAR_TOKEN_SECRET' || key === 'REVIEW_COUPON_HMAC_SECRET'
}

export function resolveDeployConfig(env = {}) {
  const cakeDatabaseId = resourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const kidsDatabaseId = resourceId(env, 'APPWRITE_KIDS_DATABASE_ID')
  const pin = required(env, 'CALENDAR_VIEW_PIN')
  const tokenSecret = required(env, 'CALENDAR_TOKEN_SECRET')
  if (!/^\d{6}$/.test(pin)) throw new Error('CALENDAR_VIEW_PIN must contain exactly 6 digits.')
  if (tokenSecret.length < 32) throw new Error('CALENDAR_TOKEN_SECRET must be at least 32 characters.')

  return {
    endpoint: endpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    apiKey: required(env, 'APPWRITE_API_KEY'),
    functionId: resourceId(env, 'APPWRITE_RESERVATION_API_FUNCTION_ID', 'reservation-api'),
    runtime: transactionCompatibleRuntime(env),
    runtimeVariables: {
      MARKET: String(env.MARKET || 'AU').trim(),
      APPWRITE_CAKE_DATABASE_ID: cakeDatabaseId,
      APPWRITE_KIDS_DATABASE_ID: kidsDatabaseId,
      ...Object.fromEntries(Object.entries(ID_VARIABLES).map(([key, fallback]) => [key, resourceId(env, key, fallback)])),
      CALENDAR_VIEW_PIN: pin,
      CALENDAR_TOKEN_SECRET: tokenSecret,
      REVIEW_COUPON_HMAC_SECRET: couponHmacSecret(env),
    },
  }
}

export function buildRuntimeCandidates(configuredRuntime, runtimes = {}) {
  void runtimes
  return [configuredRuntime]
}

function maskValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return '(missing)'
  if (text.length <= 4) return '••••'
  return `${text.slice(0, 2)}…${text.slice(-2)}`
}

export function redactReservationDeploymentDiagnostic(value, secrets = []) {
  const stripControls = (text) => text.replace(/[\u0000-\u000d\u000e-\u001f\u007f]/g, '')
  let output = stripControls(String(value ?? ''))
  const orderedSecrets = [...new Set(secrets
    .map((secret) => stripControls(String(secret ?? '')))
    .filter((secret) => secret.length >= 4))]
    .sort((left, right) => right.length - left.length)
  for (const secret of orderedSecrets) output = output.split(secret).join('[REDACTED]')
  output = stripControls(output
    .replace(/(REVIEW_COUPON_HMAC_SECRET|APPWRITE_API_KEY|CALENDAR_TOKEN_SECRET)\s*[=:]\s*[^\s]+/gi, '$1=[REDACTED]'))
  return output.slice(0, 1200)
}

export function buildDryRunPlan(env = {}) {
  const variableValues = {
    MARKET: env.MARKET || 'AU',
    APPWRITE_CAKE_DATABASE_ID: env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_KIDS_DATABASE_ID: env.APPWRITE_KIDS_DATABASE_ID,
    ...Object.fromEntries(Object.entries(ID_VARIABLES).map(([key, fallback]) => [key, env[key] || fallback])),
    CALENDAR_VIEW_PIN: env.CALENDAR_VIEW_PIN,
    CALENDAR_TOKEN_SECRET: env.CALENDAR_TOKEN_SECRET,
    REVIEW_COUPON_HMAC_SECRET: env.REVIEW_COUPON_HMAC_SECRET,
  }
  return {
    mode: 'dry-run',
    network: false,
    dotenvLoaded: false,
    collectionPermissionChanges: false,
    requiredApplyEnvironment: [...REQUIRED_APPLY_ENVIRONMENT],
    wouldFailApply: REQUIRED_APPLY_ENVIRONMENT.some((key) => !String(env[key] || '').trim()),
    function: {
      id: maskValue(env.APPWRITE_RESERVATION_API_FUNCTION_ID || 'reservation-api'),
      runtime: env.APPWRITE_RESERVATION_API_RUNTIME || 'node-16.0',
      source: 'functions/reservation-api/{package.json,package-lock.json,src/**}',
      scopes: [...FUNCTION_SCOPES],
      variableNames: Object.keys(variableValues),
      maskedVariables: Object.fromEntries(Object.entries(variableValues).map(([key, value]) => [key, maskValue(value)])),
    },
    notes: [
      'No Appwrite client or network operation is created in dry-run mode.',
      'Review coupons remain private; this deploy never changes collection permissions.',
    ],
  }
}
