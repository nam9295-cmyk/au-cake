import { createHash, randomUUID } from 'node:crypto'
import { photoFail } from './custom-cake-photo-codec.js'

export const photoDigest = bytes => createHash('sha256').update(bytes).digest('hex')
export const requestPhotoRefs = snapshot => snapshot?.request?.lines?.flatMap(line => line.photoRefs ?? []) ?? []
export function validPhotoRequest(snapshot, requestId, requestNumber) {
  return snapshot?.request?.contractVersion === 'custom-cake.v1' && snapshot.request.requestId === requestId &&
    snapshot.creationResponse.requestId === requestId && snapshot.creationResponse.requestNumber === requestNumber && snapshot.lookupResponse.requestNumber === requestNumber
}

// Retries only definite transaction conflicts; ambiguous commit is never replayed.
export function photoAtomic(repository) {
  return async work => {
    for (let attempt = 0; attempt < 12; attempt++) {
      try { return await repository.atomic(`photo:${randomUUID()}`, work) }
      catch (e) { if (e.code !== 'TRANSACTION_CONFLICT') throw e }
    }
    photoFail('PHOTO_STATE_CONFLICT')
  }
}

export function createPhotoRecovery({ repository, storage, now, atomic }) {
  async function settleUpload(photoRef, bytes) {
    return atomic(async tx => {
      const p = await tx.get('photos', photoRef)
      if (!p || !Buffer.isBuffer(bytes) || bytes.length !== p.byteLength || photoDigest(bytes) !== p.outputDigest) photoFail('PHOTO_STATE_CONFLICT')
      if (!p.uploadResolved) await tx.replace('photos', photoRef, { ...p, uploadResolved: true })
      return null
    })
  }
  async function reconcileUpload(photoRef) {
    const p = await repository.get('photos', photoRef)
    if (!p || p.uploadResolved) return Boolean(p?.uploadResolved)
    const result = await storage.resolveUpload(p.fileId)
    // A missing file does not prove a timed-out upload cannot still complete.
    if (result?.settled !== true || !Buffer.isBuffer(result.bytes)) return false
    await settleUpload(photoRef, result.bytes)
    return true
  }
  async function claimOrphan(photoRef) {
    return atomic(async tx => {
      const p = await tx.get('photos', photoRef)
      if (!p || !['staging', 'staged'].includes(p.state)) return false
      const timestamp = Date.parse(p.intentAt), current = now().getTime()
      if (!Number.isFinite(timestamp) || timestamp > current || current - timestamp < 86400000) return false
      const snapshot = await tx.get('snapshots', p.requestId), session = await tx.get('sessions', p.sessionId)
      if (!session || session.requestId !== p.requestId || p.attachedRequestNumber ||
        (snapshot && (!validPhotoRequest(snapshot, p.requestId, snapshot.creationResponse?.requestNumber) || requestPhotoRefs(snapshot).includes(photoRef)))) return false
      await tx.replace('photos', photoRef, { ...p, state: 'cleanup-claimed', dueAt: now().toISOString() })
      return true
    })
  }
  async function removeClaimed(photoRef) {
    const p = await repository.get('photos', photoRef)
    if (!p || !['cleanup-claimed', 'deletion-pending'].includes(p.state)) return p?.state ?? null
    if (!p.uploadResolved) { if (!await reconcileUpload(photoRef)) return p.state }
    // The claim prevents every legal future attach. Re-read both authoritative
    // sources immediately before physical deletion and retain on any ambiguity.
    const current = await repository.get('photos', photoRef), snapshot = await repository.get('snapshots', p.requestId), session = await repository.get('sessions', p.sessionId)
    if (!current || current.state !== p.state || current.fileId !== p.fileId || !current.uploadResolved) return p.state
    if (!session || session.requestId !== current.requestId) return p.state
    if (p.state === 'cleanup-claimed') {
      const age = now().getTime() - Date.parse(current.intentAt)
      if (!Number.isFinite(age) || age < 86400000) return p.state
    }
    if (snapshot && !validPhotoRequest(snapshot, p.requestId, snapshot.creationResponse?.requestNumber)) return p.state
    if (p.state === 'cleanup-claimed' && (current.attachedRequestNumber || requestPhotoRefs(snapshot).includes(photoRef))) return p.state
    if (p.state === 'deletion-pending' && (!validPhotoRequest(snapshot, p.requestId, current.attachedRequestNumber) || !requestPhotoRefs(snapshot).includes(photoRef))) return p.state
    try { await storage.delete(p.fileId) } catch (e) { if (e.code !== 404) return p.state }
    return atomic(async tx => {
      const after = await tx.get('photos', photoRef)
      if (!after || after.state !== p.state || !after.uploadResolved) photoFail('PHOTO_STATE_CONFLICT')
      const saved = await tx.get('snapshots', after.requestId)
      if (p.state === 'cleanup-claimed' && (after.attachedRequestNumber || requestPhotoRefs(saved).includes(photoRef))) photoFail('PHOTO_STATE_CONFLICT')
      const quota = await tx.get('quotas', after.requestId)
      if (!quota || quota.used < 1) photoFail('PHOTO_STATE_CONFLICT')
      await tx.replace('photos', photoRef, { ...after, state: 'deleted', deletedAt: now().toISOString() })
      await tx.replace('quotas', after.requestId, { ...quota, used: quota.used - 1 })
      return 'deleted'
    })
  }
  async function recover({ cursor, limit = 100 } = {}) {
    const candidates = await repository.list('photos', { ...(cursor ? { cursor } : {}), limit })
    const result = { inspected: candidates.length, deleted: 0, retained: 0, uncertain: 0, cursor: candidates.at(-1)?.id ?? null }
    for (const { id } of candidates) {
      try {
        let p = await repository.get('photos', id)
        if (!p || p.state === 'deleted' || p.state === 'attached') { result.retained++; continue }
        if (['staging', 'staged'].includes(p.state)) await claimOrphan(id)
        p = await repository.get('photos', id)
        if (['cleanup-claimed', 'deletion-pending'].includes(p.state) && await removeClaimed(id) === 'deleted') result.deleted++
        else result.retained++
      } catch { result.uncertain++ } // Durable row, no secrets or external error logged.
    }
    return result
  }
  return { settleUpload, reconcileUpload, removeClaimed, recover }
}
