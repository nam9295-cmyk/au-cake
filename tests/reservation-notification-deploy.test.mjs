import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  ARCHIVE_SHARED_SOURCE_PATHS,
  FUNCTION_SCOPES,
  buildDryRunPlan,
  buildFunctionPayload,
  isSecretFunctionVariable,
  resolveDeployConfig,
} from '../scripts/reservation-notification-deploy-config.mjs'
import { createNotificationArchive } from '../scripts/reservation-notification-deploy-runtime.mjs'

const mainSource = await readFile(new URL('../appwrite-functions/reservation-notification/src/main.js', import.meta.url), 'utf8')
const deploySource = await readFile(new URL('../scripts/deploy-reservation-notification.mjs', import.meta.url), 'utf8')
const archiveRuntimeSource = await readFile(new URL('../scripts/reservation-notification-deploy-runtime.mjs', import.meta.url), 'utf8')
const wrapperSource = await readFile(new URL('../appwrite-functions/reservation-notification/shared/reservation-api/business.js', import.meta.url), 'utf8').catch(() => '')
const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8')
const packageJson = JSON.parse(packageSource)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const validEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.test/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'operator-secret',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  RESEND_API_KEY: 'resend-secret',
  RESEND_FROM_EMAIL: 'Verygood Chocolate <hello@verygood.example>',
  RESEND_TO_EMAILS: 'owner@example.com, second@example.com',
}

test('notification runtime imports the authoritative stored-order parser through its packaged wrapper', () => {
  assert.match(mainSource, /from '\.\.\/shared\/reservation-api\/business\.js'/)
  assert.match(wrapperSource, /reservation-api\/src\/business\.js/)
})

test('notification deploy archive replaces the local wrapper with every authoritative parser dependency', () => {
  assert.match(deploySource, /createNotificationArchive/)
  assert.match(archiveRuntimeSource, /reservation-api\/src\/business\.js/)
  assert.match(archiveRuntimeSource, /reservation-api\/src\/coupon-digest\.js/)
  assert.match(archiveRuntimeSource, /reservation-api\/src\/active-cake-products\.js/)
  assert.match(archiveRuntimeSource, /shared\/reservation-api/)
  assert.match(archiveRuntimeSource, /recursive:\s*true/)
})

test('canonical npm test executes the notification deploy packaging regression', () => {
  assert.match(packageJson.scripts.test, /test:reservation-notification-deploy/)
  assert.match(packageJson.scripts['test:reservation-notification-deploy'], /reservation-notification-deploy\.test\.mjs/)
})

test('notification deployment config grants only the dynamic ledger database/document scopes', () => {
  assert.deepEqual(FUNCTION_SCOPES, [
    'databases.read',
    'databases.write',
    'documents.read',
    'documents.write',
  ])
  assert.deepEqual(resolveDeployConfig(validEnv).runtimeVariables, {
    MARKET: 'AU',
    APPWRITE_CAKE_DATABASE_ID: 'cake_db',
    APPWRITE_EMAIL_DELIVERIES_TABLE_ID: 'email_deliveries',
    RESEND_API_KEY: 'resend-secret',
    RESEND_FROM_EMAIL: 'Verygood Chocolate <hello@verygood.example>',
    RESEND_TO_EMAILS: 'owner@example.com, second@example.com',
    RESEND_REPLY_TO_EMAIL: '',
  })
  assert.deepEqual(buildFunctionPayload('node-16.0', ['tablesdb.cake_db.tables.reservations.rows.*.create']), {
    name: 'Reservation Notification',
    execute: [],
    timeout: 15,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: FUNCTION_SCOPES,
    runtime: 'node-16.0',
    events: ['tablesdb.cake_db.tables.reservations.rows.*.create'],
  })
  assert.equal(isSecretFunctionVariable('RESEND_API_KEY'), true)
  assert.equal(isSecretFunctionVariable('APPWRITE_EMAIL_DELIVERIES_TABLE_ID'), false)
})

test('notification deployment dry-run is offline, redacts secrets, and declares shared ledger archive sources', async () => {
  assert.deepEqual(ARCHIVE_SHARED_SOURCE_PATHS, [
    'appwrite-functions/shared/email-delivery.js',
    'appwrite-functions/shared/email-delivery-repository.js',
  ])
  const plan = buildDryRunPlan({ RESEND_API_KEY: 'resend-secret', APPWRITE_API_KEY: 'operator-secret' })
  assert.equal(plan.network, false)
  assert.equal(JSON.stringify(plan).includes('resend-secret'), false)
  assert.equal(JSON.stringify(plan).includes('operator-secret'), false)

  const result = spawnSync(process.execPath, ['scripts/deploy-reservation-notification.mjs', '--dry-run'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {},
  })
  assert.equal(result.status, 0, result.stderr)
  const commandPlan = JSON.parse(result.stdout)
  assert.equal(commandPlan.network, false)
  assert.deepEqual(commandPlan.function.scopes, FUNCTION_SCOPES)

  const archive = await createNotificationArchive({ repositoryRoot })
  try {
    const entries = spawnSync('tar', ['-tzf', archive.path], { encoding: 'utf8' })
    assert.equal(entries.status, 0, entries.stderr)
    assert.match(entries.stdout, /shared\/email-delivery\/email-delivery\.js/)
    assert.match(entries.stdout, /shared\/email-delivery\/email-delivery-repository\.js/)
    assert.match(entries.stdout, /shared\/reservation-api\/business\.js/)
    assert.doesNotMatch(entries.stdout, /node_modules\//)
  } finally {
    await archive.cleanup()
  }
})
