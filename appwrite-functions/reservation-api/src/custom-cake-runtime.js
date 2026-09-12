import { Account, Client, Databases, Functions, Storage } from 'node-appwrite'
import { createCustomCakeRepository, resolveCustomCakePersistenceConfig } from './custom-cake-persistence.js'
import { checkCustomCakeReadiness } from './custom-cake-readiness.js'
import { createCustomCakePhotoService } from './custom-cake-photo-service.js'
import { createCustomCakePhotoStorage } from './custom-cake-photo-storage.js'
import { createCustomCakeWorkflow, cakeWireFail } from './custom-cake-workflow.js'
import { createCustomCakeRateLimiter, resolveCustomCakeAdmin } from './custom-cake-security.js'
import { createCakeV2CouponLedger } from './custom-cake-coupons.js'
import { normalizeAustralianMobile } from './business.js'
import { legacyCakeWireMode } from './custom-cake-legacy-gate.js'

// Appwrite Databases transactions are authorized by documents.write. The
// request uses only the platform dynamic key, so Function.scopes is authoritative.
export const CUSTOM_CAKE_REQUIRED_SCOPES = Object.freeze(['functions.read', 'databases.read', 'collections.read', 'documents.read', 'documents.write', 'buckets.read', 'files.read', 'files.write'])

export function cakeServicesForRequest(req, env) {
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT, projectId = env.APPWRITE_FUNCTION_PROJECT_ID, key = req.headers?.['x-appwrite-key']
  if (!endpoint || !projectId || !key) cakeWireFail('CAPABILITY_UNAVAILABLE')
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(key)
  return {
    databases: new Databases(client), storage: new Storage(client), functions: new Functions(client),
    accountForJwt: jwt => new Account(new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt)),
  }
}
function digestKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const bytes = Buffer.from(value, 'base64url')
  return bytes.length >= 32 && bytes.toString('base64url') === value ? bytes : null
}
function instant(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
export async function createCakeWireRuntime({ services, env, runtimeConfig, now = () => new Date(), smoreWritesEnabled }) {
  const { databases, storage } = services, config = resolveCustomCakePersistenceConfig(env)
  await checkCustomCakeReadiness({ databases, storage, config })
  const repository = createCustomCakeRepository(databases, config)
  const mode = legacyCakeWireMode(env)
  const tokenKey = digestKey(env.CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET)
  const independentKey = tokenKey && !tokenKey.equals(runtimeConfig.reviewCouponHmacSecret)
  let recoveryReady = false
  if (env.CUSTOM_CAKE_RECOVERY_ENABLED === 'true' && env.APPWRITE_FUNCTION_ID) {
    try {
      const fn = await services.functions.get({ functionId: env.APPWRITE_FUNCTION_ID })
      recoveryReady = fn.$id === env.APPWRITE_FUNCTION_ID && fn.enabled === true && typeof fn.schedule === 'string' && fn.schedule.trim().split(/\s+/).length === 5 && Array.isArray(fn.scopes) && CUSTOM_CAKE_REQUIRED_SCOPES.every(scope => fn.scopes.includes(scope))
    } catch { /* Missing schedule/scopes cannot enable new submissions. */ }
  }
  const securityReady = Boolean(independentKey && recoveryReady && String(env.REVIEW_ADMIN_USER_IDS || '').split(',').some(v => v.trim()))
  const newReady = securityReady && instant(env.CUSTOM_CAKE_PROMOTION_STARTS_AT)
  const limiter = createCustomCakeRateLimiter({ repository, key: runtimeConfig.reviewCouponHmacSecret, now })
  const admin = headers => resolveCustomCakeAdmin({ headers, env, accountForJwt: services.accountForJwt })
  let workflow
  async function access({ requestNumber, authorization, context }) {
    if (authorization.kind === 'admin') await admin(context.headers)
    else {
      if (!await limiter.allow('lookup', requestNumber, context.headers)) return null
      const phone = normalizeAustralianMobile(authorization.customerPhone)
      if (!/^04\d{8}$/.test(phone)) return null
      let row
      try { row = await workflow.find(requestNumber) } catch (e) { if (e.code === 'NOT_FOUND') return null; throw e }
      if (row.value.lookupResponse.customer.customerPhone !== phone) return null
      return { requestId: row.id, requestNumber }
    }
    let row
    try { row = await workflow.find(requestNumber) } catch (e) { if (e.code === 'NOT_FOUND') return null; throw e }
    return { requestId: row.id, requestNumber }
  }
  const photos = independentKey ? createCustomCakePhotoService({
    repository, storage: createCustomCakePhotoStorage(storage, { bucketId: config.bucketId, privateBucketVerified: true }), tokenDigestKey: tokenKey,
    resolveRequestAccess: access, allowSessionIssue: ({ requestId, context }) => limiter.allow('session', requestId, context.headers), now,
  }) : null
  workflow = createCustomCakeWorkflow({ repository, fingerprintKey: runtimeConfig.reviewCouponHmacSecret, now, smoreWritesEnabled,
    assertNewReady: () => { if (!newReady) cakeWireFail('CAPABILITY_UNAVAILABLE') },
    photos: photos || { attach: () => cakeWireFail('CAPABILITY_UNAVAILABLE') }, coupons: createCakeV2CouponLedger(databases, runtimeConfig),
    assertLegacyAbsent: async (documentId, transactionId) => {
      try { await databases.getDocument({ databaseId: runtimeConfig.cakeDatabaseId, collectionId: runtimeConfig.cakeReservationsId, documentId, transactionId }) } catch (error) { if (error.code === 404) return; throw error }
      cakeWireFail('REQUEST_ID_CONFLICT')
    },
  })
  return { repository, workflow, photos, admin, limiter, mode, newReady, securityReady, recoveryReady,
    capabilities: { contractVersion: 'cake-capabilities.v1', status: 'ready', customCakeV1: Boolean(newReady && smoreWritesEnabled), cakeOrderV2: Boolean(newReady && smoreWritesEnabled), legacyNewSubmissions: mode },
  }
}
