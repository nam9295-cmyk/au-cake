import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/ReviewInviteButton.tsx', import.meta.url), 'utf8')

test('review invite admin action keeps copy and makes email the primary action', () => {
  assert.match(source, /Send review email/)
  assert.match(source, /Copy review request/)
  assert.match(source, /sendReviewInviteEmail\(/)
  assert.match(source, /copyReviewInviteRequest\(/)
  assert.match(source, /getReviewInviteEmailStatus\(/)
  assert.doesNotMatch(source, /createReviewInvite\(/)
})

test('review invite button disables delivery for terminal or missing-email states while keeping copy explicit', () => {
  assert.match(source, /Email address is missing/)
  assert.match(source, /Review email sent/)
  assert.match(source, /Review email could not be sent/)
  assert.match(source, /Email delivery status is uncertain/)
  assert.match(source, /Existing review link cannot be recovered/)
  assert.match(source, /copyAdminRewardMessage\(copy\.message\)/)
})

test('review invite status loading follows the async query rather than synchronously setting state in its effect', () => {
  assert.doesNotMatch(source, /setLoadingStatus\(true\)/)
  assert.doesNotMatch(source, /setError\(''\)\n\s*getReviewInviteEmailStatus\(/)
})
