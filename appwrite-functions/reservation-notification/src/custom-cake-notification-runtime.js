import { randomUUID } from 'node:crypto'
import { Client, Databases, Functions, Storage } from 'node-appwrite'
import { createCustomCakeRepository, resolveCustomCakePersistenceConfig } from '../shared/reservation-api/custom-cake-persistence.js'
import { checkCustomCakeReadiness } from '../shared/reservation-api/custom-cake-readiness.js'
import { createResendTransport } from '../shared/email-delivery/resend-transport.js'
import { createCustomCakeNotificationDispatcher } from './custom-cake-notification.js'

export const CUSTOM_CAKE_NOTIFICATION_SCOPES = Object.freeze(['functions.read', 'databases.read', 'collections.read', 'documents.read', 'documents.write', 'buckets.read'])
const unavailable = () => { throw new Error('CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE') }
function matchesAdministratorExecution(execute, configuredAdmins) {
  if (typeof configuredAdmins !== 'string' || !Array.isArray(execute)) return false
  const admins = [...new Set(configuredAdmins.split(',').map(id => id.trim()).filter(Boolean))]
  if (!admins.length || admins.some(id => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id))) return false
  const expected = admins.map(id => `user:${id}`).sort(), actual = [...new Set(execute)].sort()
  return actual.length === expected.length && actual.every((role, index) => role === expected[index])
}
function servicesForRequest(req, env) {
  const client = new Client().setEndpoint(env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(env.APPWRITE_FUNCTION_PROJECT_ID).setKey(req.headers['x-appwrite-key'])
  return { databases: new Databases(client), storage: new Storage(client), functions: new Functions(client) }
}
export async function createCustomCakeNotificationRuntime({ req, env, services, now = () => new Date(), createTransport = createResendTransport }) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22 || env.CUSTOM_CAKE_NOTIFICATIONS_ENABLED !== 'true' || !req.headers?.['x-appwrite-key'] || !env.APPWRITE_FUNCTION_API_ENDPOINT || !env.APPWRITE_FUNCTION_PROJECT_ID || !env.APPWRITE_FUNCTION_ID || !env.RESEND_API_KEY?.trim() || !env.RESEND_FROM_EMAIL?.trim() || /[\r\n]/.test(env.RESEND_FROM_EMAIL)) unavailable()
    services ||= servicesForRequest(req, env)
    const fn = await services.functions.get({ functionId: env.APPWRITE_FUNCTION_ID })
    if (fn.$id !== env.APPWRITE_FUNCTION_ID || fn.enabled !== true || fn.runtime !== 'node-22' || fn.timeout < 60 || typeof fn.schedule !== 'string' || fn.schedule.trim().split(/\s+/).length !== 5 || !matchesAdministratorExecution(fn.execute, env.REVIEW_ADMIN_USER_IDS) || !Array.isArray(fn.scopes) || !CUSTOM_CAKE_NOTIFICATION_SCOPES.every(scope => fn.scopes.includes(scope))) unavailable()
    const config = resolveCustomCakePersistenceConfig(env)
    await checkCustomCakeReadiness({ ...services, config })
    const repository = createCustomCakeRepository(services.databases, config)
    // Validate recipients only when creating that role's first payload. A missing
    // operator address must not block customer mail or an immutable saved retry.
    const operatorRecipients = String(env.RESEND_TO_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean)
    const dispatcher = createCustomCakeNotificationDispatcher({ repository, from: env.RESEND_FROM_EMAIL, replyTo: env.RESEND_REPLY_TO_EMAIL || null, operatorRecipients })
    const transport = createTransport({ apiKey: env.RESEND_API_KEY })
    return {
      async run({ log = () => {}, error = () => {} } = {}) {
        const cursorId = 'custom-cake-mail-cursor'
        const before = await repository.get('ratelimits', cursorId)
        const initial = before?.cursor || null
        // Scan all outbox rows: changing a sent row's state cannot invalidate our
        // pagination cursor. A schedule sends at most one event within its budget.
        const rows = await repository.list('outbox', { ...(initial ? { cursor: initial } : {}), limit: 100 })
        let scanned = 0, processed = 0, cursor = initial
        for (const row of rows) {
          scanned++; cursor = row.id
          if (row.value.state !== 'pending' || row.value.dueAt > now().toISOString()) continue
          try { await dispatcher.deliver(row.id, { transport, now: now(), log, error }) } catch { error(`Cake event unavailable: ${row.id}`) }
          processed++
          break
        }
        if (scanned === rows.length && rows.length < 100) cursor = null
        await repository.atomic(`custom-cake-mail-cursor/${randomUUID()}`, async tx => {
          const current = await tx.get('ratelimits', cursorId)
          if ((current?.cursor || null) !== initial) return tx.readOnly({ advanced: false })
          const value = { cursor, updatedAt: now().toISOString() }
          if (current) await tx.replace('ratelimits', cursorId, value)
          else await tx.create('ratelimits', cursorId, value)
          return { advanced: true }
        })
        return { scanned, processed }
      },
    }
  } catch { unavailable() }
}
