import { exactCakeObject, cakeWireFail } from './custom-cake-workflow.js'
import { normalizeAustralianMobile } from './business.js'
import { randomUUID } from 'node:crypto'
const actions = Object.freeze({
  'get-cake-wire-capabilities': ['custom-cake.v1', 'capabilities'],
  'create-custom-cake-request': ['custom-cake.v1', 'create'], 'get-custom-cake-request': ['custom-cake.v1', 'lookup'],
  'create-cake-order-v2': ['cake-order.v2', 'create'], 'get-cake-order-v2': ['cake-order.v2', 'lookup'],
  'admin-update-custom-cake-quote': ['custom-cake.v1', 'quote'], 'admin-record-custom-cake-acceptance': ['custom-cake.v1', 'accept'],
  'admin-confirm-custom-cake-request': ['custom-cake.v1', 'confirm'], 'admin-complete-custom-cake-request': ['custom-cake.v1', 'complete'], 'admin-cancel-custom-cake-request': ['custom-cake.v1', 'cancel'],
  'create-custom-cake-photo-session': ['custom-cake-photo.v1', 'issueSession'], 'upload-custom-cake-photo': ['custom-cake-photo.v1', 'upload'],
  'read-custom-cake-photo': ['custom-cake-photo.v1', 'read'], 'delete-custom-cake-photo': ['custom-cake-photo.v1', 'delete'],
})
export const isCakeWireAction = action => Object.hasOwn(actions, action || '')
const orderCodes = { INVALID_REQUEST: 400, INVALID_LINE_ID: 400, INVALID_LINE_REFERENCE: 400, INVALID_PHOTO_REFERENCE: 400, PROMO_CODE_INVALID: 400, FORBIDDEN: 403, NOT_FOUND: 404, REQUEST_ID_CONFLICT: 409, QUOTE_VERSION_CONFLICT: 409, QUOTE_NOT_FINAL: 409, QUOTE_ACCEPTANCE_REQUIRED: 409, QUOTE_STATE_CONFLICT: 409, CAPABILITY_UNAVAILABLE: 503 }
const photoCodes = { INVALID_REQUEST: 400, PHOTO_INVALID_IMAGE: 400, PHOTO_SESSION_INVALID: 403, PHOTO_SESSION_EXPIRED: 403, FORBIDDEN: 403, NOT_FOUND: 404, PHOTO_UPLOAD_CONFLICT: 409, PHOTO_STATE_CONFLICT: 409, PHOTO_LIMIT_EXCEEDED: 409, PHOTO_TOO_LARGE: 413, CAPABILITY_UNAVAILABLE: 503 }

/** Platform-injected headers are the trust boundary, never request data. */
export async function handleCakeWireRequest({ req, res }, options) {
  const action = req.bodyJson?.action, [wire, operation] = actions[action]
  const cache = { 'Cache-Control': 'no-store' }, codes = wire === 'custom-cake-photo.v1' ? photoCodes : orderCodes
  try {
    const body = req.bodyJson
    exactCakeObject(body, operation === 'capabilities' ? ['action'] : ['action', 'data'])
    const size = Buffer.byteLength(typeof req.bodyText === 'string' ? req.bodyText : JSON.stringify(body))
    if (size > (operation === 'upload' ? 13981016 + 4096 : 1048576)) cakeWireFail(operation === 'upload' ? 'PHOTO_TOO_LARGE' : 'INVALID_REQUEST')
    const { createCakeWireRuntime } = await import('./custom-cake-runtime.js')
    const runtime = await createCakeWireRuntime(options), context = { headers: req.headers || {} }
    let result
    if (operation === 'capabilities') result = runtime.capabilities
    else if (wire === 'custom-cake-photo.v1') {
      if (!runtime.photos || (['issueSession', 'upload'].includes(operation) && !runtime.newReady)) cakeWireFail('CAPABILITY_UNAVAILABLE')
      result = await runtime.photos[operation](body.data, operation === 'upload' ? context.headers : context)
    } else if (operation === 'create') {
      if (body.data?.contractVersion !== wire) cakeWireFail('INVALID_REQUEST')
      result = await runtime.workflow.create(body.data, context.headers)
    } else if (operation === 'lookup') {
      const key = wire === 'custom-cake.v1' ? 'requestNumber' : 'reservationNumber'
      exactCakeObject(body.data, ['contractVersion', key, 'customerPhone'])
      if (body.data.contractVersion !== wire || typeof body.data[key] !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body.data[key]) || typeof body.data.customerPhone !== 'string') cakeWireFail('INVALID_REQUEST')
      if (!await runtime.limiter.allow('lookup', body.data[key], context.headers)) cakeWireFail('NOT_FOUND')
      const phone = normalizeAustralianMobile(body.data.customerPhone)
      if (!/^04\d{8}$/.test(phone)) cakeWireFail('NOT_FOUND')
      const found = await runtime.workflow.find(body.data[key], wire)
      if (found.value.lookupResponse.customer.customerPhone !== phone) cakeWireFail('NOT_FOUND')
      result = found.value.lookupResponse
    } else result = await runtime.workflow.mutate(operation, body.data, await runtime.admin(context.headers))
    return res.json({ ok: true, result }, 200, cache)
  } catch (error) {
    const code = Object.hasOwn(codes, error?.code) ? error.code : 'CAPABILITY_UNAVAILABLE'
    return res.json({ ok: false, contractVersion: wire, code }, codes[code], cache)
  }
}

export async function handleCakePhotoRecovery({ req, res }, options) {
  try {
    if (req.headers?.['x-appwrite-trigger'] !== 'schedule') cakeWireFail('FORBIDDEN')
    const { createCakeWireRuntime } = await import('./custom-cake-runtime.js')
    const runtime = await createCakeWireRuntime(options)
    if (!runtime.recoveryReady || !runtime.photos) cakeWireFail('CAPABILITY_UNAVAILABLE')
    const cursorId = 'photo-recovery-cursor'
    const saved = await runtime.repository.get('ratelimits', cursorId), start = saved?.cursor ?? null
    let cursor = start, inspected = 0
    for (let page = 0; page < 10; page++) {
      const result = await runtime.photos.recover({ ...(cursor ? { cursor } : {}), limit: 100 })
      inspected += result.inspected
      if (!result.cursor || result.inspected < 100) { cursor = null; break }
      cursor = result.cursor
    }
    await runtime.repository.atomic(`recovery-cursor/${randomUUID()}`, async tx => {
      const current = await tx.get('ratelimits', cursorId)
      if ((current?.cursor ?? null) !== start) return null
      const next = { cursor, state: 'recovery-cursor', dueAt: options.now().toISOString() }
      await tx[current ? 'replace' : 'create']('ratelimits', cursorId, next)
      return null
    })
    return res.json({ ok: true, result: { inspected } }, 200, { 'Cache-Control': 'no-store' })
  } catch { return res.json({ ok: false, code: 'CAPABILITY_UNAVAILABLE' }, 503, { 'Cache-Control': 'no-store' }) }
}
