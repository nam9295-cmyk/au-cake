import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  ADMIN_REVIEW_INVITE_ALREADY_USED_MESSAGE,
  ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE,
  buildReviewLink,
  buildReviewRequestMessage,
  canCreateReviewInvite,
  firstNameFromFullName,
  reviewInviteErrorMessage,
} from '../src/lib/review-messages.js'
import {
  ReviewInviteApiError,
  buildCreateReviewInvitePayload,
  createReviewInvite,
  parseReviewInviteExecution,
} from '../src/lib/review-repository.js'

const cakeMessage = `Hi Jenny!

Thanks so much for ordering with us! We hope you enjoyed every single bite.
We'd love to know how everything turned out.

Leave us an honest review and get 5% off your next order — or make it 10% off if you add a photo or two!

https://au.verygood-chocolate.com/review#cake-token

Your unique code will be valid for 30 days once issued!

-very good chocolate team-`

const classMessage = `Hi Alex!

Thanks so much for ordering with us! We hope you enjoyed every single bite.
We'd love to know how everything turned out.

Leave us an honest review and get 5% off your next order — or make it 10% off if you add a photo or two!

https://au.verygood-chocolate.com/review#class-token

Your unique code will be valid for 30 days once issued!

-very good chocolate team-`

test('cake review request matches Jenny’s exact full-string contract', () => {
  assert.equal(buildReviewRequestMessage('cake', '  Jenny Kim  ', 'cake-token'), cakeMessage)
})

test('class review request uses the same exact full-string contract', () => {
  assert.equal(buildReviewRequestMessage('class', 'Alex Morgan', 'class-token'), classMessage)
})

test('review links use an encoded fragment and canonical production origin by default', () => {
  assert.equal(
    buildReviewLink('token /?#%한글'),
    'https://au.verygood-chocolate.com/review#token%20%2F%3F%23%25%ED%95%9C%EA%B8%80',
  )
  assert.equal(
    buildReviewLink('preview token', 'http://localhost:4173/'),
    'http://localhost:4173/review#preview%20token',
  )
})

test('first name is trimmed to the first whitespace token and falls back to there', () => {
  assert.equal(firstNameFromFullName('  Jenny   Kim '), 'Jenny')
  assert.equal(firstNameFromFullName('\tAlex\nMorgan'), 'Alex')
  assert.equal(firstNameFromFullName('   '), 'there')
})

test('review invites are available only for exact completed cake and class statuses', () => {
  assert.equal(canCreateReviewInvite('cake', '픽업완료'), true)
  assert.equal(canCreateReviewInvite('class', 'Completed'), true)
  for (const status of ['예약신청', '예약확정', '취소', 'Requested', 'Confirmed', 'Cancelled', 'completed', '']) {
    assert.equal(canCreateReviewInvite('cake', status), false)
    assert.equal(canCreateReviewInvite('class', status), false)
  }
})

test('create-invite payload allowlists only exact action and source identifiers', () => {
  const contaminated = {
    sourceType: 'cake' as const,
    sourceReservationId: 'reservation-1',
    customerName: 'Private person',
    token: 'must-not-flow',
    phone: '0412345678',
  }
  assert.deepEqual(buildCreateReviewInvitePayload(contaminated), {
    action: 'create-invite',
    data: { sourceType: 'cake', sourceReservationId: 'reservation-1' },
  })
})

test('review invite execution parser returns only a stable token and expiry', () => {
  assert.deepEqual(parseReviewInviteExecution({
    status: 'completed',
    responseStatusCode: 200,
    responseBody: JSON.stringify({
      ok: true,
      result: { token: 'raw-token', expiresAt: '2026-08-18T00:00:00.000Z', internal: 'drop-me' },
      extra: 'drop-me',
    }),
  }), { token: 'raw-token', expiresAt: '2026-08-18T00:00:00.000Z' })
})

test('review invite execution parser exposes only stable API error codes', () => {
  assert.throws(
    () => parseReviewInviteExecution({
      status: 'failed',
      responseStatusCode: 409,
      responseBody: JSON.stringify({ ok: false, code: 'REVIEW_ALREADY_SUBMITTED', detail: 'private' }),
    }),
    (error) => error instanceof ReviewInviteApiError && error.code === 'REVIEW_ALREADY_SUBMITTED',
  )
  for (const execution of [
    { status: 'failed', responseStatusCode: 500, responseBody: '<html>private upstream output</html>' },
    { status: 'completed', responseStatusCode: 200, responseBody: '{bad json' },
    { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: { token: '', expiresAt: '' } }) },
  ]) {
    assert.throws(
      () => parseReviewInviteExecution(execution),
      (error) => error instanceof ReviewInviteApiError && error.code === 'REVIEW_INVITE_REQUEST_FAILED',
    )
  }
})

test('createReviewInvite executes one synchronous authenticated SDK request with allowlisted body', async () => {
  const calls: unknown[] = []
  const sdk = {
    async createExecution(input: unknown) {
      calls.push(input)
      return {
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({ ok: true, result: { token: 'secret-token', expiresAt: '2026-08-18T00:00:00.000Z' } }),
      }
    },
  }
  assert.deepEqual(await createReviewInvite(sdk, 'review-api', {
    sourceType: 'class',
    sourceReservationId: 'class-1',
  }), { token: 'secret-token', expiresAt: '2026-08-18T00:00:00.000Z' })
  assert.deepEqual(calls, [{
    functionId: 'review-api',
    body: JSON.stringify({ action: 'create-invite', data: { sourceType: 'class', sourceReservationId: 'class-1' } }),
    async: false,
  }])
})

test('admin error copy distinguishes already-used review links without leaking other errors', () => {
  assert.equal(
    reviewInviteErrorMessage(new ReviewInviteApiError('REVIEW_ALREADY_SUBMITTED')),
    ADMIN_REVIEW_INVITE_ALREADY_USED_MESSAGE,
  )
  assert.equal(reviewInviteErrorMessage(new ReviewInviteApiError('INTERNAL_ERROR')), ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE)
  assert.equal(reviewInviteErrorMessage(new Error('customer private detail')), ADMIN_REVIEW_INVITE_GENERIC_ERROR_MESSAGE)
})
