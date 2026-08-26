import { EMAIL_DELIVERY_REQUIRED_FUNCTION_SCOPES } from '../appwrite-functions/shared/email-delivery.js'

const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

export const FUNCTION_SCOPES = Object.freeze([...EMAIL_DELIVERY_REQUIRED_FUNCTION_SCOPES])

export const ARCHIVE_SHARED_SOURCE_PATHS = Object.freeze([
  'appwrite-functions/shared/email-delivery.js',
  'appwrite-functions/shared/email-delivery-repository.js',
])

export const REQUIRED_APPLY_ENVIRONMENT = Object.freeze([
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_CAKE_DATABASE_ID',
  'REVIEW_ADMIN_USER_IDS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_TO_EMAILS',
])

function required(env, key) {
  const value = String(env[key] ?? '').trim()
  if (!value) throw new Error(`${key} is required.`)
  return value
}

function resourceId(env, key, fallback) {
  const value = String(env[key] || fallback || '').trim()
  if (!RESOURCE_ID.test(value)) throw new Error(`${key} must be a valid Appwrite resource ID.`)
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

function runtime(env) {
  const value = String(env.APPWRITE_RESERVATION_NOTIFY_RUNTIME || 'node-16.0').trim()
  if (value !== 'node-16.0') throw new Error('APPWRITE_RESERVATION_NOTIFY_RUNTIME must be node-16.0 for this Appwrite deployment.')
  return value
}

function market(env) {
  const value = String(env.MARKET || 'AU').trim().toUpperCase()
  if (!['AU', 'KR'].includes(value)) throw new Error('MARKET must be AU or KR.')
  return value
}

function adminUserIds(env) {
  const ids = [...new Set(required(env, 'REVIEW_ADMIN_USER_IDS').split(',').map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0 || ids.some((id) => !RESOURCE_ID.test(id))) {
    throw new Error('REVIEW_ADMIN_USER_IDS must contain valid comma-separated Appwrite user IDs.')
  }
  return ids
}

export function isSecretFunctionVariable(key) {
  return key === 'RESEND_API_KEY' || key === 'REVIEW_ADMIN_USER_IDS'
}

export function maskValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return '(missing)'
  if (text.length <= 4) return '••••'
  return `${text.slice(0, 2)}…${text.slice(-2)}`
}

export function resolveDeployConfig(env = {}) {
  const cakeDatabaseId = resourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const classDatabaseId = resourceId(env, 'APPWRITE_KIDS_DATABASE_ID', cakeDatabaseId)
  const cakeReservationsId = resourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID', 'reservations')
  const classReservationsId = resourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID', 'class_reservations')
  const admins = adminUserIds(env)
  return {
    endpoint: endpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    apiKey: required(env, 'APPWRITE_API_KEY'),
    functionId: resourceId(env, 'APPWRITE_RESERVATION_NOTIFY_FUNCTION_ID', 'reservation-notification'),
    runtime: runtime(env),
    adminExecuteRoles: admins.map((id) => `user:${id}`),
    eventResources: { cakeDatabaseId, classDatabaseId, cakeReservationsId, classReservationsId },
    runtimeVariables: {
      MARKET: market(env),
      APPWRITE_CAKE_DATABASE_ID: cakeDatabaseId,
      APPWRITE_KIDS_DATABASE_ID: classDatabaseId,
      APPWRITE_CAKE_RESERVATIONS_TABLE_ID: cakeReservationsId,
      APPWRITE_KIDS_RESERVATIONS_TABLE_ID: classReservationsId,
      APPWRITE_EMAIL_DELIVERIES_TABLE_ID: resourceId(env, 'APPWRITE_EMAIL_DELIVERIES_TABLE_ID', 'email_deliveries'),
      REVIEW_ADMIN_USER_IDS: admins.join(','),
      RESEND_API_KEY: required(env, 'RESEND_API_KEY'),
      RESEND_FROM_EMAIL: required(env, 'RESEND_FROM_EMAIL'),
      RESEND_TO_EMAILS: required(env, 'RESEND_TO_EMAILS'),
      RESEND_REPLY_TO_EMAIL: String(env.RESEND_REPLY_TO_EMAIL || '').trim(),
    },
  }
}

export function buildReservationCreateEventGroups(resources, env = {}) {
  if (env.APPWRITE_RESERVATION_CREATE_EVENTS) {
    return [env.APPWRITE_RESERVATION_CREATE_EVENTS.split(',').map((event) => event.trim()).filter(Boolean)]
  }
  if (env.APPWRITE_RESERVATION_CREATE_EVENT) return [[env.APPWRITE_RESERVATION_CREATE_EVENT.trim()]]
  const { cakeDatabaseId, classDatabaseId, cakeReservationsId, classReservationsId } = resources
  return [
    [
      `tablesdb.${cakeDatabaseId}.tables.${cakeReservationsId}.rows.*.create`,
      `tablesdb.${classDatabaseId}.tables.${classReservationsId}.rows.*.create`,
    ],
    [
      `databases.${cakeDatabaseId}.collections.${cakeReservationsId}.documents.*.create`,
      `databases.${classDatabaseId}.collections.${classReservationsId}.documents.*.create`,
    ],
  ]
}

export function buildFunctionPayload(runtimeName, events, execute = []) {
  return {
    name: 'Reservation Notification',
    execute: [...execute],
    timeout: 15,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: [...FUNCTION_SCOPES],
    runtime: runtimeName,
    events,
  }
}

export function buildDryRunPlan(env = {}) {
  const variableValues = {
    MARKET: env.MARKET || 'AU',
    APPWRITE_CAKE_DATABASE_ID: env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_KIDS_DATABASE_ID: env.APPWRITE_KIDS_DATABASE_ID || env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_CAKE_RESERVATIONS_TABLE_ID: env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations',
    APPWRITE_KIDS_RESERVATIONS_TABLE_ID: env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID || 'class_reservations',
    APPWRITE_EMAIL_DELIVERIES_TABLE_ID: env.APPWRITE_EMAIL_DELIVERIES_TABLE_ID || 'email_deliveries',
    REVIEW_ADMIN_USER_IDS: env.REVIEW_ADMIN_USER_IDS,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    RESEND_TO_EMAILS: env.RESEND_TO_EMAILS,
    RESEND_REPLY_TO_EMAIL: env.RESEND_REPLY_TO_EMAIL,
  }
  return {
    mode: 'dry-run',
    network: false,
    dotenvLoaded: false,
    collectionPermissionChanges: false,
    requiredApplyEnvironment: [...REQUIRED_APPLY_ENVIRONMENT],
    wouldFailApply: REQUIRED_APPLY_ENVIRONMENT.some((key) => !String(env[key] || '').trim()),
    function: {
      id: maskValue(env.APPWRITE_RESERVATION_NOTIFY_FUNCTION_ID || 'reservation-notification'),
      runtime: env.APPWRITE_RESERVATION_NOTIFY_RUNTIME || 'node-16.0',
      source: 'appwrite-functions/reservation-notification/{package.json,package-lock.json,src/**,shared/**}',
      sharedSources: [...ARCHIVE_SHARED_SOURCE_PATHS],
      scopes: [...FUNCTION_SCOPES],
      anonymousExecution: false,
      exactAdminExecution: true,
      variableNames: Object.keys(variableValues),
      maskedVariables: Object.fromEntries(Object.entries(variableValues).map(([key, value]) => [key, maskValue(value)])),
    },
    notes: [
      'No Appwrite client, Resend request, or network operation is created in dry-run mode.',
      'The deployment never changes database or collection permissions.',
    ],
  }
}
