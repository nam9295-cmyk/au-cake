import { randomBytes, timingSafeEqual } from 'node:crypto'
import sharp from 'sharp'
import {
  ReviewApiError,
  cleanupPhotoFileDurably,
  enqueuePhotoCleanupIntent,
  hashSecret,
} from './business.js'

export const MAX_REVIEW_PHOTO_BYTES = 1_572_864
export const MAX_REVIEW_PHOTO_INPUT_PIXELS = 8_000_000
export const MAX_REVIEW_PHOTO_UPLOADS = 10
const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const CANONICAL_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function fail(code, status = 400) {
  throw new ReviewApiError(code, status)
}

function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function activeInvite(invite, tokenHash, now) {
  const expiresAt = new Date(invite?.expiresAt)
  return Boolean(invite && secureEqual(invite.tokenHash, tokenHash) && !invite.usedAt &&
    !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime())
}

function sourceCompleted(sourceType, source) {
  return sourceType === 'cake' ? source?.status === '픽업완료' : source?.status === 'Completed'
}

function validateToken(token) {
  if (typeof token !== 'string' || !REVIEW_TOKEN_PATTERN.test(token)) fail('REVIEW_INVITE_INVALID', 404)
  return hashSecret(token)
}

function uploadCount(invite) {
  return Number.isInteger(invite?.photoUploadCount) && invite.photoUploadCount >= 0 ? invite.photoUploadCount : 0
}

export function decodePhotoUpload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.mimeType !== 'image/webp') fail('PHOTO_INVALID')
  if (typeof input.base64 !== 'string' || !input.base64 || !CANONICAL_BASE64_PATTERN.test(input.base64)) fail('PHOTO_INVALID')
  if (input.byteLength !== undefined && (!Number.isInteger(input.byteLength) || input.byteLength < 1)) fail('PHOTO_INVALID')
  const buffer = Buffer.from(input.base64, 'base64')
  if (!buffer.length || buffer.toString('base64') !== input.base64) fail('PHOTO_INVALID')
  if (buffer.length > MAX_REVIEW_PHOTO_BYTES) fail('PHOTO_TOO_LARGE', 413)
  if (input.byteLength !== undefined && input.byteLength !== buffer.length) fail('PHOTO_INVALID')
  return buffer
}

export async function normalizeReviewPhoto(input) {
  try {
    const image = sharp(input, { limitInputPixels: MAX_REVIEW_PHOTO_INPUT_PIXELS, animated: true, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== 'webp' || !Number.isInteger(metadata.width) || metadata.width < 1 ||
      !Number.isInteger(metadata.height) || metadata.height < 1 || (metadata.pages ?? 1) !== 1 ||
      metadata.width * metadata.height > MAX_REVIEW_PHOTO_INPUT_PIXELS) fail('PHOTO_INVALID')
    const { data, info } = await image.rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
    if (!data.length || data.length > MAX_REVIEW_PHOTO_BYTES) fail('PHOTO_TOO_LARGE', 413)
    if (info.format !== 'webp' || info.width < 1 || info.height < 1 || info.width > 1600 || info.height > 1600) fail('PHOTO_INVALID')
    return data
  } catch (error) {
    if (error instanceof ReviewApiError) throw error
    if (/pixel limit|input image exceeds pixel limit|too large/i.test(String(error?.message || ''))) fail('PHOTO_TOO_LARGE', 413)
    fail('PHOTO_INVALID')
  }
}

async function validateInviteAndSource(repository, tokenHash, now, transaction) {
  const invite = await repository.findInviteByTokenHash(tokenHash, transaction)
  if (!activeInvite(invite, tokenHash, now)) fail('REVIEW_INVITE_INVALID', 404)
  const source = await repository.getSource(invite.sourceType, invite.sourceReservationId, transaction)
  if (!sourceCompleted(invite.sourceType, source)) fail('REVIEW_INVITE_INVALID', 404)
  return invite
}

async function queueCleanup(repository, { fileId, inviteId, reason, status = 'pending', attempts = 0, now = new Date() }, transaction) {
  return enqueuePhotoCleanupIntent(repository, { fileId, inviteId, reason, status, attempts, now }, transaction)
}

async function cleanupOne(repository, storage, options) {
  return cleanupPhotoFileDurably(repository, storage, options)
}

export const MAX_PHOTO_CLEANUP_ATTEMPTS = 9
const STAGING_GRACE_MS = 5 * 60 * 1000

async function deleteConvergently(storage, fileId, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await storage.deletePhoto(fileId)
      return true
    } catch (error) {
      if (error?.code === 404) return true
      if (attempt === attempts) return false
    }
  }
  return false
}

async function processCleanupBatch(repository, storage, { batchLimit = 25, now = new Date() }) {
  const entries = await repository.listPhotoCleanup(Math.min(25, Math.max(1, Number.isInteger(batchLimit) ? batchLimit : 25)))
  const result = { processed: entries.length, deleted: 0, retained: 0, failed: 0 }
  for (const entry of entries) {
    const entryId = entry.$id || entry.id
    try {
      if (entry.reason === 'uncertain_attach' || entry.reason === 'staged_upload') {
        const invite = await repository.getInvite(entry.inviteId)
        if (invite?.pendingPhotoFileId === entry.fileId) {
          await repository.deletePhotoCleanup(entryId)
          result.retained += 1
          continue
        }
        const createdAt = new Date(entry.createdAt).getTime()
        if (entry.status === 'staging' && (!Number.isFinite(createdAt) || now.getTime() - createdAt < STAGING_GRACE_MS)) {
          result.retained += 1
          continue
        }
      }
      if (await deleteConvergently(storage, entry.fileId)) {
        await repository.deletePhotoCleanup(entryId)
        result.deleted += 1
        continue
      }
      const attempts = (entry.attempts || 0) + 3
      await repository.updatePhotoCleanup(entryId, {
        status: attempts >= MAX_PHOTO_CLEANUP_ATTEMPTS ? 'failed' : 'pending',
        attempts,
        updatedAt: now.toISOString(),
      })
      result.failed += 1
    } catch {
      result.failed += 1
      try {
        const attempts = (entry.attempts || 0) + 1
        await repository.updatePhotoCleanup(entryId, {
          status: attempts >= MAX_PHOTO_CLEANUP_ATTEMPTS ? 'failed' : 'pending',
          attempts,
          updatedAt: now.toISOString(),
        })
      } catch { /* the durable row remains discoverable */ }
    }
  }
  return result
}

export async function cleanupPhotoFiles(repository, storage, options = {}) {
  return Object.prototype.hasOwnProperty.call(options, 'fileId')
    ? cleanupOne(repository, storage, options)
    : processCleanupBatch(repository, storage, options)
}

export async function uploadReviewPhoto(repository, storage, token, input, {
  now = new Date(), idFactory = () => randomBytes(18).toString('hex'),
  nameFactory = () => `${randomBytes(16).toString('hex')}.webp`, isConflict = (error) => error?.code === 409,
} = {}) {
  const tokenHash = validateToken(token)
  const preflightInvite = await validateInviteAndSource(repository, tokenHash, now)
  if (uploadCount(preflightInvite) >= MAX_REVIEW_PHOTO_UPLOADS) fail('PHOTO_UPLOAD_LIMIT_REACHED', 429)
  const normalized = await normalizeReviewPhoto(decodePhotoUpload(input))
  const fileId = idFactory()
  let inviteId = preflightInvite.$id || preflightInvite.id

  // Reserving first as `staging` closes the otherwise unavoidable crash window between
  // Storage creation and ledger persistence. The reconciler waits before touching it.
  await queueCleanup(repository, {
    fileId, inviteId, reason: 'staged_upload', status: 'staging', attempts: 0, now,
  })
  try {
    await storage.createPrivatePhoto({ fileId, name: nameFactory(), buffer: normalized, mimeType: 'image/webp' })
  } catch (error) {
    try { await repository.deletePhotoCleanup(fileId) } catch { /* 404 reconciliation removes the durable row */ }
    throw error
  }

  let transaction
  let previousFileId
  let commitAttempted = false
  try {
    transaction = await repository.beginTransaction()
    const invite = await validateInviteAndSource(repository, tokenHash, now, transaction)
    inviteId = invite.$id || invite.id
    const count = uploadCount(invite)
    if (count >= MAX_REVIEW_PHOTO_UPLOADS) fail('PHOTO_UPLOAD_LIMIT_REACHED', 429)
    previousFileId = invite.pendingPhotoFileId
    if (previousFileId && previousFileId !== fileId) {
      await queueCleanup(repository, {
        fileId: previousFileId, inviteId, reason: 'replacement', status: 'pending', attempts: 0, now,
      }, transaction)
    }
    await repository.updateInvite(inviteId, {
      pendingPhotoFileId: fileId,
      pendingPhotoUploadedAt: now.toISOString(),
      photoUploadCount: count + 1,
    }, transaction)
    await repository.deletePhotoCleanup(fileId, transaction)
    commitAttempted = true
    await repository.commitTransaction(transaction)
  } catch (error) {
    if (transaction) try { await repository.rollbackTransaction(transaction) } catch { /* commit state may be uncertain */ }
    if (commitAttempted) {
      let current
      try { current = await repository.getInvite(inviteId) } catch {
        await queueCleanup(repository, {
          fileId, inviteId, reason: 'uncertain_attach', status: 'pending', attempts: 0, now,
        })
        fail('PHOTO_UPLOAD_UNCERTAIN', 503)
      }
      if (current?.pendingPhotoFileId === fileId) {
        if (previousFileId && previousFileId !== fileId) {
          await cleanupOne(repository, storage, {
            fileId: previousFileId, inviteId, reason: 'replacement', now, intentExists: true,
          })
        }
        return { uploaded: true, hasPhoto: true }
      }
    }
    await cleanupOne(repository, storage, {
      fileId, inviteId, reason: 'staged_upload', now, intentExists: true,
    })
    if (error instanceof ReviewApiError) throw error
    if (isConflict(error) || commitAttempted) fail('REVIEW_INVITE_CHANGED', 409)
    throw error
  }
  if (previousFileId && previousFileId !== fileId) {
    await cleanupOne(repository, storage, {
      fileId: previousFileId, inviteId, reason: 'replacement', now, intentExists: true,
    })
  }
  return { uploaded: true, hasPhoto: true }
}

export async function removeReviewPhoto(repository, storage, token, { now = new Date() } = {}) {
  const tokenHash = validateToken(token)
  const transaction = await repository.beginTransaction()
  let previousFileId
  let inviteId
  let commitAttempted = false
  try {
    const invite = await validateInviteAndSource(repository, tokenHash, now, transaction)
    inviteId = invite.$id || invite.id
    previousFileId = invite.pendingPhotoFileId
    if (previousFileId) {
      await queueCleanup(repository, {
        fileId: previousFileId, inviteId, reason: 'remove', status: 'pending', attempts: 0, now,
      }, transaction)
    }
    await repository.updateInvite(inviteId, { pendingPhotoFileId: null, pendingPhotoUploadedAt: null }, transaction)
    commitAttempted = true
    await repository.commitTransaction(transaction)
  } catch (error) {
    try { await repository.rollbackTransaction(transaction) } catch { /* commit state may be uncertain */ }
    if (!commitAttempted) throw error
    let current
    try { current = await repository.getInvite(inviteId) } catch {
      fail('PHOTO_REMOVE_UNCERTAIN', 503)
    }
    if (current?.pendingPhotoFileId === previousFileId) fail('REVIEW_INVITE_CHANGED', 409)
    if (previousFileId) {
      await cleanupOne(repository, storage, {
        fileId: previousFileId, inviteId, reason: 'remove', now, intentExists: true,
      })
    }
    return { removed: true, hasPhoto: false }
  }
  if (previousFileId) {
    await cleanupOne(repository, storage, {
      fileId: previousFileId, inviteId, reason: 'remove', now, intentExists: true,
    })
  }
  return { removed: true, hasPhoto: false }
}
