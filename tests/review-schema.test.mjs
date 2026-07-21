import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  assertCompleteExactAvailableKeySet,
  assertExactAvailableKeySet,
  buildReviewSetupPlan,
  canEnableReviewPhotoTransformations,
  ensureStrictCollection,
  parseAdminUserIds,
  reviewPhotoBucketMismatches,
  RESERVATION_REVIEW_AUDIT_ATTRIBUTES,
  REVIEW_COLLECTIONS,
  REVIEW_COLLECTION_RESOURCE_KEYS,
  REVIEW_PHOTO_BUCKET,
  REVIEW_RESOURCE_DEFAULTS,
  resolveReviewResourceIds,
  sameUnorderedValues,
  toAppwriteIndexCreate,
  validateAdminApplyConfiguration,
  validateAttributeDefinition,
  validateIndexDefinition,
} from '../scripts/review-schema.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function attribute(collection, key) {
  return collection.attributes.find((candidate) => candidate.key === key)
}

function index(collection, key) {
  return collection.indexes.find((candidate) => candidate.key === key)
}

test('review resource ids use safe defaults and server ids override Vite ids', () => {
  assert.deepEqual(REVIEW_RESOURCE_DEFAULTS, {
    reviewInvitesCollectionId: 'review_invites',
    reviewsCollectionId: 'reviews',
    reviewCouponsCollectionId: 'review_coupons',
    manualCouponsCollectionId: 'manual_coupons',
    reviewPhotosBucketId: 'review-photos',
    reviewPhotoCleanupCollectionId: 'review_photo_cleanup',
  })
  assert.deepEqual(resolveReviewResourceIds({}), REVIEW_RESOURCE_DEFAULTS)
  assert.deepEqual(
    resolveReviewResourceIds({
      VITE_APPWRITE_REVIEW_INVITES_TABLE_ID: 'vite_invites',
      APPWRITE_REVIEW_INVITES_TABLE_ID: 'server_invites',
      VITE_APPWRITE_REVIEWS_TABLE_ID: 'vite_reviews',
      VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID: 'vite_coupons',
      VITE_APPWRITE_MANUAL_COUPONS_TABLE_ID: 'public_manual_must_not_win',
      APPWRITE_MANUAL_COUPONS_TABLE_ID: 'server_manual_coupons',
      APPWRITE_REVIEW_PHOTOS_BUCKET_ID: 'server_photos',
    }),
    {
      reviewInvitesCollectionId: 'server_invites',
      reviewsCollectionId: 'vite_reviews',
      reviewCouponsCollectionId: 'vite_coupons',
      manualCouponsCollectionId: 'server_manual_coupons',
      reviewPhotosBucketId: 'server_photos',
      reviewPhotoCleanupCollectionId: 'review_photo_cleanup',
    },
  )
})

test('review invite schema stores only hashed tokens and has both required unique constraints', () => {
  const invites = REVIEW_COLLECTIONS.reviewInvites
  assert.deepEqual(invites.publicPermissions, [])
  assert.deepEqual(invites.adminPermissions, ['read', 'update', 'delete'])
  assert.deepEqual(attribute(invites, 'sourceType'), {
    key: 'sourceType', type: 'enum', required: true, elements: ['cake', 'class'],
  })
  assert.deepEqual(attribute(invites, 'tokenHash'), {
    key: 'tokenHash', type: 'string', size: 64, required: true,
  })
  assert.deepEqual(attribute(invites, 'usedAt'), {
    key: 'usedAt', type: 'string', size: 40, required: false,
  })
  assert.deepEqual(attribute(invites, 'pendingPhotoFileId'), {
    key: 'pendingPhotoFileId', type: 'string', size: 64, required: false,
  })
  assert.deepEqual(attribute(invites, 'pendingPhotoUploadedAt'), {
    key: 'pendingPhotoUploadedAt', type: 'string', size: 40, required: false,
  })
  assert.deepEqual(
    invites.attributes.map(({ key }) => key),
    ['sourceType', 'sourceReservationId', 'sourceReservationNumber', 'tokenHash', 'expiresAt', 'usedAt', 'pendingPhotoFileId', 'pendingPhotoUploadedAt', 'photoUploadCount', 'createdByUserId', 'createdAt'],
  )
  assert.deepEqual(index(invites, 'tokenHash_unique'), {
    key: 'tokenHash_unique', attributes: ['tokenHash'], type: 'unique',
  })
  assert.deepEqual(index(invites, 'sourceReservation_unique'), {
    key: 'sourceReservation_unique', attributes: ['sourceType', 'sourceReservationId'], type: 'unique',
  })
})

test('reviews schema keeps DB reward bound 5..10 while API runtime owns exact 5|10 validation', () => {
  const reviews = REVIEW_COLLECTIONS.reviews
  assert.deepEqual(reviews.publicPermissions, [])
  assert.deepEqual(reviews.adminPermissions, ['read', 'update', 'delete'])
  assert.deepEqual(attribute(reviews, 'rating'), {
    key: 'rating', type: 'integer', required: true, min: 1, max: 5,
  })
  assert.deepEqual(attribute(reviews, 'body'), {
    key: 'body', type: 'string', size: 2000, required: true,
  })
  assert.deepEqual(attribute(reviews, 'photoFileId'), {
    key: 'photoFileId', type: 'string', size: 64, required: false,
  })
  assert.deepEqual(attribute(reviews, 'photoPublishConsent'), {
    key: 'photoPublishConsent', type: 'boolean', required: true,
  })
  assert.deepEqual(attribute(reviews, 'displayName'), {
    key: 'displayName', type: 'string', size: 50, required: false,
  })
  assert.deepEqual(attribute(reviews, 'moderationStatus'), {
    key: 'moderationStatus', type: 'enum', required: true, elements: ['pending', 'published', 'hidden'],
  })
  assert.deepEqual(attribute(reviews, 'rewardPercent'), {
    key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 10,
  })
  assert.deepEqual(index(reviews, 'sourceReservation_unique'), {
    key: 'sourceReservation_unique', attributes: ['sourceType', 'sourceReservationId'], type: 'unique',
  })
  assert.deepEqual(index(reviews, 'public_reviews_idx'), {
    key: 'public_reviews_idx',
    attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
    orders: ['ASC', 'ASC', 'DESC'],
  })
  assert.deepEqual(
    reviews.indexes.filter(({ type = 'key' }) => type === 'key').map(({ attributes }) => attributes),
    [
      ['moderationStatus'],
      ['createdAt'],
      ['sourceType'],
      ['moderationStatus', 'publishConsent', 'createdAt'],
    ],
  )
})

test('public review composite index preserves Appwrite attribute and order wiring', () => {
  assert.deepEqual(toAppwriteIndexCreate(index(REVIEW_COLLECTIONS.reviews, 'public_reviews_idx')), {
    key: 'public_reviews_idx',
    type: 'key',
    attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
    orders: ['ASC', 'ASC', 'DESC'],
  })
  assert.deepEqual(toAppwriteIndexCreate(index(REVIEW_COLLECTIONS.reviews, 'createdAt_idx')), {
    key: 'createdAt_idx',
    type: 'key',
    attributes: ['createdAt'],
  })
})

test('existing composite indexes require the configured Appwrite order sequence', () => {
  const expected = index(REVIEW_COLLECTIONS.reviews, 'public_reviews_idx')
  assert.doesNotThrow(() => validateIndexDefinition('reviews', expected, {
    type: 'key',
    attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
    orders: ['ASC', 'ASC', 'DESC'],
  }))
  assert.doesNotThrow(() => validateIndexDefinition(
    'reviews',
    index(REVIEW_COLLECTIONS.reviews, 'createdAt_idx'),
    { type: 'key', attributes: ['createdAt'] },
  ))
  assert.throws(
    () => validateIndexDefinition('reviews', expected, {
      type: 'key',
      attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
      orders: ['ASC', 'ASC', 'ASC'],
    }),
    /orders=\[ASC, ASC, DESC\].*orders=\[ASC, ASC, ASC\]/,
  )
})

test('review coupon schema supports one-time reward lookup and expiry queries', () => {
  const coupons = REVIEW_COLLECTIONS.reviewCoupons
  assert.deepEqual(coupons.publicPermissions, [])
  assert.deepEqual(coupons.adminPermissions, ['read', 'update', 'delete'])
  assert.deepEqual(attribute(coupons, 'scope'), {
    key: 'scope', type: 'enum', required: true, elements: ['cake'],
  })
  assert.deepEqual(attribute(coupons, 'status'), {
    key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'],
  })
  assert.deepEqual(attribute(coupons, 'rewardPercent'), {
    key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 10,
  })
  assert.deepEqual(attribute(coupons, 'codeCiphertext'), {
    key: 'codeCiphertext', type: 'string', size: 64, required: false,
  })
  assert.deepEqual(attribute(coupons, 'codeIv'), {
    key: 'codeIv', type: 'string', size: 16, required: false,
  })
  assert.deepEqual(attribute(coupons, 'codeAuthTag'), {
    key: 'codeAuthTag', type: 'string', size: 22, required: false,
  })
  assert.deepEqual(attribute(coupons, 'codeEncryptionVersion'), {
    key: 'codeEncryptionVersion', type: 'integer', required: false, min: 1, max: 1,
  })
  assert.deepEqual(coupons.attributes.map(({ key }) => key), [
    'codeHash', 'codeLast4', 'codeCiphertext', 'codeIv', 'codeAuthTag', 'codeEncryptionVersion',
    'rewardPercent', 'scope', 'status', 'sourceReviewId', 'expiresAt', 'redeemedAt',
    'redeemedReservationId', 'createdAt',
  ])
  assert.equal(index(coupons, 'codeHash_unique').type, 'unique')
  assert.equal(index(coupons, 'sourceReview_unique').type, 'unique')
  assert.deepEqual(index(coupons, 'status_idx').attributes, ['status'])
  assert.deepEqual(index(coupons, 'expiresAt_idx').attributes, ['expiresAt'])
})

test('manual coupon schema is a dedicated exact private 5 percent ledger without review linkage or recovery envelope', () => {
  const coupons = REVIEW_COLLECTIONS.manualCoupons
  assert.equal(coupons.name, 'manual_coupons')
  assert.deepEqual(coupons.publicPermissions, [])
  assert.deepEqual(coupons.adminPermissions, ['read', 'update', 'delete'])
  assert.deepEqual(coupons.attributes, [
    { key: 'codeHash', type: 'string', size: 64, required: true },
    { key: 'codeLast4', type: 'string', size: 4, required: true },
    { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 5 },
    { key: 'scope', type: 'enum', required: true, elements: ['cake'] },
    { key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'] },
    { key: 'expiresAt', type: 'string', size: 40, required: true },
    { key: 'redeemedAt', type: 'string', size: 40, required: false },
    { key: 'redeemedReservationId', type: 'string', size: 64, required: false },
    { key: 'createdAt', type: 'string', size: 40, required: true },
  ])
  assert.deepEqual(coupons.indexes, [
    { key: 'codeHash_unique', attributes: ['codeHash'], type: 'unique' },
    { key: 'status_idx', attributes: ['status'] },
    { key: 'expiresAt_idx', attributes: ['expiresAt'] },
  ])
  assert.equal(coupons.attributes.some(({ key }) =>
    key === 'sourceReviewId' ||
    key === 'codeCiphertext' ||
    key === 'codeIv' ||
    key === 'codeAuthTag' ||
    key === 'codeEncryptionVersion'), false)
})

test('strict review collection provisioning includes the dedicated manual coupon ledger without dropping existing resources', () => {
  assert.deepEqual(REVIEW_COLLECTION_RESOURCE_KEYS, [
    ['reviewInvites', 'reviewInvitesCollectionId'],
    ['reviews', 'reviewsCollectionId'],
    ['reviewCoupons', 'reviewCouponsCollectionId'],
    ['manualCoupons', 'manualCouponsCollectionId'],
    ['reviewPhotoCleanup', 'reviewPhotoCleanupCollectionId'],
  ])
})

test('encrypted coupon attribute drift is rejected exactly while all envelope fields stay migration-safe optional', () => {
  const couponDefinitions = REVIEW_COLLECTIONS.reviewCoupons.attributes
    .filter(({ key }) => key.startsWith('code') && !['codeHash', 'codeLast4'].includes(key))
  const appwriteShape = (definition) => ({
    ...definition,
    array: false,
    default: null,
    status: 'available',
  })
  for (const definition of couponDefinitions) {
    assert.equal(definition.required, false)
    assert.doesNotThrow(() => validateAttributeDefinition('review_coupons', definition, appwriteShape(definition)))
  }
  assert.throws(
    () => validateAttributeDefinition(
      'review_coupons',
      attribute(REVIEW_COLLECTIONS.reviewCoupons, 'codeCiphertext'),
      { ...appwriteShape(attribute(REVIEW_COLLECTIONS.reviewCoupons, 'codeCiphertext')), size: 63 },
    ),
    /codeCiphertext.*size/,
  )
  assert.throws(
    () => validateAttributeDefinition(
      'review_coupons',
      attribute(REVIEW_COLLECTIONS.reviewCoupons, 'codeEncryptionVersion'),
      { ...appwriteShape(attribute(REVIEW_COLLECTIONS.reviewCoupons, 'codeEncryptionVersion')), max: 2 },
    ),
    /codeEncryptionVersion.*max/,
  )
})

test('cleanup ledger is private, PII-free, bounded, and indexed for idempotent processing', () => {
  assert.deepEqual(attribute(REVIEW_COLLECTIONS.reviewInvites, 'photoUploadCount'), {
    key: 'photoUploadCount', type: 'integer', required: false, min: 0, max: 10, xdefault: 0,
  })
  const cleanup = REVIEW_COLLECTIONS.reviewPhotoCleanup
  assert.deepEqual(cleanup.publicPermissions, [])
  assert.deepEqual(cleanup.adminPermissions, ['read', 'update', 'delete'])
  assert.deepEqual(cleanup.attributes.map(({ key }) => key), [
    'fileId', 'inviteId', 'reason', 'status', 'attempts', 'createdAt', 'updatedAt',
  ])
  assert.deepEqual(attribute(cleanup, 'reason').elements, ['replacement', 'remove', 'rotation', 'uncertain_attach', 'staged_upload'])
  assert.deepEqual(attribute(cleanup, 'status').elements, ['staging', 'pending', 'failed'])
  assert.equal(index(cleanup, 'fileId_unique').type, 'unique')
  assert.deepEqual(index(cleanup, 'status_createdAt_idx'), {
    key: 'status_createdAt_idx', attributes: ['status', 'createdAt'], orders: ['ASC', 'ASC'],
  })
})

test('reservation review audit attributes are optional and bounded', () => {
  assert.deepEqual(RESERVATION_REVIEW_AUDIT_ATTRIBUTES, [
    { key: 'subtotalCents', type: 'integer', required: false, min: 0 },
    { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100 },
    { key: 'discountCents', type: 'integer', required: false, min: 0 },
    { key: 'appliedPromoCodeLast4', type: 'string', size: 4, required: false },
    { key: 'reviewCouponId', type: 'string', size: 64, required: false },
  ])
})

test('review photo bucket is private and restricted to safe image uploads', () => {
  assert.deepEqual(REVIEW_PHOTO_BUCKET, {
    name: 'review-photos',
    publicPermissions: [],
    adminPermissions: ['read', 'update', 'delete'],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 1_572_864,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    encryption: true,
    antivirus: true,
    transformations: true,
  })
})

test('review photo bucket migration permits only an explicit false-to-true transformation change', () => {
  const expected = {
    name: 'review-photos', permissions: ['read("user:admin")'], fileSecurity: true, enabled: true,
    maximumFileSize: 1_572_864, allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    encryption: true, antivirus: true, transformations: true,
  }
  const current = { ...expected, $permissions: expected.permissions, transformations: false }
  const mismatches = reviewPhotoBucketMismatches(current, expected)
  assert.deepEqual(mismatches, ['transformations=false'])
  assert.equal(canEnableReviewPhotoTransformations(mismatches, true), true)
  assert.equal(canEnableReviewPhotoTransformations(mismatches, false), false)
  assert.equal(canEnableReviewPhotoTransformations([...mismatches, 'encryption=false'], true), false)
})

test('required review attributes never declare Appwrite defaults', () => {
  for (const definition of Object.values(REVIEW_COLLECTIONS)) {
    for (const attribute of definition.attributes) {
      if (!attribute.required) continue
      assert.equal(attribute.default, undefined, `${definition.id}.${attribute.key} default`)
      assert.equal(attribute.xdefault, undefined, `${definition.id}.${attribute.key} xdefault`)
    }
  }
})

test('dry-run plan exposes review ids, private permissions, admin mapping intent, and bucket policy without secrets', () => {
  const plan = buildReviewSetupPlan({
    APPWRITE_CAKE_DATABASE_ID: 'cake_db_test',
    APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations_test',
    APPWRITE_REVIEW_INVITES_TABLE_ID: 'invites_test',
    APPWRITE_REVIEWS_TABLE_ID: 'reviews_test',
    APPWRITE_REVIEW_COUPONS_TABLE_ID: 'coupons_test',
    APPWRITE_MANUAL_COUPONS_TABLE_ID: 'manual_coupons_test',
    APPWRITE_REVIEW_PHOTOS_BUCKET_ID: 'photos_test',
    APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID: 'cleanup_test',
    APPWRITE_ADMIN_USER_IDS: 'admin-a, admin-b',
    APPWRITE_API_KEY: 'must-not-appear',
    APPWRITE_ENDPOINT: 'https://secret-endpoint.invalid/v1',
  })

  assert.equal(plan.mode, 'dry-run')
  assert.equal(plan.network, false)
  assert.equal(plan.databaseId, 'cake_db_test')
  assert.deepEqual(plan.collections.map(({ id }) => id), ['invites_test', 'reviews_test', 'coupons_test', 'manual_coupons_test', 'cleanup_test'])
  const manualCouponsPlan = plan.collections.find(({ id }) => id === 'manual_coupons_test')
  assert.deepEqual(manualCouponsPlan.attributeKeys, REVIEW_COLLECTIONS.manualCoupons.attributes.map(({ key }) => key))
  assert.deepEqual(manualCouponsPlan.indexKeys, ['codeHash_unique', 'status_idx', 'expiresAt_idx'])
  const reviewsPlan = plan.collections.find(({ id }) => id === 'reviews_test')
  assert.deepEqual(
    reviewsPlan.indexes.find(({ key }) => key === 'public_reviews_idx'),
    {
      key: 'public_reviews_idx',
      type: 'key',
      attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
      orders: ['ASC', 'ASC', 'DESC'],
    },
  )
  assert.equal(plan.reservationAudit.collectionId, 'reservations_test')
  assert.equal(plan.permissions.publicPermissionCount, 0)
  assert.deepEqual(plan.permissions.adminMappingIntent, {
    roleKind: 'user',
    adminUserCount: 2,
    actions: ['read', 'update', 'delete'],
  })
  assert.equal(plan.bucket.id, 'photos_test')
  assert.equal(plan.bucket.maximumFileSize, 1_572_864)
  assert.deepEqual(plan.bucket.allowedFileExtensions, ['jpg', 'jpeg', 'png', 'webp'])
  assert.equal(JSON.stringify(plan).includes('must-not-appear'), false)
  assert.equal(JSON.stringify(plan).includes('secret-endpoint'), false)
})

test('missing admin ids fail apply validation but remain inspectable in dry-run', () => {
  assert.throws(
    () => validateAdminApplyConfiguration({ APPWRITE_ADMIN_USER_IDS: ' , ' }),
    /APPWRITE_ADMIN_USER_IDS is required/,
  )

  const plan = buildReviewSetupPlan({})
  assert.equal(plan.permissions.adminMappingIntent.adminUserCount, 0)
  assert.equal(plan.wouldFailApply, true)
})

test('admin user ids are de-duplicated while preserving first-seen order', () => {
  assert.deepEqual(
    parseAdminUserIds({ APPWRITE_ADMIN_USER_IDS: 'admin-b, admin-a, admin-b, admin-a, admin-c' }),
    ['admin-b', 'admin-a', 'admin-c'],
  )
  assert.equal(
    buildReviewSetupPlan({ APPWRITE_ADMIN_USER_IDS: 'admin-a, admin-a' })
      .permissions.adminMappingIntent.adminUserCount,
    1,
  )
})

test('permission comparison rejects same-length Role.any drift even when admin input contains duplicates', () => {
  const adminUserIds = parseAdminUserIds({ APPWRITE_ADMIN_USER_IDS: 'admin-a, admin-a' })
  const expected = ['read', 'update', 'delete'].flatMap((action) =>
    adminUserIds.map((id) => `${action}("user:${id}")`),
  )
  const driftedSameLength = [...expected.slice(0, -1), 'read("any")']

  assert.equal(driftedSameLength.length, expected.length)
  assert.equal(sameUnorderedValues(driftedSameLength, expected), false)
  assert.equal(sameUnorderedValues([...expected].reverse(), expected), true)
})

test('strict exact-set validation rejects missing, extra, and unavailable review resources', () => {
  const expected = [{ key: 'alpha' }, { key: 'beta' }]
  assert.doesNotThrow(() => assertExactAvailableKeySet('reviews attributes', expected, [
    { key: 'beta', status: 'available' },
    { key: 'alpha', status: 'available' },
  ]))
  assert.throws(
    () => assertExactAvailableKeySet('reviews attributes', expected, [{ key: 'alpha', status: 'available' }]),
    /missing=beta/,
  )
  assert.throws(
    () => assertExactAvailableKeySet('reviews indexes', expected, [
      { key: 'alpha', status: 'available' },
      { key: 'beta', status: 'available' },
      { key: 'legacy_idx', status: 'available' },
    ]),
    /extra=legacy_idx/,
  )
  assert.throws(
    () => assertExactAvailableKeySet('reviews attributes', expected, [
      { key: 'alpha', status: 'processing' },
      { key: 'beta', status: 'available' },
    ]),
    /not available: alpha=processing/,
  )
})

test('strict collection ensure refetches and validates the exact id after a concurrent create conflict', async () => {
  const calls = []
  const expected = {
    databaseId: 'cake_db',
    collectionId: 'reviews',
    name: 'reviews',
    permissions: ['read("user:admin-a")'],
    documentSecurity: false,
  }
  const current = {
    name: 'reviews',
    $permissions: expected.permissions,
    documentSecurity: false,
    enabled: true,
  }

  const result = await ensureStrictCollection({
    ...expected,
    getCollection: async (params) => {
      calls.push(['get', params])
      if (calls.length === 1) throw Object.assign(new Error('missing'), { code: 404 })
      return current
    },
    createCollection: async (params) => {
      calls.push(['create', params])
      throw Object.assign(new Error('conflict'), { code: 409 })
    },
    isMissing: (error) => error.code === 404,
    isConflict: (error) => error.code === 409,
  })

  assert.equal(result, 'existing')
  assert.deepEqual(calls.map(([operation]) => operation), ['get', 'create', 'get'])
  assert.deepEqual(calls[2][1], { databaseId: 'cake_db', collectionId: 'reviews' })
})

test('strict collection ensure rejects mismatched collection after a concurrent create conflict', async () => {
  let getCount = 0
  await assert.rejects(
    () => ensureStrictCollection({
      databaseId: 'cake_db',
      collectionId: 'reviews',
      name: 'reviews',
      permissions: ['read("user:admin-a")'],
      documentSecurity: false,
      getCollection: async () => {
        getCount += 1
        if (getCount === 1) throw Object.assign(new Error('missing'), { code: 404 })
        return {
          name: 'wrong-reviews',
          $permissions: ['read("user:admin-a")'],
          documentSecurity: false,
          enabled: true,
        }
      },
      createCollection: async () => {
        throw Object.assign(new Error('conflict'), { code: 409 })
      },
      isMissing: (error) => error.code === 404,
      isConflict: (error) => error.code === 409,
    }),
    /collection reviews definition mismatch \(name=wrong-reviews\)/,
  )
  assert.equal(getCount, 2)
})

test('complete exact-set validation fails closed when Appwrite total exceeds returned resources', () => {
  assert.throws(
    () => assertCompleteExactAvailableKeySet(
      'reviews attributes',
      [{ key: 'alpha' }],
      { total: 101, attributes: Array.from({ length: 100 }, (_, index) => ({ key: `key-${index}`, status: 'available' })) },
      'attributes',
    ),
    /incomplete pagination.*total=101.*returned=100/,
  )
})

test('complete exact-set validation proceeds when Appwrite total equals returned resources', () => {
  assert.doesNotThrow(() => assertCompleteExactAvailableKeySet(
    'reviews indexes',
    [{ key: 'alpha' }, { key: 'beta' }],
    {
      total: 2,
      indexes: [
        { key: 'beta', status: 'available' },
        { key: 'alpha', status: 'available' },
      ],
    },
    'indexes',
  ))
  assert.throws(
    () => assertCompleteExactAvailableKeySet(
      'reviews indexes',
      [{ key: 'alpha' }],
      {
        total: 2,
        indexes: [
          { key: 'alpha', status: 'available' },
          { key: 'legacy_idx', status: 'available' },
        ],
      },
      'indexes',
    ),
    /extra=legacy_idx/,
  )
})

test('409 revalidation accepts Appwrite enum response shape and rejects enum definition drift', () => {
  const expected = {
    key: 'status', type: 'enum', required: true, elements: ['pending', 'published'], xdefault: 'pending',
  }
  const current = {
    key: 'status', type: 'string', format: 'enum', required: true, array: false,
    elements: ['pending', 'published'], default: 'pending', status: 'available',
  }

  assert.doesNotThrow(() => validateAttributeDefinition('reviews', expected, current))
  for (const patch of [
    { format: undefined },
    { required: false },
    { elements: ['pending'] },
    { default: 'published' },
  ]) {
    assert.throws(
      () => validateAttributeDefinition('reviews', expected, { ...current, ...patch }),
      /definition mismatch/,
    )
  }
})

test('409 revalidation rejects Appwrite enum response when a plain string attribute is expected', () => {
  assert.throws(
    () => validateAttributeDefinition(
      'reviews',
      { key: 'body', type: 'string', required: true, size: 2000 },
      {
        key: 'body', type: 'string', format: 'enum', required: true, array: false,
        size: 2000, elements: ['unexpected'], default: null,
      },
    ),
    /format=enum/,
  )
})

test('409 revalidation definition validator rejects every mismatched non-enum attribute field', () => {
  const expected = {
    key: 'rewardPercent', type: 'integer', required: false, array: false, min: 5, max: 10, xdefault: 5,
  }
  const current = {
    key: 'rewardPercent', type: 'integer', required: false, array: false, min: 5, max: 10, default: 5,
  }
  assert.doesNotThrow(() => validateAttributeDefinition('reviews', expected, current))

  for (const [field, value] of [
    ['type', 'string'],
    ['required', true],
    ['array', true],
    ['min', 4],
    ['max', 11],
    ['default', 10],
  ]) {
    assert.throws(
      () => validateAttributeDefinition('reviews', expected, { ...current, [field]: value }),
      new RegExp(field),
    )
  }

  assert.throws(
    () => validateAttributeDefinition(
      'reviews',
      { key: 'body', type: 'string', required: true, size: 2000 },
      { key: 'body', type: 'string', required: true, array: false, size: 1000, default: null },
    ),
    /size/,
  )
})

test('integer attributes without explicit bounds accept Appwrite platform default bounds', () => {
  assert.doesNotThrow(() => validateAttributeDefinition(
    'reservations',
    { key: 'subtotalCents', type: 'integer', required: false },
    {
      key: 'subtotalCents', type: 'integer', required: false, array: false,
      min: -9_223_372_036_854_775_808, max: 9_223_372_036_854_775_807, default: null,
    },
  ))
})

test('setup --dry-run exits without credentials, dotenv secret output, or network access', () => {
  const secret = 'child-process-secret-marker'
  const result = spawnSync(process.execPath, ['scripts/setup-appwrite.mjs', '--dry-run'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      APPWRITE_CAKE_DATABASE_ID: 'child_db',
      APPWRITE_ADMIN_USER_IDS: '',
      APPWRITE_API_KEY: secret,
    },
    timeout: 5_000,
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.includes(secret), false)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.databaseId, 'child_db')
  assert.equal(plan.network, false)
  assert.equal(plan.permissions.adminMappingIntent.adminUserCount, 0)
  assert.equal(plan.wouldFailApply, true)
})
