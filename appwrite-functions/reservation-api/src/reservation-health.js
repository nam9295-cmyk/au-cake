import { Query } from 'node-appwrite'
import { ReservationApiError } from './business.js'
import { SMORE_WRITES_ENABLED } from './smore-write-policy.js'

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

export async function checkReservationReadiness(databases, runtimeConfig) {
  await databases.listDocuments({
    databaseId: runtimeConfig.cakeDatabaseId,
    collectionId: runtimeConfig.settingsId,
    queries: [Query.limit(1)],
    total: false,
  })
  const [
    couponCollection,
    couponAttributeResult,
    couponIndexResult,
    manualCouponCollection,
    manualCouponAttributeResult,
    manualCouponIndexResult,
    reservationAttributeResult,
  ] = await Promise.all([
    databases.getCollection({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listIndexes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.getCollection({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listIndexes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.cakeReservationsId,
      queries: [Query.limit(100)],
      total: true,
    }),
  ])

  const completeResources = (response, key) => {
    const resources = Array.isArray(response?.[key]) ? response[key] : []
    if (!Number.isInteger(response?.total) || response.total !== resources.length) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
    return resources
  }
  const validateAdminOnlyPermissions = (collection) => {
    const permissions = collection?.$permissions || collection?.permissions
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
    const permissionsByAdmin = new Map()
    for (const permission of permissions) {
      const match = typeof permission === 'string'
        ? /^(read|update|delete)\("user:([A-Za-z0-9][A-Za-z0-9._-]{0,35})"\)$/.exec(permission)
        : null
      if (!match) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
      const actions = permissionsByAdmin.get(match[2]) || new Set()
      if (actions.has(match[1])) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
      actions.add(match[1])
      permissionsByAdmin.set(match[2], actions)
    }
    if ([...permissionsByAdmin.values()].some((actions) =>
      actions.size !== 3 || !['read', 'update', 'delete'].every((action) => actions.has(action)))) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
  }
  const manualCouponCollectionId = manualCouponCollection?.$id || manualCouponCollection?.id
  if (
    manualCouponCollectionId !== runtimeConfig.manualCouponsId ||
    manualCouponCollection?.name !== 'manual_coupons' ||
    manualCouponCollection?.enabled !== true ||
    manualCouponCollection?.documentSecurity !== false
  ) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  validateAdminOnlyPermissions(couponCollection)
  validateAdminOnlyPermissions(manualCouponCollection)

  const couponAttributes = completeResources(couponAttributeResult, 'attributes')
  const couponIndexes = completeResources(couponIndexResult, 'indexes')
  const manualCouponAttributes = completeResources(manualCouponAttributeResult, 'attributes')
  const manualCouponIndexes = completeResources(manualCouponIndexResult, 'indexes')
  const reservationAttributes = completeResources(reservationAttributeResult, 'attributes')
  const codeHash = couponAttributes.find((attribute) => (attribute.key || attribute.$id) === 'codeHash')
  const uniqueCodeHash = couponIndexes.some((index) =>
    index.type === 'unique' &&
    index.status === 'available' &&
    Array.isArray(index.attributes) &&
    index.attributes.length === 1 &&
    index.attributes[0] === 'codeHash')
  if (!codeHash || codeHash.type !== 'string' || codeHash.required !== true || codeHash.size !== 64 || codeHash.status !== 'available' || !uniqueCodeHash) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedCouponEnvelopeAttributes = [
    { key: 'codeCiphertext', type: 'string', required: false, size: 64 },
    { key: 'codeIv', type: 'string', required: false, size: 16 },
    { key: 'codeAuthTag', type: 'string', required: false, size: 22 },
    { key: 'codeEncryptionVersion', type: 'integer', required: false, min: 1, max: 1 },
  ]
  const compatibleCouponEnvelopeAttribute = (expected) => {
    const current = couponAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key)
    if (!current || current.status !== 'available' || current.type !== expected.type || current.required !== false) return false
    if (expected.type === 'string') return current.size === expected.size
    return (current.min ?? null) === expected.min && (current.max ?? null) === expected.max
  }
  if (!expectedCouponEnvelopeAttributes.every(compatibleCouponEnvelopeAttribute)) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedManualCouponAttributes = [
    { key: 'codeHash', type: 'string', required: true, size: 64 },
    { key: 'codeLast4', type: 'string', required: true, size: 4 },
    { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 5 },
    { key: 'scope', type: 'enum', required: true, elements: ['cake'] },
    { key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'] },
    { key: 'expiresAt', type: 'string', required: true, size: 40 },
    { key: 'redeemedAt', type: 'string', required: false, size: 40 },
    { key: 'redeemedReservationId', type: 'string', required: false, size: 64 },
    { key: 'createdAt', type: 'string', required: true, size: 40 },
  ]
  const compatibleManualAttribute = (expected, current) => {
    if (!current || current.status !== 'available' || current.required !== expected.required) return false
    if (expected.type === 'enum') {
      if (current.type !== 'enum' && current.type !== 'string') return false
      return Array.isArray(current.elements) &&
        current.elements.length === expected.elements.length &&
        expected.elements.every((element, index) => current.elements[index] === element)
    }
    if (current.type !== expected.type) return false
    if (expected.type === 'string') return current.size === expected.size
    return (current.min ?? null) === expected.min && (current.max ?? null) === expected.max
  }
  if (manualCouponAttributes.length !== expectedManualCouponAttributes.length ||
      !expectedManualCouponAttributes.every((expected) => compatibleManualAttribute(
        expected,
        manualCouponAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key),
      ))) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedManualCouponIndexes = [
    { key: 'codeHash_unique', type: 'unique', attributes: ['codeHash'] },
    { key: 'status_idx', type: 'key', attributes: ['status'] },
    { key: 'expiresAt_idx', type: 'key', attributes: ['expiresAt'] },
  ]
  if (manualCouponIndexes.length !== expectedManualCouponIndexes.length ||
      !expectedManualCouponIndexes.every((expected) => {
        const current = manualCouponIndexes.find((index) => (index.key || index.$id) === expected.key)
        return current?.status === 'available' && current.type === expected.type &&
          Array.isArray(current.attributes) && current.attributes.length === expected.attributes.length &&
          expected.attributes.every((attribute, index) => current.attributes[index] === attribute)
      })) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedAuditAttributes = [
    { key: 'subtotalCents', type: 'integer', required: false, min: 0, max: APPWRITE_INTEGER_MAX },
    { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100 },
    { key: 'discountCents', type: 'integer', required: false, min: 0, max: APPWRITE_INTEGER_MAX },
    { key: 'appliedPromoCodeLast4', type: 'string', required: false, size: 4 },
    { key: 'reviewCouponId', type: 'string', required: false, size: 64 },
    { key: 'vanillaCakeSheet', type: 'string', required: false, size: 20 },
    { key: 'vanillaCakeFlavor', type: 'string', required: false, size: 40 },
    { key: 'cupcakeFinish', type: 'string', required: false, size: 40 },
    { key: 'orderLinesJson', type: 'string', required: false, size: 65535 },
    { key: 'orderLineCount', type: 'integer', required: false, min: 1, max: APPWRITE_INTEGER_MAX },
    { key: 'orderItemCount', type: 'integer', required: false, min: 1, max: APPWRITE_INTEGER_MAX },
    { key: 'discountBasisCents', type: 'integer', required: false, min: 0, max: APPWRITE_INTEGER_MAX },
    { key: 'individualPackagingPieces', type: 'integer', required: false, min: 0, max: APPWRITE_INTEGER_MAX },
    { key: 'individualPackagingFeeCents', type: 'integer', required: false, min: 0, max: APPWRITE_INTEGER_MAX },
    { key: 'requestFingerprint', type: 'string', required: false, size: 64 },
  ]
  const compatibleAuditAttribute = (expected) => {
    const current = reservationAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key)
    if (
      !current ||
      current.status !== 'available' ||
      current.type !== expected.type ||
      current.required !== expected.required ||
      (current.array ?? false) !== false ||
      (current.default ?? null) !== null
    ) return false
    if (expected.type === 'string') {
      return current.size === expected.size &&
        (current.format ?? '') === '' &&
        (current.encrypt ?? false) === false
    }
    return sameIntegerBound(current.min, expected.min) && sameIntegerBound(current.max, expected.max)
  }
  if (!expectedAuditAttributes.every(compatibleAuditAttribute)) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  return {
    status: 'ready',
    capabilities: {
      cakeOrderLines: 1,
      smoreStoredOrders: 1,
      smoreWrites: SMORE_WRITES_ENABLED ? 1 : 0,
    },
  }
}
