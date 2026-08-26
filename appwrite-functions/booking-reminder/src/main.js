import { Client, Databases, Query } from 'node-appwrite'
import { createEmailDeliveryRepository } from '../shared/email-delivery/email-delivery-repository.js'
import { createResendTransport } from '../shared/email-delivery/resend-transport.js'
import {
  BOOKING_REMINDER_MODE_SEND,
  createBookingReminderRunner,
  resolveBookingReminderMode,
} from './reminder-business.js'
import { isSydneyReminderWindow } from '../shared/sydney-calendar.js'

const APPWRITE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

function runtimeResourceId(env, key, fallback) {
  const value = String(env[key] || fallback || '').trim()
  if (!APPWRITE_RESOURCE_ID.test(value)) throw new Error('BOOKING_REMINDER_CONFIGURATION_ERROR')
  return value
}

function runtimeDatabases({ req, env, createDatabases }) {
  const endpoint = String(env.APPWRITE_FUNCTION_API_ENDPOINT || '').trim()
  const projectId = String(env.APPWRITE_FUNCTION_PROJECT_ID || '').trim()
  const apiKey = req?.headers?.['x-appwrite-key']
  if (!endpoint || !projectId || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('BOOKING_REMINDER_CONFIGURATION_ERROR')
  }
  return createDatabases
    ? createDatabases({ endpoint, projectId, apiKey })
    : new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey))
}

export function createRuntimeBookingReminderRepository({ req, env = process.env, createDatabases } = {}) {
  const databases = runtimeDatabases({ req, env, createDatabases })
  if (typeof databases.listDocuments !== 'function' || typeof databases.getDocument !== 'function') {
    throw new Error('BOOKING_REMINDER_CONFIGURATION_ERROR')
  }
  const cakeDatabaseId = runtimeResourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const classDatabaseId = runtimeResourceId(env, 'APPWRITE_KIDS_DATABASE_ID', cakeDatabaseId)
  const cakeReservationsId = runtimeResourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID', 'reservations')
  const classReservationsId = runtimeResourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID', 'class_reservations')
  const queryPage = (queries, { cursor, limit }) => [
    ...queries,
    Query.limit(limit),
    ...(cursor ? [Query.cursorAfter(cursor)] : []),
  ]
  return {
    async listCakeCandidates({ targetDate, cursor, limit }) {
      return databases.listDocuments({
        databaseId: cakeDatabaseId, collectionId: cakeReservationsId,
        queries: queryPage([Query.equal('status', '예약확정'), Query.equal('pickupDate', targetDate)], { cursor, limit }),
        total: false,
      })
    },
    async listClassFirstCandidates({ targetDate, cursor, limit }) {
      return databases.listDocuments({
        databaseId: classDatabaseId, collectionId: classReservationsId,
        queries: queryPage([Query.equal('status', 'Confirmed'), Query.equal('classDate', targetDate)], { cursor, limit }),
        total: false,
      })
    },
    async listClassAdvancedCandidates({ targetDate, cursor, limit }) {
      return databases.listDocuments({
        databaseId: classDatabaseId, collectionId: classReservationsId,
        queries: queryPage([Query.equal('status', 'Confirmed'), Query.equal('advancedClassDate', targetDate)], { cursor, limit }),
        total: false,
      })
    },
    async getCakeReservation(reservationId) {
      return databases.getDocument({ databaseId: cakeDatabaseId, collectionId: cakeReservationsId, documentId: reservationId })
    },
    async getClassReservation(reservationId) {
      return databases.getDocument({ databaseId: classDatabaseId, collectionId: classReservationsId, documentId: reservationId })
    },
  }
}

export function createRuntimeBookingReminderDeliveryRepository({ req, env = process.env, createDatabases } = {}) {
  const databases = runtimeDatabases({ req, env, createDatabases })
  return createEmailDeliveryRepository({
    databases,
    databaseId: runtimeResourceId(env, 'APPWRITE_CAKE_DATABASE_ID'),
    collectionId: runtimeResourceId(env, 'APPWRITE_EMAIL_DELIVERIES_TABLE_ID', 'email_deliveries'),
  })
}

export function createBookingReminderHandler({
  env = process.env,
  createReservationRepository = createRuntimeBookingReminderRepository,
  createLedgerRepository = createRuntimeBookingReminderDeliveryRepository,
  createTransport = createResendTransport,
  now = () => new Date(),
} = {}) {
  return async ({ req, res, log = () => {}, error = () => {} }) => {
    const current = now()
    if (!isSydneyReminderWindow(current)) {
      return res.json({ ok: true, skipped: 'outside_sydney_reminder_window' })
    }
    let repository
    try {
      const mode = resolveBookingReminderMode(env.BOOKING_REMINDER_MODE)
      repository = createReservationRepository({ req, env })
      const deliveryRepository = mode === BOOKING_REMINDER_MODE_SEND ? createLedgerRepository({ req, env }) : undefined
      const transport = mode === BOOKING_REMINDER_MODE_SEND ? createTransport({ apiKey: env.RESEND_API_KEY }) : undefined
      const result = await createBookingReminderRunner({
        now: () => current, repository, deliveryRepository, transport, mode,
        from: env.RESEND_FROM_EMAIL, replyTo: env.RESEND_REPLY_TO_EMAIL || null, log, error,
      }).run()
      return res.json(result)
    } catch {
      error('Booking reminder configuration or scan failure')
      return res.json({ ok: false, reason: 'booking_reminder_unavailable' })
    }
  }
}

export default createBookingReminderHandler()
