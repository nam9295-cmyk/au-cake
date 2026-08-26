import { ID, Query } from 'node-appwrite'
import {
  buildPendingEmailDelivery,
  decideEmailDelivery,
  EmailDeliveryError,
} from './email-delivery.js'

const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const ERROR_CODE = /^[A-Za-z0-9_.-]{1,80}$/

function assertResourceId(value, code) {
  if (!APPWRITE_ID.test(value || '')) throw new EmailDeliveryError(code)
  return value
}

function timestamp(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_TIME')
  return value.toISOString()
}

function errorCode(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !ERROR_CODE.test(value)) throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_ERROR_CODE')
  return value
}

function providerMessageId(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_PROVIDER_MESSAGE_ID')
  }
  return value.trim()
}

export function isEmailDeliveryUniqueConflict(error) {
  return error?.code === 409
}

export function createEmailDeliveryRepository({ databases, databaseId, collectionId, idFactory = ID.unique } = {}) {
  if (!databases || typeof databases.listDocuments !== 'function' ||
      typeof databases.createDocument !== 'function' || typeof databases.updateDocument !== 'function') {
    throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_DATABASE_ADAPTER')
  }
  assertResourceId(databaseId, 'INVALID_EMAIL_DELIVERY_DATABASE_ID')
  assertResourceId(collectionId, 'INVALID_EMAIL_DELIVERY_COLLECTION_ID')
  if (typeof idFactory !== 'function') throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_ID_FACTORY')

  async function getByEventKey(eventKey) {
    const result = await databases.listDocuments({
      databaseId,
      collectionId,
      queries: [Query.equal('eventKey', eventKey), Query.limit(1)],
      total: false,
    })
    return result.documents[0] || null
  }

  async function createPending(identity, now = new Date()) {
    const data = buildPendingEmailDelivery(identity, now)
    return databases.createDocument({
      databaseId,
      collectionId,
      documentId: idFactory(),
      data,
    })
  }

  async function getOrCreatePending(identity, now = new Date()) {
    const existing = await getByEventKey(identity.eventKey)
    if (existing) return { kind: 'existing', delivery: existing, decision: decideEmailDelivery(existing, identity, now) }

    try {
      return { kind: 'created', delivery: await createPending(identity, now) }
    } catch (error) {
      if (!isEmailDeliveryUniqueConflict(error)) throw error
      const createdByConcurrentCaller = await getByEventKey(identity.eventKey)
      if (!createdByConcurrentCaller) throw error
      return {
        kind: 'existing',
        delivery: createdByConcurrentCaller,
        decision: decideEmailDelivery(createdByConcurrentCaller, identity, now),
      }
    }
  }

  async function update(delivery, data) {
    if (!delivery?.$id || !APPWRITE_ID.test(delivery.$id)) throw new EmailDeliveryError('INVALID_EMAIL_DELIVERY_ID')
    return databases.updateDocument({ databaseId, collectionId, documentId: delivery.$id, data })
  }

  return {
    getByEventKey,
    createPending,
    getOrCreatePending,
    async markAttempt(delivery, now = new Date()) {
      return update(delivery, {
        attempts: Math.max(0, Number.isInteger(delivery.attempts) ? delivery.attempts : 0) + 1,
        lastAttemptAt: timestamp(now),
        updatedAt: timestamp(now),
      })
    },
    async markSent(delivery, { now = new Date(), providerMessageId: messageId } = {}) {
      return update(delivery, {
        status: 'sent',
        providerMessageId: providerMessageId(messageId),
        sentAt: timestamp(now),
        lastErrorCode: null,
        updatedAt: timestamp(now),
      })
    },
    async markFailed(delivery, { now = new Date(), errorCode: code } = {}) {
      return update(delivery, {
        status: 'failed',
        lastErrorCode: errorCode(code),
        updatedAt: timestamp(now),
      })
    },
    async markUncertain(delivery, { now = new Date(), errorCode: code } = {}) {
      return update(delivery, {
        status: 'uncertain',
        lastErrorCode: errorCode(code),
        updatedAt: timestamp(now),
      })
    },
  }
}
