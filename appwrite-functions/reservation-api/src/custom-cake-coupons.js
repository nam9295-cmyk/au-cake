import { Query } from 'node-appwrite'
import { hashReviewCouponCode, normalizeReviewCouponCode, validateReviewCoupon } from './business.js'
import { PROMOTIONS } from './cake-order-catalog.js'
import { cakeWireFail } from './custom-cake-workflow.js'

/** Reads and redeems the current trusted ledger within the caller's receipt transaction. */
export function createCakeV2CouponLedger(databases, config) {
  return {
    async resolve(code, now, transactionId) {
      if (!code || PROMOTIONS.some(p => p.code === code)) return null
      const normalized = normalizeReviewCouponCode(code), manual = normalized.startsWith('JENNIE')
      const collectionId = manual ? config.manualCouponsId : config.reviewCouponsId
      const codeHash = hashReviewCouponCode(normalized, config.reviewCouponHmacSecret)
      const found = await databases.listDocuments({ databaseId: config.cakeDatabaseId, collectionId, queries: [Query.equal('codeHash', codeHash), Query.limit(2)], total: false, transactionId })
      if (found.documents.length !== 1) cakeWireFail('PROMO_CODE_INVALID')
      const coupon = validateReviewCoupon(found.documents[0], normalized, now, config.reviewCouponHmacSecret)
      return { collectionId, documentId: coupon.id, manual, pricing: { ...coupon, id: manual ? `manual:${coupon.id}` : coupon.id }, audit: { ledger: manual ? 'manual' : 'review', couponId: coupon.id, codeHash, codeLast4: coupon.codeLast4, rewardPercent: coupon.rewardPercent } }
    },
    async redeem(coupon, requestId, now, transactionId) {
      await databases.updateDocument({ databaseId: config.cakeDatabaseId, collectionId: coupon.collectionId, documentId: coupon.documentId, transactionId, data: {
        status: 'redeemed', redeemedAt: now.toISOString(), redeemedReservationId: requestId,
        ...(!coupon.manual ? { codeCiphertext: null, codeIv: null, codeAuthTag: null, codeEncryptionVersion: null } : {}),
      } })
    },
  }
}
