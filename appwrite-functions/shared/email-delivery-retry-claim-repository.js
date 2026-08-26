import { ID, Query } from 'node-appwrite'
import {
  buildEmailDeliveryEventKey,
  EmailDeliveryError,
} from './email-delivery.js'
import { isEmailDeliveryUniqueConflict } from './email-delivery-repository.js'

const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const ERROR_CODE = /^[A-Za-z0-9_.-]{1,80}$/
const CLAIM_STATUSES = new Set(['pending', 'sent', 'failed', 'uncertain'])

function assertResourceId(value, code) {
  if (!APPWRITE_ID.test(value || '')) throw new EmailDeliveryError(code)
  return value
}
function at(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_TIME')
  return value.toISOString()
}

function claimIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM')
  const eventKey = buildEmailDeliveryEventKey(value)
  if (value.eventKey !== eventKey || !APPWRITE_ID.test(value.claimedByUserId || '')) {
    throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM')
  }
  return {
    eventKey,
    sourceType: value.sourceType,
    sourceId: value.sourceId,
    template: value.template,
    claimedByUserId: value.claimedByUserId,
  }
}

function safeErrorCode(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !ERROR_CODE.test(value)) throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_ERROR_CODE')
  return value
}

export function createEmailDeliveryRetryClaimRepository({ databases, databaseId, collectionId, idFactory = ID.unique } = {}) {
  if (!databases || typeof databases.listDocuments !== 'function' ||
      typeof databases.createDocument !== 'function' || typeof databases.updateDocument !== 'function') {
    throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM_DATABASE_ADAPTER')
  }
  assertResourceId(databaseId, 'INVALID_EMAIL_RETRY_CLAIM_DATABASE_ID')
  assertResourceId(collectionId, 'INVALID_EMAIL_RETRY_CLAIM_COLLECTION_ID')
  if (typeof idFactory !== 'function') throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM_ID_FACTORY')

  async function getByEventKey(eventKey) {
    const result = await databases.listDocuments({
      databaseId,
      collectionId,
      queries: [Query.equal('eventKey', eventKey), Query.limit(1)],
      total: false,
    })
    return result.documents[0] || null
  }

  async function createClaim(value, now = new Date()) {
    const identity = claimIdentity(value)
    const timestamp = at(now)
    return databases.createDocument({
      databaseId,
      collectionId,
      documentId: idFactory(),
      data: {
        ...identity,
        status: 'pending',
        claimedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    })
  }

  async function getOrCreateClaim(value, now = new Date()) {
    const identity = claimIdentity(value)
    const existing = await getByEventKey(identity.eventKey)
    if (existing) return { kind: 'existing', claim: existing }
    try {
      return { kind: 'created', claim: await createClaim(identity, now) }
    } catch (error) {
      if (!isEmailDeliveryUniqueConflict(error)) throw error
      const winner = await getByEventKey(identity.eventKey)
      if (!winner) throw error
      return { kind: 'existing', claim: winner }
    }
  }

  async function update(claim, data) {
    if (!claim?.$id || !APPWRITE_ID.test(claim.$id)) throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM_ID')
    return databases.updateDocument({ databaseId, collectionId, documentId: claim.$id, data })
  }

  return {
    getByEventKey,
    createClaim,
    getOrCreateClaim,
    async markCompleted(claim, { status, now = new Date(), errorCode } = {}) {
      if (!CLAIM_STATUSES.has(status) || status === 'pending') throw new EmailDeliveryError('INVALID_EMAIL_RETRY_CLAIM_STATUS')
      const timestamp = at(now)
      return update(claim, {
        status,
        completedAt: timestamp,
        lastErrorCode: safeErrorCode(errorCode),
        updatedAt: timestamp,
      })
    },
  }
}
