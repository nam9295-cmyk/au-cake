import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ARCHIVE_SHARED_SOURCE_PATHS,
  FUNCTION_SCOPES,
  buildDryRunPlan,
  buildFunctionPayload,
  resolveDeployConfig,
} from '../scripts/booking-reminder-deploy-config.mjs'
import { createBookingReminderArchive } from '../scripts/booking-reminder-deploy-runtime.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const validEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.test/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'operator-secret',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  RESEND_API_KEY: 'resend-secret',
  RESEND_FROM_EMAIL: 'Verygood Chocolate <hello@verygood.example>',
  BOOKING_REMINDER_MODE: 'send',
}

test('booking-reminder deployment is private, hourly, event-free, and only has database/document scopes', () => {
  assert.deepEqual(FUNCTION_SCOPES, [
    'databases.read', 'databases.write', 'documents.read', 'documents.write',
  ])
  assert.deepEqual(buildFunctionPayload('node-16.0'), {
    name: 'Booking Reminder',
    execute: [],
    timeout: 30,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: FUNCTION_SCOPES,
    runtime: 'node-16.0',
    events: [],
    schedule: '0 * * * *',
  })
  assert.deepEqual(resolveDeployConfig(validEnv).runtimeVariables, {
    APPWRITE_CAKE_DATABASE_ID: 'cake_db',
    APPWRITE_KIDS_DATABASE_ID: 'cake_db',
    APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
    APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
    APPWRITE_EMAIL_DELIVERIES_TABLE_ID: 'email_deliveries',
    BOOKING_REMINDER_MODE: 'send',
    RESEND_API_KEY: 'resend-secret',
    RESEND_FROM_EMAIL: 'Verygood Chocolate <hello@verygood.example>',
    RESEND_REPLY_TO_EMAIL: '',
  })
  assert.throws(() => resolveDeployConfig({ ...validEnv, BOOKING_REMINDER_MODE: 'automatic-retry' }), /BOOKING_REMINDER_MODE/)
})

test('booking-reminder dry run is offline, defaults to dry-run, redacts secrets, and packages shared delivery modules', async () => {
  assert.deepEqual(ARCHIVE_SHARED_SOURCE_PATHS, [
    'appwrite-functions/shared/email-delivery.js',
    'appwrite-functions/shared/email-delivery-repository.js',
    'appwrite-functions/shared/resend-transport.js',
    'appwrite-functions/shared/email-delivery-sender.js',
    'appwrite-functions/shared/email-template-safety.js',
    'appwrite-functions/shared/sydney-calendar.js',
  ])
  const plan = buildDryRunPlan({ RESEND_API_KEY: 'resend-secret', APPWRITE_API_KEY: 'operator-secret' })
  assert.equal(plan.network, false)
  assert.equal(plan.function.schedule, '0 * * * *')
  assert.equal(plan.function.anonymousExecution, false)
  assert.equal(plan.function.mode, 'dry-run')
  assert.equal(JSON.stringify(plan).includes('resend-secret'), false)
  assert.equal(JSON.stringify(plan).includes('operator-secret'), false)

  const result = spawnSync(process.execPath, ['scripts/deploy-booking-reminder.mjs', '--dry-run'], {
    cwd: repositoryRoot, encoding: 'utf8', env: {},
  })
  assert.equal(result.status, 0, result.stderr)
  const commandPlan = JSON.parse(result.stdout)
  assert.equal(commandPlan.network, false)
  assert.equal(commandPlan.function.mode, 'dry-run')

  const archive = await createBookingReminderArchive({ repositoryRoot })
  try {
    const entries = spawnSync('tar', ['-tzf', archive.path], { encoding: 'utf8' })
    assert.equal(entries.status, 0, entries.stderr)
    for (const entry of [
      'src/main.js', 'src/reminder-business.js', 'src/reminder-templates.js',
      'shared/email-delivery/email-delivery.js', 'shared/email-delivery/email-delivery-repository.js',
      'shared/email-delivery/resend-transport.js', 'shared/email-delivery/email-delivery-sender.js',
      'shared/email-template-safety.js', 'shared/sydney-calendar.js', 'shared/reservation-api/business.js',
    ]) assert.match(entries.stdout, new RegExp(entry.replaceAll('.', '\\.')))
    assert.doesNotMatch(entries.stdout, /node_modules\//)
  } finally {
    await archive.cleanup()
  }
})

test('main entry point uses only the dynamic Function key for runtime database access', async () => {
  const mainSource = await readFile(new URL('../appwrite-functions/booking-reminder/src/main.js', import.meta.url), 'utf8')
  assert.match(mainSource, /x-appwrite-key/)
  assert.doesNotMatch(mainSource, /APPWRITE_API_KEY/)
  assert.doesNotMatch(mainSource, /req\.bodyRaw/)
})

test('canonical scripts run booking-reminder regressions and expose only the explicit deploy command', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(packageJson.scripts.test, /test:booking-reminder/)
  assert.match(packageJson.scripts['test:booking-reminder'], /booking-reminder\.test\.mjs/)
  assert.equal(packageJson.scripts['deploy:booking-reminder'], 'node scripts/deploy-booking-reminder.mjs')
})
