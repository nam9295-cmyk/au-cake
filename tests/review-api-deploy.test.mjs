import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import {
  ARCHIVE_SOURCE_ENTRIES,
  DEPLOYMENT_OPERATIONS,
  FUNCTION_SCOPES,
  buildCreateFunctionPayload,
  buildDryRunPlan,
  buildRuntimeCandidates,
  buildUpdateFunctionPayload,
  evaluateDeploymentStatus,
  isSecretFunctionVariable,
  resolveDeployConfig,
  sanitizeDeploymentLogs,
} from '../scripts/review-api-deploy-config.mjs'
import {
  buildDeploymentPayload,
  createAndUploadArchive,
} from '../scripts/review-api-deploy-runtime.mjs'

const validEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.com/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'top-secret-api-key',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  APPWRITE_KIDS_DATABASE_ID: 'kids_db',
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'cake_reservations',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_REVIEW_INVITES_TABLE_ID: 'review_invites',
  APPWRITE_REVIEWS_TABLE_ID: 'reviews',
  APPWRITE_REVIEW_COUPONS_TABLE_ID: 'review_coupons',
  APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID: 'review_photo_cleanup',
  APPWRITE_REVIEW_PHOTOS_BUCKET_ID: 'review-photos',
  REVIEW_ADMIN_USER_IDS: 'admin_1, admin_2,admin_1',
  REVIEW_FRONTEND_ORIGINS: 'https://admin.example.test,https://www.example.test',
  REVIEW_COUPON_HMAC_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  REVIEW_COUPON_ENCRYPTION_KEY: 'ERERERERERERERERERERERERERERERERERERERERERE',
}

test('apply configuration rejects every missing or blank required server variable', () => {
  for (const key of [
    'APPWRITE_ENDPOINT',
    'APPWRITE_PROJECT_ID',
    'APPWRITE_API_KEY',
    'APPWRITE_CAKE_DATABASE_ID',
    'APPWRITE_KIDS_DATABASE_ID',
    'REVIEW_ADMIN_USER_IDS',
    'REVIEW_FRONTEND_ORIGINS',
    'REVIEW_COUPON_HMAC_SECRET',
    'REVIEW_COUPON_ENCRYPTION_KEY',
  ]) {
    const missing = { ...validEnv }
    delete missing[key]
    assert.throws(() => resolveDeployConfig(missing), new RegExp(key))
    assert.throws(() => resolveDeployConfig({ ...validEnv, [key]: '   ' }), new RegExp(key))
  }
})

test('review coupon HMAC secret requires canonical base64url encoding of at least 32 bytes', () => {
  for (const secret of ['short', 'A'.repeat(42), `${'A'.repeat(43)}=`, ` ${validEnv.REVIEW_COUPON_HMAC_SECRET}`, `${validEnv.REVIEW_COUPON_HMAC_SECRET} `]) {
    assert.throws(() => resolveDeployConfig({ ...validEnv, REVIEW_COUPON_HMAC_SECRET: secret }), /REVIEW_COUPON_HMAC_SECRET/)
  }
})

test('review coupon encryption key requires canonical unpadded base64url encoding of exactly 32 bytes and is independent', () => {
  for (const key of ['short', 'A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(43)}=`, ` ${validEnv.REVIEW_COUPON_ENCRYPTION_KEY}`, `${validEnv.REVIEW_COUPON_ENCRYPTION_KEY} `]) {
    assert.throws(() => resolveDeployConfig({ ...validEnv, REVIEW_COUPON_ENCRYPTION_KEY: key }), /REVIEW_COUPON_ENCRYPTION_KEY/)
  }
  assert.throws(
    () => resolveDeployConfig({ ...validEnv, REVIEW_COUPON_ENCRYPTION_KEY: validEnv.REVIEW_COUPON_HMAC_SECRET }),
    /independent/,
  )
})

test('resource IDs and review administrator IDs are validated and deduplicated', () => {
  assert.throws(
    () => resolveDeployConfig({ ...validEnv, APPWRITE_REVIEWS_TABLE_ID: 'bad id' }),
    /APPWRITE_REVIEWS_TABLE_ID/,
  )
  assert.throws(
    () => resolveDeployConfig({ ...validEnv, REVIEW_ADMIN_USER_IDS: 'admin_1,bad id' }),
    /REVIEW_ADMIN_USER_IDS/,
  )
  assert.deepEqual(resolveDeployConfig(validEnv).adminUserIds, ['admin_1', 'admin_2'])
})

test('endpoint rejects embedded username or password userinfo', () => {
  assert.throws(
    () => resolveDeployConfig({ ...validEnv, APPWRITE_ENDPOINT: 'https://user:password@appwrite.example.com/v1' }),
    /userinfo/,
  )
})

test('review administrators use REVIEW_ADMIN_USER_IDS as the only source of truth', () => {
  assert.throws(
    () => resolveDeployConfig({
      ...validEnv,
      REVIEW_ADMIN_USER_IDS: '',
      APPWRITE_ADMIN_USER_IDS: 'schema_admin',
    }),
    /REVIEW_ADMIN_USER_IDS/,
  )
})

test('function variables map exact server-only IDs without VITE fallbacks', () => {
  const config = resolveDeployConfig({
    ...validEnv,
    APPWRITE_REVIEW_API_FUNCTION_ID: 'custom-review-api',
    VITE_APPWRITE_REVIEWS_TABLE_ID: 'vite_reviews_must_not_win',
  })
  assert.equal(config.functionId, 'custom-review-api')
  assert.deepEqual(config.runtimeVariables, {
    APPWRITE_PUBLIC_ENDPOINT: 'https://appwrite.example.com/v1',
    APPWRITE_CAKE_DATABASE_ID: 'cake_db',
    APPWRITE_KIDS_DATABASE_ID: 'kids_db',
    APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'cake_reservations',
    APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
    APPWRITE_REVIEW_INVITES_TABLE_ID: 'review_invites',
    APPWRITE_REVIEWS_TABLE_ID: 'reviews',
    APPWRITE_REVIEW_COUPONS_TABLE_ID: 'review_coupons',
    APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID: 'review_photo_cleanup',
    APPWRITE_REVIEW_PHOTOS_BUCKET_ID: 'review-photos',
    REVIEW_ADMIN_USER_IDS: 'admin_1,admin_2',
    REVIEW_FRONTEND_ORIGINS: validEnv.REVIEW_FRONTEND_ORIGINS,
    REVIEW_COUPON_HMAC_SECRET: validEnv.REVIEW_COUPON_HMAC_SECRET,
    REVIEW_COUPON_ENCRYPTION_KEY: validEnv.REVIEW_COUPON_ENCRYPTION_KEY,
  })
  assert.equal(resolveDeployConfig(validEnv).functionId, 'review-api')
  assert.equal(Object.keys(config.runtimeVariables).some((key) => key.startsWith('VITE_')), false)
})

test('default runtime matches the self-hosted Appwrite Node 16 runtime and compatible sharp line', () => {
  assert.equal(resolveDeployConfig(validEnv).runtime, 'node-16.0')
  assert.equal(
    resolveDeployConfig({ ...validEnv, APPWRITE_REVIEW_API_RUNTIME: 'node-16.0' }).runtime,
    'node-16.0',
  )
  assert.throws(
    () => resolveDeployConfig({ ...validEnv, APPWRITE_REVIEW_API_RUNTIME: 'node-14.0' }),
    /APPWRITE_REVIEW_API_RUNTIME/,
  )
  assert.deepEqual(buildRuntimeCandidates('node-16.0', {
    Node200: 'node-20.0', Node180: 'node-18.0', Node160: 'node-16.0',
  }), ['node-16.0'])
})

test('dynamic function key scopes cover only required database/document and file operations', () => {
  assert.deepEqual(FUNCTION_SCOPES, [
    'databases.read',
    'databases.write',
    'documents.read',
    'documents.write',
    'files.read',
    'files.write',
  ])
})

test('function payload builders own rollout fields and preserve unrelated update settings', () => {
  const owned = {
    name: 'Review API',
    runtime: 'node-20.0',
    execute: ['any'],
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: FUNCTION_SCOPES,
  }
  assert.deepEqual(buildCreateFunctionPayload('node-20.0', 'any'), owned)

  const existing = {
    $id: 'review-api',
    name: 'Old name',
    runtime: 'node-18.0',
    execute: ['users'],
    events: ['databases.*.collections.*.documents.*.create'],
    schedule: '15 3 * * *',
    timeout: 91,
    enabled: false,
    logging: false,
    entrypoint: 'old.js',
    commands: 'old command',
    scopes: ['users.read'],
    installationId: 'install-1',
    providerRepositoryId: 'repo-1',
    providerBranch: 'production',
    providerSilentMode: true,
    providerRootDirectory: 'functions/old',
    specification: 's-2vcpu-2gb',
  }
  assert.deepEqual(buildUpdateFunctionPayload(existing, 'node-20.0', 'any'), {
    ...owned,
    events: existing.events,
    schedule: existing.schedule,
    timeout: existing.timeout,
    enabled: existing.enabled,
    logging: existing.logging,
    installationId: existing.installationId,
    providerRepositoryId: existing.providerRepositoryId,
    providerBranch: existing.providerBranch,
    providerSilentMode: existing.providerSilentMode,
    providerRootDirectory: existing.providerRootDirectory,
    specification: existing.specification,
  })
})

test('review frontend origins require exact HTTPS origins and remain a nonsecret runtime variable', () => {
  for (const origins of ['', '*', 'http://admin.example.test', 'https://*.example.test', 'https://example.test/path']) {
    assert.throws(() => resolveDeployConfig({ ...validEnv, REVIEW_FRONTEND_ORIGINS: origins }), /REVIEW_FRONTEND_ORIGINS/)
  }
  assert.equal(isSecretFunctionVariable('REVIEW_FRONTEND_ORIGINS'), false)
})

test('review administrator, coupon HMAC, and coupon encryption variables are secret while ordinary resource IDs are not', () => {
  assert.equal(isSecretFunctionVariable('REVIEW_ADMIN_USER_IDS'), true)
  assert.equal(isSecretFunctionVariable('REVIEW_COUPON_HMAC_SECRET'), true)
  assert.equal(isSecretFunctionVariable('REVIEW_COUPON_ENCRYPTION_KEY'), true)
  assert.equal(isSecretFunctionVariable('APPWRITE_REVIEWS_TABLE_ID'), false)
})

test('archive source manifest and operation plan exclude secrets, dependencies, and collection mutations', () => {
  assert.deepEqual(ARCHIVE_SOURCE_ENTRIES, ['package.json', 'package-lock.json', 'src'])
  for (const forbidden of ['node_modules', '.env', 'secret', 'collection.permissions']) {
    assert.equal(JSON.stringify({ ARCHIVE_SOURCE_ENTRIES, DEPLOYMENT_OPERATIONS }).includes(forbidden), false)
  }
  assert.deepEqual(DEPLOYMENT_OPERATIONS, [
    'functions.get',
    'functions.create-or-update',
    'functions.variables.upsert',
    'functions.deployments.create',
    'functions.deployments.get',
  ])
})

test('deployment payload uses the direct node-appwrite InputFile contract', async () => {
  const { InputFile } = await import('node-appwrite/file')
  const archive = Buffer.from('archive bytes')
  const payload = buildDeploymentPayload('review-api', archive)
  const expected = InputFile.fromBuffer(archive, 'code.tar.gz')
  assert.equal(payload.functionId, 'review-api')
  assert.equal(payload.code.name, expected.name)
  assert.equal(payload.code.size, expected.size)
  assert.equal(payload.activate, true)
})

test('archive helper always cleans its temporary directory when upload fails', async () => {
  const calls = []
  await assert.rejects(
    () => createAndUploadArchive({ functionDir: '/function', functionId: 'review-api' }, {
      mkdtemp: async () => '/tmp/review-api-test',
      createArchive: async (_archivePath, _functionDir, entries) => calls.push(['archive', entries]),
      readFile: async () => Buffer.from('archive'),
      upload: async () => { throw new Error('injected upload failure') },
      cleanup: async (path) => calls.push(['cleanup', path]),
    }),
    /injected upload failure/,
  )
  assert.deepEqual(calls, [
    ['archive', ARCHIVE_SOURCE_ENTRIES],
    ['cleanup', '/tmp/review-api-test'],
  ])
})

test('dry-run plan is safe, masked, secret-free, and declares boundaries', () => {
  const plan = buildDryRunPlan(validEnv)
  const serialized = JSON.stringify(plan)
  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.collectionPermissionChanges, false)
  assert.deepEqual(plan.requiredApplyEnvironment, [
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
  assert.deepEqual(plan.function.scopes, FUNCTION_SCOPES)
  assert.deepEqual(plan.function.variableNames, Object.keys(resolveDeployConfig(validEnv).runtimeVariables))
  assert.deepEqual(plan.operations, DEPLOYMENT_OPERATIONS)
  assert.equal(serialized.includes(validEnv.APPWRITE_API_KEY), false)
  assert.equal(serialized.includes(validEnv.REVIEW_COUPON_HMAC_SECRET), false)
  assert.equal(serialized.includes(validEnv.REVIEW_COUPON_ENCRYPTION_KEY), false)
  assert.equal(serialized.includes(validEnv.APPWRITE_ENDPOINT), false)
  assert.equal(serialized.includes('admin_1'), false)
  assert.equal(serialized.includes('cake_reservations'), false)
  assert.match(plan.function.id, /…/)
})

test('dry-run child process exits before invalid apply credentials or optional SDK/network path', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy-review-api.mjs', '--dry-run'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      APPWRITE_ENDPOINT: 'not-a-url',
      APPWRITE_API_KEY: 'invalid-if-apply-progresses',
    },
  })
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.wouldFailApply, true)
})

test('deployment status helper returns ready and rejects failed, unexpected, or bounded timeout', () => {
  assert.equal(evaluateDeploymentStatus({ status: 'ready' }, 2, 60), 'ready')
  assert.throws(
    () => evaluateDeploymentStatus({ status: 'failed', buildLogs: 'compile failed' }, 2, 60),
    /compile failed/,
  )
  assert.throws(
    () => evaluateDeploymentStatus({ status: 'building' }, 60, 60),
    /120 seconds/,
  )
  assert.equal(evaluateDeploymentStatus({ status: 'building' }, 2, 60), 'pending')
  assert.throws(
    () => evaluateDeploymentStatus({ status: 'mystery-future-state' }, 2, 60),
    /Unexpected Review API deployment status/,
  )
})

test('deployment failure diagnostics are redacted and capped before throwing', () => {
  const secret = 'admin_123456'
  const logs = `failure for ${secret}: ${'x'.repeat(5000)}`
  const sanitized = sanitizeDeploymentLogs(logs, [secret], 240)
  assert.equal(sanitized.includes(secret), false)
  assert.match(sanitized, /\[REDACTED\]/)
  assert.ok(sanitized.length <= 240)
  assert.throws(
    () => evaluateDeploymentStatus({ status: 'failed', buildLogs: logs }, 2, 60, [secret]),
    (error) => error.message.length < 600 && !error.message.includes(secret),
  )
})
