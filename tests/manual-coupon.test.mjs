import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'

import { digestReviewCouponCode } from '../functions/reservation-api/src/coupon-digest.js'
import {
  REQUIRED_MANUAL_COUPON_APPLY_ENVIRONMENT,
  addSydneyCalendarDays,
  buildManualCouponDocument,
  buildManualCouponDryRunPlan,
  hashManualCouponCode,
  maskIdentifier,
  resolveManualCouponApplyConfig,
} from '../scripts/manual-coupon-config.mjs'
import {
  executeManualCouponApply,
  issueManualCoupon,
  runManualCouponCli,
} from '../scripts/issue-manual-coupon.mjs'

const rawCode = 'JENNIETEST7'
const fakeHmacSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const validEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.com/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'fake-operator-key',
  APPWRITE_CAKE_DATABASE_ID: 'verygood_cake_au',
  APPWRITE_MANUAL_COUPONS_TABLE_ID: 'private_manual_coupons',
  REVIEW_COUPON_HMAC_SECRET: fakeHmacSecret,
  MANUAL_COUPON_CODE: rawCode,
}

function fixedIds() {
  const ids = ['11111111-1111-4111-8111-111111111111']
  return () => ids.shift()
}

test('default dry-run branches before dotenv, SDK, code access, ID generation, network, or writes', async () => {
  const calls = []
  let output = ''
  const status = await runManualCouponCli({
    args: [],
    writeLine: (line) => { output += line },
    apply: async () => { calls.push('apply'); throw new Error('must not apply') },
  })

  assert.equal(status, 0)
  assert.deepEqual(calls, [])
  const plan = JSON.parse(output)
  assert.deepEqual(plan, buildManualCouponDryRunPlan())
  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.dotenvLoaded, false)
  assert.equal(plan.sdkLoaded, false)
  assert.equal(plan.couponCodeAccessed, false)
  assert.equal(plan.identifiersGenerated, false)
  assert.equal(plan.writes, false)
  assert.equal(plan.collectionPermissionChanges, false)
  assert.deepEqual(plan.requiredApplyEnvironment, REQUIRED_MANUAL_COUPON_APPLY_ENVIRONMENT)
  assert.equal(JSON.stringify(plan).includes(rawCode), false)
})

test('CLI accepts only no arguments for dry-run or sole --apply for mutation', async () => {
  let applyCalls = 0
  await runManualCouponCli({
    args: ['--apply'],
    writeLine: () => {},
    apply: async () => { applyCalls += 1; return { status: 'created' } },
  })
  assert.equal(applyCalls, 1)

  for (const args of [
    ['--dry-run'],
    ['--apply', '--dry-run'],
    ['--apply', 'JENNIETEST7'],
    ['unexpected'],
  ]) {
    await assert.rejects(
      runManualCouponCli({ args, apply: async () => { applyCalls += 1 } }),
      (error) => {
        assert.match(error.message, /no arguments.*--apply/i)
        assert.equal(args.some((arg) => error.message.includes(arg) && arg !== '--apply'), false)
        return true
      },
    )
  }
  assert.equal(applyCalls, 1)
})

test('actual CLI dry-run is secret-free and places the apply boundary before dynamic SDK loading', async () => {
  const result = spawnSync(process.execPath, ['scripts/issue-manual-coupon.mjs'], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, HOME: process.env.HOME, MANUAL_COUPON_CODE: rawCode },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.includes(rawCode), false)
  assert.equal(result.stderr.includes(rawCode), false)
  assert.equal(JSON.parse(result.stdout).network, false)

  const source = await readFile(new URL('../scripts/issue-manual-coupon.mjs', import.meta.url), 'utf8')
  assert.equal(source.includes("from 'node-appwrite'"), false)
  assert.ok(source.indexOf("if (!parsed.apply)") < source.indexOf("import('node-appwrite')"))
})

test('manual code validation is exact and hashing matches Reservation API HMAC contract', () => {
  const config = resolveManualCouponApplyConfig(validEnv)
  const expected = digestReviewCouponCode(rawCode, fakeHmacSecret)
  assert.equal(hashManualCouponCode(rawCode, config.hmacSecret), expected)
  assert.equal(config.collectionId, 'private_manual_coupons')
  assert.equal(resolveManualCouponApplyConfig({
    ...validEnv,
    APPWRITE_MANUAL_COUPONS_TABLE_ID: undefined,
    VITE_APPWRITE_MANUAL_COUPONS_TABLE_ID: 'public_must_not_win',
  }).collectionId, 'manual_coupons')
  assert.match(expected, /^[a-f0-9]{64}$/)

  for (const code of [
    'JENNIEABCDE',
    'JENNIE12345',
    'JENNIEA1B2',
    'JENNIEA1B2C3',
    'jennieA1B2C',
    ' JENNIEA1B2C',
    'JENNIEA1B2C ',
    'FOXKIWI7Q2MK',
  ]) {
    const shouldPass = /^JENNIE[A-Z0-9]{5}$/.test(code)
    if (shouldPass) assert.equal(resolveManualCouponApplyConfig({ ...validEnv, MANUAL_COUPON_CODE: code }).code, code)
    else assert.throws(() => resolveManualCouponApplyConfig({ ...validEnv, MANUAL_COUPON_CODE: code }), /MANUAL_COUPON_CODE/)
  }
  for (const value of [12345, true, { toString: () => rawCode }]) {
    assert.throws(
      () => resolveManualCouponApplyConfig({ ...validEnv, MANUAL_COUPON_CODE: value }),
      /MANUAL_COUPON_CODE/,
    )
    assert.throws(() => hashManualCouponCode(value, config.hmacSecret), /MANUAL_COUPON_CODE/)
  }
})

test('30 Sydney calendar-day expiry preserves wall time across both DST transitions', () => {
  assert.equal(
    addSydneyCalendarDays(new Date('2026-03-07T00:30:00.000Z'), 30).toISOString(),
    '2026-04-06T01:30:00.000Z',
  )
  assert.equal(
    addSydneyCalendarDays(new Date('2026-09-06T00:30:00.000Z'), 30).toISOString(),
    '2026-10-05T23:30:00.000Z',
  )
  assert.throws(() => addSydneyCalendarDays(new Date('invalid'), 30), /valid/i)
})

test('document payload has exact safe fields and never contains the raw code or encryption envelope', () => {
  const config = resolveManualCouponApplyConfig(validEnv)
  const now = new Date('2026-09-06T00:30:00.000Z')
  const document = buildManualCouponDocument({ config, now })

  assert.deepEqual(Object.keys(document).sort(), [
    'codeHash', 'codeLast4', 'createdAt', 'expiresAt', 'rewardPercent', 'scope', 'status',
  ])
  assert.deepEqual(document, {
    codeHash: digestReviewCouponCode(rawCode, fakeHmacSecret),
    codeLast4: 'EST7',
    rewardPercent: 5,
    scope: 'cake',
    status: 'active',
    expiresAt: '2026-10-05T23:30:00.000Z',
    createdAt: '2026-09-06T00:30:00.000Z',
  })
  assert.equal(JSON.stringify(document).includes(rawCode), false)
  assert.equal(Object.keys(document).some((key) => key === 'sourceReviewId' || key.startsWith('codeCipher') || key.startsWith('codeIv') || key.startsWith('codeAuth')), false)
})

test('duplicate hash is idempotently refused without create, update, or reactivation', async () => {
  const config = resolveManualCouponApplyConfig(validEnv)
  const calls = []
  const existing = {
    $id: 'existing-coupon-private-id',
    status: 'revoked',
  }
  const result = await issueManualCoupon({
    config,
    now: new Date('2026-07-21T00:00:00.000Z'),
    makeId: () => { calls.push('generate'); throw new Error('must not generate') },
    repository: {
      findByCodeHash: async (codeHash) => { calls.push(['find', codeHash]); return existing },
      create: async () => { calls.push('create'); throw new Error('must not create') },
      update: async () => { calls.push('update'); throw new Error('must not update') },
    },
  })

  assert.equal(result.status, 'duplicate')
  assert.equal(result.codeLast4, 'EST7')
  assert.equal(result.couponId, maskIdentifier(existing.$id))
  assert.equal('sourceReviewId' in result, false)
  assert.equal(JSON.stringify(result).includes(rawCode), false)
  assert.deepEqual(calls, [['find', digestReviewCouponCode(rawCode, fakeHmacSecret)]])
})

test('create-time 409 re-queries the exact hash and refuses the raced duplicate without update or reactivation', async () => {
  const config = resolveManualCouponApplyConfig(validEnv)
  const expectedHash = digestReviewCouponCode(rawCode, fakeHmacSecret)
  const calls = []
  const existing = { $id: 'raced-private-id', status: 'expired' }
  const result = await issueManualCoupon({
    config,
    now: new Date('2026-07-21T00:00:00.000Z'),
    makeId: fixedIds(),
    repository: {
      findByCodeHash: async (hash) => {
        calls.push(['find', hash])
        return calls.filter(([name]) => name === 'find').length === 1 ? null : existing
      },
      create: async () => { calls.push(['create']); throw Object.assign(new Error('conflict'), { code: 409 }) },
      update: async () => { calls.push(['update']); throw new Error('must not update') },
      isConflict: (error) => error.code === 409,
    },
  })

  assert.deepEqual(result, {
    status: 'duplicate',
    codeLast4: 'EST7',
    couponId: maskIdentifier(existing.$id),
  })
  assert.deepEqual(calls, [['find', expectedHash], ['create'], ['find', expectedHash]])
})

test('create-time 409 propagates when the exact hash re-query finds no duplicate', async () => {
  const conflict = Object.assign(new Error('conflict'), { code: 409 })
  await assert.rejects(
    issueManualCoupon({
      config: resolveManualCouponApplyConfig(validEnv),
      makeId: fixedIds(),
      repository: {
        findByCodeHash: async () => null,
        create: async () => { throw conflict },
        isConflict: (error) => error.code === 409,
      },
    }),
    (error) => error === conflict,
  )
})

test('apply creates one exact private-safe document after an exact hash query', async () => {
  const config = resolveManualCouponApplyConfig(validEnv)
  const calls = []
  const result = await issueManualCoupon({
    config,
    now: new Date('2026-09-06T00:30:00.000Z'),
    makeId: fixedIds(),
    repository: {
      findByCodeHash: async (codeHash) => { calls.push(['find', codeHash]); return null },
      create: async ({ documentId, data }) => {
        calls.push(['create', documentId, data])
        return { $id: documentId, ...data }
      },
    },
  })

  assert.equal(result.status, 'created')
  assert.equal(result.codeLast4, 'EST7')
  assert.equal(result.couponId, maskIdentifier('11111111-1111-4111-8111-111111111111'))
  assert.equal('sourceReviewId' in result, false)
  assert.equal(JSON.stringify(result).includes(rawCode), false)
  assert.equal(calls.length, 2)
  assert.equal(calls[0][0], 'find')
  assert.equal(calls[1][0], 'create')
  assert.deepEqual(calls[1][2], buildManualCouponDocument({
    config,
    now: new Date('2026-09-06T00:30:00.000Z'),
  }))
})

test('malformed apply configuration fails before SDK import, client construction, query, or network', async () => {
  const invalidEnvironments = [
    { ...validEnv, APPWRITE_ENDPOINT: 'ftp://appwrite.example.com/v1' },
    { ...validEnv, APPWRITE_PROJECT_ID: 'bad project id' },
    { ...validEnv, APPWRITE_API_KEY: '   ' },
    { ...validEnv, APPWRITE_CAKE_DATABASE_ID: '../cake-db' },
    { ...validEnv, APPWRITE_MANUAL_COUPONS_TABLE_ID: 'manual coupons' },
    { ...validEnv, REVIEW_COUPON_HMAC_SECRET: 'short' },
    { ...validEnv, REVIEW_COUPON_HMAC_SECRET: `${fakeHmacSecret}=` },
    { ...validEnv, REVIEW_COUPON_HMAC_SECRET: ` ${fakeHmacSecret}` },
    { ...validEnv, MANUAL_COUPON_CODE: 'JENNIEA1B2' },
  ]

  for (const env of invalidEnvironments) {
    const calls = []
    await assert.rejects(
      executeManualCouponApply({
        env,
        loadDotEnv: () => calls.push('dotenv'),
        loadSdk: async () => { calls.push('sdk'); throw new Error('must not load SDK') },
        makeId: () => { calls.push('id'); return 'must-not-generate' },
      }),
      /APPWRITE_|REVIEW_COUPON_HMAC_SECRET|MANUAL_COUPON_CODE/,
    )
    assert.deepEqual(calls, ['dotenv'])
  }
})

test('SDK adapter uses the dedicated server-only manual collection, exact codeHash query, and no permissions', async () => {
  const calls = []
  class FakeClient {
    setEndpoint(value) { calls.push(['endpoint', value]); return this }
    setProject(value) { calls.push(['project', value]); return this }
    setKey(value) { calls.push(['key', value]); return this }
  }
  class FakeDatabases {
    listDocuments(input) { calls.push(['listDocuments', input]); return { documents: [], total: 0 } }
    createDocument(input) { calls.push(['createDocument', input]); return { $id: input.documentId, ...input.data } }
  }
  const Query = {
    equal: (key, value) => ({ equal: [key, value] }),
    limit: (value) => ({ limit: value }),
  }

  const result = await executeManualCouponApply({
    env: { ...validEnv },
    loadDotEnv: () => calls.push(['dotenv']),
    loadSdk: async () => ({ Client: FakeClient, Databases: FakeDatabases, Query }),
    now: () => new Date('2026-09-06T00:30:00.000Z'),
    makeId: fixedIds(),
  })

  assert.equal(result.status, 'created')
  const list = calls.find(([name]) => name === 'listDocuments')[1]
  assert.equal(list.databaseId, 'verygood_cake_au')
  assert.equal(list.collectionId, 'private_manual_coupons')
  assert.deepEqual(list.queries, [
    { equal: ['codeHash', digestReviewCouponCode(rawCode, fakeHmacSecret)] },
    { limit: 2 },
  ])
  const create = calls.find(([name]) => name === 'createDocument')[1]
  assert.equal('permissions' in create, false)
  assert.equal(JSON.stringify(create).includes(rawCode), false)
})

test('outputs expose only last4 and masked identifiers, never the exact code or private IDs', async () => {
  for (const value of ['', 'a', 'abcd', 'private-coupon-id']) {
    const masked = maskIdentifier(value)
    assert.equal(masked.includes(value) && value.length > 0, false)
  }

  let output = ''
  const result = await runManualCouponCli({
    args: ['--apply'],
    writeLine: (line) => { output += line },
    apply: async () => ({
      status: 'created',
      codeLast4: 'EST7',
      couponId: maskIdentifier('private-coupon-id'),
    }),
  })
  assert.equal(result, 0)
  assert.equal(output.includes(rawCode), false)
  assert.equal(output.includes('private-coupon-id'), false)
  assert.deepEqual(JSON.parse(output), {
    status: 'created',
    codeLast4: 'EST7',
    couponId: maskIdentifier('private-coupon-id'),
  })
})

test('source fixtures use synthetic manual codes and exclude the intended date-shaped bearer family without embedding its raw value', async () => {
  const roots = ['functions', 'scripts', 'src', 'tests', 'docs']
  const sourceFiles = []
  async function collect(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = `${path}/${entry.name}`
      if (entry.isDirectory()) await collect(child)
      else if (/\.(?:js|mjs|ts|tsx|md)$/.test(entry.name)) sourceFiles.push(child)
    }
  }
  for (const root of roots) await collect(root)
  const intendedBearerMetadata = Object.freeze({
    prefix: 'JENNIE',
    suffixShape: 'two decimal digits followed by three uppercase letters',
    sourcePattern: /JENNIE\d{2}[A-Z]{3}/g,
  })
  for (const path of sourceFiles) {
    const source = await readFile(path, 'utf8')
    assert.equal(intendedBearerMetadata.sourcePattern.test(source), false, `${path} embeds a date-like manual bearer code`)
    intendedBearerMetadata.sourcePattern.lastIndex = 0
  }
  assert.equal(intendedBearerMetadata.prefix, 'JENNIE')
  assert.match(intendedBearerMetadata.suffixShape, /digits.*uppercase letters/)
  assert.match(rawCode, /^JENNIETEST[2-9]$/)
})

test('package scripts wire the focused test, canonical suite, and apply-gated issuer command', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.scripts['test:manual-coupon'], 'node --test tests/manual-coupon.test.mjs')
  assert.match(packageJson.scripts.test, /(?:^|&&\s*)npm run test:manual-coupon(?:\s*&&|$)/)
  assert.equal(packageJson.scripts['issue:manual-coupon'], 'node scripts/issue-manual-coupon.mjs')
})
