import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  adminRewardStatusLabel,
  buildCopyReviewRewardMessagePayload,

  copyAdminRewardMessage,
  copyReviewRewardMessage,
  formatAdminRewardExpiry,
  parseAdminReviewResult,
  parseCopyReviewRewardMessageResult,
  type AdminReview,
} from '../src/lib/admin-reviews.js'
import { adminReviewDemoFixtures, buildDemoAdminRewardMessage } from '../src/lib/admin-reviews-demo.js'

const active: AdminReview = {
  id: 'review-active',
  sourceType: 'cake',
  rating: 5,
  body: 'Wonderful cake',
  displayName: 'Amelia',
  hasPhoto: false,
  photoPublishConsent: false,
  publishConsent: true,
  moderationStatus: 'pending',
  rewardPercent: 10,
  rewardCodeLast4: 'Q2MK',
  rewardStatus: 'active',
  rewardExpiresAt: '2026-09-17T00:00:00.000Z',
  rewardMessageAvailable: true,
  createdAt: '2026-07-18T01:00:00.000Z',
  updatedAt: '2026-07-18T01:00:00.000Z',
}

const message = 'Thank you for sharing your review with Very Good Chocolate.\nYour 10% cake reward code is FOXKIWI7Q2MK.\nIt can be used once on your next cake order until 17 September 2026.'

test('reward DTO parser accepts only exact safe summary fields and never accepts coupon internals', () => {
  assert.deepEqual(parseAdminReviewResult(active), active)
  for (const invalid of [
    { ...active, rewardCodeLast4: 'bad!' },
    { ...active, rewardCodeLast4: null, rewardStatus: 'active' },
    { ...active, rewardStatus: 'pending' },
    { ...active, rewardExpiresAt: '2026-09-17' },
    { ...active, rewardMessageAvailable: 'true' },
    { ...active, rewardExpiresAt: '2020-01-01T00:00:00.000Z' },
    { ...active, rewardStatus: 'redeemed', rewardMessageAvailable: true },
    { ...active, couponId: 'coupon-private' },
    { ...active, codeHash: 'private-hash' },
    { ...active, codeCiphertext: 'private-envelope' },
    { ...active, couponCode: 'FOXKIWI7Q2MK' },
  ]) assert.throws(() => parseAdminReviewResult(invalid))
  assert.equal(parseAdminReviewResult({ ...active, rewardMessageAvailable: false }).rewardMessageAvailable, false)
  assert.deepEqual(parseAdminReviewResult({
    ...active,
    rewardCodeLast4: null,
    rewardStatus: 'unavailable',
    rewardExpiresAt: null,
    rewardMessageAvailable: false,
  }).rewardStatus, 'unavailable')
})

test('copy request and response use exact minimal contracts', () => {
  assert.deepEqual(buildCopyReviewRewardMessagePayload(active.id), {
    action: 'copy-review-reward-message',
    data: { reviewId: active.id },
  })
  assert.deepEqual(parseCopyReviewRewardMessageResult({ message }), { message })
  for (const invalid of [
    null,
    {},
    { message: '' },
    { message: 'bad\0message' },
    { message, couponCode: 'FOXKIWI7Q2MK' },
    { message, rewardPercent: 10 },
  ]) assert.throws(() => parseCopyReviewRewardMessageResult(invalid))
})

test('copy repository sends the exact action and returns only the parsed message', async () => {
  const calls: unknown[] = []
  const executor = {
    async createExecution(input: unknown) {
      calls.push(input)
      return {
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({ ok: true, result: { message } }),
      }
    },
  }
  assert.deepEqual(await copyReviewRewardMessage(executor, 'review-api', active.id), { message })
  assert.deepEqual(calls, [{
    functionId: 'review-api',
    body: JSON.stringify(buildCopyReviewRewardMessagePayload(active.id)),
    async: false,
  }])
})

test('clipboard uses the native API when available without creating DOM content', async () => {
  const writes: string[] = []
  const documentLike = { createElement() { throw new Error('fallback must not render') } }
  await copyAdminRewardMessage(message, {
    clipboard: { async writeText(value: string) { writes.push(value) } },
    document: documentLike,
  })
  assert.deepEqual(writes, [message])
})

test('clipboard fallback creates one ephemeral textarea and always removes it immediately', async () => {
  const events: string[] = []
  const textarea = {
    value: '',
    style: {} as Record<string, string>,
    setAttribute(name: string, value: string) { events.push(`attribute:${name}:${value}`) },
    select() { events.push('select') },
    remove() { events.push('remove') },
  }
  const documentLike = {
    body: { appendChild(node: unknown) { assert.equal(node, textarea); events.push('append') } },
    createElement(tag: string) { assert.equal(tag, 'textarea'); events.push('create'); return textarea },
    execCommand(command: string) { events.push(`exec:${command}`); return true },
  }
  await copyAdminRewardMessage(message, { clipboard: undefined, document: documentLike })
  assert.equal(textarea.value, message)
  assert.deepEqual(events, [
    'create', 'attribute:readonly:', 'append', 'select', 'exec:copy', 'remove',
  ])
})

test('clipboard fallback removes the textarea and fails generically when copying is denied', async () => {
  let removed = false
  const textarea = {
    value: '', style: {}, setAttribute() {}, select() {}, remove() { removed = true },
  }
  await assert.rejects(() => copyAdminRewardMessage(message, {
    clipboard: undefined,
    document: {
      body: { appendChild() {} }, createElement() { return textarea }, execCommand() { return false },
    },
  }), /ADMIN_REWARD_COPY_FAILED/)
  assert.equal(removed, true)
})

test('reward state labels and Sydney expiry are admin-safe Korean copy', () => {
  assert.deepEqual([
    adminRewardStatusLabel('active'),
    adminRewardStatusLabel('redeemed'),
    adminRewardStatusLabel('expired'),
    adminRewardStatusLabel('revoked'),
    adminRewardStatusLabel('unavailable'),
  ], ['사용 가능', '사용 완료', '만료', '취소', '확인 불가'])
  assert.equal(formatAdminRewardExpiry('2026-09-17T00:00:00.000Z'), '2026년 9월 17일')
  assert.equal(formatAdminRewardExpiry(null), '확인 불가')
})

test('demo keeps only a safe summary in DTOs and creates its fake code only inside the local copy helper', () => {
  const fixtures = adminReviewDemoFixtures(true, true)
  const demo = fixtures.find((review) => review.rewardMessageAvailable)
  assert.ok(demo)
  const serialized = JSON.stringify(fixtures)
  assert.equal(serialized.includes('FOXKIWI7Q2MK'), false)
  assert.equal(serialized.includes('couponCode'), false)
  assert.deepEqual(Object.keys(demo).sort(), Object.keys(active).sort())
  const demoMessage = buildDemoAdminRewardMessage(demo.id)
  assert.match(demoMessage, /^DEMO — not saved\./)
  assert.match(demoMessage, /Your (?:5|10)% cake reward code is [A-Z2-9]+\./)
  assert.equal(JSON.stringify(demo).includes(demoMessage), false)
  assert.throws(() => buildDemoAdminRewardMessage('unknown-review'), /ADMIN_REWARD_COPY_FAILED/)
})
