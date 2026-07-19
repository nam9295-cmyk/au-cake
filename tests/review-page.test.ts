import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  REVIEW_COPY,
  buildLoadReviewInvitePayload,
  buildSubmitReviewPayload,
  copyReviewCoupon,
  createReviewGenerationController,
  finishReviewOperation,
  extractReviewToken,
  formatCouponExpiry,
  formatExperienceDate,
  getReviewDocumentLanguage,
  getReviewSourceLabel,
  getStarAriaLabel,
  isReviewDemoMode,
  parseLoadReviewInviteResult,
  parseSubmitReviewResult,

  shouldLoadStoreSettings,
  tryBeginReviewOperation,
} from '../src/lib/review-page.js'
import { reviewDemoFixture, reviewDemoSubmission } from '../src/lib/review-page-demo.js'
import { getPageFromPath, pathForPage } from '../src/lib/app-routes.js'
import { getSeoConfig } from '../src/lib/seo.js'
import { loadReviewInvite, submitCustomerReview } from '../src/lib/review-repository.js'

const TOKEN = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

test('extractReviewToken accepts only an exact 43-character base64url fragment', () => {
  assert.equal(extractReviewToken(`#${TOKEN}`), TOKEN)
  assert.equal(extractReviewToken(`#${'a-b_C'.repeat(8)}abc`), 'a-b_C'.repeat(8) + 'abc')
  for (const fragment of ['', '#', `#${'A'.repeat(42)}`, `#${'A'.repeat(44)}`, `#${'A'.repeat(42)}=`, '#abc def', `#${'A'.repeat(42)}%`]) {
    assert.equal(extractReviewToken(fragment), null, fragment)
  }
})

test('review copy defaults to English and provides a Korean toggle without changing disclosure meaning', () => {
  assert.equal(REVIEW_COPY.en.languageName, '한국어')
  assert.equal(REVIEW_COPY.ko.languageName, 'English')
  assert.match(REVIEW_COPY.en.disclosure, /photo presence/i)
  assert.match(REVIEW_COPY.en.disclosure, /not.*rating/i)
  assert.match(REVIEW_COPY.en.disclosure, /positive or negative/i)
  assert.match(REVIEW_COPY.en.incentivisedNotice, /incentivised/i)
  assert.match(REVIEW_COPY.ko.disclosure, /사진 유무/)
  assert.match(REVIEW_COPY.ko.disclosure, /별점/)
  assert.match(REVIEW_COPY.en.copyError, /could not copy/i)
  assert.match(REVIEW_COPY.ko.copyError, /복사하지 못했습니다/)
  assert.match(REVIEW_COPY.en.submissionUncertain, /may have been received/i)
  assert.match(REVIEW_COPY.en.submissionUncertain, /retry/i)
})

test('review heading uses exact source-neutral copy for cake and class invitations', () => {
  assert.equal(REVIEW_COPY.en.title, 'Tell us how it went')
  assert.equal(REVIEW_COPY.ko.title, '어떠셨는지 들려주세요')
})

test('verified source context is derived from source type in the selected language', () => {
  assert.equal(getReviewSourceLabel('cake', 'en'), 'Verified cake order')
  assert.equal(getReviewSourceLabel('class', 'en'), 'Verified class booking')
  assert.equal(getReviewSourceLabel('cake', 'ko'), '확인된 케이크 주문')
  assert.equal(getReviewSourceLabel('class', 'ko'), '확인된 클래스 예약')
})

test('star aria labels are localized and grammatically correct', () => {
  assert.equal(getStarAriaLabel(1, 'en'), '1 star')
  assert.equal(getStarAriaLabel(2, 'en'), '2 stars')
  assert.equal(getStarAriaLabel(1, 'ko'), '별점 1점')
  assert.equal(getStarAriaLabel(5, 'ko'), '별점 5점')
})

test('review document language maps to a full locale tag', () => {
  assert.equal(getReviewDocumentLanguage('en'), 'en-AU')
  assert.equal(getReviewDocumentLanguage('ko'), 'ko-KR')
})

test('review generations reject a stale A response after token B starts and reject updates after disposal', async () => {
  const controller = createReviewGenerationController()
  const requestA = deferred<string>()
  const requestB = deferred<string>()
  const rendered: string[] = []
  const generationA = controller.begin(TOKEN)
  void requestA.promise.then((value) => controller.commit(generationA, () => rendered.push(value)))

  const generationB = controller.begin(TOKEN_B)
  void requestB.promise.then((value) => controller.commit(generationB, () => rendered.push(value)))
  requestB.resolve('B')
  await requestB.promise
  await Promise.resolve()
  requestA.resolve('A')
  await requestA.promise
  await Promise.resolve()

  assert.deepEqual(rendered, ['B'])
  assert.equal(generationB.token, TOKEN_B)
  controller.dispose()
  assert.equal(controller.commit(generationB, () => rendered.push('after unmount')), false)
  assert.deepEqual(rendered, ['B'])
})

test('submit and photo operation flags exclude deterministic same-tick races', () => {
  const submitting = { current: false }
  const photo = { current: false }
  assert.equal(tryBeginReviewOperation('photo', submitting, photo), true)
  assert.equal(photo.current, true)
  assert.equal(tryBeginReviewOperation('submit', submitting, photo), false)
  finishReviewOperation('photo', submitting, photo)
  assert.equal(tryBeginReviewOperation('submit', submitting, photo), true)
  assert.equal(submitting.current, true)
  assert.equal(tryBeginReviewOperation('photo', submitting, photo), false)
  finishReviewOperation('submit', submitting, photo)
  assert.deepEqual([submitting.current, photo.current], [false, false])
})

test('clipboard helper reports unsupported and rejected writes without claiming success', async () => {
  assert.equal(await copyReviewCoupon(undefined, 'FOXKIWI7Q2MK'), false)
  assert.equal(await copyReviewCoupon({ writeText: async () => { throw new Error('denied') } }, 'FOXKIWI7Q2MK'), false)
  let copied = ''
  assert.equal(await copyReviewCoupon({ writeText: async (value) => { copied = value } }, 'FOXKIWI7Q2MK'), true)
  assert.equal(copied, 'FOXKIWI7Q2MK')
})

test('store settings are not loaded for the private review page', () => {
  assert.equal(shouldLoadStoreSettings('review'), false)
  for (const page of ['home', 'reserve', 'calendar', 'admin']) {
    assert.equal(shouldLoadStoreSettings(page), true, page)
  }
})

test('review and generated review.html paths resolve to the focused review page while navigation stays canonical', () => {
  assert.equal(getPageFromPath('/review'), 'review')
  assert.equal(getPageFromPath('/review.html'), 'review')
  assert.equal(pathForPage('review'), '/review')
})

test('load payload contains only the action and exact raw token', () => {
  assert.deepEqual(buildLoadReviewInvitePayload(TOKEN), {
    action: 'load-invite',
    data: { token: TOKEN },
  })
})

test('submit payload allowlists review fields and contains no photo field', () => {
  const contaminated = {
    token: TOKEN,
    rating: 4,
    body: ' Honest feedback ',
    displayName: 'Alex',
    publishConsent: true,
    photoPublishConsent: true,
    website: '',
    photoFileId: 'untrusted-client-photo',
    rewardPercent: 10,
  }
  const payload = buildSubmitReviewPayload(contaminated)
  assert.deepEqual(payload, {
    action: 'submit-review',
    data: {
      token: TOKEN,
      review: {
        rating: 4,
        body: ' Honest feedback ',
        displayName: 'Alex',
        publishConsent: true,
        photoPublishConsent: true,
        website: '',
      },
    },
  })
  assert.equal('photoFileId' in payload.data.review, false)
  assert.equal('rewardPercent' in payload.data.review, false)
})

test('response parsers accept only allowlisted invite and coupon context', () => {
  assert.deepEqual(parseLoadReviewInviteResult({ sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01', hasPhoto: false, ignored: 'x' }), {
    sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01', hasPhoto: false,
  })
  assert.deepEqual(parseSubmitReviewResult({ reviewId: 'internal-review-id', rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: '2026-09-01T00:00:00.000Z', ignored: TOKEN }), {
    rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: '2026-09-01T00:00:00.000Z',
  })
  assert.throws(() => parseLoadReviewInviteResult({ sourceType: 'other', label: 'x', experienceDate: 'x' }))
  assert.throws(() => parseLoadReviewInviteResult({ sourceType: 'cake', label: 'x', experienceDate: '2026-02-30', hasPhoto: false }), /INVALID_REVIEW_RESPONSE/)
  assert.throws(() => parseLoadReviewInviteResult({ sourceType: 'cake', label: 'x', experienceDate: '2026-2-03', hasPhoto: false }), /INVALID_REVIEW_RESPONSE/)
  assert.throws(() => parseSubmitReviewResult({ reviewId: 'x', rewardPercent: 10, couponCode: '', couponExpiresAt: 'x' }))
})

test('submit response requires a valid ISO timestamp with a timezone and a matching coupon format', () => {
  const validBase = { reviewId: 'review-1', rewardPercent: 5 as const, couponCode: 'FOXKIWI7Q2MK' }
  for (const couponExpiresAt of [
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T10:15:30+10:00',
    '2026-09-01T10:15:30.123-04:30',
  ]) {
    assert.equal(parseSubmitReviewResult({ ...validBase, couponExpiresAt }).couponExpiresAt, couponExpiresAt)
  }

  for (const couponExpiresAt of [
    'not-a-date',
    '2026-02-30T00:00:00.000Z',
    '2026-09-01',
    '',
    123,
    null,
    undefined,
  ]) {
    assert.throws(
      () => parseSubmitReviewResult({ ...validBase, couponExpiresAt }),
      /INVALID_REVIEW_RESPONSE/,
      String(couponExpiresAt),
    )
  }

  assert.throws(() => parseSubmitReviewResult({ ...validBase, couponCode: 'SAVE-5', couponExpiresAt: '2026-09-01T00:00:00.000Z' }), /INVALID_REVIEW_RESPONSE/)
  assert.deepEqual(parseSubmitReviewResult({ ...validBase, rewardPercent: 10, couponExpiresAt: '2026-09-01T00:00:00.000Z' }), {
    rewardPercent: 10,
    couponCode: 'FOXKIWI7Q2MK',
    couponExpiresAt: '2026-09-01T00:00:00.000Z',
  })
  for (const couponCode of ['FOXKIWI7I', 'FOXKIWI0A', 'FOXKIWI7', 'FOXKIWI7Q2MKA', 'RATKIWI7Q', 'FOXORANGE7Q', 'CHOCOLATE', 'LEMONI']) {
    assert.throws(() => parseSubmitReviewResult({ ...validBase, couponCode, couponExpiresAt: '2026-09-01T00:00:00.000Z' }), /INVALID_REVIEW_RESPONSE/)
  }
})

test('coupon expiry formatter is localized to the Sydney calendar date and never throws for malformed runtime input', () => {
  assert.equal(formatCouponExpiry('2026-08-31T14:30:00.000Z', 'en'), '1 September 2026')
  assert.equal(formatCouponExpiry('2026-08-31T14:30:00.000Z', 'ko'), '2026년 9월 1일')
  assert.equal(formatCouponExpiry('invalid', 'en'), 'Expiry unavailable')
  assert.equal(formatCouponExpiry(undefined, 'ko'), '만료일 확인 불가')
})

test('experience date formatter accepts real Gregorian date-only values and stays on the Sydney calendar date', () => {
  assert.equal(formatExperienceDate('2026-09-01', 'en'), '1 September 2026')
  assert.equal(formatExperienceDate('2026-09-01', 'ko'), '2026년 9월 1일')
  assert.equal(formatExperienceDate('2026-02-30', 'en'), 'Date unavailable')
})

test('demo mode is explicit only and fixture remains in memory', () => {
  assert.equal(isReviewDemoMode('true'), true)
  assert.equal(isReviewDemoMode('TRUE'), false)
  assert.equal(isReviewDemoMode('1'), false)
  assert.equal(isReviewDemoMode(undefined), false)
  assert.deepEqual(reviewDemoFixture(), {
    sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01', hasPhoto: false,
  })
  assert.deepEqual(reviewDemoSubmission(), {
    rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: '2026-09-01T00:00:00.000Z',
  })
  assert.deepEqual(reviewDemoSubmission(true), {
    rewardPercent: 10, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: '2026-09-01T00:00:00.000Z',
  })
})

test('review SEO is noindex and nofollow', () => {
  const seo = getSeoConfig('/review')
  assert.equal(seo.noindex, true)
  assert.equal(seo.title, 'Share Your Review | Verygood Chocolate')
  const aliasSeo = getSeoConfig('/review.html')
  assert.equal(aliasSeo.noindex, true)
  assert.equal(aliasSeo.canonical, 'https://au.verygood-chocolate.com/review')
})

test('review repository sends exact Function payloads and parses successful results', async () => {
  const bodies: unknown[] = []
  const executor = {
    async createExecution(input: { functionId: string; body: string; async: false }) {
      bodies.push(JSON.parse(input.body))
      const action = (bodies.at(-1) as { action: string }).action
      return {
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({
          ok: true,
          result: action === 'load-invite'
            ? { sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01', hasPhoto: false }
            : { reviewId: 'r1', rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: '2026-09-01T00:00:00.000Z' },
        }),
      }
    },
  }
  await loadReviewInvite(executor, 'review-api', TOKEN)
  await submitCustomerReview(executor, 'review-api', {
    token: TOKEN, rating: 5, body: 'Great', displayName: '', publishConsent: false, photoPublishConsent: false, website: '',
  })
  assert.deepEqual(bodies, [
    buildLoadReviewInvitePayload(TOKEN),
    buildSubmitReviewPayload({ token: TOKEN, rating: 5, body: 'Great', displayName: '', publishConsent: false, photoPublishConsent: false, website: '' }),
  ])
})

test('review repository maps malformed coupon expiry responses to the stable generic response error', async () => {
  const executor = {
    async createExecution() {
      return {
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({
          ok: true,
          result: { reviewId: 'r1', rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK', couponExpiresAt: 'tomorrow' },
        }),
      }
    },
  }
  await assert.rejects(
    submitCustomerReview(executor, 'review-api', {
      token: TOKEN, rating: 5, body: 'Great', displayName: '', publishConsent: false, photoPublishConsent: false, website: '',
    }),
    (error: unknown) => (error as { code?: unknown }).code === 'REVIEW_INVITE_REQUEST_FAILED',
  )
})
