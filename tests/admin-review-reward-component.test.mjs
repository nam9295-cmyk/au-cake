import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const page = await readFile(new URL('../src/AdminReviewsPage.tsx', import.meta.url), 'utf8')
const client = await readFile(new URL('../src/lib/admin-reviews.ts', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('admin card renders only a masked safe reward summary with Korean states and Sydney expiry', () => {
  for (const field of ['rewardCodeLast4', 'rewardStatus', 'rewardExpiresAt', 'rewardMessageAvailable']) {
    assert.match(page, new RegExp(`review\\.${field}`))
  }
  assert.match(page, /••••\{review\.rewardCodeLast4\}/)
  for (const label of ['사용 가능', '사용 완료', '만료', '취소', '확인 불가']) {
    assert.match(client, new RegExp(label))
  }
  assert.match(page, /formatAdminRewardExpiry\(review\.rewardExpiresAt\)/)
  for (const forbidden of ['review.couponId', 'review.codeHash', 'review.codeCiphertext', 'review.couponCode']) {
    assert.doesNotMatch(page, new RegExp(forbidden.replace('.', '\\.')))
  }
})

test('reward copy button is availability and in-flight gated with no reissue action', () => {
  assert.match(page, /리워드 메시지 복사/)
  assert.match(page, /disabled=\{[^}]*!review\.rewardMessageAvailable[^}]*\}/)
  assert.match(page, /copyReviewRewardMessage/)
  assert.match(page, /copyAdminRewardMessage/)
  assert.doesNotMatch(page, /재발급|reissue/i)
})

test('copy result stays in a local variable, is copied immediately, and announcements never render the message or code', () => {
  assert.match(page, /const \{ message \} = await copyReviewRewardMessage/)
  assert.match(page, /await copyAdminRewardMessage\(message\)/)
  assert.match(page, /리워드 메시지를 복사했습니다/)
  assert.match(page, /리워드 메시지를 복사하지 못했습니다/)
  assert.doesNotMatch(page, /set(?:Reward)?Message\s*\(/)
  assert.doesNotMatch(page, /<textarea[^>]*value=\{message\}/)
  assert.doesNotMatch(page, /console\.(?:log|info|warn|error)/)
})

test('demo copy is visibly not saved and uses only the memory-local helper', () => {
  assert.match(page, /buildDemoAdminRewardMessage/)
  assert.match(page, /DEMO, 저장되지 않음/)
  assert.doesNotMatch(page, /demo\.couponCode/)
})

test('reward copy and card controls remain mobile-safe at 320, 360, and 390 with 44px targets', () => {
  assert.match(css, /\.admin-review-reward-copy[\s\S]*min-height:\s*44px/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.admin-review-reward/)
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*\.admin-review-reward/)
})
