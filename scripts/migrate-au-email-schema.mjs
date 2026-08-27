import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES,
  AU_EMAIL_REMINDER_INDEXES,
} from './au-email-schema-contract.mjs'
import {
  REVIEW_COLLECTIONS,
  resolveReviewResourceIds,
  toAppwriteIndexCreate,
  validateAttributeDefinition,
  validateCollectionDefinition,
  validateIndexDefinition,
} from './review-schema.mjs'

const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const DEFAULT_WAIT_ATTEMPTS = 30
const DEFAULT_WAIT_MS = 1000

export const AU_EMAIL_SCHEMA_MODE_DRY_RUN = 'dry-run'
export const AU_EMAIL_SCHEMA_MODE_APPLY = 'apply'
export const AU_EMAIL_SCHEMA_APPLY_MARKET = 'AU'

export class AuEmailSchemaMigrationError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function resourceId(env, key) {
  const value = String(env[key] || '').trim()
  if (!RESOURCE_ID.test(value)) throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_TARGET')
  return value
}

function endpoint(env) {
  const value = String(env.APPWRITE_ENDPOINT || '').trim()
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_TARGET')
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_TARGET')
  }
  return value
}

function targetKey(databaseId, collectionId, key) {
  return `${databaseId}/${collectionId}/${key}`
}

function missing(error) {
  return error?.code === 404
}

function definitionMatches(validate, ...args) {
  try {
    validate(...args)
    return true
  } catch {
    return false
  }
}

function available(resource) {
  return resource?.status === undefined || resource.status === 'available'
}

function privateCollectionDefinition(definition) {
  return {
    name: definition.name,
    permissions: [],
    documentSecurity: false,
    enabled: true,
  }
}

function attributeTarget(databaseId, collectionId, attribute) {
  return Object.freeze({
    kind: 'attribute',
    key: `${collectionId}.${attribute.key}`,
    databaseId,
    collectionId,
    attribute,
  })
}

function indexTarget(databaseId, collectionId, index) {
  return Object.freeze({
    kind: 'index',
    key: `${collectionId}.${index.key}`,
    databaseId,
    collectionId,
    index,
  })
}

function collectionTarget(databaseId, collectionId, definition) {
  return Object.freeze({
    kind: 'collection',
    key: collectionId,
    databaseId,
    collectionId,
    definition,
    collection: privateCollectionDefinition(definition),
  })
}

export function buildAuEmailSchemaTargets(env = {}) {
  const ids = resolveReviewResourceIds(env)
  const cakeDatabaseId = resourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const classDatabaseId = resourceId(env, 'APPWRITE_KIDS_DATABASE_ID')
  const cakeReservationsId = resourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID')
  const classReservationsId = resourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID')
  const reviewInvitesId = resourceId(env, 'APPWRITE_REVIEW_INVITES_TABLE_ID')
  const emailDeliveriesId = resourceId({ APPWRITE_EMAIL_DELIVERIES_TABLE_ID: ids.emailDeliveriesCollectionId }, 'APPWRITE_EMAIL_DELIVERIES_TABLE_ID')
  const retryClaimsId = resourceId({ APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID: ids.emailDeliveryRetryClaimsCollectionId }, 'APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID')

  return Object.freeze({
    endpoint: endpoint(env),
    projectId: resourceId(env, 'APPWRITE_PROJECT_ID'),
    cakeDatabaseId,
    classDatabaseId,
    cakeReservationsId,
    classReservationsId,
    reviewInvitesId,
    sourceCollections: Object.freeze([
      Object.freeze({ databaseId: cakeDatabaseId, collectionId: cakeReservationsId }),
      Object.freeze({ databaseId: classDatabaseId, collectionId: classReservationsId }),
      Object.freeze({ databaseId: cakeDatabaseId, collectionId: reviewInvitesId }),
    ]),
    attributes: Object.freeze([
      ...AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES.map((attribute) => attributeTarget(cakeDatabaseId, cakeReservationsId, attribute)),
      ...['tokenCiphertext', 'tokenIv', 'tokenAuthTag', 'tokenEncryptionVersion'].map((key) =>
        attributeTarget(cakeDatabaseId, reviewInvitesId, REVIEW_COLLECTIONS.reviewInvites.attributes.find((attribute) => attribute.key === key))),
    ]),
    collections: Object.freeze([
      collectionTarget(cakeDatabaseId, emailDeliveriesId, REVIEW_COLLECTIONS.emailDeliveries),
      collectionTarget(cakeDatabaseId, retryClaimsId, REVIEW_COLLECTIONS.emailDeliveryRetryClaims),
    ]),
    indexes: Object.freeze([
      ...AU_EMAIL_REMINDER_INDEXES.cake.map((index) => indexTarget(cakeDatabaseId, cakeReservationsId, index)),
      ...AU_EMAIL_REMINDER_INDEXES.classFirst.map((index) => indexTarget(classDatabaseId, classReservationsId, index)),
      ...AU_EMAIL_REMINDER_INDEXES.classAdvanced.map((index) => indexTarget(classDatabaseId, classReservationsId, index)),
    ]),
  })
}

function assertReadAdapter(adapter) {
  for (const method of ['getDatabase', 'getCollection', 'getAttribute', 'getIndex']) {
    if (typeof adapter?.[method] !== 'function') throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_ADAPTER')
  }
}

function assertCreateAdapter(adapter) {
  for (const method of ['createCollection', 'createStringAttribute', 'createIntegerAttribute', 'createEnumAttribute', 'createIndex']) {
    if (typeof adapter?.[method] !== 'function') throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_ADAPTER')
  }
}

async function inspectRequiredTarget(adapter, target) {
  const drift = []
  for (const databaseId of [target.cakeDatabaseId, target.classDatabaseId]) {
    try {
      await adapter.getDatabase({ databaseId })
    } catch {
      drift.push({ key: `database.${databaseId}`, reason: 'TARGET_NOT_FOUND' })
    }
  }
  for (const resource of target.sourceCollections) {
    try {
      await adapter.getCollection(resource)
    } catch {
      drift.push({ key: `${resource.collectionId}`, reason: 'TARGET_NOT_FOUND' })
    }
  }
  return drift
}

async function inspectAttribute(adapter, target) {
  try {
    const current = await adapter.getAttribute({
      databaseId: target.databaseId,
      collectionId: target.collectionId,
      key: target.attribute.key,
    })
    if (!available(current) || !definitionMatches(validateAttributeDefinition, target.collectionId, target.attribute, current)) {
      return { status: 'DRIFT', target, reason: 'ATTRIBUTE_DEFINITION_MISMATCH' }
    }
    return { status: 'EXISTS_MATCH', target }
  } catch (error) {
    if (missing(error)) return { status: 'CREATE', target }
    return { status: 'DRIFT', target, reason: 'ATTRIBUTE_READ_FAILED' }
  }
}

async function inspectIndex(adapter, target) {
  try {
    const current = await adapter.getIndex({
      databaseId: target.databaseId,
      collectionId: target.collectionId,
      key: target.index.key,
    })
    if (!available(current) || !definitionMatches(validateIndexDefinition, target.collectionId, target.index, current)) {
      return { status: 'DRIFT', target, reason: 'INDEX_DEFINITION_MISMATCH' }
    }
    return { status: 'EXISTS_MATCH', target }
  } catch (error) {
    if (missing(error)) return { status: 'CREATE', target }
    return { status: 'DRIFT', target, reason: 'INDEX_READ_FAILED' }
  }
}

async function inspectCollection(adapter, target) {
  try {
    const current = await adapter.getCollection({ databaseId: target.databaseId, collectionId: target.collectionId })
    if (!definitionMatches(validateCollectionDefinition, target.collectionId, current, target.collection)) {
      return { status: 'DRIFT', target, reason: 'COLLECTION_DEFINITION_MISMATCH' }
    }
    const attributes = await Promise.all(target.definition.attributes.map((attribute) =>
      inspectAttribute(adapter, attributeTarget(target.databaseId, target.collectionId, attribute))))
    const indexes = await Promise.all(target.definition.indexes.map((index) =>
      inspectIndex(adapter, indexTarget(target.databaseId, target.collectionId, index))))
    return { status: 'EXISTS_MATCH', target, attributes, indexes }
  } catch (error) {
    if (missing(error)) return { status: 'CREATE', target }
    return { status: 'DRIFT', target, reason: 'COLLECTION_READ_FAILED' }
  }
}

function flattenInspection(inspection) {
  if (inspection.status !== 'EXISTS_MATCH') return [inspection]
  return [inspection, ...(inspection.attributes || []), ...(inspection.indexes || [])]
}

export async function preflightAuEmailSchemaMigration(adapter, targets) {
  assertReadAdapter(adapter)
  const targetDrift = await inspectRequiredTarget(adapter, targets)
  const attributes = await Promise.all(targets.attributes.map((target) => inspectAttribute(adapter, target)))
  const collections = await Promise.all(targets.collections.map((target) => inspectCollection(adapter, target)))
  const indexes = await Promise.all(targets.indexes.map((target) => inspectIndex(adapter, target)))
  const inspections = [...attributes, ...collections, ...indexes]
  const entries = inspections.flatMap(flattenInspection)
  const drift = [
    ...targetDrift,
    ...entries.filter((entry) => entry.status === 'DRIFT').map(({ target, reason }) => ({ key: target.key, reason })),
  ]
  return {
    targets,
    inspections,
    create: entries.filter((entry) => entry.status === 'CREATE').map(({ target }) => target),
    existsMatch: entries.filter((entry) => entry.status === 'EXISTS_MATCH').map(({ target }) => target),
    drift,
    safeToApply: drift.length === 0,
  }
}

async function waitForAvailable(getter, label, { attempts = DEFAULT_WAIT_ATTEMPTS, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await getter()
    if (current?.status === 'available') return
    if (current?.status === 'failed' || current?.status === 'stuck') throw new AuEmailSchemaMigrationError(`AU_EMAIL_SCHEMA_${label}_FAILED`)
    if (attempt + 1 < attempts) await sleep(DEFAULT_WAIT_MS)
  }
  throw new AuEmailSchemaMigrationError(`AU_EMAIL_SCHEMA_${label}_TIMEOUT`)
}

async function createAttribute(adapter, target, waitOptions) {
  const params = { databaseId: target.databaseId, collectionId: target.collectionId, key: target.attribute.key, required: target.attribute.required }
  if (target.attribute.type === 'string') await adapter.createStringAttribute({ ...params, size: target.attribute.size })
  else if (target.attribute.type === 'integer') await adapter.createIntegerAttribute({
    ...params,
    ...(target.attribute.min !== undefined ? { min: target.attribute.min } : {}),
    ...(target.attribute.max !== undefined ? { max: target.attribute.max } : {}),
  })
  else if (target.attribute.type === 'enum') await adapter.createEnumAttribute({ ...params, elements: target.attribute.elements })
  else throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_UNSUPPORTED_ATTRIBUTE')
  await waitForAvailable(
    () => adapter.getAttribute({ databaseId: target.databaseId, collectionId: target.collectionId, key: target.attribute.key }),
    'ATTRIBUTE',
    waitOptions,
  )
}

async function createIndex(adapter, target, waitOptions) {
  await adapter.createIndex({
    databaseId: target.databaseId,
    collectionId: target.collectionId,
    ...toAppwriteIndexCreate(target.index),
  })
  await waitForAvailable(
    () => adapter.getIndex({ databaseId: target.databaseId, collectionId: target.collectionId, key: target.index.key }),
    'INDEX',
    waitOptions,
  )
}

async function createCollectionSchema(adapter, inspection, waitOptions) {
  const { target } = inspection
  await adapter.createCollection({
    databaseId: target.databaseId,
    collectionId: target.collectionId,
    ...target.collection,
  })
  for (const attribute of target.definition.attributes) {
    await createAttribute(adapter, attributeTarget(target.databaseId, target.collectionId, attribute), waitOptions)
  }
  for (const index of target.definition.indexes) {
    await createIndex(adapter, indexTarget(target.databaseId, target.collectionId, index), waitOptions)
  }
}

async function applyPreflight(adapter, preflight, waitOptions) {
  const simpleAttributes = preflight.inspections
    .filter((inspection) => inspection.target.kind === 'attribute' && inspection.status === 'CREATE')
  for (const inspection of simpleAttributes) await createAttribute(adapter, inspection.target, waitOptions)

  for (const inspection of preflight.inspections.filter((inspection) => inspection.target.kind === 'collection')) {
    if (inspection.status === 'CREATE') {
      await createCollectionSchema(adapter, inspection, waitOptions)
      continue
    }
    for (const attribute of inspection.attributes.filter((entry) => entry.status === 'CREATE')) {
      await createAttribute(adapter, attribute.target, waitOptions)
    }
    for (const index of inspection.indexes.filter((entry) => entry.status === 'CREATE')) {
      await createIndex(adapter, index.target, waitOptions)
    }
  }

  for (const inspection of preflight.inspections.filter((inspection) => inspection.target.kind === 'index' && inspection.status === 'CREATE')) {
    await createIndex(adapter, inspection.target, waitOptions)
  }
}

export async function runAuEmailSchemaMigration({
  adapter,
  env = process.env,
  targets = buildAuEmailSchemaTargets(env),
  mode = AU_EMAIL_SCHEMA_MODE_DRY_RUN,
  confirmation,
  waitOptions,
} = {}) {
  if (![AU_EMAIL_SCHEMA_MODE_DRY_RUN, AU_EMAIL_SCHEMA_MODE_APPLY].includes(mode)) {
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_MODE')
  }
  if (mode === AU_EMAIL_SCHEMA_MODE_APPLY && confirmation !== AU_EMAIL_SCHEMA_APPLY_MARKET) {
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_APPLY_CONFIRMATION_REQUIRED')
  }
  const preflight = await preflightAuEmailSchemaMigration(adapter, targets)
  const result = {
    mode,
    create: preflight.create,
    existsMatch: preflight.existsMatch,
    drift: preflight.drift,
    safeToApply: preflight.safeToApply,
  }
  if (mode === AU_EMAIL_SCHEMA_MODE_DRY_RUN || !preflight.safeToApply) return result

  assertCreateAdapter(adapter)
  await applyPreflight(adapter, preflight, waitOptions)
  return { ...result, applied: true }
}

const CLI_TARGET_KEYS = Object.freeze([
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_CAKE_DATABASE_ID',
  'APPWRITE_KIDS_DATABASE_ID',
  'APPWRITE_CAKE_RESERVATIONS_TABLE_ID',
  'APPWRITE_KIDS_RESERVATIONS_TABLE_ID',
  'APPWRITE_REVIEW_INVITES_TABLE_ID',
])

export function parseAuEmailSchemaMigrationArgs(args = []) {
  let mode = AU_EMAIL_SCHEMA_MODE_DRY_RUN
  let confirmation
  for (const argument of args) {
    if (argument === '--dry-run') continue
    if (argument === '--apply') {
      mode = AU_EMAIL_SCHEMA_MODE_APPLY
      continue
    }
    if (argument.startsWith('--market=')) {
      confirmation = argument.slice('--market='.length)
      continue
    }
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_INVALID_ARGUMENT')
  }
  return { mode, confirmation }
}

export function loadDotEnvLocal(env = process.env, cwd = process.cwd()) {
  const envPath = resolve(cwd, '.env.local')
  if (!existsSync(envPath)) return env
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in env)) env[key] = value
  }
  return env
}

function hasCliTargetConfiguration(env) {
  return CLI_TARGET_KEYS.every((key) => String(env[key] || '').trim())
}

export function buildOfflineAuEmailSchemaMigrationPlan() {
  return {
    title: 'AU Email Schema Migration',
    mode: AU_EMAIL_SCHEMA_MODE_DRY_RUN,
    network: false,
    safeToApply: false,
    reason: 'OFFLINE_TARGET_CONFIGURATION_REQUIRED',
    requiredTargetConfiguration: CLI_TARGET_KEYS,
  }
}

function publicTargetIdentity(targets) {
  return {
    projectId: targets.projectId,
    cakeDatabaseId: targets.cakeDatabaseId,
    classDatabaseId: targets.classDatabaseId,
    cakeReservationsId: targets.cakeReservationsId,
    classReservationsId: targets.classReservationsId,
    reviewInvitesId: targets.reviewInvitesId,
    emailDeliveriesId: targets.collections[0].collectionId,
    retryClaimsId: targets.collections[1].collectionId,
  }
}

export async function createAppwriteSchemaAdapter(env) {
  const { Client, Databases } = await import('node-appwrite')
  const databases = new Databases(new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY))
  return {
    getDatabase: (params) => databases.get(params),
    getCollection: (params) => databases.getCollection(params),
    getAttribute: (params) => databases.getAttribute(params),
    getIndex: (params) => databases.getIndex(params),
    createCollection: (params) => databases.createCollection(params),
    createStringAttribute: (params) => databases.createStringAttribute(params),
    createIntegerAttribute: (params) => databases.createIntegerAttribute(params),
    createEnumAttribute: (params) => databases.createEnumAttribute(params),
    createIndex: (params) => databases.createIndex(params),
  }
}

export async function runAuEmailSchemaMigrationCommand({
  args = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  adapter,
} = {}) {
  const options = parseAuEmailSchemaMigrationArgs(args)
  loadDotEnvLocal(env, cwd)
  if (options.mode === AU_EMAIL_SCHEMA_MODE_APPLY && options.confirmation !== AU_EMAIL_SCHEMA_APPLY_MARKET) {
    throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_APPLY_CONFIRMATION_REQUIRED')
  }
  if (!adapter && !hasCliTargetConfiguration(env)) {
    if (options.mode === AU_EMAIL_SCHEMA_MODE_APPLY) {
      throw new AuEmailSchemaMigrationError('AU_EMAIL_SCHEMA_TARGET_CONFIGURATION_REQUIRED')
    }
    return buildOfflineAuEmailSchemaMigrationPlan()
  }
  const targets = buildAuEmailSchemaTargets(env)
  const migrationAdapter = adapter || await createAppwriteSchemaAdapter(env)
  const result = await runAuEmailSchemaMigration({
    adapter: migrationAdapter,
    env,
    targets,
    mode: options.mode,
    confirmation: options.confirmation,
  })
  return {
    title: 'AU Email Schema Migration',
    network: true,
    target: publicTargetIdentity(targets),
    ...result,
  }
}

async function main() {
  try {
    const result = await runAuEmailSchemaMigrationCommand()
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error?.code || 'AU_EMAIL_SCHEMA_MIGRATION_FAILED')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
