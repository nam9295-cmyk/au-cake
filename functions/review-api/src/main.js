import { Account, AppwriteException, Client, Databases, ID, Permission, Query, Role, Storage } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import {
  createAdminPhotoPreviewDependencies,
  createAdminPhotoPreviewHandler,
} from './admin-photo-preview.js'
import {
  ReviewApiError,
  assertReviewAdmin,
  copyReviewRewardMessage,
  issueReviewInvite,
  listAdminReviews,
  listPublicReviewPage,
  listPublicReviews,
  loadReviewInvite,
  moderateReview,
  submitReview,
} from './business.js'
import { cleanupPhotoFiles, removeReviewPhoto, uploadReviewPhoto } from './photo.js'
import { resolveReviewCouponHmacSecret } from './coupon-digest.js'
import { resolveReviewCouponEncryptionKey } from './coupon-envelope.js'

const APPWRITE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

function configuredResourceId(env, name, fallback) {
  const supplied = Object.prototype.hasOwnProperty.call(env, name)
  const value = String(supplied ? env[name] : (fallback ?? '')).trim()
  if (!value || !APPWRITE_RESOURCE_ID.test(value)) {
    throw new ReviewApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  return value
}

export function resolveReviewConfig(env = process.env) {
  return {
    cakeDatabaseId: configuredResourceId(env, 'APPWRITE_CAKE_DATABASE_ID'),
    classDatabaseId: configuredResourceId(env, 'APPWRITE_KIDS_DATABASE_ID'),
    cakeReservationsId: configuredResourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID', 'reservations'),
    classReservationsId: configuredResourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID', 'class_reservations'),
    reviewInvitesId: configuredResourceId(env, 'APPWRITE_REVIEW_INVITES_TABLE_ID', 'review_invites'),
    reviewsId: configuredResourceId(env, 'APPWRITE_REVIEWS_TABLE_ID', 'reviews'),
    reviewCouponsId: configuredResourceId(env, 'APPWRITE_REVIEW_COUPONS_TABLE_ID', 'review_coupons'),
    reviewPhotoCleanupId: configuredResourceId(env, 'APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID', 'review_photo_cleanup'),
    reviewPhotosBucketId: configuredResourceId(env, 'APPWRITE_REVIEW_PHOTOS_BUCKET_ID', 'review-photos'),
  }
}

function clientForRequest(req, env = process.env) {
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT
  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID
  const apiKey = req.headers['x-appwrite-key']
  if (!endpoint || !projectId || !apiKey) throw new ReviewApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
}

function isNotFound(error) {
  return error instanceof AppwriteException && error.code === 404
}

function isConflict(error) {
  return error instanceof AppwriteException
    ? error.code === 409
    : error?.code === 409 || /unique|duplicate|already exists/i.test(String(error?.message || ''))
}

export function createReviewRepository(databases, config = resolveReviewConfig()) {
  const transactionId = (transaction) => transaction?.$id || transaction?.id
  return {
    async getSource(sourceType, documentId, transaction) {
      try {
        return await databases.getDocument({
          databaseId: sourceType === 'cake' ? config.cakeDatabaseId : config.classDatabaseId,
          collectionId: sourceType === 'cake' ? config.cakeReservationsId : config.classReservationsId,
          documentId,
          ...(transaction ? { transactionId: transactionId(transaction) } : {}),
        })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    async createInvite(data, transaction, documentId = ID.unique()) {
      return databases.createDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewInvitesId,
        documentId,
        data,
        transactionId: transactionId(transaction),
      })
    },
    async findInviteBySource(sourceType, sourceReservationId, transaction) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewInvitesId,
        queries: [
          Query.equal('sourceType', sourceType),
          Query.equal('sourceReservationId', sourceReservationId),
          Query.limit(1),
        ],
        total: false,
        ...(transaction ? { transactionId: transactionId(transaction) } : {}),
      })
      return result.documents[0] || null
    },
    async updateInvite(documentId, data, transaction) {
      return databases.updateDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewInvitesId,
        documentId,
        data,
        transactionId: transactionId(transaction),
      })
    },
    async findReviewBySource(sourceType, sourceReservationId, transaction) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewsId,
        queries: [
          Query.equal('sourceType', sourceType),
          Query.equal('sourceReservationId', sourceReservationId),
          Query.limit(1),
        ],
        total: false,
        ...(transaction ? { transactionId: transactionId(transaction) } : {}),
      })
      return result.documents[0] || null
    },
    async findInviteByTokenHash(tokenHash, transaction) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewInvitesId,
        queries: [Query.equal('tokenHash', tokenHash), Query.limit(1)],
        total: false,
        ...(transaction ? { transactionId: transactionId(transaction) } : {}),
      })
      return result.documents[0] || null
    },
    async beginTransaction() {
      return databases.createTransaction()
    },
    async createReview(data, transaction, documentId) {
      return databases.createDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewsId,
        documentId,
        data,
        transactionId: transactionId(transaction),
      })
    },
    async createCoupon(data, transaction, documentId) {
      return databases.createDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewCouponsId,
        documentId,
        data,
        transactionId: transactionId(transaction),
      })
    },
    async markInviteUsed(documentId, usedAt, transaction) {
      return databases.updateDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewInvitesId,
        documentId,
        data: { usedAt },
        transactionId: transactionId(transaction),
      })
    },
    async commitTransaction(transaction) {
      return databases.updateTransaction({ transactionId: transactionId(transaction), commit: true })
    },
    async rollbackTransaction(transaction) {
      return databases.updateTransaction({ transactionId: transactionId(transaction), rollback: true })
    },
    async getInvite(documentId) {
      try {
        return await databases.getDocument({
          databaseId: config.cakeDatabaseId, collectionId: config.reviewInvitesId, documentId,
        })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    async enqueuePhotoCleanup(data, transaction) {
      try {
        return await databases.createDocument({
          databaseId: config.cakeDatabaseId,
          collectionId: config.reviewPhotoCleanupId,
          documentId: data.fileId,
          data,
          ...(transaction ? { transactionId: transactionId(transaction) } : {}),
        })
      } catch (error) {
        if (!isConflict(error)) throw error
        return databases.updateDocument({
          databaseId: config.cakeDatabaseId,
          collectionId: config.reviewPhotoCleanupId,
          documentId: data.fileId,
          data: {
            fileId: data.fileId,
            inviteId: data.inviteId,
            reason: data.reason,
            status: data.status,
            attempts: data.attempts,
            updatedAt: data.updatedAt,
          },
          ...(transaction ? { transactionId: transactionId(transaction) } : {}),
        })
      }
    },
    async listPhotoCleanup(limit = 25) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewPhotoCleanupId,
        queries: [Query.equal('status', ['staging', 'pending']), Query.orderAsc('createdAt'), Query.limit(Math.min(25, limit))],
        total: false,
      })
      return result.documents
    },
    async updatePhotoCleanup(documentId, data, transaction) {
      return databases.updateDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewPhotoCleanupId,
        documentId,
        data,
        ...(transaction ? { transactionId: transactionId(transaction) } : {}),
      })
    },
    async deletePhotoCleanup(documentId, transaction) {
      return databases.deleteDocument({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewPhotoCleanupId,
        documentId,
        ...(transaction ? { transactionId: transactionId(transaction) } : {}),
      })
    },
    async listPublishedReviews({ limit = 4, cursor } = {}) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewsId,
        queries: [
          Query.equal('moderationStatus', 'published'),
          Query.equal('publishConsent', true),
          Query.orderDesc('createdAt'),
          Query.orderAsc('$id'),
          Query.limit(Math.min(7, Math.max(2, limit))),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
        total: false,
      })
      return result.documents
    },
    async listReviews({ cursor, limit = 100, moderationStatus } = {}) {
      const result = await databases.listDocuments({
        databaseId: config.cakeDatabaseId,
        collectionId: config.reviewsId,
        queries: [
          ...(moderationStatus ? [Query.equal('moderationStatus', moderationStatus)] : []),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
        total: false,
      })
      return result.documents
    },
    async getReview(documentId) {
      try {
        return await databases.getDocument({ databaseId: config.cakeDatabaseId, collectionId: config.reviewsId, documentId })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    async getCoupon(documentId) {
      try {
        return await databases.getDocument({ databaseId: config.cakeDatabaseId, collectionId: config.reviewCouponsId, documentId })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    async updateReview(documentId, data) {
      return databases.updateDocument({ databaseId: config.cakeDatabaseId, collectionId: config.reviewsId, documentId, data })
    },
  }
}

export function createReviewPhotoStorage(storage, config = resolveReviewConfig()) {
  return {
    async createPrivatePhoto({ fileId, name, buffer }) {
      return storage.createFile({
        bucketId: config.reviewPhotosBucketId,
        fileId,
        file: InputFile.fromBuffer(buffer, name),
        permissions: [],
      })
    },
    async deletePhoto(fileId) {
      return storage.deleteFile({ bucketId: config.reviewPhotosBucketId, fileId })
    },
    async makePublic(fileId) {
      return storage.updateFile({
        bucketId: config.reviewPhotosBucketId,
        fileId,
        permissions: [Permission.read(Role.any())],
      })
    },
    async makePrivate(fileId) {
      return storage.updateFile({ bucketId: config.reviewPhotosBucketId, fileId, permissions: [] })
    },
  }
}

export function createPublicReviewPhotoUrlBuilder(env, config = resolveReviewConfig(env)) {
  const endpoint = String(env.APPWRITE_PUBLIC_ENDPOINT || '').trim().replace(/\/$/, '')
  const projectId = String(env.APPWRITE_FUNCTION_PROJECT_ID || '').trim()
  let parsed
  try { parsed = new URL(endpoint) } catch { throw new ReviewApiError('FUNCTION_CONFIGURATION_ERROR', 500) }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !APPWRITE_RESOURCE_ID.test(projectId)) {
    throw new ReviewApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  return (review) => {
    const fileId = String(review?.photoFileId || '')
    if (!APPWRITE_RESOURCE_ID.test(fileId)) throw new ReviewApiError('INVALID_PUBLIC_REVIEW', 500)
    const base = `${endpoint}/storage/buckets/${encodeURIComponent(config.reviewPhotosBucketId)}/files/${encodeURIComponent(fileId)}`
    const photoUrl = new URL(`${base}/view`)
    photoUrl.searchParams.set('project', projectId)
    const thumbnailUrl = new URL(`${base}/preview`)
    thumbnailUrl.searchParams.set('project', projectId)
    thumbnailUrl.searchParams.set('width', '640')
    thumbnailUrl.searchParams.set('height', '480')
    thumbnailUrl.searchParams.set('gravity', 'center')
    thumbnailUrl.searchParams.set('quality', '78')
    thumbnailUrl.searchParams.set('output', 'webp')
    return { thumbnailUrl: thumbnailUrl.toString(), photoUrl: photoUrl.toString() }
  }
}

const REVIEW_ACTIONS = new Set([
  'create-invite',
  'list-admin-reviews',
  'moderate-review',
  'load-invite',
  'submit-review',
  'list-public',
  'list-public-page',
  'upload-photo',
  'remove-photo',
  'cleanup-photo-files',
  'copy-review-reward-message',
])

export function safeActionForLog(action) {
  return typeof action === 'string' && REVIEW_ACTIONS.has(action) ? action : 'unknown'
}

const STANDARD_REQUEST_BYTES = 20_000
const PHOTO_UPLOAD_REQUEST_BYTES = 2_400_000
const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const PHOTO_UPLOAD_KEYS = new Set(['action', 'token', 'mimeType', 'base64', 'byteLength'])

function parseLargePhotoUpload(bodyText, parsedBody) {
  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    if (parsedBody?.action === 'upload-photo') throw new ReviewApiError('INVALID_REQUEST')
    throw new ReviewApiError('REQUEST_TOO_LARGE', 413)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReviewApiError('INVALID_REQUEST')
  if (body.action !== 'upload-photo') throw new ReviewApiError('REQUEST_TOO_LARGE', 413)
  if (
    Object.keys(body).some((key) => !PHOTO_UPLOAD_KEYS.has(key)) ||
    typeof body.token !== 'string' || !REVIEW_TOKEN_PATTERN.test(body.token) ||
    body.mimeType !== 'image/webp' ||
    typeof body.base64 !== 'string' || !body.base64 ||
    (body.byteLength !== undefined && (!Number.isInteger(body.byteLength) || body.byteLength < 1))
  ) throw new ReviewApiError('INVALID_REQUEST')
  return body
}

export function parseRequestBody(req) {
  const bodyBytes = typeof req.bodyText === 'string' ? Buffer.byteLength(req.bodyText, 'utf8') : 0
  if (bodyBytes > PHOTO_UPLOAD_REQUEST_BYTES) throw new ReviewApiError('REQUEST_TOO_LARGE', 413)
  if (bodyBytes > STANDARD_REQUEST_BYTES) return parseLargePhotoUpload(req.bodyText, req.bodyJson)
  const body = req.bodyJson
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReviewApiError('INVALID_REQUEST')
  return body
}

const defaultServices = {
  loadInvite: loadReviewInvite,
  submit: submitReview,
  listPublic: listPublicReviews,
  listPublicPage: listPublicReviewPage,
  issue: issueReviewInvite,
  listAdmin: listAdminReviews,
  moderate: moderateReview,
  uploadPhoto: uploadReviewPhoto,
  removePhoto: removeReviewPhoto,
  cleanupPhotos: cleanupPhotoFiles,
  copyReward: copyReviewRewardMessage,
}

export async function handleReviewRequest(body, headers, env = process.env, services = defaultServices, repository, photoStorage, options = {}) {
  const action = body.action
  const data = body.data || {}
  if (action === 'load-invite') return services.loadInvite(repository, data.token)
  if (action === 'submit-review') {
    return services.submit(repository, data.token, data.review || {}, {
      isConflict,
      hmacSecret: options.hmacSecret,
      encryptionKey: options.encryptionKey,
    })
  }
  if (action === 'list-public') return services.listPublic(repository, body.limit, {
    photoUrlForReview: options.photoUrlForReview,
  })
  if (action === 'list-public-page') return services.listPublicPage(repository, body.limit, {
    cursor: body.cursor,
    photoUrlForReview: options.photoUrlForReview,
  })
  if (action === 'upload-photo') {
    return services.uploadPhoto(repository, photoStorage, body.token, {
      mimeType: body.mimeType,
      base64: body.base64,
      ...(body.byteLength === undefined ? {} : { byteLength: body.byteLength }),
    }, { isConflict })
  }
  if (action === 'remove-photo') return services.removePhoto(repository, photoStorage, body.token)

  if (!['create-invite', 'list-admin-reviews', 'moderate-review', 'cleanup-photo-files', 'copy-review-reward-message'].includes(action)) {
    throw new ReviewApiError('UNKNOWN_ACTION', 404)
  }
  const userId = assertReviewAdmin(headers, env)
  if (action === 'create-invite') return services.issue(repository, data, { createdByUserId: userId, isConflict, storage: photoStorage })
  if (action === 'list-admin-reviews') return services.listAdmin(repository, data)
  if (action === 'copy-review-reward-message') {
    return services.copyReward(repository, data.reviewId, {
      hmacSecret: options.hmacSecret,
      encryptionKey: options.encryptionKey,
    })
  }
  if (action === 'cleanup-photo-files') {
    return services.cleanupPhotos(repository, photoStorage, { batchLimit: data.limit })
  }
  return services.moderate(repository, data.reviewId, data.moderationStatus, { photoStorage })
}

function isDirectPhotoPreviewRequest(req) {
  if (req.method === 'OPTIONS') return true
  const body = req.bodyJson
  return Boolean(
    body && typeof body === 'object' && !Array.isArray(body) &&
    !Object.hasOwn(body, 'action') &&
    (Object.hasOwn(body, 'reviewId') || Object.hasOwn(req.headers || {}, 'x-appwrite-user-jwt')),
  )
}

function sendPhotoPreviewResponse(res, result) {
  if (result.binary) return res.binary(result.binary, result.status, result.headers)
  if (result.status === 204) return res.empty(result.status, result.headers)
  return res.json(result.json, result.status, result.headers)
}

async function handleDirectPhotoPreview(req, res, env = process.env) {
  const config = resolveReviewConfig(env)
  const systemClient = clientForRequest(req, env)
  const repository = createReviewRepository(new Databases(systemClient), config)
  const dependencies = createAdminPhotoPreviewDependencies({
    endpoint: env.APPWRITE_FUNCTION_API_ENDPOINT,
    projectId: env.APPWRITE_FUNCTION_PROJECT_ID,
    bucketId: config.reviewPhotosBucketId,
    repository,
    storage: new Storage(systemClient),
    ClientClass: Client,
    AccountClass: Account,
  })
  const handler = createAdminPhotoPreviewHandler(dependencies, env)
  return sendPhotoPreviewResponse(res, await handler(req))
}

export default async ({ req, res, log, error }) => {
  let action = 'unknown'
  try {
    if (isDirectPhotoPreviewRequest(req)) {
      const response = await handleDirectPhotoPreview(req, res)
      log('review-api completed: admin-photo-preview')
      return response
    }
    const body = parseRequestBody(req)
    action = safeActionForLog(body.action)
    const hmacSecret = resolveReviewCouponHmacSecret(process.env, ReviewApiError)
    const encryptionKey = resolveReviewCouponEncryptionKey(process.env, ReviewApiError)
    const config = resolveReviewConfig(process.env)
    const client = clientForRequest(req)
    const databases = new Databases(client)
    const repository = createReviewRepository(databases, config)
    const photoStorage = createReviewPhotoStorage(new Storage(client), config)
    const photoUrlForReview = createPublicReviewPhotoUrlBuilder(process.env, config)
    const result = await handleReviewRequest(body, req.headers, process.env, defaultServices, repository, photoStorage, {
      hmacSecret,
      encryptionKey,
      photoUrlForReview,
    })
    log(`review-api completed: ${action}`)
    return res.json({ ok: true, result }, 200)
  } catch (caught) {
    const known = caught instanceof ReviewApiError
    const code = known ? caught.code : 'INTERNAL_ERROR'
    const status = known ? caught.status : 500
    const diagnostic = caught instanceof AppwriteException
      ? `appwrite=${caught.type || 'unknown'} http=${caught.code || 'unknown'}`
      : `error=${caught?.name || 'unknown'}`
    error(`review-api failed: ${action} ${code} ${diagnostic}`)
    return res.json({ ok: false, code }, status)
  }
}
