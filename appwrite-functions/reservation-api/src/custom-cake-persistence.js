// Private additive storage only. No pricing, catalogue, transport authorization,
// Storage calls or runtime/environment activation is performed by this module.
import { createHash } from 'node:crypto'

export const CUSTOM_CAKE_RECORD_LIMIT = 65535
export const CUSTOM_CAKE_RESOURCE_KEYS = Object.freeze(['claims', 'snapshots', 'sessions', 'photos', 'quotas', 'outbox', 'commits'])
const resourceId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const fail = code => { throw Object.assign(new Error(code), { code }) }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const clone = value => JSON.parse(JSON.stringify(value))

export function resolveCustomCakePersistenceConfig(env = {}) {
  const config = { enabled: env.CUSTOM_CAKE_PERSISTENCE_ENABLED === 'true', databaseId: env.APPWRITE_CUSTOM_CAKE_DATABASE_ID, bucketId: env.APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID }
  for (const key of CUSTOM_CAKE_RESOURCE_KEYS) config[key] = env[`APPWRITE_CUSTOM_CAKE_${key.toUpperCase()}_TABLE_ID`]
  if (!config.enabled || ['databaseId', 'bucketId', ...CUSTOM_CAKE_RESOURCE_KEYS].some(key => !resourceId.test(config[key] || ''))) return { enabled: false }
  return config
}

function validJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') { if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('PERSISTENCE_INVALID_RECORD'); return }
  if (typeof value !== 'object' || seen.has(value) || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) fail('PERSISTENCE_INVALID_RECORD')
  seen.add(value)
  for (const entry of Object.values(value)) validJson(entry, seen)
  seen.delete(value)
}

function validate(kind, value) {
  if (!CUSTOM_CAKE_RESOURCE_KEYS.includes(kind) || !value || Array.isArray(value) || typeof value !== 'object') fail('PERSISTENCE_INVALID_RECORD')
  validJson(value)
  if (kind === 'snapshots') {
    const { request, creationResponse, lookupResponse, quoteHistory, transitionAudit } = value
    if (!request || !creationResponse || !lookupResponse || !Array.isArray(quoteHistory) || !Array.isArray(transitionAudit) || !['custom-cake.v1', 'cake-order.v2'].includes(request.contractVersion) || request.contractVersion !== creationResponse.contractVersion || request.contractVersion !== lookupResponse.contractVersion || request.requestId !== creationResponse.requestId) fail('PERSISTENCE_INVALID_RECORD')
  }
  if (kind === 'claims') {
    if (!uuid.test(value.requestId) || !['custom-cake.v1', 'cake-order.v2', 'cake-request-v1'].includes(value.wire) || typeof value.creatorScope !== 'string' || !value.creatorScope || value.creatorScope.length > 256 || !/^[a-f0-9]{64}$/.test(value.fingerprint) || !Object.hasOwn(value, 'creationResponse')) fail('PERSISTENCE_INVALID_RECORD')
  }
}

export function encodeCustomCakeRecord(kind, value) {
  validate(kind, value)
  const payloadJson = JSON.stringify(value)
  if (Buffer.byteLength(payloadJson, 'utf8') > CUSTOM_CAKE_RECORD_LIMIT) fail('PERSISTENCE_RECORD_TOO_LARGE')
  return { schemaVersion: 1, payloadJson }
}

export function decodeCustomCakeRecord(kind, document) {
  if (document?.schemaVersion !== 1 || typeof document.payloadJson !== 'string' || Buffer.byteLength(document.payloadJson, 'utf8') > CUSTOM_CAKE_RECORD_LIMIT) fail('PERSISTENCE_INVALID_RECORD')
  let value
  try { value = JSON.parse(document.payloadJson) } catch { fail('PERSISTENCE_INVALID_RECORD') }
  validate(kind, value)
  return value
}

export function customCakeDocumentId(namespace, value) {
  if (typeof namespace !== 'string' || !namespace || typeof value !== 'string' || !value) fail('PERSISTENCE_INVALID_RECORD')
  return createHash('sha256').update(`${namespace}\0${value}`).digest('hex').slice(0, 36)
}

function preserve(kind, before, after) {
  const immutable = kind === 'snapshots' ? ['request', 'creationResponse'] : kind === 'claims' || kind === 'commits' ? Object.keys(before) : []
  for (const key of immutable) if (!equal(before[key], after[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  if (kind === 'snapshots') {
    for (const key of ['quoteHistory', 'transitionAudit']) if (!equal(before[key], after[key]?.slice(0, before[key].length))) fail('PERSISTENCE_IMMUTABLE_RECORD')
    const old = before.lookupResponse, next = after.lookupResponse
    for (const key of ['contractVersion', 'requestNumber', 'reservationNumber', 'customer', 'pickup', 'lines', 'paidSmoreLines', 'pricing']) if (!equal(old[key], next[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
    if (old.acceptanceHistory && !equal(old.acceptanceHistory, next.acceptanceHistory?.slice(0, old.acceptanceHistory.length))) fail('PERSISTENCE_IMMUTABLE_RECORD')
    if (old.quote) for (const key of ['pricingPolicyVersion', 'promotionEligibilityAt', 'currency', 'baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity']) if (!equal(old.quote[key], next.quote?.[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  }
}

/** Inject a node-appwrite Databases service. Callbacks perform database work only:
 * never send mail/upload/delete files inside a transaction. All checks and fenced
 * writes (request, photo, session and quota) belong in the same callback. */
export function createCustomCakeRepository(databases, config = {}) {
  if (config.enabled !== true || ['databaseId', 'bucketId', ...CUSTOM_CAKE_RESOURCE_KEYS].some(key => !resourceId.test(config[key] || '')) || new Set(CUSTOM_CAKE_RESOURCE_KEYS.map(key => config[key])).size !== CUSTOM_CAKE_RESOURCE_KEYS.length) fail('CAPABILITY_UNAVAILABLE')
  function params(kind, id, transactionId) {
    if (!CUSTOM_CAKE_RESOURCE_KEYS.includes(kind) || !resourceId.test(id)) fail('PERSISTENCE_INVALID_RECORD')
    return { databaseId: config.databaseId, collectionId: config[kind], documentId: id, ...(transactionId ? { transactionId } : {}) }
  }
  async function get(kind, id, transactionId) {
    try { return decodeCustomCakeRecord(kind, await databases.getDocument(params(kind, id, transactionId))) } catch (error) { if (error?.code === 404) return null; throw error }
  }
  function replay(claim, identity) {
    if (!claim) return null
    for (const key of ['requestId', 'wire', 'creatorScope', 'fingerprint']) if (claim[key] !== identity[key]) fail('REQUEST_ID_CONFLICT')
    return clone(claim.creationResponse)
  }
  function unit(transactionId) {
    return {
      transactionId,
      get: (kind, id) => get(kind, id, transactionId),
      async create(kind, id, value) { await databases.createDocument({ ...params(kind, id, transactionId), data: encodeCustomCakeRecord(kind, value), permissions: [] }); return clone(value) },
      async replace(kind, id, value) {
        const before = await get(kind, id, transactionId)
        if (!before) fail('PERSISTENCE_NOT_FOUND')
        preserve(kind, before, value)
        await databases.updateDocument({ ...params(kind, id, transactionId), data: encodeCustomCakeRecord(kind, value), permissions: [] })
        return clone(value)
      },
      async claimRequest(identity, creationResponse) {
        const existing = await get('claims', identity.requestId, transactionId)
        if (existing) return { replay: true, creationResponse: replay(existing, identity) }
        await this.create('claims', identity.requestId, { ...identity, creationResponse })
        return { replay: false, creationResponse: clone(creationResponse) }
      },
    }
  }
  return {
    get: (kind, id) => get(kind, id),
    findReplay: async identity => replay(await get('claims', identity.requestId), identity),
    async atomic(operationId, work) {
      const id = customCakeDocumentId('custom-cake-operation-v1', operationId)
      const existing = await get('commits', id)
      if (existing) return clone(existing.result)
      const transaction = await databases.createTransaction({ ttl: 60 })
      const transactionId = transaction.$id
      if (!resourceId.test(transactionId || '')) fail('PERSISTENCE_UNCERTAIN')
      let committing = false
      try {
        const tx = unit(transactionId)
        const result = await work(tx)
        await tx.create('commits', id, { operationId, result })
        committing = true
        await databases.updateTransaction({ transactionId, commit: true })
        return clone(result)
      } catch (error) {
        if (committing) {
          let committed
          try { committed = await get('commits', id) } catch { fail('PERSISTENCE_UNCERTAIN') }
          if (committed) return clone(committed.result)
          if (error?.code !== 409) fail('PERSISTENCE_UNCERTAIN')
        }
        try { await databases.updateTransaction({ transactionId, rollback: true }) } catch { /* Preserve original error. */ }
        if (error?.code === 409) fail('TRANSACTION_CONFLICT')
        throw error
      }
    },
  }
}
