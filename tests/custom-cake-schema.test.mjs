import test from 'node:test'
import assert from 'node:assert/strict'
import { Client, Databases, Storage } from 'node-appwrite'
import { createServer } from 'node:http'

const load = async () => { try { return await import('../scripts/migrate-custom-cake-schema.mjs') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }

// Actual SDK serializes/parses HTTP requests to an isolated loopback fake service.
// Complete schema responses include definitions, availability and permissions.
async function harness(run, { existing = false, drift, onRead } = {}) {
  const calls = [], resources = new Map()
  const m = await load(); assert.equal(typeof m.buildCustomCakeSchemaTargets, 'function')
  let targets
  const seedResources = () => {
  if (existing) {
    for (const c of targets.collections) resources.set(`/databases/synthetic-db/collections/${c.collectionId}`, { $id: c.collectionId, databaseId: 'synthetic-db', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', $permissions: [], name: c.name, documentSecurity: false, enabled: true, attributes: c.attributes.map(a => ({ ...a, array: false, default: null, status: 'available', ...(a.type === 'string' ? { format: '', encrypt: false } : {}) })), indexes: c.indexes.map(i => ({ ...i, status: 'available', lengths: [] })) })
    resources.set(`/storage/buckets/${targets.bucket.bucketId}`, { ...targets.bucket, $id: targets.bucket.bucketId, $permissions: [], $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z' })
    if (drift) drift(resources, targets)
  }
  }
  const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0].replace(/^\/v1/, ''), method = req.method
    let body = ''; for await (const chunk of req) body += chunk
    calls.push({ method, path, body: body ? JSON.parse(body) : null })
    if (onRead && method === 'GET') onRead(resources, targets, calls)
    const ok = data => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    if (method === 'POST') {
      const input = JSON.parse(body)
      if (path === '/databases/synthetic-db/collections') {
        const value = { ...input, $id: input.collectionId, databaseId: 'synthetic-db', $permissions: input.permissions, attributes: [], indexes: [] }
        resources.set(`${path}/${input.collectionId}`, value); return ok(value)
      }
      if (path === '/storage/buckets') { const value = { ...input, $id: input.bucketId, $permissions: input.permissions }; resources.set(`${path}/${input.bucketId}`, value); return ok(value) }
      const attr = path.match(/^(.*\/collections\/[^/]+)\/attributes\/(string|integer)$/)
      if (attr) { const value = { ...input, type: attr[2], status: 'available', array: false, default: null, ...(attr[2] === 'string' ? { format: '', encrypt: false } : {}) }; resources.get(attr[1]).attributes.push(value); resources.set(`${attr[1]}/attributes/${input.key}`, value); return ok(value) }
      if (path.endsWith('/indexes')) { const value = { ...input, status: 'available', lengths: [] }; resources.get(path.slice(0, -8)).indexes.push(value); resources.set(`${path}/${input.key}`, value); return ok(value) }
    }
    if (method !== 'GET') { res.writeHead(500); return res.end('unexpected mutation') }
    if (path === '/databases/synthetic-db') return ok({ $id: 'synthetic-db', name: 'Synthetic', enabled: true, $createdAt: '', $updatedAt: '' })
    if (resources.has(path)) return ok(resources.get(path))
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'not found', code: 404, type: 'general_not_found' }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  targets = m.buildCustomCakeSchemaTargets({ endpoint: `http://127.0.0.1:${server.address().port}/v1`, projectId: 'synthetic-project', databaseId: 'synthetic-db' })
  seedResources()
  try {
    const client = new Client().setEndpoint(`http://127.0.0.1:${server.address().port}/v1`).setProject('synthetic-project').setKey('synthetic-key')
    const adapter = m.createCustomCakeSchemaAdapter({ databases: new Databases(client), storage: new Storage(client) })
    return await run({ m, adapter, targets, calls, resources })
  } finally { await new Promise(resolve => server.close(resolve)) }
}

test('dry-run defaults to read-only HTTP preflight and creates no private resources', async () => {
  await harness(async ({ m, adapter, targets, calls }) => {
    const result = await m.runCustomCakeSchemaMigration({ adapter, targets })
    assert.equal(result.mode, 'dry-run'); assert.equal(result.safeToApply, true); assert.equal(result.create.length, 11)
    assert.ok(calls.every(c => c.method === 'GET'))
    assert.equal(typeof result.confirmation, 'string')
  })
})

test('confirmed apply adds private schema only and verifies every created resource over actual SDK HTTP', async () => {
  await harness(async ({ m, adapter, targets, calls }) => {
    const result = await m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply', confirmation: m.customCakeMigrationConfirmation(targets), reconfirm: async value => value, waitOptions: { sleep: async () => {}, attempts: 1 } })
    assert.equal(result.applied, true)
    const writes = calls.filter(c => c.method !== 'GET')
    assert.equal(writes.length, 81)
    assert.ok(writes.every(c => c.method === 'POST'))
    assert.ok(writes.filter(c => c.path.endsWith('/collections') || c.path.endsWith('/buckets')).every(c => c.body.permissions.length === 0))
    assert.ok(writes.every(c => !c.path.includes('/documents')))
    const repeated = await m.runCustomCakeSchemaMigration({ adapter, targets })
    assert.equal(repeated.create.length, 0); assert.equal(repeated.safeToApply, true)
  })
})

test('target project mismatch fails before any HTTP request', async () => {
  await harness(async ({ m, adapter, targets, calls }) => {
    const wrong = m.buildCustomCakeSchemaTargets({ ...targets, projectId: 'other-project' })
    await assert.rejects(m.runCustomCakeSchemaMigration({ adapter, targets: wrong }), { code: 'CUSTOM_CAKE_SCHEMA_TARGET_DRIFT' })
    assert.equal(calls.length, 0)
  })
})

test('exact full schema fixture is accepted; unexpected permissions attributes indexes fail closed globally', async () => {
  await harness(async ({ m, adapter, targets, calls }) => {
    const r = await m.runCustomCakeSchemaMigration({ adapter, targets }); assert.equal(r.safeToApply, true); assert.equal(r.create.length, 0); assert.ok(calls.every(c => c.method === 'GET'))
  }, { existing: true })
  for (const drift of [
    (r, t) => r.get(`/databases/synthetic-db/collections/${t.collections[0].collectionId}`).$permissions.push('read("any")'),
    (r, t) => r.get(`/databases/synthetic-db/collections/${t.collections[0].collectionId}`).attributes.push({ key: 'unexpected', type: 'string', size: 10, required: false, status: 'available' }),
    (r, t) => r.get(`/databases/synthetic-db/collections/${t.collections[0].collectionId}`).indexes[0].orders = ['DESC'],
    (r, t) => { r.get(`/storage/buckets/${t.bucket.bucketId}`).fileSecurity = true },
  ]) await harness(async ({ m, adapter, targets, calls }) => {
    const r = await m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply', confirmation: m.customCakeMigrationConfirmation(targets), reconfirm: async c => c })
    assert.equal(r.safeToApply, false); assert.ok(r.drift.length); assert.ok(calls.every(c => c.method === 'GET'))
  }, { existing: true, drift })
})

test('apply requires target-bound explicit reconfirmation and repeats preflight before first write', async () => {
  await harness(async ({ m, adapter, targets, calls, resources }) => {
    await assert.rejects(m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply' }), { code: 'CUSTOM_CAKE_SCHEMA_CONFIRMATION_REQUIRED' })
    const r = await m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply', confirmation: m.customCakeMigrationConfirmation(targets), reconfirm: async confirmation => {
      resources.get(`/databases/synthetic-db/collections/${targets.collections[0].collectionId}`).enabled = false
      return confirmation
    } })
    assert.equal(r.safeToApply, false); assert.ok(calls.every(c => c.method === 'GET'))
  }, { existing: true })
})

for (const [name, mutate] of [
  ['collection ID', targets => { targets.collections[0].collectionId = 'legacy_table' }],
  ['bucket ID', targets => { targets.bucket.bucketId = 'legacy-photos' }],
  ['bucket permissions', targets => { targets.bucket.permissions.push('read("any")') }],
]) test(`reconfirmation mutation of ${name} fails closed with zero writes`, async () => {
  await harness(async ({ m, adapter, targets, calls }) => {
    let error
    try {
      await m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply', confirmation: m.customCakeMigrationConfirmation(targets), reconfirm: async confirmation => {
        mutate(targets)
        return confirmation
      }, waitOptions: { sleep: async () => {}, attempts: 1 } })
    } catch (caught) { error = caught }
    assert.equal(calls.filter(c => c.method !== 'GET').length, 0, 'mutated targets must never reach a write')
    assert.equal(error?.code, 'CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
  })
})

test('target mutation while second preflight awaits also fails closed with zero writes', async () => {
  let reconfirmed = false
  await harness(async ({ m, adapter, targets, calls }) => {
    let error
    try {
      await m.runCustomCakeSchemaMigration({ adapter, targets, mode: 'apply', confirmation: m.customCakeMigrationConfirmation(targets), reconfirm: async confirmation => {
        reconfirmed = true
        return confirmation
      }, waitOptions: { sleep: async () => {}, attempts: 1 } })
    } catch (caught) { error = caught }
    assert.equal(calls.filter(c => c.method !== 'GET').length, 0, 'mutated targets must never reach a write')
    assert.equal(error?.code, 'CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
  }, { onRead: (_resources, targets) => { if (reconfirmed) { reconfirmed = false; targets.bucket.permissions.push('read("any")') } } })
})
