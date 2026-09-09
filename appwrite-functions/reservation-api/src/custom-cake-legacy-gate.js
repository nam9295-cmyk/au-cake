import { randomUUID } from 'node:crypto'
import { createCustomCakeRepository, resolveCustomCakePersistenceConfig } from './custom-cake-persistence.js'
import { checkCustomCakeReadiness } from './custom-cake-readiness.js'
import { ReservationApiError } from './business.js'
const fail = (code, status = 409) => { throw new ReservationApiError(code, status) }
const sharedId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value.toLowerCase() : null

export function legacyCakeWireMode(env) {
  const mode = env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS
  if (mode === undefined || mode === '') return 'compat'
  if (!['compat', 'required'].includes(mode)) fail('FUNCTION_CONFIGURATION_ERROR', 503)
  return mode
}

/** Lazy: historical authorized replay never depends on activation or new resources. */
export function createLegacyCakeGate({ env, services }) {
  let repository
  const mode = legacyCakeWireMode(env), enabled = env.CUSTOM_CAKE_PERSISTENCE_ENABLED === 'true'
  async function repo() {
    if (!enabled) return null
    if (!repository) {
      const config = resolveCustomCakePersistenceConfig(env)
      try {
        await checkCustomCakeReadiness({ ...services, config })
        repository = createCustomCakeRepository(services.databases, config)
      } catch { fail('FUNCTION_CONFIGURATION_ERROR', 503) }
    }
    return repository
  }
  async function assertNoForeignClaim(documentId) {
    const id = sharedId(documentId), r = await repo()
    if (!id || !r) return
    const claim = await r.get('claims', id)
    if (claim && claim.wire !== 'cake-request-v1') fail('REQUEST_ID_CONFLICT')
  }
  return {
    mode,
    async beforeNew(documentId) {
      if (mode === 'required') {
        try { await assertNoForeignClaim(documentId) } catch (error) { if (error.code === 'REQUEST_ID_CONFLICT') throw error }
        fail('CAKE_ORDER_UPGRADE_REQUIRED')
      }
      await assertNoForeignClaim(documentId)
    },
    assertNoForeignClaim,
    identity(documentId, customerPhone, fingerprint) {
      const requestId = sharedId(documentId)
      return enabled && requestId ? { requestId, wire: 'cake-request-v1', creatorScope: `customer:${customerPhone}`, fingerprint } : null
    },
    async createPlain(identity, create) {
      const r = await repo()
      try {
        return await r.atomic(`legacy-create/${identity.requestId}/${randomUUID()}`, async tx => {
          const existing = await tx.get('claims', identity.requestId)
          if (existing) return tx.readOnly((await tx.claimRequest(identity, null)).creationResponse)
          const response = await create(tx.transactionId)
          await tx.claimRequest(identity, response)
          return response
        })
      } catch (error) {
        if (error.code === 'REQUEST_ID_CONFLICT') fail('REQUEST_ID_CONFLICT')
        if (error.code === 'TRANSACTION_CONFLICT') {
          try { const replay = await r.findReplay(identity); if (replay) return replay } catch (error) { if (error.code === 'REQUEST_ID_CONFLICT') fail('REQUEST_ID_CONFLICT'); throw error }
        }
        throw error
      }
    },
    async claim(transactionId, identity, response) {
      if (!identity) return
      try { await (await repo()).inTransaction(transactionId).claimRequest(identity, response) } catch (error) { if (error.code === 'REQUEST_ID_CONFLICT') fail('REQUEST_ID_CONFLICT'); throw error }
    },
  }
}
