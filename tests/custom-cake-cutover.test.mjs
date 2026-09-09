import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './custom-cake-actions.test.mjs'
import { AppwriteException } from './reservation-sdk.mjs'
import { hashReviewCouponCode } from '../appwrite-functions/reservation-api/src/business.js'
import { readFileSync } from 'node:fs'
const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${n}.json`, import.meta.url)))
const oldInput = () => ({ requestId: '11111111-1111-4111-8111-111111111111', customerName: 'Contract Example', customerPhone: '0412345678', customerEmail: 'contract@example.invalid', productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none', quantity: 1, pickupDate: '2026-10-05', pickupTime: '12:00', cacaoPercent: '100', requestNote: '', promoCode: '', privacyConsent: true })
async function setup() {
  const h = await harness(), get = h.sdk.getDocument
  h.sdk.getDocument = async p => { try { return await get(p) } catch (e) { if (typeof e.code === 'number') throw new AppwriteException(e.message, e.code, 'document_not_found'); throw e } }
  const create = h.sdk.createDocument
  h.sdk.createDocument = async p => {
    if (p.transactionId) return create(p)
    const key = `${p.collectionId}/${p.documentId}`
    if (h.sdk.docs.has(key)) throw new AppwriteException('duplicate', 409, 'document_already_exists')
    const data = { ...structuredClone(p.data), $id: p.documentId }; h.sdk.docs.set(key, { revision: 1, data }); return data
  }
  return h
}

test('required old gate authenticates exact stored fingerprint before clock; fingerprintless compat survives but required cannot bypass', async () => {
  const h = await setup(), input = oldInput(), created = await h.call('create-cake', input)
  assert.equal(created.status, 200, JSON.stringify(created.body))
  h.env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS = 'required'; h.clock('2027-01-01T00:00:00.000Z')
  assert.deepEqual((await h.call('create-cake', input)).body, created.body)
  assert.equal((await h.call('create-cake', { ...input, quantity: 2 })).body.code, 'REQUEST_ID_CONFLICT')
  const newId = { ...input, requestId: '22222222-2222-4222-8222-222222222222' }
  const denied = await h.call('create-cake', newId)
  assert.deepEqual(denied, { body: { ok: false, code: 'CAKE_ORDER_UPGRADE_REQUIRED' }, status: 409, headers: undefined })
  const doc = h.sdk.docs.get(`reservations/${input.requestId}`); delete doc.data.requestFingerprint
  assert.equal((await h.call('create-cake', input)).body.code, 'CAKE_ORDER_UPGRADE_REQUIRED')
  h.env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS = 'compat'
  assert.deepEqual((await h.call('create-cake', { ...input, quantity: 2 })).body, created.body)
})

test('required cutover stays required when provisioning is unavailable and invalid mode never reverts to compat', async () => {
  const h = await setup(); h.env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS = 'required'
  h.storage.getBucket = async () => { throw new Error('missing bucket') }
  assert.equal((await h.call('create-cake', oldInput())).body.code, 'CAKE_ORDER_UPGRADE_REQUIRED')
  assert.equal(h.sdk.docs.size, 0)
  h.env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS = 'typo'
  assert.notEqual((await h.call('create-cake', oldInput())).status, 200)
  assert.equal(h.sdk.docs.size, 0)
})

test('simultaneous legacy/custom/v2 request ID cannot produce two committed receipts', async () => {
  const h = await setup(), custom = fixture('custom-v1').request, ordinary = fixture('cake-order-v2').request
  custom.lines[0].photoRefs = []
  let release, checked = 0
  const checkedBoth = new Promise(resolve => { release = resolve }), get = h.sdk.getDocument, create = h.sdk.createDocument
  h.sdk.getDocument = async p => { try { return await get(p) } finally { if (p.collectionId === 'reservations' && ++checked === 3) release() } }
  h.sdk.createDocument = async p => { if (p.collectionId === 'reservations' && !p.transactionId) await checkedBoth; return create(p) }
  const replies = await Promise.all([h.call('create-cake', oldInput()), h.call('create-custom-cake-request', custom), h.call('create-cake-order-v2', ordinary)])
  assert.equal(replies.filter(r => r.status === 200).length, 1, JSON.stringify(replies))
  assert.ok(replies.filter(r => r.status !== 200).every(r => r.body.code === 'REQUEST_ID_CONFLICT'))
  const count = [...h.sdk.docs.keys()].filter(k => k.startsWith('reservations/') || k.startsWith('custom_cake_snapshots/')).length
  assert.equal(count, 1)
})

test('v2 current coupon ledger is redeemed with receipt and sanitized event; failed redemption rolls back everything', async () => {
  for (const failure of [false, true]) {
    const h = await setup(), request = fixture('cake-order-v2').request
    request.promoCode = 'FOXKIWI7Q2MK'
    const coupon = { $id: 'coupon-1', codeHash: hashReviewCouponCode(request.promoCode, Buffer.alloc(32, 7)), codeLast4: 'Q2MK', rewardPercent: 5, scope: 'cake', status: 'active', expiresAt: '2026-11-01T00:00:00.000Z' }
    h.sdk.docs.set('review_coupons/coupon-1', { revision: 1, data: coupon })
    if (failure) { const update = h.sdk.updateDocument; h.sdk.updateDocument = async p => { if (p.collectionId === 'review_coupons') throw new Error('raw coupon write error'); return update(p) } }
    else h.sdk.uncertain = true
    const result = await h.call('create-cake-order-v2', request)
    if (failure) {
      assert.equal(result.body.code, 'CAPABILITY_UNAVAILABLE'); assert.equal((await h.repository.list('snapshots')).length, 0)
      assert.equal((await h.repository.list('claims')).length, 0); assert.equal((await h.repository.list('outbox')).length, 0)
      assert.equal(h.sdk.docs.get('review_coupons/coupon-1').data.status, 'active')
    } else {
      assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.result.pricing.totalCents, 8135)
      assert.equal(h.sdk.docs.get('review_coupons/coupon-1').data.redeemedReservationId, request.requestId)
      assert.equal(h.sdk.docs.get('review_coupons/coupon-1').data.codeCiphertext, null)
      const stored = (await h.repository.list('snapshots'))[0].value
      assert.equal(stored.request.promoCode, ''); assert.equal(stored.couponAudit.codeLast4, 'Q2MK')
      assert.ok(!JSON.stringify([...h.sdk.docs.values()]).includes('FOXKIWI7Q2MK'))
      assert.deepEqual((await h.call('create-cake-order-v2', request)).body, result.body)
      assert.equal((await h.repository.list('outbox'))[0].value.eventType, 'cake-order-v2.received')
    }
  }
})
