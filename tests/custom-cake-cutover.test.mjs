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

for (const rawId of ['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', 'aAaAaAaA-aAaA-4AaA-8aAa-AaAaAaAaAaAa']) {
  for (const quantity of [1, 2]) test(`legacy raw ID case remains distinct for ${rawId} and lowercase with quantity ${quantity}`, async () => {
    const h = await setup(), upper = { ...oldInput(), requestId: rawId }
    const first = await h.call('create-cake', upper)
    assert.equal(first.status, 200)
    const before = structuredClone(h.sdk.docs.get(`reservations/${rawId}`))
    const lower = { ...upper, requestId: rawId.toLowerCase(), quantity }
    const second = await h.call('create-cake', lower)
    assert.equal(second.status, 200, JSON.stringify(second.body))
    assert.ok(h.sdk.docs.has(`reservations/${lower.requestId}`), 'lowercase raw ID needs its own legacy document')
    assert.notEqual(second.body.result.reservationNumber, first.body.result.reservationNumber)
    assert.equal(second.body.result.totalPriceCents, quantity === 1 ? 7900 : 15800)
    assert.deepEqual(h.sdk.docs.get(`reservations/${rawId}`), before)
    assert.deepEqual((await h.call('create-cake', upper)).body, first.body)
    assert.deepEqual((await h.call('create-cake', lower)).body, second.body)
    const claims = await h.repository.list('claims')
    assert.equal(claims.length, 1)
    assert.equal(claims[0].value.requestId, lower.requestId)
    assert.deepEqual(claims[0].value.creationResponse, second.body.result)
  })
}

test('pre-activation uppercase legacy record remains separate from newly enrolled lowercase legacy ID', async () => {
  const h = await setup(), upper = { ...oldInput(), requestId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }
  h.env.CUSTOM_CAKE_PERSISTENCE_ENABLED = 'false'
  const first = await h.call('create-cake', upper)
  assert.equal(first.status, 200)
  assert.equal((await h.repository.list('claims')).length, 0)
  const before = structuredClone(h.sdk.docs.get(`reservations/${upper.requestId}`))
  h.env.CUSTOM_CAKE_PERSISTENCE_ENABLED = 'true'
  const lower = { ...upper, requestId: upper.requestId.toLowerCase(), quantity: 2 }
  const second = await h.call('create-cake', lower)
  assert.equal(second.status, 200)
  assert.equal(second.body.result.totalPriceCents, 15800)
  assert.ok(h.sdk.docs.has(`reservations/${lower.requestId}`))
  assert.deepEqual(h.sdk.docs.get(`reservations/${upper.requestId}`), before)
  assert.equal((await h.repository.list('claims')).length, 1)
})

test('uppercase legacy ID does not claim the distinct lowercase new-wire ID', async () => {
  for (const [action, name] of [['create-custom-cake-request', 'custom-v1'], ['create-cake-order-v2', 'cake-order-v2']]) {
    const h = await setup(), upper = { ...oldInput(), requestId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }
    const first = await h.call('create-cake', upper)
    assert.equal(first.status, 200)
    const before = structuredClone(h.sdk.docs.get(`reservations/${upper.requestId}`))
    const lower = fixture(name).request; lower.requestId = upper.requestId.toLowerCase()
    if (name === 'custom-v1') lower.lines[0].photoRefs = []
    const second = await h.call(action, lower)
    assert.equal(second.status, 200, JSON.stringify(second.body))
    assert.ok(await h.repository.get('snapshots', lower.requestId))
    assert.deepEqual(h.sdk.docs.get(`reservations/${upper.requestId}`), before)
  }
})

test('required mode retains exact uppercase stored replay but never treats lowercase as that stored ID', async () => {
  const h = await setup(), upper = { ...oldInput(), requestId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }
  const first = await h.call('create-cake', upper)
  assert.equal(first.status, 200)
  const before = structuredClone(h.sdk.docs)
  h.env.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS = 'required'
  h.clock('2027-01-01T00:00:00.000Z')
  h.storage.getBucket = async () => { throw new Error('unavailable new provisioning') }
  assert.deepEqual((await h.call('create-cake', upper)).body, first.body)
  assert.equal((await h.call('create-cake', { ...upper, quantity: 2 })).body.code, 'REQUEST_ID_CONFLICT')
  for (const quantity of [1, 2]) {
    const reply = await h.call('create-cake', { ...upper, requestId: upper.requestId.toLowerCase(), quantity })
    assert.deepEqual(reply.body, { ok: false, code: 'CAKE_ORDER_UPGRADE_REQUIRED' })
    assert.equal(reply.status, 409)
  }
  assert.deepEqual(h.sdk.docs, before)
})

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

test('simultaneous legacy and v2 redemption share the current coupon fence and leave only the winning receipt', async () => {
  const h = await setup(), old = oldInput(), ordinary = fixture('cake-order-v2').request
  old.promoCode = 'FOXKIWI7Q2MK'; ordinary.promoCode = old.promoCode; ordinary.requestId = '22222222-2222-4222-8222-222222222222'
  h.sdk.docs.set('review_coupons/coupon-1', { revision: 1, data: { $id: 'coupon-1', codeHash: hashReviewCouponCode(old.promoCode, Buffer.alloc(32, 7)), codeLast4: 'Q2MK', rewardPercent: 5, scope: 'cake', status: 'active', expiresAt: '2026-11-01T00:00:00.000Z' } })
  const update = h.sdk.updateDocument; let entered = 0, release
  const barrier = new Promise(resolve => { release = resolve })
  h.sdk.updateDocument = async p => { const value = await update(p); if (p.collectionId === 'review_coupons') { if (++entered === 2) release(); await barrier } return value }
  const replies = await Promise.all([h.call('create-cake', old), h.call('create-cake-order-v2', ordinary)])
  assert.equal(replies.filter(r => r.status === 200).length, 1)
  assert.equal(replies.find(r => r.status !== 200).body.code, 'PROMO_CODE_INVALID')
  assert.equal((await h.repository.list('claims')).length, 1)
  assert.equal([...h.sdk.docs.keys()].filter(k => k.startsWith('reservations/') || k.startsWith('custom_cake_snapshots/')).length, 1)
  assert.equal(h.sdk.docs.get('review_coupons/coupon-1').data.status, 'redeemed')
})

test('legacy coupon lost commit response reconciles existing receipt and shared claim without redemption twice', async () => {
  const h = await setup(), input = oldInput(); input.promoCode = 'JENNIETEST7'
  h.sdk.docs.set('manual_coupons/coupon-1', { revision: 1, data: { $id: 'coupon-1', codeHash: hashReviewCouponCode(input.promoCode, Buffer.alloc(32, 7)), codeLast4: 'EST7', rewardPercent: 5, scope: 'cake', status: 'active', expiresAt: '2026-11-01T00:00:00.000Z' } })
  h.sdk.uncertain = true
  const created = await h.call('create-cake', input)
  assert.equal(created.status, 200, JSON.stringify(created.body))
  assert.deepEqual((await h.call('create-cake', input)).body, created.body)
  assert.equal((await h.repository.list('claims')).length, 1)
  assert.equal(h.sdk.calls.filter(([verb, p]) => verb === 'update' && p.collectionId === 'manual_coupons').length, 1)
  assert.equal(h.sdk.docs.get('manual_coupons/coupon-1').data.redeemedReservationId, input.requestId)
})
