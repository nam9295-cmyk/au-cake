import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAttributeDefinition, validateCollectionDefinition, validateIndexDefinition, reviewPhotoBucketMismatches, toAppwriteIndexCreate } from './review-schema.mjs'
import { CUSTOM_CAKE_RECORD_LIMIT, CUSTOM_CAKE_RESOURCE_KEYS } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'

const fail = code => { throw Object.assign(new Error(code), { code }) }
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const attributes = [
  { key: 'schemaVersion', type: 'integer', required: true, min: 1, max: 1 },
  { key: 'payloadJson', type: 'string', size: CUSTOM_CAKE_RECORD_LIMIT, required: true },
  { key: 'lookupKey', type: 'string', size: 64, required: true },
  { key: 'state', type: 'string', size: 32, required: true },
  { key: 'dueAt', type: 'string', size: 24, required: true },
]

// Intentionally fixed new resource IDs: this runner cannot target an old table,
// mutate its enums, update permissions, delete, or backfill existing documents.
export function buildCustomCakeSchemaTargets({ endpoint, projectId, databaseId } = {}) {
  if (!id.test(projectId || '') || !id.test(databaseId || '')) fail('CUSTOM_CAKE_SCHEMA_TARGET_REQUIRED')
  let url
  try { url = new URL(endpoint) } catch { fail('CUSTOM_CAKE_SCHEMA_TARGET_REQUIRED') }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) fail('CUSTOM_CAKE_SCHEMA_TARGET_REQUIRED')
  return {
    endpoint, projectId, databaseId,
    collections: CUSTOM_CAKE_RESOURCE_KEYS.map(kind => ({
      kind, collectionId: `custom_cake_${kind}`, name: `custom_cake_${kind}`,
      permissions: [], documentSecurity: false, enabled: true,
      attributes: structuredClone(attributes),
      indexes: [
        { key: 'lookup_key', type: kind === 'snapshots' ? 'unique' : 'key', attributes: ['lookupKey'], orders: ['ASC'] },
        { key: 'state_due', type: 'key', attributes: ['state', 'dueAt'], orders: ['ASC', 'ASC'] },
      ],
    })),
    bucket: { bucketId: 'custom-cake-photos', name: 'custom-cake-photos', permissions: [], fileSecurity: false, enabled: true, maximumFileSize: 10485760, allowedFileExtensions: ['webp'], compression: 'none', encryption: true, antivirus: true, transformations: false },
  }
}

function assertTargets(targets) {
  const expected = buildCustomCakeSchemaTargets(targets)
  if (JSON.stringify(expected) !== JSON.stringify(targets)) fail('CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
}

function frozenCopy(value) {
  function freeze(item) {
    if (item && typeof item === 'object') {
      for (const child of Object.values(item)) freeze(child)
      Object.freeze(item)
    }
    return item
  }
  return freeze(structuredClone(value))
}

export function customCakeMigrationConfirmation(targets) {
  assertTargets(targets)
  return `APPLY CUSTOM CAKE ${targets.endpoint} ${targets.projectId}/${targets.databaseId} ${createHash('sha256').update(JSON.stringify(targets)).digest('hex')}`
}

export function createCustomCakeSchemaAdapter({ databases, storage }) {
  return {
    assertTarget(targets) {
      for (const service of [databases, storage]) if (service.client?.config?.project !== targets.projectId || service.client?.config?.endpoint !== targets.endpoint) fail('CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
    },
    getDatabase: p => databases.get(p), getCollection: p => databases.getCollection(p),
    getAttribute: p => databases.getAttribute(p), getIndex: p => databases.getIndex(p),
    getBucket: p => storage.getBucket(p),
    createCollection: p => databases.createCollection(p), createStringAttribute: p => databases.createStringAttribute(p),
    createIntegerAttribute: p => databases.createIntegerAttribute(p), createIndex: p => databases.createIndex(p),
    createBucket: p => storage.createBucket(p),
  }
}

async function optional(read) { try { return await read() } catch (error) { if (error?.code === 404) return null; throw error } }

async function inspect(adapter, targets) {
  const drift = [], create = []
  const database = await adapter.getDatabase({ databaseId: targets.databaseId })
  if (database.$id !== targets.databaseId || database.enabled !== true) drift.push('database identity or enabled state differs')
  for (const c of targets.collections) {
    const params = { databaseId: targets.databaseId, collectionId: c.collectionId }
    const current = await optional(() => adapter.getCollection(params))
    if (!current) { create.push({ kind: 'collection', target: c }); continue }
    try {
      validateCollectionDefinition(c.collectionId, current, c)
      if (current.$id !== c.collectionId || current.databaseId !== targets.databaseId) throw new Error('collection identity differs')
      for (const [field, validator] of [['attributes', validateAttributeDefinition], ['indexes', validateIndexDefinition]]) {
        if (!Array.isArray(current[field])) throw new Error(`${field} absent`)
        const keys = current[field].map(v => v.key)
        if (new Set(keys).size !== keys.length || keys.some(k => !c[field].some(v => v.key === k))) throw new Error(`unexpected ${field}`)
        for (const expected of c[field]) {
          const actual = current[field].find(v => v.key === expected.key)
          if (!actual) { create.push({ kind: field === 'attributes' ? 'attribute' : 'index', collectionId: c.collectionId, target: expected }); continue }
          if (actual.status !== 'available') throw new Error(`${expected.key} unavailable`)
          validator(c.collectionId, expected, actual)
          if (field === 'indexes' && (actual.lengths || []).some(length => length !== 0)) throw new Error('index prefix length differs')
        }
      }
    } catch (error) { drift.push(`${c.collectionId}: ${error.message}`) }
  }
  const bucket = await optional(() => adapter.getBucket({ bucketId: targets.bucket.bucketId }))
  if (!bucket) create.push({ kind: 'bucket', target: targets.bucket })
  else {
    const mismatch = reviewPhotoBucketMismatches(bucket, targets.bucket)
    if (bucket.$id !== targets.bucket.bucketId || bucket.compression !== targets.bucket.compression) mismatch.push('bucket identity/compression differs')
    if (mismatch.length) drift.push(`${targets.bucket.bucketId}: ${mismatch.join(', ')}`)
  }
  return { create, drift, safeToApply: drift.length === 0 }
}

async function available(read, validate, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 30 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const value = await read()
    if (value.status === 'available') { validate(value); return }
    if (['failed', 'stuck'].includes(value.status)) fail('CUSTOM_CAKE_SCHEMA_CREATE_FAILED')
    if (i + 1 < attempts) await sleep(1000)
  }
  fail('CUSTOM_CAKE_SCHEMA_CREATE_TIMEOUT')
}

async function apply(adapter, targets, changes, waitOptions) {
  async function attribute(collectionId, a) {
    const params = { databaseId: targets.databaseId, collectionId, ...a }
    delete params.type
    if (a.type === 'integer') await adapter.createIntegerAttribute(params)
    else await adapter.createStringAttribute(params)
    await available(() => adapter.getAttribute({ databaseId: targets.databaseId, collectionId, key: a.key }), current => validateAttributeDefinition(collectionId, a, current), waitOptions)
  }
  async function index(collectionId, i) {
    await adapter.createIndex({ databaseId: targets.databaseId, collectionId, ...toAppwriteIndexCreate(i) })
    await available(() => adapter.getIndex({ databaseId: targets.databaseId, collectionId, key: i.key }), current => validateIndexDefinition(collectionId, i, current), waitOptions)
  }
  for (const change of changes) {
    if (change.kind === 'collection') {
      const c = change.target
      await adapter.createCollection({ databaseId: targets.databaseId, collectionId: c.collectionId, name: c.name, permissions: [], documentSecurity: false, enabled: true })
      for (const a of c.attributes) await attribute(c.collectionId, a)
      for (const i of c.indexes) await index(c.collectionId, i)
    } else if (change.kind === 'attribute') await attribute(change.collectionId, change.target)
    else if (change.kind === 'index') await index(change.collectionId, change.target)
    else if (change.kind === 'bucket') await adapter.createBucket(change.target)
  }
}

/** No env loading or automatic client construction. Explicit injected services
 * are required even for online preflight. Apply requires a second target-bound
 * confirmation after displaying preflight, then repeats every read. */
export async function runCustomCakeSchemaMigration({ adapter, targets, mode = 'dry-run', confirmation, reconfirm, waitOptions } = {}) {
  if (!['dry-run', 'apply'].includes(mode)) fail('CUSTOM_CAKE_SCHEMA_INVALID_MODE')
  if (!adapter || !targets) {
    if (mode === 'apply') fail('CUSTOM_CAKE_SCHEMA_TARGET_REQUIRED')
    return { mode, network: false, safeToApply: false, reason: 'EXPLICIT_TARGET_AND_ADAPTER_REQUIRED' }
  }
  const required = customCakeMigrationConfirmation(targets)
  const approvedTargets = frozenCopy(targets)
  if (typeof adapter.assertTarget !== 'function') fail('CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
  const assertBinding = () => {
    let current
    try { current = customCakeMigrationConfirmation(targets) } catch { fail('CUSTOM_CAKE_SCHEMA_TARGET_DRIFT') }
    if (current !== required) fail('CUSTOM_CAKE_SCHEMA_TARGET_DRIFT')
    adapter.assertTarget(approvedTargets)
  }
  assertBinding()
  if (mode === 'apply' && (confirmation !== required || typeof reconfirm !== 'function')) fail('CUSTOM_CAKE_SCHEMA_CONFIRMATION_REQUIRED')
  const first = frozenCopy(await inspect(adapter, approvedTargets))
  assertBinding()
  const result = { mode, network: true, confirmation: required, ...first }
  if (mode === 'dry-run' || !first.safeToApply) return result
  if (await reconfirm(required, structuredClone(result)) !== required) fail('CUSTOM_CAKE_SCHEMA_CONFIRMATION_REQUIRED')
  assertBinding()
  const second = frozenCopy(await inspect(adapter, approvedTargets))
  assertBinding()
  if (!second.safeToApply) return { ...result, ...second }
  if (JSON.stringify(second) !== JSON.stringify(first)) return { ...result, safeToApply: false, drift: ['schema changed after confirmation'] }
  await apply(adapter, approvedTargets, second.create, waitOptions)
  const verified = await inspect(adapter, approvedTargets)
  if (!verified.safeToApply || verified.create.length) fail('CUSTOM_CAKE_SCHEMA_VERIFICATION_FAILED')
  return { ...result, applied: true }
}

// The CLI is deliberately offline. A reviewed operator harness must explicitly
// supply both target and adapter to opt in; .env.local is never loaded here.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) { console.error('CUSTOM_CAKE_SCHEMA_EXPLICIT_ADAPTER_REQUIRED'); process.exitCode = 1 }
  else console.log(JSON.stringify(await runCustomCakeSchemaMigration(), null, 2))
}
