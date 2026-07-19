import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { digestReviewCouponCode, resolveReviewCouponHmacSecret } from './coupon-digest.js'
import { decryptReviewCouponCode, encryptReviewCouponCode, resolveReviewCouponEncryptionKey } from './coupon-envelope.js'

const SYDNEY_TIME_ZONE = 'Australia/Sydney'
const COUPON_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const REWARD_LAST4_PATTERN = /^[A-Z2-9]{4}$/
const REWARD_STATUSES = new Set(['active', 'redeemed', 'expired', 'revoked'])
const UNAVAILABLE_REWARD_SUMMARY = Object.freeze({
  rewardCodeLast4: null,
  rewardStatus: 'unavailable',
  rewardExpiresAt: null,
  rewardMessageAvailable: false,
})

export const REVIEW_COUPON_ANIMALS = [
  'FOX', 'CAT', 'DOG', 'OWL', 'PIG', 'BEE', 'COW', 'CUB', 'EMU', 'HEN', 'KOI', 'PUP', 'RAM', 'YAK', 'APE',
]
export const REVIEW_COUPON_FRUITS = [
  'KIWI', 'FIG', 'LIME', 'PEAR', 'PLUM', 'APPLE', 'GRAPE', 'GUAVA', 'LEMON', 'MANGO', 'MELON', 'PEACH',
]

export class ReviewApiError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.name = 'ReviewApiError'
    this.code = code
    this.status = status
  }
}

function fail(code, status = 400) {
  throw new ReviewApiError(code, status)
}

export function validateReviewInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_REQUEST')
  if (input.website !== undefined && input.website !== null && input.website !== '') fail('INVALID_REQUEST')
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail('INVALID_REVIEW_RATING')
  if (typeof input.body !== 'string') fail('INVALID_REVIEW_BODY')
  const body = input.body.trim()
  if (!body || body.length > 2000) fail('INVALID_REVIEW_BODY')
  if (input.displayName !== undefined && input.displayName !== null && typeof input.displayName !== 'string') {
    fail('INVALID_DISPLAY_NAME')
  }
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  if (displayName.length > 50) fail('INVALID_DISPLAY_NAME')
  if (typeof input.publishConsent !== 'boolean') fail('INVALID_PUBLISH_CONSENT')
  if (input.photoPublishConsent !== undefined && typeof input.photoPublishConsent !== 'boolean') {
    fail('INVALID_PHOTO_PUBLISH_CONSENT')
  }
  return {
    rating: input.rating,
    body,
    displayName,
    publishConsent: input.publishConsent,
    photoPublishConsent: input.photoPublishConsent === true,
  }
}

export function generateReviewToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSecret(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex')
}

const formatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function sydneyParts(value) {
  const parts = Object.fromEntries(formatter.formatToParts(value)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]))
  return { ...parts, millisecond: value.getUTCMilliseconds() }
}

function partsAsUtc(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond)
}

function candidatesFor(parts) {
  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(sydneyParts(new Date(instant))) - instant)
  }
  return [...offsets].map((offset) => target - offset)
    .filter((candidate) => partsAsUtc(sydneyParts(new Date(candidate))) === target)
    .sort((left, right) => left - right)
}

function fromSydneyParts(parts) {
  const candidates = candidatesFor(parts)
  if (candidates.length > 0) return new Date(candidates[0])

  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(sydneyParts(new Date(instant))) - instant)
  }
  const sortedOffsets = [...offsets].sort((left, right) => left - right)
  const gap = sortedOffsets.at(-1) - sortedOffsets[0]
  const shifted = new Date(target + gap)
  const shiftedParts = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  const shiftedCandidates = candidatesFor(shiftedParts)
  if (gap <= 0 || shiftedCandidates.length === 0) throw new RangeError('Sydney date-time could not be resolved')
  return new Date(shiftedCandidates[0])
}

export function addSydneyCalendarDays(value, days) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()) || !Number.isInteger(days)) {
    throw new RangeError('Sydney calendar date and days must be valid')
  }
  const parts = sydneyParts(value)
  const shifted = new Date(partsAsUtc({ ...parts, day: parts.day + days }))
  const target = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  return fromSydneyParts(target)
}

function randomCouponIndex(size, randomByteFactory) {
  const unbiasedLimit = Math.floor(256 / size) * size
  while (true) {
    const byte = randomByteFactory(1)[0]
    if (byte < unbiasedLimit) return byte % size
  }
}

export function generateCoupon(rewardPercent, hmacSecret, { randomBytes: randomByteFactory = randomBytes } = {}) {
  if (rewardPercent !== 5 && rewardPercent !== 10) fail('INVALID_REWARD_PERCENT')
  const secret = Buffer.isBuffer(hmacSecret)
    ? hmacSecret
    : resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: hmacSecret }, ReviewApiError)
  const animal = REVIEW_COUPON_ANIMALS[randomCouponIndex(REVIEW_COUPON_ANIMALS.length, randomByteFactory)]
  const fruit = REVIEW_COUPON_FRUITS[randomCouponIndex(REVIEW_COUPON_FRUITS.length, randomByteFactory)]
  const suffix = Array.from({ length: 5 }, () =>
    COUPON_ALPHABET[randomCouponIndex(COUPON_ALPHABET.length, randomByteFactory)]).join('')
  const code = `${animal}${fruit}${suffix}`
  return { code, persisted: { codeHash: digestReviewCouponCode(code, secret), codeLast4: code.slice(-4) } }
}

export function toPublicReview(review, photoUrlForReview) {
  if (!review?.publishConsent || review.moderationStatus !== 'published') fail('REVIEW_NOT_PUBLIC', 404)
  if ((review.sourceType !== 'cake' && review.sourceType !== 'class') ||
      !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 ||
      typeof review.body !== 'string' || !review.body.trim() || review.body.length > 2000) {
    fail('INVALID_PUBLIC_REVIEW', 500)
  }
  const createdAt = review.createdAt || review.$createdAt
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) fail('INVALID_PUBLIC_REVIEW', 500)
  const displayName = typeof review.displayName === 'string' ? review.displayName.trim() : ''
  if (displayName.length > 50) fail('INVALID_PUBLIC_REVIEW', 500)
  const id = review.$id || review.id
  if (!OPAQUE_ID_PATTERN.test(id || '')) fail('INVALID_PUBLIC_REVIEW', 500)
  const photoUrls = review.photoPublishConsent === true && typeof review.photoFileId === 'string' && review.photoFileId
    ? photoUrlForReview?.(review) || null
    : null
  if (photoUrls !== null && (
    typeof photoUrls !== 'object' ||
    typeof photoUrls.thumbnailUrl !== 'string' || !photoUrls.thumbnailUrl.startsWith('https://') ||
    typeof photoUrls.photoUrl !== 'string' || !photoUrls.photoUrl.startsWith('https://')
  )) {
    fail('INVALID_PUBLIC_REVIEW', 500)
  }
  return {
    id,
    sourceType: review.sourceType,
    rating: review.rating,
    body: review.body,
    displayName: displayName || (review.sourceType === 'cake' ? 'Verified cake order' : 'Verified class booking'),
    hasPhoto: photoUrls !== null,
    thumbnailUrl: photoUrls?.thumbnailUrl || null,
    photoUrl: photoUrls?.photoUrl || null,
    createdAt,
    incentivised: true,
  }
}

function secureHashEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function validIsoDate(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function canonicalBase64Url(value, decodedBytes) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value)) return false
  const decoded = Buffer.from(value, 'base64url')
  return (decodedBytes === undefined || decoded.length === decodedBytes) && decoded.toString('base64url') === value
}

function hasCompleteV1Envelope(coupon) {
  return coupon?.codeEncryptionVersion === 1 &&
    typeof coupon.codeCiphertext === 'string' && coupon.codeCiphertext.length <= 64 && canonicalBase64Url(coupon.codeCiphertext) &&
    canonicalBase64Url(coupon.codeIv, 12) &&
    canonicalBase64Url(coupon.codeAuthTag, 16)
}

function deriveAdminRewardSummary(review, coupon, now = new Date()) {
  const reviewId = review?.$id || review?.id
  const couponId = coupon?.$id || coupon?.id
  const linked = OPAQUE_ID_PATTERN.test(reviewId || '') &&
    OPAQUE_ID_PATTERN.test(review?.couponId || '') &&
    review.couponId === couponId &&
    coupon?.sourceReviewId === reviewId &&
    (review.rewardPercent === 5 || review.rewardPercent === 10) &&
    coupon.rewardPercent === review.rewardPercent &&
    REWARD_STATUSES.has(coupon.status) &&
    validIsoDate(coupon.expiresAt) &&
    REWARD_LAST4_PATTERN.test(coupon.codeLast4 || '')
  if (!linked) return { ...UNAVAILABLE_REWARD_SUMMARY }
  if (coupon.status === 'active' && !hasCompleteV1Envelope(coupon)) {
    return { ...UNAVAILABLE_REWARD_SUMMARY }
  }

  const isFuture = Date.parse(coupon.expiresAt) > now.getTime()
  const rewardStatus = coupon.status === 'active' && !isFuture ? 'expired' : coupon.status
  return {
    rewardCodeLast4: coupon.codeLast4,
    rewardStatus,
    rewardExpiresAt: coupon.expiresAt,
    rewardMessageAvailable: rewardStatus === 'active' && isFuture,
  }
}

async function loadAdminRewardSummary(repository, review, now) {
  if (!OPAQUE_ID_PATTERN.test(review?.couponId || '')) return { ...UNAVAILABLE_REWARD_SUMMARY }
  try {
    const coupon = await repository.getCoupon(review.couponId)
    return deriveAdminRewardSummary(review, coupon, now)
  } catch {
    return { ...UNAVAILABLE_REWARD_SUMMARY }
  }
}

function validInvite(invite, tokenHash, now) {
  const expiresAt = new Date(invite?.expiresAt)
  return Boolean(
    invite &&
    secureHashEqual(invite.tokenHash, tokenHash) &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime() &&
    !invite.usedAt,
  )
}

function validateSourceType(value) {
  return value === 'cake' || value === 'class'
}

function sourceIsCompleted(sourceType, source) {
  return sourceType === 'cake' ? source?.status === '픽업완료' : source?.status === 'Completed'
}

export function assertReviewAdmin(headers = {}, env = process.env) {
  const userId = headers['x-appwrite-user-id']
  const allowlist = String(env.REVIEW_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)
  if (typeof userId !== 'string' || !allowlist.includes(userId)) fail('REVIEW_ADMIN_UNAUTHORIZED', 403)
  return userId
}

export function photoCleanupIntent({ fileId, inviteId, reason, status = 'pending', attempts = 0, now = new Date() }) {
  return {
    fileId, inviteId, reason, status, attempts,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }
}

export async function enqueuePhotoCleanupIntent(repository, options, transaction) {
  try {
    await repository.enqueuePhotoCleanup(photoCleanupIntent(options), transaction)
  } catch {
    fail('PHOTO_CLEANUP_RECORD_FAILED', 503)
  }
}

export async function cleanupPhotoFileDurably(repository, storage, {
  fileId, inviteId, reason, attempts = 3, now = new Date(), intentExists = false,
}) {
  if (!fileId || !storage) return 'none'
  let deleted = false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await storage.deletePhoto(fileId)
      deleted = true
      break
    } catch (error) {
      if (error?.code === 404) {
        deleted = true
        break
      }
    }
  }
  if (deleted) {
    if (intentExists && repository.deletePhotoCleanup) {
      try { await repository.deletePhotoCleanup(fileId) } catch { /* durable row remains for 404 convergence */ }
    }
    return 'deleted'
  }
  if (!intentExists) {
    await enqueuePhotoCleanupIntent(repository, { fileId, inviteId, reason, status: 'pending', attempts, now })
  }
  return 'queued'
}

export async function issueReviewInvite(repository, input, {
  now = new Date(),
  createdByUserId,
  tokenFactory = generateReviewToken,
  idFactory = () => randomBytes(18).toString('hex'),
  isConflict = (error) => error?.code === 409,
  storage,
} = {}) {
  const sourceType = input?.sourceType
  const sourceReservationId = typeof input?.sourceReservationId === 'string' ? input.sourceReservationId.trim() : ''
  if (!validateSourceType(sourceType) || !sourceReservationId) fail('REVIEW_SOURCE_NOT_COMPLETED')

  const transaction = await repository.beginTransaction()
  let rotatedPhoto
  let rotatedInviteId
  let proposedToken
  let proposedData
  let commitAttempted = false
  try {
    const source = await repository.getSource(sourceType, sourceReservationId, transaction)
    if (!sourceIsCompleted(sourceType, source)) fail('REVIEW_SOURCE_NOT_COMPLETED')
    const existingInvite = await repository.findInviteBySource(sourceType, sourceReservationId, transaction)
    const existingReview = await repository.findReviewBySource(sourceType, sourceReservationId, transaction)
    if (existingInvite?.usedAt || existingReview) fail('REVIEW_ALREADY_SUBMITTED', 409)

    proposedToken = tokenFactory()
    proposedData = {
      sourceType,
      sourceReservationId,
      sourceReservationNumber: source.reservationNumber,
      tokenHash: hashSecret(proposedToken),
      expiresAt: addSydneyCalendarDays(now, 30).toISOString(),
      createdByUserId,
      createdAt: now.toISOString(),
    }
    if (existingInvite) {
      rotatedPhoto = existingInvite.pendingPhotoFileId
      rotatedInviteId = existingInvite.$id || existingInvite.id
      if (rotatedPhoto) {
        await enqueuePhotoCleanupIntent(repository, {
          fileId: rotatedPhoto, inviteId: rotatedInviteId, reason: 'rotation', status: 'pending', attempts: 0, now,
        }, transaction)
      }
      await repository.updateInvite(rotatedInviteId, {
        ...proposedData,
        pendingPhotoFileId: null,
        pendingPhotoUploadedAt: null,
      }, transaction)
    } else {
      await repository.createInvite({ ...proposedData, photoUploadCount: 0 }, transaction, idFactory())
    }
    commitAttempted = true
    await repository.commitTransaction(transaction)
    await cleanupPhotoFileDurably(repository, storage, {
      fileId: rotatedPhoto, inviteId: rotatedInviteId, reason: 'rotation', now, intentExists: Boolean(rotatedPhoto),
    })
    return { token: proposedToken, expiresAt: proposedData.expiresAt }
  } catch (error) {
    try { await repository.rollbackTransaction(transaction) } catch { /* already rolled back or committed */ }
    if (error instanceof ReviewApiError) throw error

    if (commitAttempted && rotatedInviteId) {
      let currentInvite
      try {
        currentInvite = repository.getInvite
          ? await repository.getInvite(rotatedInviteId)
          : await repository.findInviteBySource(sourceType, sourceReservationId)
      } catch {
        fail('REVIEW_INVITE_UNCERTAIN', 503)
      }
      if (currentInvite && secureHashEqual(currentInvite.tokenHash, proposedData.tokenHash)) {
        await cleanupPhotoFileDurably(repository, storage, {
          fileId: rotatedPhoto, inviteId: rotatedInviteId, reason: 'rotation', now, intentExists: Boolean(rotatedPhoto),
        })
        return { token: proposedToken, expiresAt: proposedData.expiresAt }
      }
      fail('REVIEW_INVITE_CHANGED', 409)
    }

    if (!isConflict(error)) throw error
    try {
      const [currentInvite, currentReview] = await Promise.all([
        repository.findInviteBySource(sourceType, sourceReservationId),
        repository.findReviewBySource(sourceType, sourceReservationId),
      ])
      if (currentInvite?.usedAt || currentReview) fail('REVIEW_ALREADY_SUBMITTED', 409)
    } catch (classificationError) {
      if (classificationError instanceof ReviewApiError) throw classificationError
    }
    fail('REVIEW_INVITE_CHANGED', 409)
  }
}

export async function loadReviewInvite(repository, token, { now = new Date() } = {}) {
  if (typeof token !== 'string' || !REVIEW_TOKEN_PATTERN.test(token)) fail('REVIEW_INVITE_INVALID', 404)
  const tokenHash = hashSecret(token)
  const invite = await repository.findInviteByTokenHash(tokenHash)
  if (!validInvite(invite, tokenHash, now)) fail('REVIEW_INVITE_INVALID', 404)
  const source = await repository.getSource(invite.sourceType, invite.sourceReservationId)
  if (!sourceIsCompleted(invite.sourceType, source)) fail('REVIEW_INVITE_INVALID', 404)
  return {
    sourceType: invite.sourceType,
    label: invite.sourceType === 'cake' ? 'Verified cake order' : 'Verified class booking',
    experienceDate: invite.sourceType === 'cake' ? source.pickupDate : source.classDate,
    hasPhoto: typeof invite.pendingPhotoFileId === 'string' && invite.pendingPhotoFileId.length > 0,
  }
}

async function reconcileSubmittedReview(repository, proposed) {
  try {
    const [invite, review, coupon] = await Promise.all([
      repository.findInviteByTokenHash(proposed.tokenHash),
      repository.getReview(proposed.reviewId),
      repository.getCoupon(proposed.couponId),
    ])
    const inviteMatches = invite &&
      secureHashEqual(invite.tokenHash, proposed.tokenHash) &&
      invite.usedAt === proposed.createdAt &&
      invite.sourceType === proposed.sourceType &&
      invite.sourceReservationId === proposed.sourceReservationId
    const reviewMatches = review &&
      (review.$id || review.id) === proposed.reviewId &&
      review.sourceType === proposed.sourceType &&
      review.sourceReservationId === proposed.sourceReservationId &&
      review.couponId === proposed.couponId &&
      review.rewardPercent === proposed.result.rewardPercent
    const couponMatches = coupon &&
      (coupon.$id || coupon.id) === proposed.couponId &&
      coupon.sourceReviewId === proposed.reviewId &&
      coupon.status === 'active' &&
      coupon.rewardPercent === proposed.result.rewardPercent &&
      coupon.expiresAt === proposed.result.couponExpiresAt &&
      secureHashEqual(coupon.codeHash, proposed.couponHash)
    return inviteMatches && reviewMatches && couponMatches ? proposed.result : null
  } catch {
    return null
  }
}

export async function submitReview(repository, token, input, {
  now = new Date(),
  idFactory = () => randomBytes(18).toString('hex'),
  isConflict = (error) => error?.code === 409,
  hmacSecret,
  encryptionKey,
} = {}) {
  const couponHmacSecret = Buffer.isBuffer(hmacSecret)
    ? hmacSecret
    : resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: hmacSecret }, ReviewApiError)
  if (couponHmacSecret.length < 32) fail('FUNCTION_CONFIGURATION_ERROR', 500)
  const couponEncryptionKey = Buffer.isBuffer(encryptionKey)
    ? encryptionKey
    : resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  if (couponEncryptionKey.length !== 32 || couponEncryptionKey.equals(couponHmacSecret)) {
    fail('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  if (typeof token !== 'string' || !REVIEW_TOKEN_PATTERN.test(token)) fail('REVIEW_INVITE_INVALID', 404)
  const reviewInput = validateReviewInput(input)
  const reviewId = idFactory()
  const couponId = idFactory()
  const createdAt = now.toISOString()
  const tokenHash = hashSecret(token)
  const initialInvite = await repository.findInviteByTokenHash(tokenHash)
  if (initialInvite?.usedAt) fail('REVIEW_ALREADY_SUBMITTED', 409)
  if (!validInvite(initialInvite, tokenHash, now)) fail('REVIEW_INVITE_INVALID', 404)
  const source = await repository.getSource(initialInvite.sourceType, initialInvite.sourceReservationId)
  if (!sourceIsCompleted(initialInvite.sourceType, source)) fail('REVIEW_SOURCE_NOT_COMPLETED')
  const transaction = await repository.beginTransaction()
  let proposedSubmission = null
  let commitAttempted = false

  try {
    const invite = await repository.findInviteByTokenHash(tokenHash, transaction)
    if (invite?.usedAt) fail('REVIEW_ALREADY_SUBMITTED', 409)
    if (!validInvite(invite, tokenHash, now)) fail('REVIEW_INVITE_INVALID', 404)
    const transactionSource = await repository.getSource(invite.sourceType, invite.sourceReservationId, transaction)
    if (!sourceIsCompleted(invite.sourceType, transactionSource)) fail('REVIEW_SOURCE_NOT_COMPLETED')

    const trustedPhotoFileId = typeof invite.pendingPhotoFileId === 'string' && invite.pendingPhotoFileId.trim()
      ? invite.pendingPhotoFileId.trim()
      : undefined
    const rewardPercent = trustedPhotoFileId ? 10 : 5
    const coupon = generateCoupon(rewardPercent, couponHmacSecret)
    const couponEnvelope = encryptReviewCouponCode({
      code: coupon.code,
      couponId,
      reviewId,
      key: couponEncryptionKey,
      ErrorClass: ReviewApiError,
    })
    const couponExpiresAt = addSydneyCalendarDays(now, 60).toISOString()

    await repository.createReview({
      sourceType: invite.sourceType,
      sourceReservationId: invite.sourceReservationId,
      sourceReservationNumber: invite.sourceReservationNumber,
      rating: reviewInput.rating,
      body: reviewInput.body,
      ...(trustedPhotoFileId ? { photoFileId: trustedPhotoFileId } : {}),
      photoPublishConsent: Boolean(trustedPhotoFileId && reviewInput.photoPublishConsent),
      ...(reviewInput.displayName ? { displayName: reviewInput.displayName } : {}),
      publishConsent: reviewInput.publishConsent,
      moderationStatus: 'pending',
      rewardPercent,
      couponId,
      createdAt,
      updatedAt: createdAt,
    }, transaction, reviewId)
    await repository.createCoupon({
      ...coupon.persisted,
      ...couponEnvelope,
      rewardPercent,
      scope: 'cake',
      status: 'active',
      sourceReviewId: reviewId,
      expiresAt: couponExpiresAt,
      createdAt,
    }, transaction, couponId)
    await repository.markInviteUsed(invite.$id || invite.id, createdAt, transaction)
    proposedSubmission = {
      tokenHash,
      reviewId,
      couponId,
      couponHash: coupon.persisted.codeHash,
      createdAt,
      sourceType: invite.sourceType,
      sourceReservationId: invite.sourceReservationId,
      result: { rewardPercent, couponCode: coupon.code, couponExpiresAt },
    }
    commitAttempted = true
    await repository.commitTransaction(transaction)
    return proposedSubmission.result
  } catch (error) {
    try {
      await repository.rollbackTransaction(transaction)
    } catch {
      // Appwrite may already have rolled back the transaction.
    }
    if (error instanceof ReviewApiError) throw error
    if (proposedSubmission && (commitAttempted || isConflict(error))) {
      const committed = await reconcileSubmittedReview(repository, proposedSubmission)
      if (committed) return committed
      if (commitAttempted && !isConflict(error)) fail('REVIEW_SUBMISSION_UNCERTAIN', 503)
    }
    if (isConflict(error)) {
      try {
        const [currentInvite, currentReview] = await Promise.all([
          repository.findInviteBySource(initialInvite.sourceType, initialInvite.sourceReservationId),
          repository.findReviewBySource(initialInvite.sourceType, initialInvite.sourceReservationId),
        ])
        if (currentReview || currentInvite?.usedAt) throw new ReviewApiError('REVIEW_ALREADY_SUBMITTED', 409)
        if (!currentInvite || !secureHashEqual(currentInvite.tokenHash, tokenHash)) {
          throw new ReviewApiError('REVIEW_INVITE_CHANGED', 409)
        }
      } catch (classificationError) {
        if (classificationError instanceof ReviewApiError) throw classificationError
      }
      throw new ReviewApiError('REVIEW_ALREADY_SUBMITTED', 409)
    }
    throw error
  }
}

export async function listPublicReviewPage(repository, limit = 3, { cursor, photoUrlForReview } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 6 ||
      (cursor !== undefined && !OPAQUE_ID_PATTERN.test(cursor))) fail('INVALID_REQUEST')
  const reviews = await repository.listPublishedReviews({ limit: limit + 1, cursor })
  const sorted = reviews
    .filter((review) => review.publishConsent === true && review.moderationStatus === 'published')
    .sort((left, right) => {
      const newest = Date.parse(right.createdAt || right.$createdAt) - Date.parse(left.createdAt || left.$createdAt)
      if (newest !== 0) return newest
      return String(left.$id || left.id || '').localeCompare(String(right.$id || right.id || ''))
    })
  const pageRows = sorted.slice(0, limit)
  const hasMore = sorted.length > limit
  return {
    reviews: pageRows.map((review) => toPublicReview(review, photoUrlForReview)),
    nextCursor: hasMore ? String(pageRows.at(-1)?.$id || pageRows.at(-1)?.id || '') : null,
    hasMore,
  }
}

export async function listPublicReviews(repository, limit = 3, { photoUrlForReview } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 3) fail('INVALID_REQUEST')
  const page = await listPublicReviewPage(repository, limit, { photoUrlForReview })
  return page.reviews.map((review) => ({
    sourceType: review.sourceType,
    rating: review.rating,
    body: review.body,
    displayName: review.displayName,
    hasPhoto: review.hasPhoto,
    photoUrl: review.photoUrl,
    createdAt: review.createdAt,
    incentivised: review.incentivised,
  }))
}

function toAdminReview(review, rewardSummary) {
  return {
    id: review.$id || review.id,
    sourceType: review.sourceType,
    rating: review.rating,
    body: review.body,
    displayName: review.displayName || '',
    hasPhoto: typeof review.photoFileId === 'string' && review.photoFileId.length > 0,
    photoPublishConsent: review.photoPublishConsent === true,
    publishConsent: review.publishConsent,
    moderationStatus: review.moderationStatus,
    rewardPercent: review.rewardPercent,
    ...rewardSummary,
    createdAt: review.createdAt || review.$createdAt,
    updatedAt: review.updatedAt || review.$updatedAt,
  }
}

export async function listAdminReviews(repository, options = {}) {
  const cursor = options.cursor === undefined ? undefined : String(options.cursor).trim()
  const limit = options.limit === undefined ? 100 : options.limit
  const moderationStatus = options.moderationStatus
  if ((cursor !== undefined && !OPAQUE_ID_PATTERN.test(cursor)) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      (moderationStatus !== undefined && !['pending', 'published', 'hidden'].includes(moderationStatus))) {
    fail('INVALID_REQUEST')
  }
  const rawReviews = await repository.listReviews({ cursor, limit, ...(moderationStatus ? { moderationStatus } : {}) })
  const reviews = await Promise.all(rawReviews.map(async (review) =>
    toAdminReview(review, await loadAdminRewardSummary(repository, review, options.now || new Date()))))
  return {
    reviews,
    nextCursor: reviews.length === limit ? reviews.at(-1).id : null,
  }
}

export async function moderateReview(repository, reviewId, moderationStatus, { now = new Date(), photoStorage } = {}) {
  if (!['pending', 'published', 'hidden'].includes(moderationStatus)) fail('INVALID_MODERATION_STATUS')
  if (typeof reviewId !== 'string' || !reviewId.trim()) fail('REVIEW_NOT_FOUND', 404)
  const review = await repository.getReview(reviewId)
  if (!review) fail('REVIEW_NOT_FOUND', 404)
  if (moderationStatus === 'published' && review.publishConsent !== true) {
    fail('REVIEW_PUBLISH_CONSENT_REQUIRED', 409)
  }
  const photoFileId = typeof review.photoFileId === 'string' && review.photoFileId ? review.photoFileId : null
  const publishPhoto = moderationStatus === 'published' && review.photoPublishConsent === true && photoFileId
  if (photoFileId && photoStorage) {
    if (publishPhoto) await photoStorage.makePublic(photoFileId)
    else await photoStorage.makePrivate(photoFileId)
  }
  let updated
  try {
    updated = await repository.updateReview(reviewId, { moderationStatus, updatedAt: now.toISOString() })
  } catch (error) {
    if (publishPhoto && photoStorage) {
      try { await photoStorage.makePrivate(photoFileId) } catch { /* keep the original moderation failure */ }
    }
    throw error
  }
  return toAdminReview(updated, await loadAdminRewardSummary(repository, updated, now))
}

const rewardExpiryFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export async function copyReviewRewardMessage(repository, reviewId, {
  now = new Date(),
  hmacSecret,
  encryptionKey,
} = {}) {
  const couponHmacSecret = Buffer.isBuffer(hmacSecret)
    ? hmacSecret
    : resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: hmacSecret }, ReviewApiError)
  const couponEncryptionKey = Buffer.isBuffer(encryptionKey)
    ? encryptionKey
    : resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  if (couponHmacSecret.length < 32 || couponEncryptionKey.length !== 32 || couponEncryptionKey.equals(couponHmacSecret)) {
    fail('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  if (typeof reviewId !== 'string' || !OPAQUE_ID_PATTERN.test(reviewId)) {
    fail('REVIEW_REWARD_UNAVAILABLE', 404)
  }

  try {
    const review = await repository.getReview(reviewId)
    if (!review || (review.$id || review.id) !== reviewId || !OPAQUE_ID_PATTERN.test(review.couponId || '')) {
      fail('REVIEW_REWARD_UNAVAILABLE', 404)
    }
    const coupon = await repository.getCoupon(review.couponId)
    const summary = deriveAdminRewardSummary(review, coupon, now)
    if (summary.rewardStatus !== 'active' || !summary.rewardMessageAvailable ||
        typeof coupon.codeHash !== 'string' || !/^[a-f0-9]{64}$/.test(coupon.codeHash)) {
      fail('REVIEW_REWARD_UNAVAILABLE', 404)
    }
    const code = decryptReviewCouponCode({
      envelope: coupon,
      couponId: review.couponId,
      reviewId,
      key: couponEncryptionKey,
      ErrorClass: ReviewApiError,
    })
    const expectedHash = digestReviewCouponCode(code, couponHmacSecret)
    if (!secureHashEqual(expectedHash, coupon.codeHash) || !secureHashEqual(code.slice(-4), coupon.codeLast4)) {
      fail('REVIEW_REWARD_UNAVAILABLE', 404)
    }
    const expiry = rewardExpiryFormatter.format(new Date(coupon.expiresAt))
    return {
      message: `Thank you for sharing your review with Very Good Chocolate.\nYour ${review.rewardPercent}% cake reward code is ${code}.\nIt can be used once on your next cake order until ${expiry}.`,
    }
  } catch (error) {
    if (error instanceof ReviewApiError && error.code === 'FUNCTION_CONFIGURATION_ERROR') throw error
    fail('REVIEW_REWARD_UNAVAILABLE', 404)
  }
}
