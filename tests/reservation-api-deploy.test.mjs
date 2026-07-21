import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  FUNCTION_SCOPES,
  buildDryRunPlan,
  buildRuntimeCandidates,
  isSecretFunctionVariable,
  redactReservationDeploymentDiagnostic,
  resolveDeployConfig,
} from '../scripts/reservation-api-deploy-config.mjs'

const validEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.com/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'operator-secret',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  APPWRITE_KIDS_DATABASE_ID: 'kids_db',
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
  APPWRITE_SETTINGS_TABLE_ID: 'settings',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_KIDS_BOOKED_DATES_TABLE_ID: 'class_booked_dates',
  APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID: 'cake_pickup_openings',
  APPWRITE_REVIEW_COUPONS_TABLE_ID: 'private_review_coupons',
  APPWRITE_MANUAL_COUPONS_TABLE_ID: 'private_manual_coupons',
  REVIEW_COUPON_HMAC_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CALENDAR_VIEW_PIN: '123456',
  CALENDAR_TOKEN_SECRET: 'a-calendar-secret-that-is-at-least-32-characters',
}

test('reservation deployment diagnostics redact overlapping secrets, bare values, carriage returns, and stay bounded', () => {
  const shortSecret = '123456'
  const longSecret = `prefix${shortSecret}suffix_SECRET_MATERIAL`
  const fragmentedShort = `${shortSecret.slice(0, 3)}\r${shortSecret.slice(3)}`
  const fragmentedLong = `${longSecret.slice(0, 8)}\n${longSecret.slice(8)}`
  const fragmentedHmac = `${validEnv.REVIEW_COUPON_HMAC_SECRET.slice(0, 12)}\u007f${validEnv.REVIEW_COUPON_HMAC_SECRET.slice(12)}`
  const output = redactReservationDeploymentDiagnostic(
    `build failed\rFORGED-LINE APPWRITE_API_KEY=${validEnv.APPWRITE_API_KEY} ${longSecret} ${shortSecret} ${fragmentedShort} ${fragmentedLong} ${fragmentedHmac} ${'x'.repeat(2000)}`,
    [shortSecret, validEnv.APPWRITE_API_KEY, longSecret, validEnv.REVIEW_COUPON_HMAC_SECRET, shortSecret],
  )
  for (const secret of [shortSecret, validEnv.APPWRITE_API_KEY, longSecret, validEnv.REVIEW_COUPON_HMAC_SECRET]) {
    assert.equal(output.includes(secret), false)
  }
  assert.equal(output.includes('\r'), false)
  assert.ok(output.length <= 1200)
})

test('reservation deploy maps review and manual coupons with server-only variables', () => {
  const config = resolveDeployConfig({
    ...validEnv,
    VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID: 'public_must_not_win',
    VITE_APPWRITE_MANUAL_COUPONS_TABLE_ID: 'public_manual_must_not_win',
  })
  assert.equal(config.runtime, 'node-16.0')
  assert.equal(config.runtimeVariables.APPWRITE_REVIEW_COUPONS_TABLE_ID, 'private_review_coupons')
  assert.equal(config.runtimeVariables.APPWRITE_MANUAL_COUPONS_TABLE_ID, 'private_manual_coupons')
  assert.equal(config.runtimeVariables.REVIEW_COUPON_HMAC_SECRET, validEnv.REVIEW_COUPON_HMAC_SECRET)
  assert.equal(Object.keys(config.runtimeVariables).some((key) => key.startsWith('VITE_')), false)
})

test('reservation deploy requires a strong shared coupon HMAC secret and marks it secret', () => {
  for (const secret of [undefined, '', 'short', 'A'.repeat(42), `${'A'.repeat(43)}=`, ` ${validEnv.REVIEW_COUPON_HMAC_SECRET}`, `${validEnv.REVIEW_COUPON_HMAC_SECRET} `]) {
    assert.throws(() => resolveDeployConfig({ ...validEnv, REVIEW_COUPON_HMAC_SECRET: secret }), /REVIEW_COUPON_HMAC_SECRET/)
  }
  assert.equal(isSecretFunctionVariable('REVIEW_COUPON_HMAC_SECRET'), true)
  assert.equal(isSecretFunctionVariable('APPWRITE_REVIEW_COUPONS_TABLE_ID'), false)
  assert.equal(isSecretFunctionVariable('APPWRITE_MANUAL_COUPONS_TABLE_ID'), false)
})

test('reservation function dynamic key has exact cross-document transaction and readiness scopes', () => {
  assert.deepEqual(FUNCTION_SCOPES, [
    'databases.read',
    'databases.write',
    'collections.read',
    'attributes.read',
    'indexes.read',
    'documents.read',
    'documents.write',
  ])
  assert.deepEqual(buildRuntimeCandidates('node-16.0', {
    Node200: 'node-20.0', Node180: 'node-18.0', Node160: 'node-16.0',
  }), ['node-16.0'])
  assert.equal(resolveDeployConfig({ ...validEnv, APPWRITE_RESERVATION_API_RUNTIME: 'node-16.0' }).runtime, 'node-16.0')
  assert.throws(() => resolveDeployConfig({ ...validEnv, APPWRITE_RESERVATION_API_RUNTIME: 'node-14.0' }), /RUNTIME/)
})

test('reservation deploy dry-run is redacted and cannot mutate permissions or network', () => {
  const plan = buildDryRunPlan(validEnv)
  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.dotenvLoaded, false)
  assert.equal(plan.collectionPermissionChanges, false)
  assert.equal(plan.function.runtime, 'node-16.0')
  assert.equal(plan.function.variableNames.includes('APPWRITE_REVIEW_COUPONS_TABLE_ID'), true)
  assert.equal(plan.function.variableNames.includes('APPWRITE_MANUAL_COUPONS_TABLE_ID'), true)
  assert.equal(plan.function.variableNames.includes('REVIEW_COUPON_HMAC_SECRET'), true)
  assert.equal(JSON.stringify(plan).includes(validEnv.REVIEW_COUPON_HMAC_SECRET), false)
  assert.equal(JSON.stringify(plan).includes('private_review_coupons'), false)
  assert.equal(JSON.stringify(plan).includes('private_manual_coupons'), false)
})

test('permission transition health gate matches the current ready response contract', () => {
  const source = readFileSync('scripts/set-reservation-write-mode.mjs', 'utf8')
  assert.match(source, /response\.result\?\.status !== 'ready'/)
  assert.doesNotMatch(source, /response\.result\?\.database !== 'ok'/)
})

test('actual reservation deploy CLI dry-run exits before credentials, dotenv and network setup', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy-reservation-api.mjs', '--dry-run'], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.network, false)
  assert.equal(plan.dotenvLoaded, false)
  assert.equal(plan.collectionPermissionChanges, false)
})
