import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES,
  AU_EMAIL_REMINDER_INDEXES,
} from '../scripts/au-email-schema-contract.mjs'
import {
  buildAuEmailSchemaTargets,
  runAuEmailSchemaMigrationCommand,
  runAuEmailSchemaMigration,
} from '../scripts/migrate-au-email-schema.mjs'
import { REVIEW_COLLECTIONS } from '../scripts/review-schema.mjs'

const ENV = Object.freeze({
  APPWRITE_ENDPOINT: 'https://appwrite.example.test/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  APPWRITE_KIDS_DATABASE_ID: 'kids_db',
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_REVIEW_INVITES_TABLE_ID: 'review_invites',
})
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function missingResource(label) {
  return Object.assign(new Error(`${label} missing`), { code: 404 })
}

function targetKey(databaseId, collectionId, key) {
  return `${databaseId}/${collectionId}/${key}`
}

function appwriteAttribute(definition, status = 'available') {
  if (definition.type === 'enum') {
    return {
      key: definition.key, type: 'string', format: 'enum', elements: definition.elements,
      required: definition.required, array: false, default: null, status,
    }
  }
  if (definition.type === 'integer') {
    return {
      key: definition.key, type: 'integer', required: definition.required, array: false, default: null,
      min: BigInt(definition.min ?? '-9223372036854775808'),
      max: BigInt(definition.max ?? '9223372036854775807'),
      status,
    }
  }
  return {
    key: definition.key, type: definition.type, format: '', encrypt: false,
    required: definition.required, array: false, size: definition.size, default: null, status,
  }
}

function createFakeSchemaAdapter({ targets = buildAuEmailSchemaTargets(ENV) } = {}) {
  const calls = []
  const existingCollections = new Map([
    ['cake_db/reservations', { name: 'reservations', $permissions: [], documentSecurity: false, enabled: true }],
    ['kids_db/class_reservations', { name: 'class_reservations', $permissions: [], documentSecurity: false, enabled: true }],
    ['cake_db/review_invites', { name: 'review_invites', $permissions: [], documentSecurity: false, enabled: true }],
  ])
  const attributes = new Map()
  const indexes = new Map()
  const attributeStatusSequences = new Map()
  const indexStatusSequences = new Map()
  const definitions = new Map([
    ...targets.attributes.map((target) => [targetKey(target.databaseId, target.collectionId, target.attribute.key), target.attribute]),
    ...targets.collections.flatMap((target) => target.definition.attributes.map((attribute) =>
      [targetKey(target.databaseId, target.collectionId, attribute.key), attribute])),
  ])
  return {
    calls,
    collections: existingCollections,
    attributes,
    indexes,
    attributeStatusSequences,
    indexStatusSequences,
    async getDatabase({ databaseId }) {
      calls.push(['getDatabase', databaseId])
      if (!['cake_db', 'kids_db'].includes(databaseId)) throw missingResource('database')
      return { $id: databaseId }
    },
    async getCollection({ databaseId, collectionId }) {
      calls.push(['getCollection', databaseId, collectionId])
      const current = existingCollections.get(`${databaseId}/${collectionId}`)
      if (!current) throw missingResource('collection')
      return current
    },
    async getAttribute({ databaseId, collectionId, key }) {
      calls.push(['getAttribute', databaseId, collectionId, key])
      const resourceKey = targetKey(databaseId, collectionId, key)
      let current = attributes.get(resourceKey)
      if (!current) throw missingResource('attribute')
      const statuses = attributeStatusSequences.get(resourceKey)
      if (statuses?.length) {
        current = { ...current, status: statuses.shift() }
        attributes.set(resourceKey, current)
      }
      return current
    },
    async getIndex({ databaseId, collectionId, key }) {
      calls.push(['getIndex', databaseId, collectionId, key])
      const resourceKey = targetKey(databaseId, collectionId, key)
      let current = indexes.get(resourceKey)
      if (!current) throw missingResource('index')
      const statuses = indexStatusSequences.get(resourceKey)
      if (statuses?.length) {
        current = { ...current, status: statuses.shift() }
        indexes.set(resourceKey, current)
      }
      return current
    },
    async createCollection(params) {
      calls.push(['createCollection', params])
      existingCollections.set(`${params.databaseId}/${params.collectionId}`, {
        name: params.name, $permissions: params.permissions, documentSecurity: params.documentSecurity, enabled: params.enabled,
      })
    },
    async createStringAttribute(params) {
      calls.push(['createStringAttribute', params])
      const definition = definitions.get(targetKey(params.databaseId, params.collectionId, params.key))
      attributes.set(targetKey(params.databaseId, params.collectionId, params.key), appwriteAttribute(definition))
    },
    async createIntegerAttribute(params) {
      calls.push(['createIntegerAttribute', params])
      const definition = definitions.get(targetKey(params.databaseId, params.collectionId, params.key))
      attributes.set(targetKey(params.databaseId, params.collectionId, params.key), appwriteAttribute(definition))
    },
    async createEnumAttribute(params) {
      calls.push(['createEnumAttribute', params])
      const definition = definitions.get(targetKey(params.databaseId, params.collectionId, params.key))
      attributes.set(targetKey(params.databaseId, params.collectionId, params.key), appwriteAttribute(definition))
    },
    async createIndex(params) {
      calls.push(['createIndex', params])
      indexes.set(targetKey(params.databaseId, params.collectionId, params.key), {
        key: params.key, type: params.type, attributes: params.attributes, orders: params.orders || [], status: 'available',
      })
    },
  }
}

test('AU email schema contract exposes only the optional customer email and ordered reminder composites', () => {
  assert.deepEqual(AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES, [
    { key: 'customerEmail', type: 'string', size: 120, required: false },
  ])
  assert.deepEqual(AU_EMAIL_REMINDER_INDEXES, {
    cake: [{ key: 'status_pickupDate_idx', type: 'key', attributes: ['status', 'pickupDate'] }],
    classFirst: [{ key: 'status_classDate_idx', type: 'key', attributes: ['status', 'classDate'] }],
    classAdvanced: [{ key: 'status_advancedClassDate_idx', type: 'key', attributes: ['status', 'advancedClassDate'] }],
  })
})

test('dry-run computes the exact additive AU email schema plan without any mutation', async () => {
  const adapter = createFakeSchemaAdapter()

  const targets = buildAuEmailSchemaTargets(ENV)
  const result = await runAuEmailSchemaMigration({ adapter, env: ENV, targets })

  assert.equal(result.mode, 'dry-run')
  assert.equal(result.safeToApply, true, JSON.stringify(result.drift))
  assert.deepEqual(result.create.map(({ key }) => key), [
    'reservations.customerEmail',
    'review_invites.tokenCiphertext',
    'review_invites.tokenIv',
    'review_invites.tokenAuthTag',
    'review_invites.tokenEncryptionVersion',
    'email_deliveries',
    'email_delivery_retry_claims',
    'reservations.status_pickupDate_idx',
    'class_reservations.status_classDate_idx',
    'class_reservations.status_advancedClassDate_idx',
  ])
  assert.equal(adapter.calls.every(([method]) => method.startsWith('get')), true)
})

test('apply requires the explicit AU guard before it reads or creates any schema resource', async () => {
  const adapter = createFakeSchemaAdapter()

  await assert.rejects(
    () => runAuEmailSchemaMigration({ adapter, env: ENV, mode: 'apply' }),
    { code: 'AU_EMAIL_SCHEMA_APPLY_CONFIRMATION_REQUIRED' },
  )

  assert.deepEqual(adapter.calls, [])
})

test('apply creates exactly the approved additive resources in dependency order', async () => {
  const adapter = createFakeSchemaAdapter()

  const result = await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  })

  assert.equal(result.applied, true)
  const writes = adapter.calls.filter(([method]) => !method.startsWith('get'))
  assert.equal(writes.every(([method]) => [
    'createCollection', 'createStringAttribute', 'createIntegerAttribute', 'createEnumAttribute', 'createIndex',
  ].includes(method)), true)
  assert.deepEqual(writes.slice(0, 5).map(([method, params]) => [method, params.collectionId, params.key]), [
    ['createStringAttribute', 'reservations', 'customerEmail'],
    ['createStringAttribute', 'review_invites', 'tokenCiphertext'],
    ['createStringAttribute', 'review_invites', 'tokenIv'],
    ['createStringAttribute', 'review_invites', 'tokenAuthTag'],
    ['createIntegerAttribute', 'review_invites', 'tokenEncryptionVersion'],
  ])
  assert.deepEqual(writes.filter(([method]) => method === 'createCollection').map(([, params]) => ({
    collectionId: params.collectionId, permissions: params.permissions, documentSecurity: params.documentSecurity,
  })), [
    { collectionId: 'email_deliveries', permissions: [], documentSecurity: false },
    { collectionId: 'email_delivery_retry_claims', permissions: [], documentSecurity: false },
  ])
  assert.deepEqual(writes.filter(([method]) => method === 'createIndex').slice(-3).map(([, params]) => ({
    key: params.key, attributes: params.attributes, type: params.type,
  })), [
    { key: 'status_pickupDate_idx', attributes: ['status', 'pickupDate'], type: 'key' },
    { key: 'status_classDate_idx', attributes: ['status', 'classDate'], type: 'key' },
    { key: 'status_advancedClassDate_idx', attributes: ['status', 'advancedClassDate'], type: 'key' },
  ])
})

test('attribute creation preserves source bounds without sending undefined Appwrite parameters', async () => {
  const adapter = createFakeSchemaAdapter()

  await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  })

  const attempts = adapter.calls.find(([method, params]) =>
    method === 'createIntegerAttribute' && params.collectionId === 'email_deliveries' && params.key === 'attempts')
  assert.deepEqual(attempts, [
    'createIntegerAttribute',
    { databaseId: 'cake_db', collectionId: 'email_deliveries', key: 'attempts', required: true, min: 0 },
  ])
})

test('any preflight drift prevents every schema write before apply begins', async () => {
  const adapter = createFakeSchemaAdapter()
  adapter.attributes.set(
    'cake_db/reservations/customerEmail',
    appwriteAttribute({ key: 'customerEmail', type: 'string', size: 120, required: true }),
  )

  const result = await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
  })

  assert.equal(result.safeToApply, false)
  assert.deepEqual(result.drift, [{ key: 'reservations.customerEmail', reason: 'ATTRIBUTE_DEFINITION_MISMATCH' }])
  assert.equal(adapter.calls.every(([method]) => method.startsWith('get')), true)
})

test('required project/database/table verification fails closed before a missing target can cause a write', async () => {
  const adapter = createFakeSchemaAdapter()
  const originalGetDatabase = adapter.getDatabase
  adapter.getDatabase = async ({ databaseId }) => {
    if (databaseId === 'kids_db') throw missingResource('database')
    return originalGetDatabase({ databaseId })
  }

  const result = await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
  })

  assert.equal(result.safeToApply, false)
  assert.deepEqual(result.drift, [{ key: 'database.kids_db', reason: 'TARGET_NOT_FOUND' }])
  assert.equal(adapter.calls.every(([method]) => method.startsWith('get')), true)
})

test('index and private table permission drift are fail-closed without any mutation', async () => {
  const indexAdapter = createFakeSchemaAdapter()
  indexAdapter.indexes.set('cake_db/reservations/status_pickupDate_idx', {
    key: 'status_pickupDate_idx', type: 'key', attributes: ['pickupDate', 'status'], orders: [], status: 'available',
  })
  const indexResult = await runAuEmailSchemaMigration({
    adapter: indexAdapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
  })
  assert.equal(indexResult.safeToApply, false)
  assert.equal(indexAdapter.calls.every(([method]) => method.startsWith('get')), true)

  const permissionAdapter = createFakeSchemaAdapter()
  permissionAdapter.collections.set('cake_db/email_deliveries', {
    name: 'email_deliveries', $permissions: ['read("any")'], documentSecurity: false, enabled: true,
  })
  const permissionResult = await runAuEmailSchemaMigration({
    adapter: permissionAdapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
  })
  assert.equal(permissionResult.safeToApply, false)
  assert.equal(permissionAdapter.calls.every(([method]) => method.startsWith('get')), true)
})

test('a completed apply is resumable: the second guarded apply makes zero writes', async () => {
  const adapter = createFakeSchemaAdapter()
  const options = {
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  }

  await runAuEmailSchemaMigration(options)
  const writesAfterFirstApply = adapter.calls.filter(([method]) => !method.startsWith('get')).length
  const result = await runAuEmailSchemaMigration(options)

  assert.equal(result.safeToApply, true, JSON.stringify(result.drift))
  assert.deepEqual(result.create, [])
  assert.equal(adapter.calls.filter(([method]) => !method.startsWith('get')).length, writesAfterFirstApply)
})

test('all target reads finish before the first additive create call', async () => {
  const adapter = createFakeSchemaAdapter()
  await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  })

  const firstWrite = adapter.calls.findIndex(([method]) => !method.startsWith('get'))
  assert.equal(firstWrite > 0, true)
  assert.equal(adapter.calls.slice(0, firstWrite).every(([method]) => method.startsWith('get')), true)
})

test('a partial prior apply skips matching resources and creates only remaining allowlisted resources', async () => {
  const adapter = createFakeSchemaAdapter()
  adapter.attributes.set(
    'cake_db/reservations/customerEmail',
    appwriteAttribute({ key: 'customerEmail', type: 'string', size: 120, required: false }),
  )

  await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  })

  assert.equal(adapter.calls.some(([method, params]) =>
    method === 'createStringAttribute' && params.collectionId === 'reservations' && params.key === 'customerEmail'), false)
  assert.equal(adapter.calls.some(([method]) => method === 'createCollection'), true)
})

test('creation waits for availability and stops on failed or timed-out asynchronous resources', async () => {
  const availableAdapter = createFakeSchemaAdapter()
  availableAdapter.attributeStatusSequences.set('cake_db/reservations/customerEmail', ['processing', 'available'])
  await runAuEmailSchemaMigration({
    adapter: availableAdapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 2, sleep: async () => {} },
  })
  assert.equal(availableAdapter.calls.filter(([method, , , key]) => method === 'getAttribute' && key === 'customerEmail').length >= 3, true)

  const failedAdapter = createFakeSchemaAdapter()
  failedAdapter.attributeStatusSequences.set('cake_db/reservations/customerEmail', ['failed'])
  await assert.rejects(
    () => runAuEmailSchemaMigration({
      adapter: failedAdapter,
      env: ENV,
      mode: 'apply',
      confirmation: 'AU',
      waitOptions: { attempts: 1, sleep: async () => {} },
    }),
    { code: 'AU_EMAIL_SCHEMA_ATTRIBUTE_FAILED' },
  )
  assert.deepEqual(failedAdapter.calls.filter(([method]) => !method.startsWith('get')).map(([method]) => method), ['createStringAttribute'])

  const timedOutAdapter = createFakeSchemaAdapter()
  timedOutAdapter.attributeStatusSequences.set('cake_db/reservations/customerEmail', ['processing'])
  await assert.rejects(
    () => runAuEmailSchemaMigration({
      adapter: timedOutAdapter,
      env: ENV,
      mode: 'apply',
      confirmation: 'AU',
      waitOptions: { attempts: 1, sleep: async () => {} },
    }),
    { code: 'AU_EMAIL_SCHEMA_ATTRIBUTE_TIMEOUT' },
  )
})

test('migration source and adapter trace permit no document, update, delete, or replace operation', async () => {
  const source = await readFile(new URL('../scripts/migrate-au-email-schema.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(?:delete(?:Attribute|Index|Collection|Document)|update(?:Attribute|Index|Collection|Document)|createDocument|deleteDocument|updateDocument)\b/)

  const adapter = createFakeSchemaAdapter()
  await runAuEmailSchemaMigration({
    adapter,
    env: ENV,
    mode: 'apply',
    confirmation: 'AU',
    waitOptions: { attempts: 1, sleep: async () => {} },
  })
  assert.equal(adapter.calls.every(([method]) => !/(?:Document|delete|update)/i.test(method)), true)
})

test('migration target definitions are the exact private source definitions, with all allowed fields only', () => {
  const targets = buildAuEmailSchemaTargets(ENV)
  assert.deepEqual(targets.attributes.map((target) => target.attribute), [
    ...AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES,
    ...['tokenCiphertext', 'tokenIv', 'tokenAuthTag', 'tokenEncryptionVersion'].map((key) =>
      REVIEW_COLLECTIONS.reviewInvites.attributes.find((attribute) => attribute.key === key)),
  ])
  assert.deepEqual(targets.collections.map(({ collection, definition }) => ({ collection, definition })), [
    {
      collection: { name: 'email_deliveries', permissions: [], documentSecurity: false, enabled: true },
      definition: REVIEW_COLLECTIONS.emailDeliveries,
    },
    {
      collection: { name: 'email_delivery_retry_claims', permissions: [], documentSecurity: false, enabled: true },
      definition: REVIEW_COLLECTIONS.emailDeliveryRetryClaims,
    },
  ])
  assert.deepEqual(targets.indexes.map(({ index }) => index), [
    ...AU_EMAIL_REMINDER_INDEXES.cake,
    ...AU_EMAIL_REMINDER_INDEXES.classFirst,
    ...AU_EMAIL_REMINDER_INDEXES.classAdvanced,
  ])
})

test('the migration command defaults to an offline, write-free dry-run when no target credentials are configured', () => {
  const result = spawnSync(process.execPath, ['scripts/migrate-au-email-schema.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {},
  })

  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.safeToApply, false)
  assert.equal(plan.reason, 'OFFLINE_TARGET_CONFIGURATION_REQUIRED')
  assert.equal(plan.requiredTargetConfiguration.includes('APPWRITE_API_KEY'), true)
})

test('the command rejects --apply without the AU guard before target configuration or mutation', () => {
  const result = spawnSync(process.execPath, ['scripts/migrate-au-email-schema.mjs', '--apply'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {},
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /AU_EMAIL_SCHEMA_APPLY_CONFIRMATION_REQUIRED/)
  assert.equal(result.stdout, '')
})

test('a configured dry-run reports the exact non-secret schema target identity', async () => {
  const adapter = createFakeSchemaAdapter()
  const result = await runAuEmailSchemaMigrationCommand({
    adapter,
    env: { ...ENV, APPWRITE_API_KEY: 'operator-key' },
    args: [],
    cwd: '/nonexistent',
  })

  assert.deepEqual(result.target, {
    projectId: 'project_au',
    cakeDatabaseId: 'cake_db',
    classDatabaseId: 'kids_db',
    cakeReservationsId: 'reservations',
    classReservationsId: 'class_reservations',
    reviewInvitesId: 'review_invites',
    emailDeliveriesId: 'email_deliveries',
    retryClaimsId: 'email_delivery_retry_claims',
  })
})

test('canonical scripts and production rollout guidance use the dedicated additive migration, never setup-appwrite', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const rollout = await readFile(new URL('../docs/superpowers/plans/2026-08-27-au-email-production-rollout.md', import.meta.url), 'utf8')

  assert.equal(packageJson.scripts['migrate:au-email-schema'], 'node scripts/migrate-au-email-schema.mjs')
  assert.equal(packageJson.scripts['test:au-email-schema-migration'], 'node --test tests/au-email-schema-migration.test.mjs')
  assert.match(packageJson.scripts.test, /test:au-email-schema-migration/)
  assert.match(readme, /DO NOT use setup:appwrite for this AU email production rollout/)
  assert.match(readme, /npm run migrate:au-email-schema -- --apply --market=AU/)
  assert.match(rollout, /npm run migrate:au-email-schema/)
  assert.doesNotMatch(rollout, /schema helper may tighten a partial legacy ledger permission pattern/)
})
