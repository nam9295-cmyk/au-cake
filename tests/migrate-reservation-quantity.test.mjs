import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const migration = await import('../scripts/migrate-reservation-quantity.mjs').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e
  return {}
})
const old = { key: 'quantity', type: 'integer', required: false, array: false, min: 1, max: 5, default: null, status: 'available', error: '' }
const target = { ...old, max: 2147483647 }
const processing = { ...target, status: 'processing' }
const failed = { ...target, status: 'failed', error: 'attribute update failed' }
const env = { VITE_MARKET: 'AU', APPWRITE_API_KEY: 'test-secret' }
for (const [key, value] of Object.entries({ APPWRITE_ENDPOINT: 'https://example.invalid/v1', APPWRITE_PROJECT_ID: 'test-project', APPWRITE_CAKE_DATABASE_ID: 'test-db', APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'test-reservations' })) { env[key] = value; env[`VITE_${key}`] = value }
function transport(attributes = [old]) {
  const calls = []
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, ...init })
    const value = url.endsWith('/health/version') ? { version: '1.8.1' } : init.method === 'PATCH' ? target : attributes.shift()
    return { ok: true, status: 200, json: async () => value }
  } }
}
test('reproduces max5 blocker and plans only a broad technical max', () => {
  assert.equal(typeof migration.planQuantityMigration, 'function', 'quantity migration planner must exist')
  const plan = migration.planQuantityMigration(old, '1.8.1')
  assert.equal(plan.action, 'update')
  assert.deepEqual(plan.patch, { required: false, min: 1, max: 2147483647, default: null })
  assert.equal(migration.planQuantityMigration(target, '1.8.1').action, 'noop')
})
test('fails closed for unknown version or any unexpected schema field', () => {
  assert.equal(typeof migration.planQuantityMigration, 'function')
  for (const change of [{ key: 'other' }, { type: 'double' }, { required: true }, { array: true }, { min: 0 }, { max: 6 }, { max: null }, { default: 1 }, { status: 'processing' }, { error: 'failed' }]) assert.throws(() => migration.planQuantityMigration({ ...old, ...change }, '1.8.1'))
  const missing = { ...old }; delete missing.default
  assert.throws(() => migration.planQuantityMigration(missing, '1.8.1'))
  assert.throws(() => migration.planQuantityMigration(old, '1.9.0'))
})
test('default dry-run makes only exact version/quantity GETs and masks identifiers', async () => {
  const fake = transport()
  const result = await migration.runMigration({ env, ...fake })
  assert.equal(result.mode, 'dry-run')
  assert.deepEqual(fake.calls.map(c => c.method), ['GET', 'GET'])
  assert.ok(fake.calls[1].url.endsWith('/attributes/quantity'))
  assert.equal(fake.calls[0].headers['X-Appwrite-Key'], undefined)
  assert.ok(!JSON.stringify(result).includes('test-secret'))
  assert.ok(!JSON.stringify(result).includes('test-project'))
})
test('apply rechecks quantity, writes exactly once then verifies GET; rerun is noop', async () => {
  const fake = transport([old, old, target])
  const result = await migration.runMigration({ env, apply: true, ...fake })
  assert.equal(result.action, 'updated')
  assert.deepEqual(fake.calls.map(c => c.method), ['GET', 'GET', 'GET', 'PATCH', 'GET'])
  const write = fake.calls[3]
  assert.ok(write.url.endsWith('/attributes/integer/quantity'))
  assert.deepEqual(JSON.parse(write.body), { required: false, min: 1, max: 2147483647, default: null })
  const rerun = transport([target]); assert.equal((await migration.runMigration({ env, apply: true, ...rerun })).action, 'noop')
  assert.ok(rerun.calls.every(c => c.method === 'GET'))
})
test('accepted PATCH polls processing once and then verifies the complete available target', async () => {
  const fake = transport([old, old, processing, target])
  let sleeps = 0
  const result = await migration.runMigration({
    env, apply: true, ...fake,
    waitOptions: { attempts: 3, sleep: async () => { sleeps += 1 } },
  })
  assert.equal(result.action, 'updated')
  assert.deepEqual(result.after, target)
  assert.equal(sleeps, 1)
  assert.equal(fake.calls.filter(c => c.method === 'PATCH').length, 1)
  assert.deepEqual(fake.calls.map(c => c.method), ['GET', 'GET', 'GET', 'PATCH', 'GET', 'GET'])
})
test('accepted PATCH polls repeated processing states without sending another PATCH', async () => {
  const fake = transport([old, old, processing, processing, target])
  let sleeps = 0
  const result = await migration.runMigration({
    env, apply: true, ...fake,
    waitOptions: { attempts: 4, sleep: async () => { sleeps += 1 } },
  })
  assert.equal(result.action, 'updated')
  assert.equal(sleeps, 2)
  assert.equal(fake.calls.filter(c => c.method === 'PATCH').length, 1)
})
test('accepted PATCH fails immediately when processing becomes failed', async () => {
  const fake = transport([old, old, processing, failed])
  await assert.rejects(
    migration.runMigration({ env, apply: true, ...fake, waitOptions: { attempts: 4, sleep: async () => {} } }),
    /PATCH accepted.*failed/i,
  )
  assert.equal(fake.calls.filter(c => c.method === 'PATCH').length, 1)
})
test('accepted PATCH times out after bounded processing polls', async () => {
  const fake = transport([old, old, processing, processing, processing])
  let sleeps = 0
  await assert.rejects(
    migration.runMigration({
      env, apply: true, ...fake,
      waitOptions: { attempts: 3, sleep: async () => { sleeps += 1 } },
    }),
    /PATCH accepted.*timeout.*processing/i,
  )
  assert.equal(sleeps, 2)
  assert.equal(fake.calls.filter(c => c.method === 'PATCH').length, 1)
})
test('accepted PATCH rejects an available postcheck with schema drift', async () => {
  const drifted = { ...target, required: true }
  const fake = transport([old, old, drifted])
  await assert.rejects(
    migration.runMigration({ env, apply: true, ...fake, waitOptions: { attempts: 2, sleep: async () => {} } }),
    /PATCH accepted.*schema drift/i,
  )
  assert.equal(fake.calls.filter(c => c.method === 'PATCH').length, 1)
})
test('mapping errors, failed HTTP, concurrent drift and failed postcheck stop safely', async () => {
  for (const bad of [{ APPWRITE_PROJECT_ID: 'different' }, { APPWRITE_API_KEY: '' }, { VITE_MARKET: 'KR' }, { APPWRITE_ENDPOINT: 'http://unsafe/v1', VITE_APPWRITE_ENDPOINT: 'http://unsafe/v1' }]) {
    const fake = transport(); await assert.rejects(migration.runMigration({ env: { ...env, ...bad }, ...fake })); assert.equal(fake.calls.length, 0)
  }
  const drift = transport([old, { ...old, min: 2 }]); await assert.rejects(migration.runMigration({ env, apply: true, ...drift })); assert.ok(drift.calls.every(c => c.method === 'GET'))
  const failed = transport([old, old, old]); await assert.rejects(migration.runMigration({ env, apply: true, ...failed })); assert.equal(failed.calls.filter(c => c.method === 'PATCH').length, 1)
  await assert.rejects(migration.runMigration({ env, fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/)
})
test('CLI flags default to dry-run and reject unknown or conflicting flags', () => {
  assert.deepEqual(migration.parseArgs([]), { apply: false })
  assert.deepEqual(migration.parseArgs(['--env-file', '/private/.env.local', '--apply']), { apply: true, envFile: '/private/.env.local' })
  for (const args of [['--force'], ['--env-file'], ['--apply', '--dry-run'], ['--apply', '--apply']]) assert.throws(() => migration.parseArgs(args))
})
test('fresh setup schema matches the broad quantity technical bound', () => {
  assert.match(readFileSync(new URL('../scripts/setup-appwrite.mjs', import.meta.url), 'utf8'), /\{ key: 'quantity', type: 'integer', required: false, min: 1, max: 2147483647 \}/)
})
