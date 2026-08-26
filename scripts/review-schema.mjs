export const REVIEW_RESOURCE_DEFAULTS = Object.freeze({
  reviewInvitesCollectionId: 'review_invites',
  reviewsCollectionId: 'reviews',
  reviewCouponsCollectionId: 'review_coupons',
  manualCouponsCollectionId: 'manual_coupons',
  reviewPhotosBucketId: 'review-photos',
  reviewPhotoCleanupCollectionId: 'review_photo_cleanup',
  emailDeliveriesCollectionId: 'email_deliveries',
})

export function resolveReviewResourceIds(env = {}) {
  return {
    reviewInvitesCollectionId:
      env.APPWRITE_REVIEW_INVITES_TABLE_ID ||
      env.VITE_APPWRITE_REVIEW_INVITES_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.reviewInvitesCollectionId,
    reviewsCollectionId:
      env.APPWRITE_REVIEWS_TABLE_ID ||
      env.VITE_APPWRITE_REVIEWS_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.reviewsCollectionId,
    reviewCouponsCollectionId:
      env.APPWRITE_REVIEW_COUPONS_TABLE_ID ||
      env.VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.reviewCouponsCollectionId,
    manualCouponsCollectionId:
      env.APPWRITE_MANUAL_COUPONS_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.manualCouponsCollectionId,
    reviewPhotosBucketId:
      env.APPWRITE_REVIEW_PHOTOS_BUCKET_ID ||
      env.VITE_APPWRITE_REVIEW_PHOTOS_BUCKET_ID ||
      REVIEW_RESOURCE_DEFAULTS.reviewPhotosBucketId,
    reviewPhotoCleanupCollectionId:
      env.APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.reviewPhotoCleanupCollectionId,
    emailDeliveriesCollectionId:
      env.APPWRITE_EMAIL_DELIVERIES_TABLE_ID ||
      REVIEW_RESOURCE_DEFAULTS.emailDeliveriesCollectionId,
  }
}

const PRIVATE_REVIEW_ACCESS = Object.freeze({
  publicPermissions: Object.freeze([]),
  adminPermissions: Object.freeze(['read', 'update', 'delete']),
})

const PRIVATE_FUNCTION_ACCESS = Object.freeze({
  publicPermissions: Object.freeze([]),
  adminPermissions: Object.freeze([]),
})

export const REVIEW_COLLECTIONS = Object.freeze({
  reviewInvites: Object.freeze({
    name: 'review_invites',
    ...PRIVATE_REVIEW_ACCESS,
    attributes: Object.freeze([
      { key: 'sourceType', type: 'enum', required: true, elements: ['cake', 'class'] },
      { key: 'sourceReservationId', type: 'string', size: 64, required: true },
      { key: 'sourceReservationNumber', type: 'string', size: 64, required: true },
      { key: 'tokenHash', type: 'string', size: 64, required: true },
      { key: 'expiresAt', type: 'string', size: 40, required: true },
      { key: 'usedAt', type: 'string', size: 40, required: false },
      { key: 'pendingPhotoFileId', type: 'string', size: 64, required: false },
      { key: 'pendingPhotoUploadedAt', type: 'string', size: 40, required: false },
      { key: 'photoUploadCount', type: 'integer', required: false, min: 0, max: 10, xdefault: 0 },
      { key: 'createdByUserId', type: 'string', size: 64, required: true },
      { key: 'createdAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'tokenHash_unique', attributes: ['tokenHash'], type: 'unique' },
      { key: 'sourceReservation_unique', attributes: ['sourceType', 'sourceReservationId'], type: 'unique' },
    ]),
  }),
  reviews: Object.freeze({
    name: 'reviews',
    ...PRIVATE_REVIEW_ACCESS,
    attributes: Object.freeze([
      { key: 'sourceType', type: 'enum', required: true, elements: ['cake', 'class'] },
      { key: 'sourceReservationId', type: 'string', size: 64, required: true },
      { key: 'sourceReservationNumber', type: 'string', size: 64, required: true },
      { key: 'rating', type: 'integer', required: true, min: 1, max: 5 },
      { key: 'body', type: 'string', size: 2000, required: true },
      { key: 'photoFileId', type: 'string', size: 64, required: false },
      { key: 'photoPublishConsent', type: 'boolean', required: true },
      { key: 'displayName', type: 'string', size: 50, required: false },
      { key: 'publishConsent', type: 'boolean', required: true },
      { key: 'moderationStatus', type: 'enum', required: true, elements: ['pending', 'published', 'hidden'] },
      { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 10 },
      { key: 'couponId', type: 'string', size: 64, required: true },
      { key: 'createdAt', type: 'string', size: 40, required: true },
      { key: 'updatedAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'sourceReservation_unique', attributes: ['sourceType', 'sourceReservationId'], type: 'unique' },
      { key: 'moderationStatus_idx', attributes: ['moderationStatus'] },
      { key: 'createdAt_idx', attributes: ['createdAt'] },
      { key: 'sourceType_idx', attributes: ['sourceType'] },
      {
        key: 'public_reviews_idx',
        attributes: ['moderationStatus', 'publishConsent', 'createdAt'],
        orders: ['ASC', 'ASC', 'DESC'],
      },
    ]),
  }),
  reviewCoupons: Object.freeze({
    name: 'review_coupons',
    ...PRIVATE_REVIEW_ACCESS,
    attributes: Object.freeze([
      { key: 'codeHash', type: 'string', size: 64, required: true },
      { key: 'codeLast4', type: 'string', size: 4, required: true },
      { key: 'codeCiphertext', type: 'string', size: 64, required: false },
      { key: 'codeIv', type: 'string', size: 16, required: false },
      { key: 'codeAuthTag', type: 'string', size: 22, required: false },
      { key: 'codeEncryptionVersion', type: 'integer', required: false, min: 1, max: 1 },
      { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 10 },
      { key: 'scope', type: 'enum', required: true, elements: ['cake'] },
      { key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'] },
      { key: 'sourceReviewId', type: 'string', size: 64, required: true },
      { key: 'expiresAt', type: 'string', size: 40, required: true },
      { key: 'redeemedAt', type: 'string', size: 40, required: false },
      { key: 'redeemedReservationId', type: 'string', size: 64, required: false },
      { key: 'createdAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'codeHash_unique', attributes: ['codeHash'], type: 'unique' },
      { key: 'sourceReview_unique', attributes: ['sourceReviewId'], type: 'unique' },
      { key: 'status_idx', attributes: ['status'] },
      { key: 'expiresAt_idx', attributes: ['expiresAt'] },
    ]),
  }),
  manualCoupons: Object.freeze({
    name: 'manual_coupons',
    ...PRIVATE_REVIEW_ACCESS,
    attributes: Object.freeze([
      { key: 'codeHash', type: 'string', size: 64, required: true },
      { key: 'codeLast4', type: 'string', size: 4, required: true },
      { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 5 },
      { key: 'scope', type: 'enum', required: true, elements: ['cake'] },
      { key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'] },
      { key: 'expiresAt', type: 'string', size: 40, required: true },
      { key: 'redeemedAt', type: 'string', size: 40, required: false },
      { key: 'redeemedReservationId', type: 'string', size: 64, required: false },
      { key: 'createdAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'codeHash_unique', attributes: ['codeHash'], type: 'unique' },
      { key: 'status_idx', attributes: ['status'] },
      { key: 'expiresAt_idx', attributes: ['expiresAt'] },
    ]),
  }),
  reviewPhotoCleanup: Object.freeze({
    name: 'review_photo_cleanup',
    ...PRIVATE_REVIEW_ACCESS,
    attributes: Object.freeze([
      { key: 'fileId', type: 'string', size: 64, required: true },
      { key: 'inviteId', type: 'string', size: 64, required: true },
      { key: 'reason', type: 'enum', required: true, elements: ['replacement', 'remove', 'rotation', 'uncertain_attach', 'staged_upload'] },
      { key: 'status', type: 'enum', required: true, elements: ['staging', 'pending', 'failed'] },
      { key: 'attempts', type: 'integer', required: true, min: 0 },
      { key: 'createdAt', type: 'string', size: 40, required: true },
      { key: 'updatedAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'fileId_unique', attributes: ['fileId'], type: 'unique' },
      { key: 'status_createdAt_idx', attributes: ['status', 'createdAt'], orders: ['ASC', 'ASC'] },
    ]),
  }),
  emailDeliveries: Object.freeze({
    name: 'email_deliveries',
    ...PRIVATE_FUNCTION_ACCESS,
    attributes: Object.freeze([
      { key: 'eventKey', type: 'string', size: 128, required: true },
      { key: 'sourceType', type: 'enum', required: true, elements: ['cake', 'class', 'review', 'system'] },
      { key: 'sourceId', type: 'string', size: 64, required: true },
      {
        key: 'template',
        type: 'enum',
        required: true,
        elements: [
          'booking-received-operator',
          'booking-received-customer',
          'booking-confirmed-customer',
          'review-invite-customer',
          'review-reward-customer',
        ],
      },
      { key: 'status', type: 'enum', required: true, elements: ['pending', 'sent', 'failed', 'uncertain'] },
      { key: 'recipientHash', type: 'string', size: 64, required: true },
      { key: 'payloadHash', type: 'string', size: 64, required: true },
      { key: 'attempts', type: 'integer', required: true, min: 0 },
      { key: 'providerMessageId', type: 'string', size: 128, required: false },
      { key: 'lastAttemptAt', type: 'string', size: 40, required: false },
      { key: 'sentAt', type: 'string', size: 40, required: false },
      { key: 'lastErrorCode', type: 'string', size: 80, required: false },
      { key: 'createdAt', type: 'string', size: 40, required: true },
      { key: 'updatedAt', type: 'string', size: 40, required: true },
    ]),
    indexes: Object.freeze([
      { key: 'eventKey_unique', attributes: ['eventKey'], type: 'unique' },
    ]),
  }),
})

export const REVIEW_COLLECTION_RESOURCE_KEYS = Object.freeze([
  Object.freeze(['reviewInvites', 'reviewInvitesCollectionId']),
  Object.freeze(['reviews', 'reviewsCollectionId']),
  Object.freeze(['reviewCoupons', 'reviewCouponsCollectionId']),
  Object.freeze(['manualCoupons', 'manualCouponsCollectionId']),
  Object.freeze(['reviewPhotoCleanup', 'reviewPhotoCleanupCollectionId']),
  Object.freeze(['emailDeliveries', 'emailDeliveriesCollectionId']),
])

export const RESERVATION_REVIEW_AUDIT_ATTRIBUTES = Object.freeze([
  { key: 'subtotalCents', type: 'integer', required: false, min: 0 },
  { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100 },
  { key: 'discountCents', type: 'integer', required: false, min: 0 },
  { key: 'appliedPromoCodeLast4', type: 'string', size: 4, required: false },
  { key: 'reviewCouponId', type: 'string', size: 64, required: false },
])

export const RESERVATION_MULTI_LINE_ATTRIBUTES = Object.freeze([
  { key: 'orderLinesJson', type: 'string', size: 65535, required: false },
  { key: 'orderLineCount', type: 'integer', required: false, min: 1 },
  { key: 'orderItemCount', type: 'integer', required: false, min: 1 },
  { key: 'discountBasisCents', type: 'integer', required: false, min: 0 },
  { key: 'individualPackagingPieces', type: 'integer', required: false, min: 0 },
  { key: 'individualPackagingFeeCents', type: 'integer', required: false, min: 0 },
  { key: 'requestFingerprint', type: 'string', size: 64, required: false },
])

export const REVIEW_PHOTO_BUCKET = Object.freeze({
  name: 'review-photos',
  publicPermissions: Object.freeze([]),
  adminPermissions: Object.freeze(['read', 'update', 'delete']),
  fileSecurity: true,
  enabled: true,
  maximumFileSize: 1_572_864,
  allowedFileExtensions: Object.freeze(['jpg', 'jpeg', 'png', 'webp']),
  encryption: true,
  antivirus: true,
  transformations: true,
})

export function parseAdminUserIds(env = {}) {
  return [...new Set(String(env.APPWRITE_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean))]
}

export function validateAdminApplyConfiguration(env = {}) {
  const adminUserIds = parseAdminUserIds(env)
  if (adminUserIds.length === 0) {
    throw new Error('APPWRITE_ADMIN_USER_IDS is required. Setup will not grant broad access to every authenticated user.')
  }
  return adminUserIds
}

export function toAppwriteIndexCreate(index) {
  return {
    key: index.key,
    type: index.type || 'key',
    attributes: index.attributes,
    ...(index.orders === undefined ? {} : { orders: index.orders }),
  }
}

export function buildReviewSetupPlan(env = {}) {
  const ids = resolveReviewResourceIds(env)
  const adminUserCount = parseAdminUserIds(env).length
  const databaseId = env.APPWRITE_CAKE_DATABASE_ID || env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake'
  const reservationsCollectionId =
    env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    'reservations'
  const resources = REVIEW_COLLECTION_RESOURCE_KEYS.map(([key, idKey]) => [key, ids[idKey]])

  return {
    mode: 'dry-run',
    network: false,
    databaseId,
    collections: resources.map(([key, id]) => ({
      id,
      name: REVIEW_COLLECTIONS[key].name,
      attributeKeys: REVIEW_COLLECTIONS[key].attributes.map((attribute) => attribute.key),
      attributeCount: REVIEW_COLLECTIONS[key].attributes.length,
      indexKeys: REVIEW_COLLECTIONS[key].indexes.map((index) => index.key),
      indexCount: REVIEW_COLLECTIONS[key].indexes.length,
      indexes: REVIEW_COLLECTIONS[key].indexes.map(toAppwriteIndexCreate),
    })),
    reservationAudit: {
      collectionId: reservationsCollectionId,
      attributeKeys: RESERVATION_REVIEW_AUDIT_ATTRIBUTES.map((attribute) => attribute.key),
      attributeCount: RESERVATION_REVIEW_AUDIT_ATTRIBUTES.length,
    },
    reservationMultiLine: {
      collectionId: reservationsCollectionId,
      attributeKeys: RESERVATION_MULTI_LINE_ATTRIBUTES.map((attribute) => attribute.key),
      attributeCount: RESERVATION_MULTI_LINE_ATTRIBUTES.length,
    },
    permissions: {
      publicPermissionCount: 0,
      adminMappingIntent: {
        roleKind: 'user',
        adminUserCount,
        actions: [...PRIVATE_REVIEW_ACCESS.adminPermissions],
      },
    },
    bucket: {
      id: ids.reviewPhotosBucketId,
      name: REVIEW_PHOTO_BUCKET.name,
      fileSecurity: REVIEW_PHOTO_BUCKET.fileSecurity,
      enabled: REVIEW_PHOTO_BUCKET.enabled,
      maximumFileSize: REVIEW_PHOTO_BUCKET.maximumFileSize,
      allowedFileExtensions: [...REVIEW_PHOTO_BUCKET.allowedFileExtensions],
      encryption: REVIEW_PHOTO_BUCKET.encryption,
      antivirus: REVIEW_PHOTO_BUCKET.antivirus,
      transformations: REVIEW_PHOTO_BUCKET.transformations,
      publicPermissionCount: REVIEW_PHOTO_BUCKET.publicPermissions.length,
      adminPermissionActions: [...REVIEW_PHOTO_BUCKET.adminPermissions],
    },
    wouldFailApply: adminUserCount === 0,
  }
}

export function sameUnorderedValues(currentValues = [], expectedValues = []) {
  if (currentValues.length !== expectedValues.length) return false
  const currentSorted = [...currentValues].sort()
  const expectedSorted = [...expectedValues].sort()
  return currentSorted.every((value, index) => value === expectedSorted[index])
}

export function reviewPhotoBucketMismatches(current, expected) {
  const currentPermissions = current.$permissions || current.permissions || []
  const mismatches = []
  if (current.name !== expected.name) mismatches.push(`name=${current.name}`)
  if (!sameUnorderedValues(currentPermissions, expected.permissions)) mismatches.push('permissions differ')
  for (const key of ['fileSecurity', 'enabled', 'maximumFileSize', 'encryption', 'antivirus', 'transformations']) {
    if (current[key] !== expected[key]) mismatches.push(`${key}=${current[key]}`)
  }
  if (!sameUnorderedValues(current.allowedFileExtensions || [], expected.allowedFileExtensions)) {
    mismatches.push(`allowedFileExtensions=[${(current.allowedFileExtensions || []).join(', ')}]`)
  }
  return mismatches
}

export function canEnableReviewPhotoTransformations(mismatches, explicitlyRequested) {
  return explicitlyRequested === true && mismatches.length === 1 && mismatches[0] === 'transformations=false'
}

function sameOrderedValues(currentValues = [], expectedValues = []) {
  return currentValues.length === expectedValues.length &&
    expectedValues.every((value, index) => currentValues[index] === value)
}

export function validateIndexDefinition(collectionId, expectedIndex, currentIndex) {
  const expected = toAppwriteIndexCreate(expectedIndex)
  const currentAttributes = Array.isArray(currentIndex.attributes) ? currentIndex.attributes : []
  const expectedOrders = expected.orders
  const currentOrders = Array.isArray(currentIndex.orders) ? currentIndex.orders : []
  const ordersMatch = expectedOrders === undefined || sameOrderedValues(currentOrders, expectedOrders)

  if (
    currentIndex.type === expected.type &&
    sameOrderedValues(currentAttributes, expected.attributes) &&
    ordersMatch
  ) return

  const expectedOrderDetails = expectedOrders === undefined ? '' : `, orders=[${expectedOrders.join(', ')}]`
  const currentOrderDetails = expectedOrders === undefined ? '' : `, orders=[${currentOrders.join(', ')}]`
  throw new Error(
    `index ${collectionId}.${expected.key} definition mismatch: ` +
    `expected type=${expected.type}, attributes=[${expected.attributes.join(', ')}]${expectedOrderDetails}; ` +
    `found type=${currentIndex.type || 'unknown'}, attributes=[${currentAttributes.join(', ')}]${currentOrderDetails}. ` +
    'Resolve the drift manually; setup will not delete or recreate the index.',
  )
}

export function validateCollectionDefinition(collectionId, current, {
  name,
  permissions,
  documentSecurity,
  enabled = true,
}) {
  const currentPermissions = current.$permissions || current.permissions || []
  const mismatches = []
  if (current.name !== name) mismatches.push(`name=${current.name}`)
  if (current.documentSecurity !== documentSecurity) mismatches.push(`documentSecurity=${current.documentSecurity}`)
  if (current.enabled !== enabled) mismatches.push(`enabled=${current.enabled}`)
  if (!sameUnorderedValues(currentPermissions, permissions)) mismatches.push('permissions differ')
  if (mismatches.length === 0) return

  throw new Error(
    `collection ${collectionId} definition mismatch (${mismatches.join(', ')}). ` +
    'Resolve the drift manually; setup will not overwrite or recreate this private review collection.',
  )
}

const LEGACY_DIRECT_ADMIN_PERMISSION = /^(read|update|delete)\("user:([A-Za-z0-9][A-Za-z0-9._-]{0,35})"\)$/
const LEGACY_DIRECT_ADMIN_ACTIONS = Object.freeze(['read', 'update', 'delete'])

export function emailDeliveryLegacyPermissionMigration(current, expected) {
  if (
    expected?.name !== 'email_deliveries' ||
    !sameUnorderedValues(expected.permissions || [], []) ||
    expected.documentSecurity !== false ||
    expected.enabled !== true ||
    current?.name !== expected.name ||
    current.documentSecurity !== expected.documentSecurity ||
    current.enabled !== expected.enabled
  ) return null

  const permissions = current.$permissions || current.permissions || []
  if (!Array.isArray(permissions) || permissions.length === 0 || permissions.length % LEGACY_DIRECT_ADMIN_ACTIONS.length !== 0) {
    return null
  }

  const actionsByUserId = new Map()
  for (const permission of permissions) {
    const match = LEGACY_DIRECT_ADMIN_PERMISSION.exec(permission)
    if (!match) return null
    const [, action, userId] = match
    const actions = actionsByUserId.get(userId) || new Set()
    if (actions.has(action)) return null
    actions.add(action)
    actionsByUserId.set(userId, actions)
  }
  if (actionsByUserId.size === 0) return null
  for (const actions of actionsByUserId.values()) {
    if (!sameUnorderedValues([...actions], LEGACY_DIRECT_ADMIN_ACTIONS)) return null
  }

  return { reason: 'revoke_legacy_direct_admin_crud_permissions' }
}

export async function ensureStrictCollection({
  databaseId,
  collectionId,
  name,
  permissions,
  documentSecurity = false,
  enabled = true,
  getCollection,
  createCollection,
  updateCollection,
  migrateExisting,
  isMissing,
  isConflict,
}) {
  const getExactCollection = () => getCollection({ databaseId, collectionId })
  const validate = (current) => validateCollectionDefinition(collectionId, current, {
    name,
    permissions,
    documentSecurity,
    enabled,
  })

  try {
    const current = await getExactCollection()
    try {
      validate(current)
    } catch (validationError) {
      if (typeof migrateExisting !== 'function' || !migrateExisting(current, {
        name,
        permissions,
        documentSecurity,
        enabled,
      }) || typeof updateCollection !== 'function') {
        throw validationError
      }
      await updateCollection({
        databaseId,
        collectionId,
        name,
        permissions,
        documentSecurity,
        enabled,
        purge: true,
      })
      const updated = await getExactCollection()
      validate(updated)
      return 'updated'
    }
    return 'existing'
  } catch (error) {
    if (!isMissing(error)) throw error
  }

  try {
    await createCollection({
      databaseId,
      collectionId,
      name,
      permissions,
      documentSecurity,
      enabled,
    })
    return 'created'
  } catch (error) {
    if (!isConflict(error)) throw error
  }

  const current = await getExactCollection()
  validate(current)
  return 'existing'
}

const APPWRITE_INTEGER_MIN = -9_223_372_036_854_775_808n
const APPWRITE_INTEGER_MAX = 9_223_372_036_854_775_807n

function sameIntegerBound(current, expected) {
  if ((typeof current !== 'number' && typeof current !== 'bigint') ||
      (typeof current === 'number' && !Number.isSafeInteger(current))) return false
  try {
    return BigInt(current) === BigInt(expected)
  } catch {
    return false
  }
}

export function validateAttributeDefinition(collectionId, expected, current) {
  const mismatches = []
  const expectedDefault = expected.xdefault ?? expected.default ?? null
  const currentDefault = current.default ?? null
  const expectedArray = expected.array ?? false
  const currentArray = current.array ?? false

  if (expected.type === 'enum') {
    if (current.type !== 'string') mismatches.push(`type=${current.type}`)
    if (current.format !== 'enum') mismatches.push(`format=${current.format}`)
  } else {
    if (current.type !== expected.type) mismatches.push(`type=${current.type}`)
    if (expected.type === 'string') {
      const currentFormat = current.format ?? ''
      const currentEncrypt = current.encrypt ?? false
      if (currentFormat !== '') mismatches.push(`format=${currentFormat}`)
      if (currentEncrypt !== false) mismatches.push(`encrypt=${currentEncrypt}`)
    }
  }
  if (current.required !== expected.required) mismatches.push(`required=${current.required}`)
  if (currentArray !== expectedArray) mismatches.push(`array=${currentArray}`)
  if (expected.type === 'string' && current.size !== expected.size) mismatches.push(`size=${current.size}`)
  if (expected.type === 'enum' && !sameUnorderedValues(current.elements || [], expected.elements || [])) {
    mismatches.push(`elements=[${(current.elements || []).join(', ')}]`)
  }
  if (expected.type === 'integer') {
    const expectedMin = expected.min ?? APPWRITE_INTEGER_MIN
    const expectedMax = expected.max ?? APPWRITE_INTEGER_MAX
    if (!sameIntegerBound(current.min, expectedMin)) mismatches.push(`min=${current.min}`)
    if (!sameIntegerBound(current.max, expectedMax)) mismatches.push(`max=${current.max}`)
  }
  if (currentDefault !== expectedDefault) mismatches.push(`default=${currentDefault}`)
  if (mismatches.length === 0) return

  throw new Error(
    `attribute ${collectionId}.${expected.key} definition mismatch (${mismatches.join(', ')}). ` +
    'Resolve the drift manually; setup will not overwrite or recreate the attribute.',
  )
}

export function assertExactAvailableKeySet(label, expectedDefinitions, currentResources) {
  const unavailable = currentResources
    .filter((resource) => resource.status !== 'available')
    .map((resource) => `${resource.key}=${resource.status || 'unknown'}`)
  if (unavailable.length > 0) {
    throw new Error(`${label} not available: ${unavailable.join(', ')}`)
  }

  const expectedKeys = expectedDefinitions.map(({ key }) => key)
  const currentKeys = currentResources.map(({ key }) => key)
  const missing = expectedKeys.filter((key) => !currentKeys.includes(key))
  const extra = currentKeys.filter((key) => !expectedKeys.includes(key))
  if (missing.length === 0 && extra.length === 0) return

  const details = [
    missing.length > 0 ? `missing=${missing.join(',')}` : '',
    extra.length > 0 ? `extra=${extra.join(',')}` : '',
  ].filter(Boolean)
  throw new Error(`${label} exact key set mismatch (${details.join('; ')}). Resolve drift manually.`)
}

export function assertCompleteExactAvailableKeySet(label, expectedDefinitions, response, resourceKey) {
  const currentResources = Array.isArray(response?.[resourceKey]) ? response[resourceKey] : []
  if (response?.total !== currentResources.length) {
    throw new Error(
      `${label} incomplete pagination (total=${response?.total ?? 'unknown'}, returned=${currentResources.length}). ` +
      'Setup will not validate a partial resource set.',
    )
  }
  assertExactAvailableKeySet(label, expectedDefinitions, currentResources)
}
