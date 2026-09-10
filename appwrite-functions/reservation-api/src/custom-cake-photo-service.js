import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { customCakeDocumentId } from './custom-cake-persistence.js'
import { CUSTOM_CAKE_PHOTO_LIMITS, decodeCustomCakePhotoInput, normalizeCustomCakePhoto, photoFail } from './custom-cake-photo-codec.js'
import { createPhotoRecovery, photoAtomic, photoDigest, requestPhotoRefs, validPhotoRequest } from './custom-cake-photo-recovery.js'

const version = 'custom-cake-photo.v1'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const asciiId = /^[A-Za-z0-9_-]{1,64}$/
function exact(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== fields.length || fields.some(k => !Object.hasOwn(data, k))) photoFail('INVALID_REQUEST')
}
function envelope(data, fields) { exact(data, ['contractVersion', ...fields]); if (data.contractVersion !== version) photoFail('INVALID_REQUEST') }
function requestIdentity(value) { if (typeof value !== 'string' || !uuid.test(value)) photoFail('INVALID_REQUEST') }
function uploadResponse(photoRef, p) { return { contractVersion: version, requestId: p.requestId, photoRef, state: 'staged', mimeType: 'image/webp', width: p.width, height: p.height, byteLength: p.byteLength } }

/** Required trusted dependencies: allowSessionIssue implements distributed abuse
 * control, resolveRequestAccess authenticates transport/lookup proof with rate
 * controls, storage is private and offers conservative complete-file resolution.
 * Bootstrap must verify those capabilities before advertising this service.
 * All snapshot/quota IDs are the raw UUID requestId; photo/session IDs are opaque.
 */
export function createCustomCakePhotoService({ repository, storage, tokenDigestKey, resolveRequestAccess, allowSessionIssue, now = () => new Date() } = {}) {
  if (!repository || ['get', 'list', 'atomic'].some(k => typeof repository[k] !== 'function') || !storage || ['upload', 'read', 'delete', 'resolveUpload'].some(k => typeof storage[k] !== 'function') || typeof resolveRequestAccess !== 'function' || typeof allowSessionIssue !== 'function' || !Buffer.isBuffer(tokenDigestKey) || tokenDigestKey.length < 32) photoFail('CAPABILITY_UNAVAILABLE')
  const secret = Buffer.from(tokenDigestKey), atomic = photoAtomic(repository)
  const recovery = createPhotoRecovery({ repository, storage, now, atomic })
  const digest = bearer => createHmac('sha256', secret).update(bearer).digest('hex')
  async function sessionProof(reader, requestId, headers) {
    const sessionId = headers?.['x-custom-cake-upload-session'], bearer = headers?.['x-custom-cake-upload-token']
    if (typeof sessionId !== 'string' || !/^[a-f0-9]{36}$/.test(sessionId) || typeof bearer !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(bearer)) photoFail('PHOTO_SESSION_INVALID')
    const s = await reader.get('sessions', sessionId)
    if (!s || s.requestId !== requestId || !timingSafeEqual(Buffer.from(s.tokenDigest, 'hex'), Buffer.from(digest(bearer), 'hex'))) photoFail('PHOTO_SESSION_INVALID')
    if (Date.parse(s.expiresAt) <= now().getTime()) photoFail('PHOTO_SESSION_EXPIRED')
    return { sessionId, session: s }
  }
  async function issueSession(data, context) {
    envelope(data, ['requestId']); requestIdentity(data.requestId)
    if (await allowSessionIssue({ requestId: data.requestId, context }) !== true) photoFail('FORBIDDEN')
    const uploadSessionId = randomBytes(18).toString('hex'), uploadToken = randomBytes(32).toString('base64url'), issuedAt = now().toISOString()
    const expiresAt = new Date(Date.parse(issuedAt) + 1800000).toISOString()
    await atomic(async tx => { await tx.create('sessions', uploadSessionId, { requestId: data.requestId, tokenDigest: digest(uploadToken), issuedAt, expiresAt }); return null })
    return { contractVersion: version, requestId: data.requestId, uploadSessionId, uploadToken, expiresAt, limits: structuredClone(CUSTOM_CAKE_PHOTO_LIMITS) }
  }
  async function completeUpload(photoRef, requestId, headers) {
    return atomic(async tx => {
      const p = await tx.get('photos', photoRef)
      if (!p || !['staging', 'staged'].includes(p.state) || !p.uploadResolved) photoFail('PHOTO_STATE_CONFLICT')
      const proof = await sessionProof(tx, requestId, headers)
      if (proof.sessionId !== p.sessionId || proof.session.attachedRequestNumber) photoFail('PHOTO_STATE_CONFLICT')
      if (p.state === 'staging') await tx.replace('photos', photoRef, { ...p, state: 'staged' })
      return uploadResponse(photoRef, p)
    })
  }
  async function upload(data, headers) {
    envelope(data, ['requestId', 'uploadId', 'mimeType', 'base64']); requestIdentity(data.requestId)
    if (typeof data.uploadId !== 'string' || !asciiId.test(data.uploadId)) photoFail('INVALID_REQUEST')
    const proof = await sessionProof(repository, data.requestId, headers)
    const bytes = decodeCustomCakePhotoInput(data.base64), inputDigest = photoDigest(Buffer.concat([Buffer.from(`${data.mimeType}\0`), bytes]))
    const photoRef = customCakeDocumentId('custom-cake-photo-upload-v1', `${proof.sessionId}/${data.uploadId}`)
    const existing = await repository.get('photos', photoRef)
    if (existing) {
      if (existing.inputDigest !== inputDigest) photoFail('PHOTO_UPLOAD_CONFLICT')
      if (!['staging', 'staged'].includes(existing.state)) photoFail('PHOTO_STATE_CONFLICT')
      if (!existing.uploadResolved && !await recovery.reconcileUpload(photoRef)) photoFail('PHOTO_STATE_CONFLICT')
      return completeUpload(photoRef, data.requestId, headers)
    }
    const normalized = await normalizeCustomCakePhoto(bytes, data.mimeType), fileId = randomBytes(18).toString('hex'), intentAt = now().toISOString()
    const dispatch = await atomic(async tx => {
      const current = await sessionProof(tx, data.requestId, headers)
      if (current.session.attachedRequestNumber) photoFail('PHOTO_STATE_CONFLICT')
      const prior = await tx.get('photos', photoRef)
      if (prior) { if (prior.inputDigest !== inputDigest) photoFail('PHOTO_UPLOAD_CONFLICT'); return false }
      const quota = await tx.get('quotas', data.requestId)
      if (quota?.used >= 5) photoFail('PHOTO_LIMIT_EXCEEDED')
      const nextQuota = { requestId: data.requestId, used: (quota?.used ?? 0) + 1 }
      if (quota) await tx.replace('quotas', data.requestId, nextQuota); else await tx.create('quotas', data.requestId, nextQuota)
      await tx.create('photos', photoRef, { state: 'staging', requestId: data.requestId, sessionId: current.sessionId, uploadId: data.uploadId, inputDigest, fileId, intentAt, dueAt: new Date(Date.parse(intentAt) + 86400000).toISOString(), uploadResolved: false,
        outputDigest: photoDigest(normalized.bytes), width: normalized.width, height: normalized.height, byteLength: normalized.byteLength })
      return true
    })
    if (!dispatch) {
      if (!await recovery.reconcileUpload(photoRef)) photoFail('PHOTO_STATE_CONFLICT')
      return completeUpload(photoRef, data.requestId, headers)
    }
    try { await storage.upload(fileId, normalized.bytes) } catch { photoFail('PHOTO_STATE_CONFLICT') }
    await recovery.settleUpload(photoRef, normalized.bytes)
    return completeUpload(photoRef, data.requestId, headers)
  }
  async function attach(tx, { requestId, requestNumber, photoRefs, headers }) {
    try {
      if (!tx?.transactionId || !Array.isArray(photoRefs) || photoRefs.length > 5 || new Set(photoRefs).size !== photoRefs.length || photoRefs.some(ref => typeof ref !== 'string' || !asciiId.test(ref))) photoFail('INVALID_PHOTO_REFERENCE')
      if (!photoRefs.length) return null
      const { sessionId, session } = await sessionProof(tx, requestId, headers)
      if (session.attachedRequestNumber) photoFail('INVALID_PHOTO_REFERENCE')
      const snapshot = await tx.get('snapshots', requestId)
      if (!validPhotoRequest(snapshot, requestId, requestNumber) || JSON.stringify([...requestPhotoRefs(snapshot)].sort()) !== JSON.stringify([...photoRefs].sort())) photoFail('INVALID_PHOTO_REFERENCE')
      const photos = []
      for (const ref of photoRefs) {
        const p = await tx.get('photos', ref)
        if (!p || p.requestId !== requestId || p.sessionId !== sessionId || p.state !== 'staged' || !p.uploadResolved || p.attachedRequestNumber) photoFail('INVALID_PHOTO_REFERENCE')
        photos.push([ref, p])
      }
      for (const [ref, p] of photos) await tx.replace('photos', ref, { ...p, state: 'attached', attachedRequestNumber: requestNumber, attachedAt: now().toISOString() })
      await tx.replace('sessions', sessionId, { ...session, attachedRequestNumber: requestNumber })
      return null
    } catch (e) {
      if (['PHOTO_SESSION_INVALID', 'PHOTO_SESSION_EXPIRED', 'PHOTO_STATE_CONFLICT', 'INVALID_PHOTO_REFERENCE'].includes(e.code)) photoFail('INVALID_PHOTO_REFERENCE')
      throw e
    }
  }
  async function access(data, context) {
    envelope(data, ['requestNumber', 'photoRef', 'authorization'])
    if (typeof data.requestNumber !== 'string' || !data.requestNumber || data.requestNumber.length > 64 || typeof data.photoRef !== 'string' || !asciiId.test(data.photoRef)) photoFail('INVALID_REQUEST')
    if (data.authorization?.kind === 'admin') exact(data.authorization, ['kind'])
    else if (data.authorization?.kind === 'customer') { exact(data.authorization, ['kind', 'customerPhone']); if (typeof data.authorization.customerPhone !== 'string') photoFail('INVALID_REQUEST') }
    else photoFail('INVALID_REQUEST')
    const proof = await resolveRequestAccess({ requestNumber: data.requestNumber, authorization: structuredClone(data.authorization), context })
    if (!proof || !uuid.test(proof.requestId) || proof.requestNumber !== data.requestNumber) photoFail('NOT_FOUND')
    return proof
  }
  async function relation(reader, data, proof, states) {
    const p = await reader.get('photos', data.photoRef), snapshot = await reader.get('snapshots', proof.requestId)
    if (!p || p.requestId !== proof.requestId || p.attachedRequestNumber !== proof.requestNumber || !states.includes(p.state) || !validPhotoRequest(snapshot, proof.requestId, proof.requestNumber) || !requestPhotoRefs(snapshot).includes(data.photoRef)) photoFail('NOT_FOUND')
    return p
  }
  async function read(data, context) {
    const proof = await access(data, context), p = await relation(repository, data, proof, ['attached'])
    let bytes
    try { bytes = await storage.read(p.fileId) } catch { photoFail('NOT_FOUND') }
    if (!Buffer.isBuffer(bytes) || bytes.length !== p.byteLength || photoDigest(bytes) !== p.outputDigest) photoFail('NOT_FOUND')
    await relation(repository, data, proof, ['attached']) // Deletion during IO revokes this response.
    return { contractVersion: version, photoRef: data.photoRef, mimeType: 'image/webp', base64: bytes.toString('base64'), width: p.width, height: p.height, byteLength: p.byteLength }
  }
  async function remove(data, context) {
    const proof = await access(data, context)
    let state = await atomic(async tx => {
      const p = await relation(tx, data, proof, ['attached', 'deletion-pending', 'deleted'])
      if (p.state !== 'attached') return p.state
      await tx.replace('photos', data.photoRef, { ...p, state: 'deletion-pending', removedAt: now().toISOString(), dueAt: now().toISOString() })
      return 'deletion-pending'
    })
    if (state === 'deletion-pending') { try { state = await recovery.removeClaimed(data.photoRef) } catch { /* durable tombstone retains retry */ } }
    return { contractVersion: version, photoRef: data.photoRef, state }
  }
  return { issueSession, upload, attach, read, delete: remove, recover: recovery.recover }
}
