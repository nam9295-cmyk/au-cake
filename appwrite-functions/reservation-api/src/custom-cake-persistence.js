// Private additive storage only. No pricing, catalogue, transport authorization,
// Storage calls or runtime/environment activation is performed by this module.
import { createHash } from 'node:crypto'
import { Query } from 'node-appwrite'

export const CUSTOM_CAKE_RECORD_LIMIT = 65535
export const CUSTOM_CAKE_RESOURCE_KEYS = Object.freeze(['claims', 'snapshots', 'sessions', 'photos', 'quotas', 'outbox', 'commits', 'chunks', 'histories', 'ratelimits'])
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
  if (Array.isArray(value) && Object.keys(value).length !== value.length) fail('PERSISTENCE_INVALID_RECORD')
  for (const [key, entry] of Object.entries(value)) {
    if (['token', 'uploadToken', 'base64', 'x-custom-cake-upload-token', 'x-custom-cake-upload-session'].includes(key) || (key === 'promoCode' && entry !== '')) fail('PERSISTENCE_SENSITIVE_RECORD')
    validJson(entry, seen)
  }
  seen.delete(value)
}

function validate(kind, value) {
  if (!CUSTOM_CAKE_RESOURCE_KEYS.includes(kind) || !value || Array.isArray(value) || typeof value !== 'object') fail('PERSISTENCE_INVALID_RECORD')
  validJson(value)
  if (kind === 'snapshots') {
    const { request, creationResponse, lookupResponse, quoteHistory, transitionAudit } = value
    if (!request || !creationResponse || !lookupResponse || !Array.isArray(quoteHistory) || !Array.isArray(transitionAudit) || !['custom-cake.v1', 'cake-order.v2'].includes(request.contractVersion) || request.contractVersion !== creationResponse.contractVersion || request.contractVersion !== lookupResponse.contractVersion || request.requestId !== creationResponse.requestId) fail('PERSISTENCE_INVALID_RECORD')
    if (request.contractVersion === 'custom-cake.v1') {
      validateQuote(creationResponse.quote); validateQuote(lookupResponse.quote)
      if (creationResponse.status !== 'requested' || creationResponse.quote.quoteVersion !== 1 || creationResponse.quote.designExtraCents !== null || creationResponse.quote.figurineExtraCents !== null || creationResponse.acceptance !== null || creationResponse.requestNumber !== lookupResponse.requestNumber || !['requested', 'quoted', 'confirmed', 'completed', 'cancelled'].includes(lookupResponse.status) || !Array.isArray(lookupResponse.acceptanceHistory)) fail('PERSISTENCE_INVALID_RECORD')
      for (const acceptance of lookupResponse.acceptanceHistory) if (!Number.isSafeInteger(acceptance.acceptedQuoteVersion) || acceptance.acceptedQuoteVersion < 1 || acceptance.acceptedQuoteVersion > lookupResponse.quote.quoteVersion || !instant(acceptance.acceptedAt)) fail('PERSISTENCE_INVALID_RECORD')
      if (lookupResponse.acceptance !== null && !lookupResponse.acceptanceHistory.some(value => equal(value, lookupResponse.acceptance))) fail('PERSISTENCE_INVALID_RECORD')
      if (['confirmed', 'completed'].includes(lookupResponse.status) && (!lookupResponse.quote.isFinalQuote || lookupResponse.acceptance?.acceptedQuoteVersion !== lookupResponse.quote.quoteVersion)) fail('PERSISTENCE_INVALID_RECORD')
    } else {
      validatePricing(creationResponse.pricing); validatePricing(lookupResponse.pricing)
      if (creationResponse.status !== '예약신청' || creationResponse.reservationNumber !== lookupResponse.reservationNumber || !['예약신청', '예약확정', '픽업완료', '취소'].includes(lookupResponse.status)) fail('PERSISTENCE_INVALID_RECORD')
    }
  }
  if (kind === 'claims') {
    if (!uuid.test(value.requestId) || !['custom-cake.v1', 'cake-order.v2', 'cake-request-v1'].includes(value.wire) || typeof value.creatorScope !== 'string' || !value.creatorScope || value.creatorScope.length > 256 || !/^[a-f0-9]{64}$/.test(value.fingerprint) || !Object.hasOwn(value, 'creationResponse')) fail('PERSISTENCE_INVALID_RECORD')
  }
  if (kind === 'sessions') {
    if (!uuid.test(value.requestId) || !/^[a-f0-9]{64}$/.test(value.tokenDigest) || !instant(value.issuedAt) || !instant(value.expiresAt) || Date.parse(value.expiresAt) - Date.parse(value.issuedAt) !== 1800000 || ['token', 'uploadToken', 'uploadSessionId'].some(key => Object.hasOwn(value, key))) fail('PERSISTENCE_INVALID_RECORD')
  }
  if (kind === 'photos') {
    if (!['staging', 'staged', 'attached', 'cleanup-claimed', 'deletion-pending', 'deleted'].includes(value.state) || !uuid.test(value.requestId) || !resourceId.test(value.sessionId) || !/^[A-Za-z0-9_-]{1,64}$/.test(value.uploadId) || !/^[a-f0-9]{64}$/.test(value.inputDigest) || !resourceId.test(value.fileId) || !instant(value.intentAt) || typeof value.uploadResolved !== 'boolean') fail('PERSISTENCE_INVALID_RECORD')
  }
  if (kind === 'quotas' && (!uuid.test(value.requestId) || !Number.isSafeInteger(value.used) || value.used < 0 || value.used > 5)) fail('PERSISTENCE_INVALID_RECORD')
}

function instant(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }

const nonnegative = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
function validateQuote(q) {
  if (!q || !Number.isSafeInteger(q.quoteVersion) || q.quoteVersion < 1 || q.currency !== 'AUD' || q.pricingPolicyVersion !== 'custom-cake.2026-09.v1' || !instant(q.promotionEligibilityAt)) fail('PERSISTENCE_INVALID_RECORD')
  for (const key of ['baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity', 'knownTotalCents']) if (!nonnegative(q[key])) fail('PERSISTENCE_INVALID_RECORD')
  for (const key of ['designExtraCents', 'figurineExtraCents']) if (q[key] !== null && !nonnegative(q[key])) fail('PERSISTENCE_INVALID_RECORD')
  const total = q.baseCents - q.cakeDiscountCents + (q.designExtraCents ?? 0) + (q.figurineExtraCents ?? 0) + q.paidSmoreTotalCents
  const final = q.designExtraCents !== null && q.figurineExtraCents !== null
  if (q.cakeDiscountCents > q.baseCents || !nonnegative(total) || q.knownTotalCents !== total || q.isFinalQuote !== final || q.finalTotalCents !== (final ? total : null)) fail('PERSISTENCE_INVALID_RECORD')
}

function validatePricing(p) {
  if (!p || p.currency !== 'AUD' || p.pricingPolicyVersion !== 'cake-order.2026-09.v2' || !instant(p.pricedAt) || !Array.isArray(p.lines) || !p.lines.length) fail('PERSISTENCE_INVALID_RECORD')
  for (const key of ['subtotalCents', 'discountCents', 'individualPackagingFeeCents', 'totalCents']) {
    if (!nonnegative(p[key])) fail('PERSISTENCE_INVALID_RECORD')
    let sum = 0
    for (const line of p.lines) {
      const amount = key === 'individualPackagingFeeCents' && line.kind !== 'cake' ? 0 : line[key]
      if (!nonnegative(amount)) fail('PERSISTENCE_INVALID_RECORD')
      sum += amount
    }
    if (!nonnegative(sum) || sum !== p[key]) fail('PERSISTENCE_INVALID_RECORD')
  }
  if (p.discountCents > p.subtotalCents || p.totalCents !== p.subtotalCents - p.discountCents + p.individualPackagingFeeCents) fail('PERSISTENCE_INVALID_RECORD')
}

function metadata(kind, value) {
  const lookupKey = kind === 'snapshots' ? value.lookupResponse.requestNumber || value.lookupResponse.reservationNumber : value.requestId || ''
  const state = kind === 'snapshots' ? value.lookupResponse.status : value.state || ''
  const dueAt = value.dueAt || ''
  if (typeof lookupKey !== 'string' || lookupKey.length > 64 || typeof state !== 'string' || state.length > 32 || (dueAt && !instant(dueAt))) fail('PERSISTENCE_INVALID_RECORD')
  return { lookupKey, state, dueAt }
}

export function encodeCustomCakeRecord(kind, value) {
  validate(kind, value)
  const payloadJson = JSON.stringify(value)
  return { schemaVersion: 1, payloadJson, ...metadata(kind, value) }
}

export function decodeCustomCakeRecord(kind, document) {
  if (document?.schemaVersion !== 1 || typeof document.payloadJson !== 'string') fail('PERSISTENCE_INVALID_RECORD')
  let value
  try { value = JSON.parse(document.payloadJson) } catch { fail('PERSISTENCE_INVALID_RECORD') }
  validate(kind, value)
  for (const [key, expected] of Object.entries(metadata(kind, value))) if (document[key] !== expected) fail('PERSISTENCE_INVALID_RECORD')
  return value
}

export function customCakeDocumentId(namespace, value) {
  if (typeof namespace !== 'string' || !namespace || typeof value !== 'string' || !value) fail('PERSISTENCE_INVALID_RECORD')
  return createHash('sha256').update(`${namespace}\0${value}`).digest('hex').slice(0, 36)
}

function preserve(kind, before, after) {
  if (['claims', 'commits', 'histories', 'chunks'].includes(kind) && !equal(before, after)) fail('PERSISTENCE_IMMUTABLE_RECORD')
  const immutable = kind === 'snapshots' ? ['request', 'creationResponse'] : kind === 'claims' || kind === 'commits' ? Object.keys(before) : []
  for (const key of immutable) if (!equal(before[key], after[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  if (kind === 'snapshots') {
    for (const key of ['quoteHistory', 'transitionAudit']) if (!equal(before[key], after[key]?.slice(0, before[key].length))) fail('PERSISTENCE_IMMUTABLE_RECORD')
    const old = before.lookupResponse, next = after.lookupResponse
    for (const key of ['contractVersion', 'requestNumber', 'reservationNumber', 'customer', 'pickup', 'lines', 'paidSmoreLines', 'pricing']) if (!equal(old[key], next[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
    if (old.acceptanceHistory && !equal(old.acceptanceHistory, next.acceptanceHistory?.slice(0, old.acceptanceHistory.length))) fail('PERSISTENCE_IMMUTABLE_RECORD')
    if (old.quote) for (const key of ['pricingPolicyVersion', 'promotionEligibilityAt', 'currency', 'baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity']) if (!equal(old.quote[key], next.quote?.[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  }
  if (kind === 'sessions') for (const key of ['requestId', 'tokenDigest', 'issuedAt', 'expiresAt']) if (!equal(before[key], after[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  if (kind === 'photos') for (const key of ['requestId', 'sessionId', 'uploadId', 'inputDigest', 'fileId', 'intentAt']) if (!equal(before[key], after[key])) fail('PERSISTENCE_IMMUTABLE_RECORD')
  if (kind === 'quotas' && before.requestId !== after.requestId) fail('PERSISTENCE_IMMUTABLE_RECORD')
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
  async function raw(kind, id, transactionId) {
    try { return await databases.getDocument(params(kind, id, transactionId)) } catch (error) { if (error?.code === 404) return null; throw error }
  }
  const historyFields = ['quoteHistory', 'transitionAudit', 'acceptanceHistory']
  const historyId = (id, field, index) => customCakeDocumentId('custom-cake-history-v1', `${id}/${field}/${index}`)
  async function hydrate(kind, id, document, transactionId) {
    if (!document || document.schemaVersion !== 1 || typeof document.payloadJson !== 'string' || Buffer.byteLength(document.payloadJson) > CUSTOM_CAKE_RECORD_LIMIT) fail('PERSISTENCE_INVALID_RECORD')
    let envelope
    try { envelope = JSON.parse(document.payloadJson) } catch { fail('PERSISTENCE_INVALID_RECORD') }
    if (envelope.format !== 'custom-cake-storage.v1') fail('PERSISTENCE_INVALID_RECORD')
    let body = envelope.body
    if (envelope.chunks) {
      if (!Array.isArray(envelope.chunks) || !envelope.chunks.length) fail('PERSISTENCE_INVALID_RECORD')
      const chunks = []
      for (const chunkId of envelope.chunks) {
        const chunk = await raw('chunks', chunkId, transactionId)
        if (!chunk || chunk.lookupKey !== `${kind}/${id}` || typeof chunk.payloadJson !== 'string') fail('PERSISTENCE_INVALID_RECORD')
        chunks.push(Buffer.from(chunk.payloadJson, 'base64'))
      }
      body = Buffer.concat(chunks).toString('utf8')
      if (createHash('sha256').update(body).digest('hex') !== envelope.digest) fail('PERSISTENCE_INVALID_RECORD')
    }
    let value
    try { value = JSON.parse(body) } catch { fail('PERSISTENCE_INVALID_RECORD') }
    if (kind === 'snapshots') {
      for (const field of historyFields) {
        const count = envelope.historyCounts?.[field]
        if (!Number.isSafeInteger(count) || count < 0) fail('PERSISTENCE_INVALID_RECORD')
        const history = []
        for (let index = 0; index < count; index++) {
          const event = await get('histories', historyId(id, field, index), transactionId)
          if (!event || event.snapshotId !== id || event.field !== field || event.index !== index) fail('PERSISTENCE_INVALID_RECORD')
          history.push(event.value)
        }
        if (field === 'acceptanceHistory') { if (value.request.contractVersion === 'custom-cake.v1') value.lookupResponse[field] = history }
        else value[field] = history
      }
    }
    return decodeCustomCakeRecord(kind, { ...document, payloadJson: JSON.stringify(value) })
  }
  async function get(kind, id, transactionId) {
    const document = await raw(kind, id, transactionId)
    return document ? hydrate(kind, id, document, transactionId) : null
  }
  async function store(kind, id, value, transactionId, replace = false, before) {
    const encoded = encodeCustomCakeRecord(kind, value), stored = clone(value)
    const envelope = { format: 'custom-cake-storage.v1' }
    if (kind === 'snapshots') {
      envelope.historyCounts = {}
      for (const field of historyFields) {
        const history = field === 'acceptanceHistory' ? stored.lookupResponse[field] || [] : stored[field]
        const prior = field === 'acceptanceHistory' ? before?.lookupResponse[field] || [] : before?.[field] || []
        envelope.historyCounts[field] = history.length
        for (let index = prior.length; index < history.length; index++) await store('histories', historyId(id, field, index), { snapshotId: id, field, index, value: history[index] }, transactionId)
        if (field === 'acceptanceHistory') delete stored.lookupResponse[field]
        else delete stored[field]
      }
    }
    const body = JSON.stringify(stored)
    envelope.body = body
    if (Buffer.byteLength(JSON.stringify(envelope)) > CUSTOM_CAKE_RECORD_LIMIT) {
      delete envelope.body
      envelope.chunks = []
      envelope.digest = createHash('sha256').update(body).digest('hex')
      const bytes = Buffer.from(body)
      for (let offset = 0; offset < bytes.length; offset += 48000) {
        const payloadJson = bytes.subarray(offset, offset + 48000).toString('base64')
        const chunkId = customCakeDocumentId('custom-cake-chunk-v1', `${kind}/${id}/${offset}/${payloadJson}`)
        envelope.chunks.push(chunkId)
        if (!await raw('chunks', chunkId, transactionId)) await databases.createDocument({ ...params('chunks', chunkId, transactionId), data: { schemaVersion: 1, payloadJson, lookupKey: `${kind}/${id}`, state: '', dueAt: '' }, permissions: [] })
      }
    }
    const payloadJson = JSON.stringify(envelope)
    if (Buffer.byteLength(payloadJson) > CUSTOM_CAKE_RECORD_LIMIT) fail('PERSISTENCE_RECORD_TOO_LARGE')
    await databases[replace ? 'updateDocument' : 'createDocument']({ ...params(kind, id, transactionId), data: { ...encoded, payloadJson }, permissions: [] })
    return clone(value)
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
      create: (kind, id, value) => store(kind, id, value, transactionId),
      async replace(kind, id, value) {
        const before = await get(kind, id, transactionId)
        if (!before) fail('PERSISTENCE_NOT_FOUND')
        preserve(kind, before, value)
        return store(kind, id, value, transactionId, true, before)
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
    async list(kind, { lookupKey, state, dueBefore, cursor, limit = 100 } = {}) {
      if (!CUSTOM_CAKE_RESOURCE_KEYS.includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 100 || (dueBefore && !instant(dueBefore))) fail('PERSISTENCE_INVALID_RECORD')
      const queries = [Query.limit(limit), Query.orderAsc('$id')]
      if (lookupKey !== undefined) queries.push(Query.equal('lookupKey', lookupKey))
      if (state !== undefined) queries.push(Query.equal('state', state))
      if (dueBefore !== undefined) queries.push(Query.lessThanEqual('dueAt', dueBefore))
      if (cursor !== undefined) queries.push(Query.cursorAfter(cursor))
      const result = await databases.listDocuments({ databaseId: config.databaseId, collectionId: config[kind], queries, total: false })
      return Promise.all(result.documents.map(async document => ({ id: document.$id, value: await hydrate(kind, document.$id, document) })))
    },
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
