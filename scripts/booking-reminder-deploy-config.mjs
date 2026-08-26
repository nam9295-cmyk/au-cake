import { EMAIL_DELIVERY_REQUIRED_FUNCTION_SCOPES } from '../appwrite-functions/shared/email-delivery.js'

const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

export const FUNCTION_SCOPES = Object.freeze([...EMAIL_DELIVERY_REQUIRED_FUNCTION_SCOPES])
export const ARCHIVE_SHARED_SOURCE_PATHS = Object.freeze([
  'appwrite-functions/shared/email-delivery.js',
  'appwrite-functions/shared/email-delivery-repository.js',
  'appwrite-functions/shared/resend-transport.js',
  'appwrite-functions/shared/email-delivery-sender.js',
  'appwrite-functions/shared/email-template-safety.js',
  'appwrite-functions/shared/sydney-calendar.js',
])
export const REQUIRED_APPLY_ENVIRONMENT = Object.freeze([
  'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY', 'APPWRITE_CAKE_DATABASE_ID', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
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
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('APPWRITE_ENDPOINT must be a valid HTTP(S) URL without userinfo.')
  return value
}

function mode(env) {
  const value = String(env.BOOKING_REMINDER_MODE || 'dry-run').trim()
  if (value !== 'dry-run' && value !== 'send') throw new Error('BOOKING_REMINDER_MODE must be dry-run or send.')
  return value
}

export function isSecretFunctionVariable(key) {
  return key === 'RESEND_API_KEY'
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
  return {
    endpoint: endpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    apiKey: required(env, 'APPWRITE_API_KEY'),
    functionId: resourceId(env, 'APPWRITE_BOOKING_REMINDER_FUNCTION_ID', 'booking-reminder'),
    runtime: 'node-16.0',
    runtimeVariables: {
      APPWRITE_CAKE_DATABASE_ID: cakeDatabaseId,
      APPWRITE_KIDS_DATABASE_ID: classDatabaseId,
      APPWRITE_CAKE_RESERVATIONS_TABLE_ID: resourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID', 'reservations'),
      APPWRITE_KIDS_RESERVATIONS_TABLE_ID: resourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID', 'class_reservations'),
      APPWRITE_EMAIL_DELIVERIES_TABLE_ID: resourceId(env, 'APPWRITE_EMAIL_DELIVERIES_TABLE_ID', 'email_deliveries'),
      BOOKING_REMINDER_MODE: mode(env),
      RESEND_API_KEY: required(env, 'RESEND_API_KEY'),
      RESEND_FROM_EMAIL: required(env, 'RESEND_FROM_EMAIL'),
      RESEND_REPLY_TO_EMAIL: String(env.RESEND_REPLY_TO_EMAIL || '').trim(),
    },
  }
}

export function buildFunctionPayload(runtime = 'node-16.0') {
  return {
    name: 'Booking Reminder', execute: [], timeout: 30, enabled: true, logging: true,
    entrypoint: 'src/main.js', commands: 'npm ci --omit=dev', scopes: [...FUNCTION_SCOPES], runtime,
    events: [], schedule: '0 * * * *',
  }
}

export function buildDryRunPlan(env = {}) {
  const variableValues = {
    APPWRITE_CAKE_DATABASE_ID: env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_KIDS_DATABASE_ID: env.APPWRITE_KIDS_DATABASE_ID || env.APPWRITE_CAKE_DATABASE_ID,
    APPWRITE_CAKE_RESERVATIONS_TABLE_ID: env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations',
    APPWRITE_KIDS_RESERVATIONS_TABLE_ID: env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID || 'class_reservations',
    APPWRITE_EMAIL_DELIVERIES_TABLE_ID: env.APPWRITE_EMAIL_DELIVERIES_TABLE_ID || 'email_deliveries',
    BOOKING_REMINDER_MODE: env.BOOKING_REMINDER_MODE || 'dry-run',
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
    RESEND_REPLY_TO_EMAIL: env.RESEND_REPLY_TO_EMAIL,
  }
  return {
    mode: 'dry-run', network: false, dotenvLoaded: false, collectionPermissionChanges: false,
    requiredApplyEnvironment: [...REQUIRED_APPLY_ENVIRONMENT],
    wouldFailApply: REQUIRED_APPLY_ENVIRONMENT.some((key) => !String(env[key] || '').trim()),
    function: {
      id: maskValue(env.APPWRITE_BOOKING_REMINDER_FUNCTION_ID || 'booking-reminder'), runtime: 'node-16.0',
      source: 'appwrite-functions/booking-reminder/{package.json,package-lock.json,src/**,shared/**}',
      sharedSources: [...ARCHIVE_SHARED_SOURCE_PATHS], scopes: [...FUNCTION_SCOPES], schedule: '0 * * * *', events: [],
      anonymousExecution: false, mode: env.BOOKING_REMINDER_MODE || 'dry-run', variableNames: Object.keys(variableValues),
      maskedVariables: Object.fromEntries(Object.entries(variableValues).map(([key, value]) => [key, maskValue(value)])),
    },
    notes: [
      'No Appwrite client, Resend request, or network operation is created in dry-run mode.',
      'The scheduled Function has no event trigger and no browser execute permission.',
    ],
  }
}
