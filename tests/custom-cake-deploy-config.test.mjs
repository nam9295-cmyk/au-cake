import assert from 'node:assert/strict'
import test from 'node:test'
import * as api from '../scripts/reservation-api-deploy-config.mjs'
import * as notification from '../scripts/reservation-notification-deploy-config.mjs'
const base = { APPWRITE_ENDPOINT: 'https://synthetic.invalid/v1', APPWRITE_PROJECT_ID: 'project', APPWRITE_API_KEY: 'synthetic', APPWRITE_CAKE_DATABASE_ID: 'cake', APPWRITE_KIDS_DATABASE_ID: 'kids', REVIEW_ADMIN_USER_IDS: 'admin', REVIEW_COUPON_HMAC_SECRET: Buffer.alloc(32, 7).toString('base64url'), CALENDAR_VIEW_PIN: '123456', CALENDAR_TOKEN_SECRET: 'x'.repeat(32), RESEND_API_KEY: 'synthetic', RESEND_FROM_EMAIL: 'Cake <cake@example.invalid>', RESEND_TO_EMAILS: 'owner@example.invalid' }
const enabled = { ...base, CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED: 'true', APPWRITE_RESERVATION_API_RUNTIME: 'node-22', APPWRITE_RESERVATION_NOTIFY_RUNTIME: 'node-22', APPWRITE_CUSTOM_CAKE_API_SCHEDULE: '* * * * *', APPWRITE_CUSTOM_CAKE_NOTIFICATION_SCHEDULE: '* * * * *', CUSTOM_CAKE_PERSISTENCE_ENABLED: 'true', CUSTOM_CAKE_RECOVERY_ENABLED: 'true', CUSTOM_CAKE_NOTIFICATIONS_ENABLED: 'true', APPWRITE_CUSTOM_CAKE_DATABASE_ID: 'private-cake', APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID: 'custom-cake-photos', CUSTOM_CAKE_PROMOTION_STARTS_AT: '2026-09-09T00:00:00.000Z', CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET: Buffer.alloc(32, 8).toString('base64url'), CAKE_WIRE_LEGACY_NEW_SUBMISSIONS: 'compat' }
for (const kind of ['CLAIMS', 'SNAPSHOTS', 'SESSIONS', 'PHOTOS', 'QUOTAS', 'OUTBOX', 'COMMITS', 'CHUNKS', 'HISTORIES', 'RATELIMITS']) enabled[`APPWRITE_CUSTOM_CAKE_${kind}_TABLE_ID`] = `custom_cake_${kind.toLowerCase()}`
test('Node22 deployment requires explicit custom opt-in, exact runtime and recovery schedule', () => {
  for (const config of [api, notification]) {
    assert.equal(config.resolveDeployConfig(base).runtime, 'node-16.0')
    const result = config.resolveDeployConfig(enabled)
    assert.equal(result.runtime, 'node-22')
    assert.equal(result.customCakeFunctionOptions.schedule, '* * * * *')
    assert.ok(result.customCakeFunctionOptions.scopes.includes('functions.read'))
    assert.ok(result.customCakeFunctionOptions.scopes.includes('collections.read'))
    assert.equal(result.runtimeVariables.APPWRITE_CUSTOM_CAKE_OUTBOX_TABLE_ID, 'custom_cake_outbox')
    assert.throws(() => config.resolveDeployConfig({ ...enabled, CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED: undefined }), /node-16.0/)
    for (const invalidRuntime of ['node-20.0', 'node-16.0', 'node-22.0']) {
      assert.throws(() => config.resolveDeployConfig({ ...enabled, APPWRITE_RESERVATION_API_RUNTIME: invalidRuntime, APPWRITE_RESERVATION_NOTIFY_RUNTIME: invalidRuntime }), /node-22/)
    }
    assert.throws(() => config.resolveDeployConfig({ ...enabled, APPWRITE_CUSTOM_CAKE_API_SCHEDULE: '', APPWRITE_CUSTOM_CAKE_NOTIFICATION_SCHEDULE: '' }), /SCHEDULE/)
    assert.throws(() => config.resolveDeployConfig({ ...enabled, APPWRITE_CUSTOM_CAKE_OUTBOX_TABLE_ID: 'email_deliveries' }), /OUTBOX/)
    const plan = config.buildDryRunPlan(enabled)
    assert.ok(JSON.stringify(plan).includes('functions.read'))
    assert.ok(!JSON.stringify(plan).includes(enabled.CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET))
  }
  assert.equal(api.isSecretFunctionVariable('CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET'), true)
  const result = notification.resolveDeployConfig(enabled)
  const payload = notification.buildFunctionPayload(result.runtime, ['legacy-event'], result.adminExecuteRoles, result.customCakeFunctionOptions)
  assert.equal(payload.schedule, '* * * * *')
  assert.ok(payload.scopes.includes('functions.read'))
  assert.deepEqual(payload.events, ['legacy-event'])
  assert.deepEqual(api.buildRuntimeCandidates('node-22'), ['node-22'])
})
