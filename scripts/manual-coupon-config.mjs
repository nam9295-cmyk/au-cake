import {
  digestReviewCouponCode,
  resolveReviewCouponHmacSecret,
} from '../functions/reservation-api/src/coupon-digest.js'

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const SYDNEY_TIME_ZONE = 'Australia/Sydney'

export const MANUAL_COUPON_PATTERN = /^JENNIE[A-Z0-9]{5}$/
export const REQUIRED_MANUAL_COUPON_APPLY_ENVIRONMENT = Object.freeze([
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_CAKE_DATABASE_ID',
  'REVIEW_COUPON_HMAC_SECRET',
  'MANUAL_COUPON_CODE',
])

export class ManualCouponConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ManualCouponConfigError'
  }
}

function required(env, key) {
  const value = typeof env[key] === 'string' ? env[key] : ''
  if (!value.trim()) throw new ManualCouponConfigError(`${key} is required.`)
  return value
}

function resourceId(env, key, defaultValue) {
  const value = env[key] === undefined && defaultValue !== undefined
    ? defaultValue
    : required(env, key)
  if (value !== value.trim() || !RESOURCE_ID_PATTERN.test(value)) {
    throw new ManualCouponConfigError(`${key} must be a valid Appwrite resource ID.`)
  }
  return value
}

function appwriteEndpoint(env) {
  const value = required(env, 'APPWRITE_ENDPOINT')
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new ManualCouponConfigError('APPWRITE_ENDPOINT must be a valid HTTP(S) URL without userinfo.')
  }
  if (
    value !== value.trim() ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new ManualCouponConfigError('APPWRITE_ENDPOINT must be a valid HTTP(S) URL without userinfo.')
  }
  return value
}

export function resolveManualCouponApplyConfig(env = {}) {
  const code = required(env, 'MANUAL_COUPON_CODE')
  if (!MANUAL_COUPON_PATTERN.test(code)) {
    throw new ManualCouponConfigError('MANUAL_COUPON_CODE must match the approved manual coupon format.')
  }

  let hmacSecret
  try {
    hmacSecret = resolveReviewCouponHmacSecret(env)
  } catch {
    throw new ManualCouponConfigError(
      'REVIEW_COUPON_HMAC_SECRET must be canonical unpadded base64url encoding of at least 32 bytes.',
    )
  }

  return Object.freeze({
    endpoint: appwriteEndpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    apiKey: required(env, 'APPWRITE_API_KEY'),
    databaseId: resourceId(env, 'APPWRITE_CAKE_DATABASE_ID'),
    collectionId: resourceId(env, 'APPWRITE_MANUAL_COUPONS_TABLE_ID', 'manual_coupons'),
    hmacSecret,
    code,
  })
}

export function hashManualCouponCode(code, hmacSecret) {
  if (typeof code !== 'string' || !MANUAL_COUPON_PATTERN.test(code)) {
    throw new ManualCouponConfigError('MANUAL_COUPON_CODE must match the approved manual coupon format.')
  }
  return digestReviewCouponCode(code, hmacSecret)
}

const sydneyFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function sydneyParts(value) {
  const parts = Object.fromEntries(sydneyFormatter.formatToParts(value)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]))
  return { ...parts, millisecond: value.getUTCMilliseconds() }
}

function partsAsUtc(parts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
}

function candidatesForSydneyParts(parts) {
  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(sydneyParts(new Date(instant))) - instant)
  }
  return [...offsets]
    .map((offset) => target - offset)
    .filter((candidate) => partsAsUtc(sydneyParts(new Date(candidate))) === target)
    .sort((left, right) => left - right)
}

function fromSydneyParts(parts) {
  const candidates = candidatesForSydneyParts(parts)
  if (candidates.length > 0) return new Date(candidates[0])

  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(sydneyParts(new Date(instant))) - instant)
  }
  const sortedOffsets = [...offsets].sort((left, right) => left - right)
  const gap = sortedOffsets.at(-1) - sortedOffsets[0]
  const shifted = new Date(target + gap)
  const shiftedParts = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  const shiftedCandidates = candidatesForSydneyParts(shiftedParts)
  if (gap <= 0 || shiftedCandidates.length === 0) {
    throw new RangeError('Sydney date-time could not be resolved')
  }
  return new Date(shiftedCandidates[0])
}

export function addSydneyCalendarDays(value, days) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()) || !Number.isInteger(days)) {
    throw new RangeError('Sydney date and calendar-day count must be valid')
  }
  const parts = sydneyParts(value)
  const shifted = new Date(partsAsUtc({ ...parts, day: parts.day + days }))
  return fromSydneyParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  })
}

export function buildManualCouponDocument({ config, now = new Date() }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ManualCouponConfigError('Issuance time must be valid.')
  }
  return {
    codeHash: hashManualCouponCode(config.code, config.hmacSecret),
    codeLast4: config.code.slice(-4),
    rewardPercent: 5,
    scope: 'cake',
    status: 'active',
    expiresAt: addSydneyCalendarDays(now, 30).toISOString(),
    createdAt: now.toISOString(),
  }
}

export function maskIdentifier(value) {
  const text = String(value ?? '')
  if (!text) return '(missing)'
  if (text.length <= 4) return '••••'
  return `${text.slice(0, 2)}…${text.slice(-2)}`
}

export function buildManualCouponDryRunPlan() {
  return {
    mode: 'dry-run',
    applyRequired: true,
    network: false,
    dotenvLoaded: false,
    sdkLoaded: false,
    couponCodeAccessed: false,
    identifiersGenerated: false,
    writes: false,
    collectionPermissionChanges: false,
    requiredApplyEnvironment: [...REQUIRED_MANUAL_COUPON_APPLY_ENVIRONMENT],
    operation: {
      lookup: 'query existing private manual_coupons by codeHash',
      onDuplicate: 'refuse without update or reactivation',
      onMissing: 'create one private 5% cake-only active coupon document',
      expiry: '30 Australia/Sydney calendar days from issuance',
      optionalEncryptionEnvelope: 'absent',
    },
    sideEffectBoundary: '--apply loads dotenv, validates all configuration and code, then loads the SDK and may query/create.',
  }
}
