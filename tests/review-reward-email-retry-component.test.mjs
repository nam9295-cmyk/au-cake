import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const page = await readFile(new URL('../src/AdminReviewsPage.tsx', import.meta.url), 'utf8')
const control = await readFile(new URL('../src/ReviewRewardEmailRetry.tsx', import.meta.url), 'utf8').catch(() => '')

test('admin rewards retain copy and add only a local safe email retry control without coupon data', () => {
  assert.match(page, /<ReviewRewardEmailRetry reviewId=\{review\.id\}/)
  assert.match(page, /리워드 메시지 복사/)
  assert.match(control, /getReviewEmailStatus/)
  assert.match(control, /retryReviewEmail/)
  assert.match(control, /Retry email/)
  for (const forbidden of ['couponCode', 'codeCiphertext', 'token', 'providerMessageId', 'payloadHash', 'recipientHash']) {
    assert.doesNotMatch(control, new RegExp(forbidden))
  }
})
