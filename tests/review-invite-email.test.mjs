import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { buildReviewInviteEmailPayload } from '../appwrite-functions/review-api/src/review-invite-email.js'

const from = 'Verygood Chocolate <hello@verygood.example>'
const token = 'A'.repeat(43)
const origin = 'https://au.verygood-chocolate.com'

function reservation(sourceType, overrides = {}) {
  return {
    $id: sourceType === 'cake' ? 'cake-123' : 'class-123',
    customerName: 'Jenny <b>\nFORGED',
    customerEmail: ' JENNY@example.com ',
    parentName: 'Pat <script>bad()</script>',
    parentEmail: ' PARENT@example.com ',
    childName: 'Private child',
    adminMemo: 'PRIVATE ADMIN MEMO',
    allergyNote: 'PRIVATE ALLERGY DETAIL',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    $databaseId: 'PRIVATE DATABASE ID',
    ...overrides,
  }
}

test('cake bilingual review invitation is Korean-first, escaped, recipient-safe, and ledger-identified', () => {
  const payload = buildReviewInviteEmailPayload({
    reservation: reservation('cake'), sourceType: 'cake', token, from, reviewOrigin: origin,
  })

  assert.equal(payload.subject, '[Verygood] 후기 부탁드려요 | We’d love your review')
  assert.deepEqual(payload.to, ['jenny@example.com'])
  assert.equal(payload.eventKey, 'review-invite-customer:cake:cake-123')
  assert.equal(payload.template, 'review-invite-customer')
  assert.equal(payload.templateVersion, 'review-invite-customer-cake-v1')
  assert.match(payload.idempotencyKey, /^verygood:[a-f0-9]{64}$/)
  assert.match(payload.text, /^\[한국어\]/)
  assert.ok(payload.text.indexOf('[한국어]') < payload.text.indexOf('[English]'))
  assert.match(payload.text, /좋았던 점이나 아쉬웠던 점 모두 솔직하게/)
  assert.match(payload.text, /텍스트 후기\n다음 케이크 주문 5% 할인 쿠폰/)
  assert.match(payload.text, /사진과 함께 남긴 후기\n다음 케이크 주문 10% 할인 쿠폰/)
  assert.match(payload.text, /개인 후기 링크는 발급일로부터 30일 동안 유효합니다/)
  assert.match(payload.text, /리워드 쿠폰도 발급일로부터 30일 동안 사용할 수 있습니다/)
  assert.match(payload.text, /Your personal review link is valid for 30 days/)
  assert.match(payload.text, /your reward coupon will be valid for 30 days from the date it is issued/i)
  assert.match(payload.text, /once on your next cake order/i)
  assert.match(payload.text, new RegExp(`${origin}/review#${token}`))
  assert.match(payload.html, /<hr[^>]*>/)
  assert.match(payload.html, /Jenny &lt;b&gt; FORGED/)
  assert.doesNotMatch(payload.html, /<script>bad\(\)<\/script>/)
  assert.equal(payload.html.indexOf('안녕하세요') < payload.html.indexOf('Thank you for choosing'), true)

  for (const forbidden of ['PRIVATE ADMIN MEMO', 'PRIVATE ALLERGY DETAIL', 'PRIVATE EMERGENCY CONTACT', 'PRIVATE DATABASE ID', 'Private child']) {
    assert.doesNotMatch(payload.text, new RegExp(forbidden))
    assert.doesNotMatch(payload.html, new RegExp(forbidden))
  }
  assert.doesNotMatch(payload.text, /^FORGED$/m)
  assert.match(payload.payloadHash, /^[a-f0-9]{64}$/)
  assert.match(payload.recipientHash, /^[a-f0-9]{64}$/)
})

test('class invitation reads only the stored parent email and rejects a client-independent invalid recipient', () => {
  const payload = buildReviewInviteEmailPayload({
    reservation: reservation('class'), sourceType: 'class', token, from, reviewOrigin: origin,
  })
  assert.deepEqual(payload.to, ['parent@example.com'])
  assert.equal(payload.eventKey, 'review-invite-customer:class:class-123')
  assert.match(payload.text, /Pat <script>bad\(\)<\/script>/)

  assert.throws(
    () => buildReviewInviteEmailPayload({
      reservation: reservation('class', { parentEmail: 'not-an-email' }), sourceType: 'class', token, from, reviewOrigin: origin,
    }),
    /INVALID_RECIPIENT_EMAIL/,
  )
})
