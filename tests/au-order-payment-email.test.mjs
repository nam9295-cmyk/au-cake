import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { buildBookingDeliveryPayload, buildBookingConfirmationPayload, createReservationNotificationHandler, deliverBookingEmail } from '../appwrite-functions/reservation-notification/src/main.js'
import { decideEmailDelivery } from '../appwrite-functions/shared/email-delivery.js'
import { buildRenewalOrderData } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'

const FROM = 'Verygood <mail@example.invalid>'
const SUBJECTS = {
  received: '[Verygood] Order Received: Payment Required 🍫 | 주문이 접수되었습니다! 결제를 진행해 주세요',
  confirmed: '[Verygood] Payment Received: Booking Confirmed 🍫 | 결제가 확인되었습니다! 예약이 최종 확정되었습니다',
}
const base = {
  $id: 'au-payment-test', reservationNumber: 'VG-C-AU-TEST', customerName: 'Alice Full Name',
  customerEmail: 'alice@example.invalid', customerPhone: '0412345678', productId: 'pave-cake',
  cakeSize: '6in', chocolateType: 'dark', quantity: 2, totalPriceCents: 12345, totalPrice: 999,
  pickupDate: '2026-10-31', pickupTime: '', status: '예약확정', paymentStatus: '입금확인',
  adminMemo: 'PRIVATE ADMIN MEMO', emergencyContact: 'PRIVATE EMERGENCY', $databaseId: 'PRIVATE DATABASE',
}
const receipt = (reservation = base, env = {}) => buildBookingDeliveryPayload({ reservation, role: 'customer', from: FROM, env })
const confirmation = (reservation = base, env = {}) => buildBookingConfirmationPayload({ reservation, sourceType: 'cake', from: FROM, env })

for (const [kind, build] of [['received', receipt], ['confirmed', confirmation]]) {
  test(`AU ${kind} uses approved English-first copy, dynamic cents, pickup and send-only contact`, () => {
    const p = build()
    assert.equal(p.subject, SUBJECTS[kind])
    for (const body of [p.text, p.html]) {
      assert.ok(body.indexOf('[English]') < body.indexOf('[한국어]'))
      assert.match(body, /AUD 123\.45/)
      assert.doesNotMatch(body, /AUD 999|36\.50|PRIVATE ADMIN|PRIVATE EMERGENCY|PRIVATE DATABASE|0412345678/)
      assert.match(body, /To be arranged/)
      assert.match(body, /시간 미정/)
      assert.match(body, /1 Bundil Blvd, Melrose Park/)
      assert.match(body, /small playground/)
      assert.match(body, /작은 놀이터/)
      assert.match(body, /https:\/\/maps.app.goo.gl\/bSVbF8M5BCdxJeDRA\?g_st=iw/)
      assert.match(body, /0421 567 776/)
      assert.match(body, /\+61 421 567 776/)
      assert.match(body, /@verygood_syd/)
      assert.match(body, /This is a send-only email; replies are not monitored/)
      assert.match(body, /본 메일은 발송 전용으로 회신을 확인하지 않습니다/)
      assert.doesNotMatch(body, /screenshot|payment receipt|영수증|캡처|wait for our instructions|No payment is taken now/i)
    }
    for (const style of ['#5b2417', '#fbf6ef', '#e8ded5']) assert.ok(p.html.includes(style))
    assert.match(p.html, /max-width:\s*640px/)
    assert.match(p.html, /href="https:\/\/maps.app.goo.gl\/bSVbF8M5BCdxJeDRA\?g_st=iw"/)
    if (kind === 'received') {
      for (const body of [p.text, p.html]) {
        for (const text of ['PayID: 0421 567 776', 'BSB: 012263', 'Account: 324999682', 'Name: JEONGMIN CHEON', 'Payment reference: Alice Full Name', '송금 메모 / Reference: Alice Full Name', 'one payment only', 'Booking Confirmed email', '입금 확인 후']) assert.ok(body.includes(text), text)
      }
    } else {
      for (const body of [p.text, p.html]) {
        assert.match(body, /Your payment has been received and checked, and your booking is now confirmed/)
        assert.match(body, /No further payment is required/)
        assert.match(body, /추가 결제는 필요하지 않습니다/)
        assert.doesNotMatch(body, /PayID|BSB|324999682|Amount due|Please complete your payment|송금 메모/)
      }
    }
  })
}

test('AU renderer keeps canonical mixed-flavour boxes, multi-line quantities and stored discount audit', () => {
  const counts = values => ({ strawberry: 0, green_grape: 0, mandarin: 0, banana: 0, butter_redbean: 0, nama_chocolate: 0, ...values })
  const row = buildRenewalOrderData({
    contractVersion: 'au-renewal.2026-10.v2', customerName: base.customerName, customerEmail: base.customerEmail,
    customerPhone: base.customerPhone, pickupDate: '2026-10-23', pickupTime: '09:00', privacyConsent: true,
    orderLines: [
      { lineId: 'cake', offerId: 'pave-cake', size: '6in', quantity: 1 },
      { lineId: 'mochi', offerId: 'mochi', mode: 'gift-four', flavourCounts: counts({ strawberry: 1, green_grape: 1, banana: 1, nama_chocolate: 1 }), quantity: 2 },
    ],
  }, { now: new Date('2026-10-20T00:00:00Z'), reservationNumber: base.reservationNumber, reviewCoupon: { id: 'coupon', rewardPercent: 5, codeLast4: 'TEST' }, renewalPolicy: { preordersEnabled: true } })
  row.$id = base.$id
  const original = JSON.stringify(row)
  for (const build of [receipt, confirmation]) {
    const p = build(row)
    for (const body of [p.text, p.html]) {
      assert.match(body, /4-piece gift box ×2 \(8 pieces\)/)
      assert.match(body, /Each box: Strawberry ×1 \/ Green Grape ×1 \/ Banana ×1 \/ Original ×1/)
      assert.match(body, /Pavé Whole Cake/)
      assert.ok(body.includes(`AUD ${(row.totalPriceCents / 100).toFixed(2)}`))
      assert.ok(body.includes(`AUD ${(row.discountCents / 100).toFixed(2)}`))
      assert.match(body, /Discount|할인/)
      assert.match(body, /5%/)
      assert.doesNotMatch(body, /gift-four|rewardPercent|coupon|codeLast4/)
    }
  }
  assert.equal(JSON.stringify(row), original)
})

test('AU payment email escapes dynamic fields and retains legacy item options', () => {
  for (const build of [receipt, confirmation]) {
    const p = build({ ...base, customerName: 'Alice <b>\nFull', requestNote: 'Note\nTotal: AUD 0.00 <script>bad()</script>', pickupTime: '13:00', productId: 'vanilla-fresh-cream-cake', vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry' })
    assert.match(p.html, /Alice &lt;b&gt; Full/)
    assert.doesNotMatch(p.html, /<script>|<b>/)
    assert.doesNotMatch(p.text, /^Total: AUD 0.00$/m)
    assert.match(p.text, /Vanilla cake sheet/)
    assert.match(p.text, /Triple berry/)
    assert.match(p.text, /13:00 — Sydney time/)
    assert.match(p.text, /13:00 — 시드니 시간/)
  }
})

test('configured market overrides reservation number for payment renderer on direct and event paths', async () => {
  for (const build of [receipt, confirmation]) {
    assert.equal(build({ ...base, reservationNumber: 'VG-C-KR-TEST' }, { MARKET: 'AU' }).subject, SUBJECTS[build === receipt ? 'received' : 'confirmed'])
    assert.doesNotMatch(build(base, { MARKET: 'KR' }).text, /PayID|Payment checked|Amount due|No further payment/)
    assert.equal(build({ ...base, reservationNumber: 'VG-C-KR-TEST' }, { VITE_MARKET: 'AU' }).subject, SUBJECTS[build === receipt ? 'received' : 'confirmed'])
  }
  const sent = []
  const handle = createReservationNotificationHandler({
    env: { MARKET: 'AU', RESEND_API_KEY: 'fake', RESEND_FROM_EMAIL: FROM, RESEND_TO_EMAILS: 'owner@example.invalid' },
    createLedgerRepository: () => ({
      async getOrCreatePending(identity) { return { kind: 'created', delivery: { ...identity, $id: 'delivery', attempts: 0 } } },
      async markAttempt(row) { return row }, async markSent(row) { return row },
    }),
    createTransport: () => ({ async send(payload) { sent.push(payload); return { kind: 'accepted', providerMessageId: 'test' } } }),
  })
  await handle({ req: { bodyJson: { ...base, reservationNumber: 'VG-C-KR-TEST' } }, res: { json: value => value } })
  assert.equal(sent.find(p => p.template === 'booking-received-customer').subject, SUBJECTS.received)
})

test('both new templates suppress historical sent identities without modifying or resetting the ledger', async () => {
  for (const build of [receipt, confirmation]) {
    const payload = build()
    const old = { ...payload, payloadHash: '0'.repeat(64), status: 'sent', attempts: 1, sentAt: '2026-10-20T00:00:00Z' }
    const original = structuredClone(old)
    let providerCalls = 0
    let claimedIdentity
    const result = await deliverBookingEmail({
      payload,
      repository: { async getOrCreatePending(identity, now) {
        claimedIdentity = identity
        return { kind: 'existing', delivery: old, decision: decideEmailDelivery(old, identity, now) }
      } },
      transport: { async send() { providerCalls++; throw new Error('HISTORICAL_RESEND') } },
    })
    assert.ok(['already_sent', 'identity_mismatch'].includes(result.status), result.status)
    assert.equal(claimedIdentity.eventKey, old.eventKey)
    assert.equal(claimedIdentity.recipientHash, old.recipientHash)
    assert.equal(payload.idempotencyKey, old.idempotencyKey)
    assert.equal(providerCalls, 0)
    assert.deepEqual(old, original)
  }
})

// Fixed pre-change payload digests prove out-of-scope content is byte-compatible.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
test('KR cake and AU class receipt and confirmation payloads remain byte-compatible', () => {
  const fixtures = [
    ['cake', { $id: 'baseline', reservationNumber: 'VG-C-KR-TEST', customerEmail: 'test@example.invalid', customerName: 'Test', productId: 'pave-cake', quantity: 1, totalPrice: 50000 }, ['f9edabfa5aea8ec85b3b0a20df08d6f30f62cea898e56582df781b474c88667a', 'e1252dcb0a09f29abae8fc2e1e6f23c1b42139d8674f2b0504033235fba09e99']],
    ['class', { $id: 'baseline', reservationNumber: 'VG-KC-AU-TEST', parentEmail: 'test@example.invalid', parentName: 'Test', childName: 'Child', classType: 'school-holiday-private-cake-class', totalPriceCents: 9900 }, ['257f864a5bf457dd6be48bc764b9856e286d93f2d856785d8afd59ebecf1cf8d', '6c799078ae4998a726e6093296626468aec8770013751b363d171863b7a55ba3']],
  ]
  for (const [sourceType, reservation, hashes] of fixtures) {
    assert.deepEqual([
      buildBookingDeliveryPayload({ reservation, from: FROM, role: 'customer', env: {} }),
      buildBookingConfirmationPayload({ reservation, from: FROM, sourceType, env: {} }),
    ].map(digest), hashes)
  }
})
