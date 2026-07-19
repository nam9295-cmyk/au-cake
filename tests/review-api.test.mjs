import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  REVIEW_COUPON_ANIMALS,
  REVIEW_COUPON_FRUITS,
  ReviewApiError,
  addSydneyCalendarDays,
  assertReviewAdmin,
  generateCoupon,
  generateReviewToken,
  getPublicReview,
  hashSecret,
  issueReviewInvite,
  listAdminReviews,
  listPublicReviewPage,
  listPublicReviews,
  loadReviewInvite,
  moderateReview,
  submitReview as submitReviewCore,
  toPublicReview,
  validateReviewInput,
} from '../functions/review-api/src/business.js'
import {
  createPublicReviewPhotoUrlBuilder,
  createReviewRepository,
  handleReviewRequest,
  parseRequestBody,
  resolveReviewConfig,
  safeActionForLog,
} from '../functions/review-api/src/main.js'
import { digestReviewCouponCode, resolveReviewCouponHmacSecret } from '../functions/review-api/src/coupon-digest.js'
import { decryptReviewCouponCode } from '../functions/review-api/src/coupon-envelope.js'

const hmacSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const encryptionKeyEncoded = 'ERERERERERERERERERERERERERERERERERERERERERE'
const encryptionKey = Buffer.from(encryptionKeyEncoded, 'base64url')

function submitReview(repository, token, input, options = {}) {
  return submitReviewCore(repository, token, input, { hmacSecret, encryptionKey, ...options })
}

function assertReviewError(code, callback) {
  assert.throws(callback, (error) => error instanceof ReviewApiError && error.code === code)
}

test('review input accepts and trims the public fields only', () => {
  const value = validateReviewInput({
    rating: 5,
    body: '  Excellent cake  ',
    displayName: '  Jenny  ',
    publishConsent: true,
    photoPublishConsent: true,
    website: '',
    acceptedPhotoFileId: 'client-forged-photo',
    hasPhoto: true,
  })
  assert.deepEqual(value, {
    rating: 5,
    body: 'Excellent cake',
    displayName: 'Jenny',
    publishConsent: true,
    photoPublishConsent: true,
  })
})

test('review input rejects invalid rating, body, display name, consent and honeypot', () => {
  for (const rating of [0, 6, 1.5, '5']) {
    assertReviewError('INVALID_REVIEW_RATING', () => validateReviewInput({ rating, body: 'ok', publishConsent: true }))
  }
  for (const body of ['', '   ', 'x'.repeat(2001)]) {
    assertReviewError('INVALID_REVIEW_BODY', () => validateReviewInput({ rating: 5, body, publishConsent: true }))
  }
  assertReviewError('INVALID_DISPLAY_NAME', () => validateReviewInput({ rating: 5, body: 'ok', displayName: 'x'.repeat(51), publishConsent: true }))
  assertReviewError('INVALID_PUBLISH_CONSENT', () => validateReviewInput({ rating: 5, body: 'ok', publishConsent: 'true' }))
  assertReviewError('INVALID_PHOTO_PUBLISH_CONSENT', () => validateReviewInput({ rating: 5, body: 'ok', publishConsent: true, photoPublishConsent: 'true' }))
  assertReviewError('INVALID_REQUEST', () => validateReviewInput({ rating: 5, body: 'ok', publishConsent: true, website: 'bot' }))
})

test('review honeypot accepts only omitted, null, or empty strings without coercion', () => {
  for (const website of [undefined, null, '']) {
    const input = { rating: 5, body: 'ok', publishConsent: true }
    if (website !== undefined) input.website = website
    assert.equal(validateReviewInput(input).body, 'ok')
  }
  for (const website of [123, {}, [], true, false, ' ', 'bot']) {
    assertReviewError('INVALID_REQUEST', () => validateReviewInput({
      rating: 5, body: 'ok', publishConsent: true, website,
    }))
  }
})

test('review tokens are 32 random URL-safe bytes and only their SHA-256 hash is stable', () => {
  const first = generateReviewToken()
  const second = generateReviewToken()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
  assert.match(hashSecret(first), /^[a-f0-9]{64}$/)
  assert.equal(hashSecret(first), hashSecret(first))
  assert.notEqual(hashSecret(first), hashSecret(second))
})

test('review coupon HMAC secret fails closed and matches the reservation digest vector', () => {
  assert.equal(resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: hmacSecret }, ReviewApiError).length, 32)
  assert.equal(
    digestReviewCouponCode('FOXKIWI7Q2MK', hmacSecret),
    'c8a232bbb8cddb5d96a8d8858218241b65bc41772d88529c6b8b97d69f15850b',
  )
  for (const value of [undefined, '', 'short', 'A'.repeat(42), `${'A'.repeat(43)}=`, ` ${hmacSecret}`, `${hmacSecret} `]) {
    assertReviewError('FUNCTION_CONFIGURATION_ERROR', () =>
      resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: value }, ReviewApiError))
  }
})

test('Sydney calendar-day helper preserves local wall time across DST boundaries', () => {
  assert.equal(addSydneyCalendarDays(new Date('2026-10-03T15:30:00.000Z'), 30).toISOString(), '2026-11-02T14:30:00.000Z')
  assert.equal(addSydneyCalendarDays(new Date('2027-03-20T14:30:00.000Z'), 60).toISOString(), '2027-05-19T15:30:00.000Z')
  assert.equal(addSydneyCalendarDays(new Date('2026-09-03T16:30:00.000Z'), 30).toISOString(), '2026-10-03T16:30:00.000Z')
  assert.equal(addSydneyCalendarDays(new Date('2026-08-04T16:30:00.000Z'), 60).toISOString(), '2026-10-03T16:30:00.000Z')
  assert.throws(() => addSydneyCalendarDays(new Date('invalid'), 30), RangeError)
})

test('review Function config fails closed on missing, blank, invalid, or Vite-only database ids', () => {
  const valid = {
    APPWRITE_CAKE_DATABASE_ID: 'cake_db',
    APPWRITE_KIDS_DATABASE_ID: 'kids.db',
  }
  for (const env of [
    { APPWRITE_KIDS_DATABASE_ID: 'kids_db' },
    { APPWRITE_CAKE_DATABASE_ID: 'cake_db' },
    { ...valid, APPWRITE_CAKE_DATABASE_ID: '   ' },
    { ...valid, APPWRITE_KIDS_DATABASE_ID: 'bad/id' },
    { VITE_APPWRITE_CAKE_DATABASE_ID: 'cake_db', VITE_APPWRITE_KIDS_DATABASE_ID: 'kids_db' },
  ]) {
    assertReviewError('FUNCTION_CONFIGURATION_ERROR', () => resolveReviewConfig(env))
  }
})

test('review Function config accepts explicit same databases, trims ids, and preserves distinct routing', async () => {
  const same = resolveReviewConfig({
    APPWRITE_CAKE_DATABASE_ID: ' same_db ',
    APPWRITE_KIDS_DATABASE_ID: 'same_db',
  })
  assert.equal(same.cakeDatabaseId, 'same_db')
  assert.equal(same.classDatabaseId, 'same_db')

  const config = resolveReviewConfig({
    APPWRITE_CAKE_DATABASE_ID: 'cake_db',
    APPWRITE_KIDS_DATABASE_ID: 'kids_db',
  })
  const calls = []
  const repository = createReviewRepository({
    async getDocument(params) { calls.push(params); return { $id: params.documentId } },
  }, config)
  await repository.getSource('cake', 'cake-1')
  await repository.getSource('class', 'class-1')
  assert.deepEqual(calls.map(({ databaseId }) => databaseId), ['cake_db', 'kids_db'])
})

test('review Function config validates explicit resource ids and retains valid original defaults', () => {
  const base = { APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' }
  const config = resolveReviewConfig(base)
  assert.equal(config.cakeReservationsId, 'reservations')
  assert.equal(config.reviewInvitesId, 'review_invites')
  for (const env of [
    { ...base, APPWRITE_REVIEWS_TABLE_ID: '   ' },
    { ...base, APPWRITE_REVIEW_INVITES_TABLE_ID: '.invalid' },
    { ...base, APPWRITE_REVIEW_COUPONS_TABLE_ID: 'bad/id' },
    { ...base, APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'x'.repeat(37) },
  ]) {
    assertReviewError('FUNCTION_CONFIGURATION_ERROR', () => resolveReviewConfig(env))
  }
})

test('review repository public query exactly matches the public_reviews_idx contract', async () => {
  const calls = []
  const config = resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' })
  const repository = createReviewRepository({
    async listDocuments(params) { calls.push(params); return { documents: [] } },
  }, config)
  await repository.listPublishedReviews({ limit: 7, cursor: 'review-prev' })
  const queries = calls[0].queries.map((query) => JSON.parse(query))
  assert.deepEqual(queries.slice(0, 3), [
    { method: 'equal', attribute: 'moderationStatus', values: ['published'] },
    { method: 'equal', attribute: 'publishConsent', values: [true] },
    { method: 'orderDesc', attribute: 'createdAt' },
  ])
  assert.deepEqual(queries.slice(-2), [
    { method: 'limit', values: [7] },
    { method: 'cursorAfter', values: ['review-prev'] },
  ])
})

test('review repository admin query uses bounded limit and exact document cursor', async () => {
  const calls = []
  const config = resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' })
  const repository = createReviewRepository({
    async listDocuments(params) { calls.push(params); return { documents: [] } },
  }, config)
  await repository.listReviews({ cursor: 'review-prev', limit: 100, moderationStatus: 'pending' })
  assert.deepEqual(calls[0].queries.map((query) => JSON.parse(query)), [
    { method: 'equal', attribute: 'moderationStatus', values: ['pending'] },
    { method: 'orderDesc', attribute: 'createdAt' },
    { method: 'limit', values: [100] },
    { method: 'cursorAfter', values: ['review-prev'] },
  ])
})

test('review repository passes transaction ids to invite reads and mutations with exact SDK shapes', async () => {
  const calls = []
  const databases = {
    async listDocuments(params) { calls.push(['list', params]); return { documents: [] } },
    async createDocument(params) { calls.push(['create', params]); return {} },
    async updateDocument(params) { calls.push(['update', params]); return {} },
  }
  const config = resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' })
  const repository = createReviewRepository(databases, config)
  const tx = { $id: 'tx-atomic' }
  await repository.findInviteBySource('cake', 'cake-1', tx)
  await repository.findReviewBySource('cake', 'cake-1', tx)
  await repository.createInvite({ tokenHash: 'hash' }, tx, 'invite-fixed')
  await repository.updateInvite('invite-fixed', { tokenHash: 'new-hash' }, tx)
  assert.equal(calls.every(([, params]) => params.transactionId === 'tx-atomic'), true)
  assert.equal(calls[2][1].documentId, 'invite-fixed')
  assert.equal(calls[3][1].documentId, 'invite-fixed')
})

test('cleanup repository create is idempotent and conflict update preserves original createdAt', async () => {
  const calls = []
  const conflict = Object.assign(new Error('duplicate cleanup file'), { code: 409 })
  const databases = {
    async createDocument(params) { calls.push(['create', params]); throw conflict },
    async updateDocument(params) { calls.push(['update', params]); return params.data },
  }
  const config = resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' })
  await createReviewRepository(databases, config).enqueuePhotoCleanup({
    fileId: 'private-file', inviteId: 'invite-1', reason: 'replacement', status: 'pending', attempts: 3,
    createdAt: '2026-07-19T00:00:00.000Z', updatedAt: '2026-07-19T00:01:00.000Z',
  })
  assert.equal(calls[0][1].documentId, 'private-file')
  assert.deepEqual(calls[1][1].data, {
    fileId: 'private-file', inviteId: 'invite-1', reason: 'replacement', status: 'pending', attempts: 3,
    updatedAt: '2026-07-19T00:01:00.000Z',
  })
})

test('cleanup repository query includes staging and pending work but excludes failed dead letters', async () => {
  const calls = []
  const config = resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' })
  const repository = createReviewRepository({
    async listDocuments(params) { calls.push(params); return { documents: [] } },
  }, config)

  await repository.listPhotoCleanup(100)

  assert.equal(calls[0].collectionId, 'review_photo_cleanup')
  assert.deepEqual(calls[0].queries.map((query) => JSON.parse(query)), [
    { method: 'equal', attribute: 'status', values: ['staging', 'pending'] },
    { method: 'orderAsc', attribute: 'createdAt' },
    { method: 'limit', values: [25] },
  ])
})

test('coupon uses curated animal and fruit tokens plus exactly five unbiased unambiguous suffix characters', () => {
  const bytes = [255, 0, 255, 0, 29, 14, 24, 11, 9]
  let calls = 0
  const randomBytes = (length) => {
    assert.equal(length, 1)
    calls += 1
    return Buffer.from([bytes.shift()])
  }
  const coupon = generateCoupon(10, hmacSecret, { randomBytes })
  assert.equal(coupon.code, 'FOXKIWI7Q2MK')
  assert.equal(calls, 9, '255 must be rejected for both non-power-of-two token lists')
  assert.match(coupon.code, /^[A-Z]+[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
  const animal = REVIEW_COUPON_ANIMALS.find((token) => coupon.code.startsWith(token))
  const fruit = REVIEW_COUPON_FRUITS.find((token) => coupon.code.slice(animal.length, -5) === token)
  assert.equal(animal, 'FOX')
  assert.equal(fruit, 'KIWI')
  assert.deepEqual(coupon.persisted, {
    codeHash: digestReviewCouponCode(coupon.code, hmacSecret),
    codeLast4: 'Q2MK',
  })
  assert.equal(JSON.stringify(coupon.persisted).includes(coupon.code), false)
  assertReviewError('INVALID_REWARD_PERCENT', () => generateCoupon(7))
})

test('curated coupon vocabulary is recognizable, uppercase, max thirteen characters, and cannot collide with static promos', () => {
  assert.deepEqual(REVIEW_COUPON_ANIMALS.slice(0, 3), ['FOX', 'CAT', 'DOG'])
  assert.equal(REVIEW_COUPON_FRUITS[0], 'KIWI')
  assert.equal(new Set(REVIEW_COUPON_ANIMALS).size, REVIEW_COUPON_ANIMALS.length)
  assert.equal(new Set(REVIEW_COUPON_FRUITS).size, REVIEW_COUPON_FRUITS.length)
  for (const animal of REVIEW_COUPON_ANIMALS) {
    assert.match(animal, /^[A-Z]{3}$/)
    for (const fruit of REVIEW_COUPON_FRUITS) {
      const code = `${animal}${fruit}AAAAA`
      assert.ok(code.length <= 13, code)
      assert.notEqual(code, 'CHOCOLATE')
      assert.notEqual(code, 'LEMONI')
    }
  }
  for (const fruit of REVIEW_COUPON_FRUITS) assert.match(fruit, /^[A-Z]{3,5}$/)
})

test('five and ten percent rewards use the same coupon shape without encoding the reward', () => {
  const deterministic = () => {
    const bytes = [0, 0, 29, 14, 24, 11, 9]
    return () => Buffer.from([bytes.shift()])
  }
  const five = generateCoupon(5, hmacSecret, { randomBytes: deterministic() })
  const ten = generateCoupon(10, hmacSecret, { randomBytes: deterministic() })
  assert.equal(five.code, 'FOXKIWI7Q2MK')
  assert.equal(ten.code, five.code)
  assert.equal(five.persisted.codeHash, ten.persisted.codeHash)
  assert.equal(JSON.stringify(five.persisted).includes(five.code), false)
  assert.equal(JSON.stringify(ten.persisted).includes(ten.code), false)
})

test('public review projection enforces publication and allowlists fields', () => {
  const contaminated = {
    $id: 'review-1', sourceType: 'cake', rating: 5, body: 'Great', displayName: '', photoUrl: null,
    publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-19T00:00:00.000Z',
    sourceReservationId: 'reservation-1', sourceReservationNumber: 'VG-PRIVATE', couponId: 'coupon-1',
    customerName: 'Private', phone: '0412345678', email: 'private@example.com', childName: 'Private child',
  }
  assert.deepEqual(toPublicReview(contaminated), {
    id: 'review-1',
    sourceType: 'cake', rating: 5, body: 'Great', displayName: 'Verified cake order',
    hasPhoto: false, thumbnailUrl: null, photoUrl: null,
    createdAt: '2026-07-19T00:00:00.000Z', incentivised: true,
  })
  assert.equal(toPublicReview({
    ...contaminated,
    photoUrl: 'https://appwrite.example/v1/storage/private-photo',
    photoPublishConsent: false,
  }).photoUrl, null)
  assert.deepEqual(toPublicReview({
    ...contaminated,
    photoUrl: 'https://appwrite.example/v1/storage/public-photo',
    photoPublishConsent: true,
    photoFileId: 'private-file-id',
  }, () => ({
    thumbnailUrl: 'https://appwrite.example/v1/storage/buckets/review-photos/files/private-file-id/preview?project=project_au&width=640&height=480&gravity=center&quality=78&output=webp',
    photoUrl: 'https://appwrite.example/v1/storage/buckets/review-photos/files/private-file-id/view?project=project_au',
  })), {
    id: 'review-1',
    sourceType: 'cake', rating: 5, body: 'Great', displayName: 'Verified cake order',
    hasPhoto: true,
    thumbnailUrl: 'https://appwrite.example/v1/storage/buckets/review-photos/files/private-file-id/preview?project=project_au&width=640&height=480&gravity=center&quality=78&output=webp',
    photoUrl: 'https://appwrite.example/v1/storage/buckets/review-photos/files/private-file-id/view?project=project_au',
    createdAt: '2026-07-19T00:00:00.000Z', incentivised: true,
  })
  assertReviewError('REVIEW_NOT_PUBLIC', () => toPublicReview({ ...contaminated, publishConsent: false }))
  assertReviewError('REVIEW_NOT_PUBLIC', () => toPublicReview({ ...contaminated, moderationStatus: 'pending' }))
})

test('public review photo URLs use only the configured HTTPS Appwrite endpoint and project', () => {
  const builder = createPublicReviewPhotoUrlBuilder({
    APPWRITE_PUBLIC_ENDPOINT: 'https://api.example.test/v1',
    APPWRITE_FUNCTION_PROJECT_ID: 'project_au',
  }, { reviewPhotosBucketId: 'review-photos' })
  assert.deepEqual(builder({ photoFileId: 'approved-photo' }), {
    thumbnailUrl: 'https://api.example.test/v1/storage/buckets/review-photos/files/approved-photo/preview?project=project_au&width=640&height=480&gravity=center&quality=78&output=webp',
    photoUrl: 'https://api.example.test/v1/storage/buckets/review-photos/files/approved-photo/view?project=project_au',
  })
  assert.throws(() => createPublicReviewPhotoUrlBuilder({
    APPWRITE_PUBLIC_ENDPOINT: 'http://api.example.test/v1',
    APPWRITE_FUNCTION_PROJECT_ID: 'project_au',
  }, { reviewPhotosBucketId: 'review-photos' }), /FUNCTION_CONFIGURATION_ERROR/)
})

test('public review list supports a six-item cursor page with deterministic lookahead', async () => {
  const reviews = [
    { $id: 'b', sourceType: 'class', rating: 4, body: 'B', publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-18T00:00:00.000Z' },
    { $id: 'c', sourceType: 'cake', rating: 5, body: 'C', publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-19T00:00:00.000Z' },
    { $id: 'a', sourceType: 'cake', rating: 5, body: 'A', publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-19T00:00:00.000Z' },
    { $id: 'd', sourceType: 'cake', rating: 5, body: 'D', publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-17T00:00:00.000Z' },
  ]
  const calls = []
  const repository = { async listPublishedReviews(options) { calls.push(options); return reviews } }
  const result = await listPublicReviewPage(repository, 3, { cursor: 'review-prev' })
  assert.deepEqual(result.reviews.map((review) => review.body), ['A', 'C', 'B'])
  assert.equal(result.hasMore, true)
  assert.equal(result.nextCursor, 'b')
  assert.deepEqual(calls, [{ limit: 4, cursor: 'review-prev' }])
  await assert.rejects(() => listPublicReviewPage(repository, 7), (error) => error instanceof ReviewApiError && error.code === 'INVALID_REQUEST')
  await assert.rejects(() => listPublicReviewPage(repository, 3, { cursor: 'bad/id' }), (error) => error instanceof ReviewApiError && error.code === 'INVALID_REQUEST')
  for (const cursor of [null, 123, ['review-prev'], { id: 'review-prev' }]) {
    await assert.rejects(() => listPublicReviewPage(repository, 3, { cursor }), (error) => error instanceof ReviewApiError && error.code === 'INVALID_REQUEST')
  }
})

test('public review lookup returns only a published consented DTO and hides every other state', async () => {
  const published = { $id: 'review-public', sourceType: 'cake', rating: 5, body: 'Public', publishConsent: true, moderationStatus: 'published', createdAt: '2026-07-19T00:00:00.000Z' }
  const reads = []
  const repository = { async getReview(id) { reads.push(id); return id === 'review-public' ? published : null } }
  assert.equal((await getPublicReview(repository, 'review-public')).id, 'review-public')
  assert.equal(await getPublicReview(repository, 'review-missing'), null)
  const hiddenRepository = { async getReview() { return { ...published, moderationStatus: 'hidden' } } }
  assert.equal(await getPublicReview(hiddenRepository, 'review-hidden'), null)
  await assert.rejects(() => getPublicReview(repository, 123), (error) => error instanceof ReviewApiError && error.code === 'INVALID_REQUEST')
  assert.deepEqual(reads, ['review-public', 'review-missing'])
})

const fixedNow = new Date('2026-07-19T00:00:00.000Z')
const VALID_TOKEN = 'A'.repeat(43)
const OLD_TOKEN = 'B'.repeat(43)
const NEW_TOKEN = 'C'.repeat(43)
const completedCake = {
  $id: 'cake-1', reservationNumber: 'VG-C-PRIVATE', status: '픽업완료', pickupDate: '2026-07-18',
  customerName: 'Private', customerPhone: '0412345678',
}
const completedClass = {
  $id: 'class-1', reservationNumber: 'VG-KC-PRIVATE', status: 'Completed', classDate: '2026-07-17',
  parentName: 'Private', parentEmail: 'private@example.com', childName: 'Private child',
}

function makeRepository(overrides = {}) {
  const calls = []
  return {
    calls,
    async getSource(sourceType, id) {
      calls.push(['getSource', sourceType, id])
      if (id === 'missing') return null
      return sourceType === 'cake' ? completedCake : completedClass
    },
    async createInvite(data) { calls.push(['createInvite', data]); return { $id: 'invite-1', ...data } },
    async findInviteBySource(sourceType, sourceReservationId) {
      calls.push(['findInviteBySource', sourceType, sourceReservationId])
      return overrides.existingInvite || null
    },
    async updateInvite(id, data, transaction) { calls.push(['updateInvite', id, data, transaction]); return { $id: id, ...data } },
    async getInvite(id) {
      calls.push(['getInvite', id])
      if (overrides.refetchError) throw overrides.refetchError
      return overrides.refetchedInvite ?? overrides.existingInvite ?? null
    },
    async enqueuePhotoCleanup(data, transaction) { calls.push(['enqueueCleanup', data, transaction]) },
    async deletePhotoCleanup(id, transaction) { calls.push(['deleteCleanup', id, transaction]) },
    async findReviewBySource(sourceType, sourceReservationId) {
      calls.push(['findReviewBySource', sourceType, sourceReservationId])
      return overrides.existingReview || null
    },
    async findInviteByTokenHash(tokenHash, transaction) {
      calls.push(['findInvite', tokenHash, transaction])
      return overrides.invite === null ? null : (overrides.invite || {
        $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1',
        sourceReservationNumber: 'VG-C-PRIVATE', tokenHash, expiresAt: '2026-08-18T00:00:00.000Z',
      })
    },
    async beginTransaction() { calls.push(['begin']); return { id: 'tx-1' } },
    async createReview(data, tx) { calls.push(['createReview', data, tx]); if (overrides.createReviewError) throw overrides.createReviewError; return { $id: 'review-1', ...data } },
    async createCoupon(data, tx) { calls.push(['createCoupon', data, tx]); if (overrides.createCouponError) throw overrides.createCouponError; return { $id: 'coupon-1', ...data } },
    async markInviteUsed(id, usedAt, tx) { calls.push(['markInviteUsed', id, usedAt, tx]) },
    async commitTransaction(tx) { calls.push(['commit', tx]); if (overrides.commitError) throw overrides.commitError },
    async rollbackTransaction(tx) { calls.push(['rollback', tx]) },
    async listPublishedReviews(options) { calls.push(['listPublishedReviews', options]); return overrides.reviews || [] },
    async listReviews(options) { calls.push(['listReviews', options]); return overrides.reviews || [] },
    async getReview() { return overrides.review || null },
    async getCoupon() { return overrides.coupon || null },
    async updateReview(id, data) { calls.push(['updateReview', id, data]); return { $id: id, ...(overrides.review || {}), ...data } },
  }
}

function makeStatefulAtomicRepository(initialInvite, expectedCommits = 2) {
  const state = { invite: structuredClone(initialInvite), review: null, coupon: null, version: 0 }
  const transactions = new Map()
  let nextTransaction = 0
  let commitsArrived = 0
  let releaseCommits
  const commitsReady = new Promise((resolve) => {
    releaseCommits = resolve
    setTimeout(resolve, 50)
  })
  const conflict = () => Object.assign(new Error('transaction conflict'), { code: 409 })
  const view = (transaction) => transaction ? transactions.get(transaction.id).snapshot : state

  return {
    state,
    async getSource(sourceType, id) { return sourceType === 'cake' ? { ...completedCake, $id: id } : { ...completedClass, $id: id } },
    async beginTransaction() {
      const transaction = { id: `tx-${++nextTransaction}` }
      transactions.set(transaction.id, { baseVersion: state.version, snapshot: structuredClone(state), operations: [] })
      return transaction
    },
    async findInviteBySource(sourceType, sourceReservationId, transaction) {
      const invite = view(transaction).invite
      return invite?.sourceType === sourceType && invite.sourceReservationId === sourceReservationId ? structuredClone(invite) : null
    },
    async findReviewBySource(sourceType, sourceReservationId, transaction) {
      const review = view(transaction).review
      return review?.sourceType === sourceType && review.sourceReservationId === sourceReservationId ? structuredClone(review) : null
    },
    async findInviteByTokenHash(tokenHash, transaction) {
      const invite = view(transaction).invite
      return invite?.tokenHash === tokenHash ? structuredClone(invite) : null
    },
    async createInvite(data, transaction) {
      assert.ok(transaction, 'createInvite must be transactional')
      const tx = transactions.get(transaction.id)
      tx.snapshot.invite = { $id: 'invite-1', ...data }
      tx.operations.push(() => { state.invite = structuredClone(tx.snapshot.invite) })
    },
    async updateInvite(id, data, transaction) {
      assert.ok(transaction, 'updateInvite must be transactional')
      const tx = transactions.get(transaction.id)
      tx.snapshot.invite = { ...tx.snapshot.invite, ...data, $id: id }
      tx.operations.push(() => { state.invite = structuredClone(tx.snapshot.invite) })
    },
    async createReview(data, transaction, id) {
      const tx = transactions.get(transaction.id)
      tx.snapshot.review = { $id: id, ...data }
      tx.operations.push(() => { state.review = structuredClone(tx.snapshot.review) })
    },
    async createCoupon(data, transaction, id) {
      const tx = transactions.get(transaction.id)
      tx.snapshot.coupon = { $id: id, ...data }
      tx.operations.push(() => { state.coupon = structuredClone(tx.snapshot.coupon) })
    },
    async markInviteUsed(id, usedAt, transaction) {
      const tx = transactions.get(transaction.id)
      tx.snapshot.invite = { ...tx.snapshot.invite, $id: id, usedAt }
      tx.operations.push(() => { state.invite = structuredClone(tx.snapshot.invite) })
    },
    async commitTransaction(transaction) {
      commitsArrived += 1
      if (commitsArrived === expectedCommits) releaseCommits()
      await commitsReady
      const tx = transactions.get(transaction.id)
      if (tx.baseVersion !== state.version) throw conflict()
      for (const operation of tx.operations) operation()
      state.version += 1
    },
    async rollbackTransaction() {},
  }
}

test('concurrent invite rotations return exactly one link and persist its matching hash', async () => {
  const repository = makeStatefulAtomicRepository({
    $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1',
    tokenHash: hashSecret('old-token'), expiresAt: '2026-08-01T00:00:00.000Z',
  })
  const options = (token) => ({ now: fixedNow, hmacSecret, tokenFactory: () => token, isConflict: (error) => error.code === 409 })
  const results = await Promise.allSettled([
    issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, options('rotation-a')),
    issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, options('rotation-b')),
  ])
  const successes = results.filter(({ status }) => status === 'fulfilled')
  const failures = results.filter(({ status }) => status === 'rejected')
  assert.equal(successes.length, 1)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].reason.code, 'REVIEW_INVITE_CHANGED')
  assert.equal(repository.state.invite.tokenHash, hashSecret(successes[0].value.token))
})

test('concurrent invite rotation and submit produce only one terminal state', async () => {
  const repository = makeStatefulAtomicRepository({
    $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1', sourceReservationNumber: 'VG-C-PRIVATE',
    tokenHash: hashSecret(OLD_TOKEN), expiresAt: '2026-08-01T00:00:00.000Z',
  })
  const results = await Promise.allSettled([
    issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
      now: fixedNow, hmacSecret, tokenFactory: () => NEW_TOKEN, isConflict: (error) => error.code === 409,
    }),
    submitReview(repository, OLD_TOKEN, { rating: 5, body: 'Great', publishConsent: true }, {
      now: fixedNow, hmacSecret, isConflict: (error) => error.code === 409,
      idFactory: (() => { let index = 0; return () => ['review-race', 'coupon-race'][index++] })(),
    }),
  ])
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  const loser = results.find(({ status }) => status === 'rejected').reason
  assert.ok(['REVIEW_INVITE_CHANGED', 'REVIEW_ALREADY_SUBMITTED'].includes(loser.code))
  assert.equal(Boolean(repository.state.coupon), Boolean(repository.state.review))
  assert.notEqual(Boolean(repository.state.coupon), repository.state.invite.tokenHash === hashSecret(NEW_TOKEN))
})

test('admin authorization uses exact REVIEW_ADMIN_USER_IDS matches', () => {
  const env = { REVIEW_ADMIN_USER_IDS: 'admin-1, admin-2' }
  assert.equal(assertReviewAdmin({ 'x-appwrite-user-id': 'admin-2' }, env), 'admin-2')
  for (const userId of ['', 'admin', ' admin-2 ', 'ADMIN-2']) {
    assertReviewError('REVIEW_ADMIN_UNAUTHORIZED', () => assertReviewAdmin({ 'x-appwrite-user-id': userId }, env))
  }
})

test('invite issuance verifies cake and class completion and persists hash only', async () => {
  for (const [sourceType, sourceReservationId] of [['cake', 'cake-1'], ['class', 'class-1']]) {
    const repository = makeRepository()
    const result = await issueReviewInvite(repository, { sourceType, sourceReservationId }, { now: fixedNow, hmacSecret, createdByUserId: 'admin-1' })
    assert.match(result.token, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(result.expiresAt, '2026-08-18T00:00:00.000Z')
    const persisted = repository.calls.find(([name]) => name === 'createInvite')[1]
    assert.equal(persisted.tokenHash, hashSecret(result.token))
    assert.equal(JSON.stringify(persisted).includes(result.token), false)
    assert.equal(persisted.sourceReservationNumber, sourceType === 'cake' ? 'VG-C-PRIVATE' : 'VG-KC-PRIVATE')
  }
})

test('invite issuance hides missing, invalid and incomplete sources behind one error', async () => {
  for (const input of [
    { sourceType: 'other', sourceReservationId: 'cake-1' },
    { sourceType: 'cake', sourceReservationId: 'missing' },
  ]) {
    await assert.rejects(() => issueReviewInvite(makeRepository(), input, { now: fixedNow, hmacSecret, createdByUserId: 'admin-1' }),
      (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SOURCE_NOT_COMPLETED')
  }
  const repository = makeRepository()
  repository.getSource = async () => ({ ...completedCake, status: '예약확정' })
  await assert.rejects(() => issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, { now: fixedNow, hmacSecret, createdByUserId: 'admin-1' }),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SOURCE_NOT_COMPLETED')
})

test('invite issuance rotates an existing unused invite in place without persisting the raw token', async () => {
  const oldToken = 'old-token'
  const repository = makeRepository({ existingInvite: {
    $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
    tokenHash: hashSecret(oldToken), expiresAt: '2026-07-20T00:00:00.000Z',
  } })
  const result = await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, createdByUserId: 'admin-1', tokenFactory: () => 'new-token',
  })
  assert.deepEqual(result, { token: 'new-token', expiresAt: '2026-08-18T00:00:00.000Z' })
  assert.equal(repository.calls.some(([name]) => name === 'createInvite'), false)
  const update = repository.calls.find(([name]) => name === 'updateInvite')
  assert.equal(update[1], 'invite-existing')
  assert.equal(update[2].tokenHash, hashSecret('new-token'))
  assert.equal(update[2].expiresAt, '2026-08-18T00:00:00.000Z')
  assert.equal(JSON.stringify(update[2]).includes('new-token'), false)
})

test('invite issuance rejects used invites and sources with submitted reviews', async () => {
  for (const overrides of [
    { existingInvite: { $id: 'invite-1', usedAt: fixedNow.toISOString() } },
    { existingInvite: { $id: 'invite-1' }, existingReview: { $id: 'review-1' } },
  ]) {
    const repository = makeRepository(overrides)
    await assert.rejects(() => issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, { now: fixedNow, hmacSecret }),
      (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ALREADY_SUBMITTED')
    assert.equal(repository.calls.some(([name]) => ['createInvite', 'updateInvite'].includes(name)), false)
  }
})

test('invite transaction conflict does not rotate again or invalidate the winning invite', async () => {
  const conflict = Object.assign(new Error('unique conflict'), { code: 409 })
  const repository = makeRepository()
  let sourceQueries = 0
  repository.findInviteBySource = async (sourceType, sourceReservationId) => {
    repository.calls.push(['findInviteBySource', sourceType, sourceReservationId])
    sourceQueries += 1
    return sourceQueries === 1 ? null : { $id: 'concurrent-invite' }
  }
  repository.createInvite = async (data) => { repository.calls.push(['createInvite', data]); throw conflict }
  let generated = 0
  await assert.rejects(() => issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow,
    tokenFactory: () => { generated += 1; return 'losing-token' },
    isConflict: (error) => error.code === 409,
  }), (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_CHANGED')
  assert.equal(sourceQueries, 2)
  assert.equal(generated, 1)
  assert.equal(repository.calls.some(([name]) => name === 'updateInvite'), false)
})

test('invite transaction conflict with an empty exact requery returns a stable changed error', async () => {
  const conflict = Object.assign(new Error('unique conflict'), { code: 409 })
  const repository = makeRepository()
  repository.createInvite = async () => { throw conflict }
  await assert.rejects(() => issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, isConflict: (error) => error.code === 409,
  }), (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_CHANGED')
})

test('rotating an invite invalidates the old token and makes only the new token valid', async () => {
  const state = { $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1', tokenHash: hashSecret(OLD_TOKEN), expiresAt: '2026-08-01T00:00:00.000Z' }
  const repository = makeRepository()
  repository.findInviteBySource = async () => state
  repository.findReviewBySource = async () => null
  repository.updateInvite = async (_id, data) => Object.assign(state, data)
  repository.findInviteByTokenHash = async (tokenHash) => state.tokenHash === tokenHash ? state : null
  await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN,
  })
  await assert.rejects(() => loadReviewInvite(repository, OLD_TOKEN, { now: fixedNow, hmacSecret }),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_INVALID')
  assert.equal((await loadReviewInvite(repository, NEW_TOKEN, { now: fixedNow, hmacSecret })).sourceType, 'cake')
})

test('load invite verifies hash, expiry and unused state and exposes generic context only', async () => {
  const repository = makeRepository()
  const token = VALID_TOKEN
  const result = await loadReviewInvite(repository, token, { now: fixedNow, hmacSecret })
  assert.deepEqual(result, { sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-18', hasPhoto: false })
  assert.equal(JSON.stringify(result).includes('VG-C-PRIVATE'), false)
  assert.equal(JSON.stringify(result).includes('Private'), false)

  for (const invite of [
    null,
    { $id: 'invite-1', tokenHash: hashSecret(token), expiresAt: fixedNow.toISOString(), sourceType: 'cake', sourceReservationId: 'cake-1' },
    { $id: 'invite-1', tokenHash: hashSecret(token), expiresAt: '2026-08-01T00:00:00.000Z', usedAt: fixedNow.toISOString(), sourceType: 'cake', sourceReservationId: 'cake-1' },
    { $id: 'invite-1', tokenHash: hashSecret('different'), expiresAt: '2026-08-01T00:00:00.000Z', sourceType: 'cake', sourceReservationId: 'cake-1' },
  ]) {
    await assert.rejects(() => loadReviewInvite(makeRepository({ invite }), token, { now: fixedNow, hmacSecret }),
      (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_INVALID')
  }
})

test('load exposes only a pending-photo boolean and never its private file id', async () => {
  const repository = makeRepository({ invite: {
    $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1',
    tokenHash: hashSecret(VALID_TOKEN), expiresAt: '2026-08-18T00:00:00.000Z',
    pendingPhotoFileId: 'private-pending-file',
  } })
  const result = await loadReviewInvite(repository, VALID_TOKEN, { now: fixedNow, hmacSecret })
  assert.equal(result.hasPhoto, true)
  assert.equal(JSON.stringify(result).includes('private-pending-file'), false)
  assert.equal('photoFileId' in result, false)
})

test('load and submit reject malformed invite tokens before repository access', async () => {
  const malformedTokens = [
    undefined,
    '',
    'A'.repeat(42),
    'A'.repeat(44),
    `${'A'.repeat(42)}=`,
    `${'A'.repeat(42)}?`,
    `token=${'A'.repeat(37)}`,
    `${'A'.repeat(42)}한`,
  ]
  for (const token of malformedTokens) {
    for (const invoke of [
      (repository) => loadReviewInvite(repository, token, { now: fixedNow, hmacSecret }),
      (repository) => submitReview(repository, token, { rating: 5, body: 'Great', publishConsent: true }, { now: fixedNow, hmacSecret }),
    ]) {
      const repository = makeRepository()
      await assert.rejects(() => invoke(repository),
        (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_INVALID')
      assert.deepEqual(repository.calls, [], String(token))
    }
  }
})

test('coupon issuance requires distinct HMAC and encryption keys before repository access', async () => {
  for (const options of [
    { now: fixedNow, encryptionKey },
    { now: fixedNow, hmacSecret },
    { now: fixedNow, hmacSecret, encryptionKey: Buffer.from(hmacSecret, 'base64url') },
  ]) {
    const repository = makeRepository()
    await assert.rejects(
      () => submitReviewCore(repository, VALID_TOKEN, { rating: 5, body: 'Great', publishConsent: true }, options),
      (error) => error instanceof ReviewApiError && error.code === 'FUNCTION_CONFIGURATION_ERROR',
    )
    assert.deepEqual(repository.calls, [])
  }
})

test('atomic submit derives the photo only from its transaction invite read and returns 10 percent', async () => {
  const repository = makeRepository({ invite: {
    $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1', sourceReservationNumber: 'VG-C-PRIVATE',
    tokenHash: hashSecret(VALID_TOKEN), expiresAt: '2026-08-18T00:00:00.000Z',
    pendingPhotoFileId: 'trusted-photo-id',
  } })
  const result = await submitReview(repository, VALID_TOKEN, {
    rating: 5, body: ' Great ', displayName: ' Jenny ', publishConsent: true,
    photoPublishConsent: true, acceptedPhotoFileId: 'forged-client-id', photoFileId: 'forged-too', hasPhoto: false,
  }, { now: fixedNow, hmacSecret, acceptedPhotoFileId: 'ignored-option', idFactory: (() => { let index = 0; return () => ['review-1', 'coupon-1'][index++] })() })
  assert.match(result.couponCode, /^(?:FOX|CAT|DOG|OWL|PIG|BEE|COW|CUB|EMU|HEN|KOI|PUP|RAM|YAK|APE)(?:KIWI|FIG|LIME|PEAR|PLUM|APPLE|GRAPE|GUAVA|LEMON|MANGO|MELON|PEACH)[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
  assert.equal(result.rewardPercent, 10)
  const reviewData = repository.calls.find(([name]) => name === 'createReview')[1]
  const couponData = repository.calls.find(([name]) => name === 'createCoupon')[1]
  assert.equal(reviewData.photoFileId, 'trusted-photo-id')
  assert.equal(reviewData.photoPublishConsent, true)
  assert.equal(reviewData.rewardPercent, 10)
  assert.equal(reviewData.couponId, 'coupon-1')
  assert.equal(couponData.codeHash, digestReviewCouponCode(result.couponCode, hmacSecret))
  assert.equal(couponData.codeLast4, result.couponCode.slice(-4))
  assert.equal(couponData.scope, 'cake')
  assert.equal(couponData.status, 'active')
  assert.equal(couponData.expiresAt, '2026-09-17T00:00:00.000Z')
  assert.equal(couponData.codeEncryptionVersion, 1)
  assert.deepEqual(Object.keys(couponData).sort(), [
    'codeAuthTag',
    'codeCiphertext',
    'codeEncryptionVersion',
    'codeHash',
    'codeIv',
    'codeLast4',
    'createdAt',
    'expiresAt',
    'rewardPercent',
    'scope',
    'sourceReviewId',
    'status',
  ])
  assert.equal(decryptReviewCouponCode({
    envelope: couponData,
    couponId: 'coupon-1',
    reviewId: 'review-1',
    key: encryptionKey,
  }), result.couponCode)
  assert.equal(JSON.stringify(couponData).includes(result.couponCode), false)
  assert.deepEqual(repository.calls.filter(([name]) => ['commit', 'rollback'].includes(name)).map(([name]) => name), ['commit'])
})

test('submit reconciles a committed review after the commit response is lost before returning its coupon', async () => {
  const repository = makeRepository({ commitError: new Error('transport lost') })
  let inviteReads = 0
  repository.findInviteByTokenHash = async (tokenHash, transaction) => {
    repository.calls.push(['findInvite', tokenHash, transaction])
    inviteReads += 1
    return {
      $id: 'invite-1', sourceType: 'cake', sourceReservationId: 'cake-1', sourceReservationNumber: 'VG-C-PRIVATE',
      tokenHash, expiresAt: '2026-08-18T00:00:00.000Z',
      ...(inviteReads >= 3 ? { usedAt: fixedNow.toISOString() } : {}),
    }
  }
  repository.getReview = async (id) => {
    const data = repository.calls.find(([name]) => name === 'createReview')?.[1]
    return { $id: id, ...data }
  }
  repository.getCoupon = async (id) => {
    const data = repository.calls.find(([name]) => name === 'createCoupon')?.[1]
    return { $id: id, ...data }
  }

  const result = await submitReview(repository, VALID_TOKEN, {
    rating: 5, body: 'Great', publishConsent: true,
  }, { now: fixedNow, hmacSecret, idFactory: (() => { let i = 0; return () => ['review-reconcile', 'coupon-reconcile'][i++] })() })

  assert.equal('reviewId' in result, false)
  assert.match(result.couponCode, /^(?:FOX|CAT|DOG|OWL|PIG|BEE|COW|CUB|EMU|HEN|KOI|PUP|RAM|YAK|APE)(?:KIWI|FIG|LIME|PEAR|PLUM|APPLE|GRAPE|GUAVA|LEMON|MANGO|MELON|PEACH)[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
  assert.deepEqual(repository.calls.filter(([name]) => ['commit', 'rollback'].includes(name)).map(([name]) => name), ['commit', 'rollback'])
})

test('submit returns a stable uncertainty error when a lost commit response cannot be proven', async () => {
  const repository = makeRepository({ commitError: new Error('transport lost') })
  await assert.rejects(() => submitReview(repository, VALID_TOKEN, {
    rating: 5, body: 'Great', publishConsent: true,
  }, { now: fixedNow, hmacSecret, idFactory: (() => { let i = 0; return () => ['review-uncertain', 'coupon-uncertain'][i++] })() }),
  (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SUBMISSION_UNCERTAIN' && error.status === 503)
})

test('submit rechecks the source completion after invite validation and before starting a transaction', async () => {
  for (const changedSource of [null, { ...completedCake, status: '예약확정' }]) {
    const repository = makeRepository()
    repository.getSource = async (sourceType, id) => {
      repository.calls.push(['getSource', sourceType, id])
      return changedSource
    }
    await assert.rejects(() => submitReview(repository, VALID_TOKEN, {
      rating: 5, body: 'Great', publishConsent: true,
    }, { now: fixedNow, hmacSecret }),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SOURCE_NOT_COMPLETED')
    assert.equal(repository.calls.some(([name]) => name === 'begin'), false)
    assert.equal(repository.calls.some(([name]) => ['createReview', 'createCoupon'].includes(name)), false)
  }
})

test('public input cannot forge the photo reward and submit failures roll back', async () => {
  const noPhotoRepository = makeRepository()
  const noPhoto = await submitReview(noPhotoRepository, VALID_TOKEN, {
    rating: 4, body: 'Good', publishConsent: false, photoPublishConsent: true,
    acceptedPhotoFileId: 'forged', photoFileId: 'forged-too', hasPhoto: true,
  }, { now: fixedNow, hmacSecret, idFactory: (() => { let i = 0; return () => ['review-2', 'coupon-2'][i++] })() })
  assert.equal(noPhoto.rewardPercent, 5)
  const noPhotoReview = noPhotoRepository.calls.find(([name]) => name === 'createReview')[1]
  assert.equal(noPhotoReview.photoFileId, undefined)
  assert.equal(noPhotoReview.photoPublishConsent, false)

  const failureRepository = makeRepository({ createCouponError: new Error('storage failed') })
  await assert.rejects(() => submitReview(failureRepository, VALID_TOKEN, { rating: 5, body: 'Great', publishConsent: true },
    { now: fixedNow, hmacSecret, idFactory: (() => { let i = 0; return () => ['review-3', 'coupon-3'][i++] })() }), /storage failed/)
  assert.deepEqual(failureRepository.calls.filter(([name]) => ['commit', 'rollback'].includes(name)).map(([name]) => name), ['rollback'])
})

test('concurrent unique conflict becomes REVIEW_ALREADY_SUBMITTED and rolls back', async () => {
  const conflict = Object.assign(new Error('duplicate unique source'), { code: 409 })
  const repository = makeRepository({ createReviewError: conflict, existingReview: { $id: 'winning-review' } })
  await assert.rejects(() => submitReview(repository, VALID_TOKEN, { rating: 5, body: 'Great', publishConsent: true },
    { now: fixedNow, hmacSecret, isConflict: (error) => error.code === 409, idFactory: (() => { let i = 0; return () => ['review-4', 'coupon-4'][i++] })() }),
  (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ALREADY_SUBMITTED')
  assert.deepEqual(repository.calls.filter(([name]) => ['commit', 'rollback'].includes(name)).map(([name]) => name), ['rollback'])
})

test('submit commit conflicts map stably and roll back without exposing a coupon', async () => {
  const conflict = Object.assign(new Error('commit conflict'), { code: 409 })
  const repository = makeRepository({ commitError: conflict })
  await assert.rejects(() => submitReview(repository, VALID_TOKEN, {
    rating: 5, body: 'Great', publishConsent: true,
  }, { now: fixedNow, hmacSecret, isConflict: (error) => error.code === 409 }),
  (error) => error instanceof ReviewApiError && ['REVIEW_ALREADY_SUBMITTED', 'REVIEW_INVITE_CHANGED'].includes(error.code))
  assert.deepEqual(repository.calls.filter(([name]) => ['commit', 'rollback'].includes(name)).map(([name]) => name), ['commit', 'rollback'])
})

test('review lists and moderation use allowlisted DTOs and enforce consent guard', async () => {
  const published = {
    $id: 'review-1', sourceType: 'class', rating: 4, body: 'Fun', displayName: '', publishConsent: true,
    photoFileId: 'private-photo', photoPublishConsent: true,
    moderationStatus: 'published', rewardPercent: 5, couponId: 'secret', sourceReservationId: 'private',
    createdAt: fixedNow.toISOString(), customerName: 'Private',
  }
  assert.deepEqual(await listPublicReviewPage(makeRepository({ reviews: [published] })), {
    reviews: [{
      id: 'review-1', sourceType: 'class', rating: 4, body: 'Fun', displayName: 'Verified class booking',
      hasPhoto: false, thumbnailUrl: null, photoUrl: null, createdAt: fixedNow.toISOString(), incentivised: true,
    }],
    nextCursor: null,
    hasMore: false,
  })
  assert.deepEqual(await listPublicReviews(makeRepository({ reviews: [published] })), [{
    sourceType: 'class', rating: 4, body: 'Fun', displayName: 'Verified class booking',
    hasPhoto: false, photoUrl: null, createdAt: fixedNow.toISOString(), incentivised: true,
  }])
  const adminRepository = makeRepository({ reviews: [published] })
  const admin = await listAdminReviews(adminRepository, { cursor: 'review-prev', limit: 1, moderationStatus: 'published' })
  assert.equal(admin.reviews[0].id, 'review-1')
  assert.equal(admin.reviews[0].hasPhoto, true)
  assert.equal('photoFileId' in admin.reviews[0], false)
  assert.equal(JSON.stringify(admin.reviews).includes('private-photo'), false)
  assert.equal(admin.reviews[0].photoPublishConsent, true)
  assert.equal('couponId' in admin.reviews[0], false)
  assert.equal('sourceReservationId' in admin.reviews[0], false)
  assert.equal(JSON.stringify(admin.reviews).includes('Private'), false)
  assert.equal(admin.nextCursor, 'review-1')
  assert.deepEqual(adminRepository.calls.find(([name]) => name === 'listReviews')[1], { cursor: 'review-prev', limit: 1, moderationStatus: 'published' })
  const filteredRepository = makeRepository({ reviews: [published] })
  await listAdminReviews(filteredRepository, { moderationStatus: 'pending', limit: 20 })
  assert.deepEqual(filteredRepository.calls.find(([name]) => name === 'listReviews')[1], { cursor: undefined, limit: 20, moderationStatus: 'pending' })
  for (const options of [{ cursor: 'bad/id' }, { limit: 0 }, { limit: 101 }, { limit: 1.5 }, { moderationStatus: 'approved' }]) {
    await assert.rejects(() => listAdminReviews(makeRepository(), options),
      (error) => error instanceof ReviewApiError && error.code === 'INVALID_REQUEST')
  }

  for (const status of ['other', 'Published']) {
    await assert.rejects(() => moderateReview(makeRepository({ review: published }), 'review-1', status),
      (error) => error instanceof ReviewApiError && error.code === 'INVALID_MODERATION_STATUS')
  }
  await assert.rejects(() => moderateReview(makeRepository({ review: { ...published, publishConsent: false } }), 'review-1', 'published'),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_PUBLISH_CONSENT_REQUIRED')
  const moderationRepository = makeRepository({ review: published })
  await moderateReview(moderationRepository, 'review-1', 'hidden', { now: fixedNow, hmacSecret })
  assert.deepEqual(moderationRepository.calls.at(-1), ['updateReview', 'review-1', { moderationStatus: 'hidden', updatedAt: fixedNow.toISOString() }])

  const photoReview = { ...published, photoFileId: 'private-photo', photoPublishConsent: true }
  const photoRepository = makeRepository({ review: photoReview })
  const photoCalls = []
  const photoStorage = {
    async makePublic(fileId) { photoCalls.push(['public', fileId]) },
    async makePrivate(fileId) { photoCalls.push(['private', fileId]) },
  }
  await moderateReview(photoRepository, 'review-1', 'published', { now: fixedNow, photoStorage })
  assert.deepEqual(photoCalls, [['public', 'private-photo']])
  await moderateReview(photoRepository, 'review-1', 'hidden', { now: fixedNow, photoStorage })
  assert.deepEqual(photoCalls.at(-1), ['private', 'private-photo'])
})

test('request parsing gives only an exact valid photo upload the 2.4MB cap and keeps all other actions at 20KB', () => {
  assertReviewError('REQUEST_TOO_LARGE', () => parseRequestBody({ bodyText: 'x'.repeat(20_001), bodyJson: {} }))
  const upload = {
    action: 'upload-photo', token: VALID_TOKEN, mimeType: 'image/webp', base64: 'A'.repeat(21_000),
  }
  assert.deepEqual(parseRequestBody({ bodyText: JSON.stringify(upload), bodyJson: upload }), upload)
  assertReviewError('REQUEST_TOO_LARGE', () => parseRequestBody({
    bodyText: JSON.stringify({ ...upload, action: 'unknown' }),
    bodyJson: { ...upload, action: 'unknown' },
  }))
  assertReviewError('INVALID_REQUEST', () => parseRequestBody({
    bodyText: 'x'.repeat(21_000), bodyJson: { action: 'upload-photo' },
  }))
  const oversizedUpload = { ...upload, base64: 'A'.repeat(2_400_000) }
  assertReviewError('REQUEST_TOO_LARGE', () => parseRequestBody({
    bodyText: JSON.stringify(oversizedUpload), bodyJson: oversizedUpload,
  }))
  assertReviewError('INVALID_REQUEST', () => parseRequestBody({ bodyText: '[]', bodyJson: [] }))
  assert.deepEqual(parseRequestBody({ bodyText: '{}', bodyJson: { action: 'load-invite' } }), { action: 'load-invite' })
})

test('logs allowlist action names instead of reflecting request text', () => {
  assert.equal(safeActionForLog('submit-review'), 'submit-review')
  assert.equal(safeActionForLog('private@example.com\nforged-log'), 'unknown')
  assert.equal(safeActionForLog(123), 'unknown')
})

test('main routing separates public and admin actions without exposing internal errors', async () => {
  const calls = []
  const services = {
    async loadInvite(_repo, token) { calls.push(['load', token]); return { sourceType: 'cake' } },
    async submit(_repo, token, data, options) {
      calls.push(['submit', token, data, options.hmacSecret, options.encryptionKey])
      return { rewardPercent: 5, couponCode: 'FOXKIWI7Q2MK' }
    },
    async listPublic(_repo, limit) { calls.push(['public-legacy', limit]); return [] },
    async listPublicPage(_repo, limit, options) { calls.push(['public-page', limit, options.cursor]); return { reviews: [], nextCursor: null, hasMore: false } },
    async getPublic(_repo, id) { calls.push(['get-public', id]); return null },
    async issue() { calls.push(['issue']); return {} },
    async listAdmin() { calls.push(['admin']); return [] },
    async moderate() { calls.push(['moderate']); return {} },
    async uploadPhoto(_repo, _storage, token, input) { calls.push(['upload', token, input]); return { hasPhoto: true } },
    async removePhoto(_repo, _storage, token) { calls.push(['remove', token]); return { hasPhoto: false } },
    async cleanupPhotos() { calls.push(['cleanup']); return { processed: 0, deleted: 0, retained: 0, failed: 0 } },
  }
  await handleReviewRequest({ action: 'load-invite', data: { token: 'token' } }, {}, {}, services)
  await handleReviewRequest(
    { action: 'submit-review', data: { token: 'token', review: { acceptedPhotoFileId: 'forged' } } },
    {},
    {},
    services,
    undefined,
    undefined,
    { hmacSecret: Buffer.from('hmac'), encryptionKey },
  )
  await handleReviewRequest({ action: 'list-public', limit: 3 }, {}, {}, services)
  await handleReviewRequest({ action: 'list-public-page', limit: 3, cursor: 'review-prev' }, {}, {}, services)
  await handleReviewRequest({ action: 'get-public', id: 'review-public' }, {}, {}, services)
  await handleReviewRequest({ action: 'upload-photo', token: VALID_TOKEN, mimeType: 'image/webp', base64: 'YQ==' }, {}, {}, services)
  await handleReviewRequest({ action: 'remove-photo', token: VALID_TOKEN }, {}, {}, services)
  assert.deepEqual(calls, [
    ['load', 'token'], ['submit', 'token', { acceptedPhotoFileId: 'forged' }, Buffer.from('hmac'), encryptionKey],
    ['public-legacy', 3], ['public-page', 3, 'review-prev'], ['get-public', 'review-public'],
    ['upload', VALID_TOKEN, { mimeType: 'image/webp', base64: 'YQ==' }], ['remove', VALID_TOKEN],
  ])
  await assert.rejects(() => handleReviewRequest({ action: 'create-invite', data: {} }, {}, { REVIEW_ADMIN_USER_IDS: 'admin-1' }, services),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ADMIN_UNAUTHORIZED')
  await handleReviewRequest({ action: 'create-invite', data: {} }, { 'x-appwrite-user-id': 'admin-1' }, { REVIEW_ADMIN_USER_IDS: 'admin-1' }, services)
  assert.equal(calls.at(-1)[0], 'issue')
  await handleReviewRequest({ action: 'cleanup-photo-files', data: { limit: 100 } }, { 'x-appwrite-user-id': 'admin-1' }, { REVIEW_ADMIN_USER_IDS: 'admin-1' }, services)
  assert.equal(calls.at(-1)[0], 'cleanup')
  await assert.rejects(() => handleReviewRequest({ action: 'cleanup-photo-files' }, {}, { REVIEW_ADMIN_USER_IDS: 'admin-1' }, services),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ADMIN_UNAUTHORIZED')
  await assert.rejects(() => handleReviewRequest({ action: 'unknown' }, {}, {}, services),
    (error) => error instanceof ReviewApiError && error.code === 'UNKNOWN_ACTION')
})

test('submit transaction rechecks source completion and writes no review or coupon after a preflight TOCTOU change', async () => {
  const repository = makeRepository()
  let sourceRead = 0
  repository.getSource = async (sourceType, id, transaction) => {
    repository.calls.push(['getSource', sourceType, id, transaction])
    sourceRead += 1
    return sourceRead === 1 ? completedCake : { ...completedCake, status: '예약확정' }
  }
  await assert.rejects(() => submitReview(repository, VALID_TOKEN, {
    rating: 5, body: 'Great', publishConsent: true,
  }, { now: fixedNow, hmacSecret }),
  (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SOURCE_NOT_COMPLETED')
  assert.equal(repository.calls.filter(([name]) => name === 'getSource').length, 2)
  assert.equal(repository.calls.some(([name]) => ['createReview', 'createCoupon'].includes(name)), false)
  assert.equal(repository.calls.some(([name]) => name === 'rollback'), true)
})

test('invite rotation atomically clears pending photo ownership and cleans the old private file only after commit', async () => {
  const events = []
  const repository = makeRepository({ existingInvite: {
    $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
    pendingPhotoFileId: 'old-private-photo', pendingPhotoUploadedAt: fixedNow.toISOString(),
  } })
  repository.updateInvite = async (id, data, tx) => { events.push(['update', id, data, tx]); return { $id: id, ...data } }
  repository.commitTransaction = async (tx) => { events.push(['commit', tx]) }
  repository.enqueuePhotoCleanup = async (entry) => { events.push(['enqueue', entry]) }
  const storage = { async deletePhoto() { events.push(['delete']) } }

  await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN, storage,
  })
  const update = events.find(([name]) => name === 'update')
  assert.equal(update[2].pendingPhotoFileId, null)
  assert.equal(update[2].pendingPhotoUploadedAt, null)
  assert.ok(events.findIndex(([name]) => name === 'commit') < events.findIndex(([name]) => name === 'delete'))
})

test('invite rotation conflict retains the currently attached private photo', async () => {
  const conflict = Object.assign(new Error('commit conflict'), { code: 409 })
  const repository = makeRepository({ existingInvite: {
    $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1', pendingPhotoFileId: 'keep-private-photo',
  }, commitError: conflict })
  const storageCalls = []
  await assert.rejects(() => issueReviewInvite(repository, {
    sourceType: 'cake', sourceReservationId: 'cake-1',
  }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN,
    storage: { async deletePhoto(id) { storageCalls.push(id) } },
    isConflict: (error) => error.code === 409,
  }), (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_CHANGED')
  assert.deepEqual(storageCalls, [])
})

test('invite rotation creates old-photo cleanup intent in the same transaction before unlink and commit', async () => {
  const repository = makeRepository({ existingInvite: {
    $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
    pendingPhotoFileId: 'old-private-photo', photoUploadCount: 7,
  } })
  await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN, storage: { async deletePhoto() {} },
  })
  const names = repository.calls.map(([name]) => name)
  const enqueueIndex = names.indexOf('enqueueCleanup')
  const updateIndex = names.indexOf('updateInvite')
  const commitIndex = names.indexOf('commit')
  assert.ok(enqueueIndex < updateIndex && updateIndex < commitIndex)
  assert.deepEqual(repository.calls[enqueueIndex].slice(1), [{
    fileId: 'old-private-photo', inviteId: 'invite-existing', reason: 'rotation', status: 'pending', attempts: 0,
    createdAt: fixedNow.toISOString(), updatedAt: fixedNow.toISOString(),
  }, { id: 'tx-1' }])
  assert.equal(repository.calls[updateIndex][2].photoUploadCount, undefined)
  assert.deepEqual(repository.calls[updateIndex][3], { id: 'tx-1' })
})

test('invite rotation commit transport error returns the proposed token when outside refetch proves commit', async () => {
  const repository = makeRepository({
    existingInvite: {
      $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
      tokenHash: hashSecret(OLD_TOKEN), pendingPhotoFileId: 'old-private-photo',
    },
    refetchedInvite: {
      $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
      tokenHash: hashSecret(NEW_TOKEN), pendingPhotoFileId: null,
    },
    commitError: new Error('server committed; response lost'),
  })
  const deleted = []
  const result = await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN, storage: { async deletePhoto(id) { deleted.push(id) } },
  })
  assert.deepEqual(result, { token: NEW_TOKEN, expiresAt: '2026-08-18T00:00:00.000Z' })
  assert.deepEqual(deleted, ['old-private-photo'])
})

test('invite rotation commit uncertainty never deletes old photo and returns stable uncertainty', async () => {
  const repository = makeRepository({
    existingInvite: {
      $id: 'invite-existing', sourceType: 'cake', sourceReservationId: 'cake-1',
      tokenHash: hashSecret(OLD_TOKEN), pendingPhotoFileId: 'old-private-photo',
    },
    refetchError: new Error('outside read unavailable'),
    commitError: new Error('transport reset'),
  })
  const deleted = []
  await assert.rejects(() => issueReviewInvite(repository, {
    sourceType: 'cake', sourceReservationId: 'cake-1',
  }, {
    now: fixedNow, tokenFactory: () => NEW_TOKEN, storage: { async deletePhoto(id) { deleted.push(id) } },
  }), (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_UNCERTAIN')
  assert.deepEqual(deleted, [])
})

test('cleanup repository mutations accept a transaction id with exact Appwrite payloads', async () => {
  const calls = []
  const repository = createReviewRepository({
    async createDocument(params) { calls.push(['create', params]); return {} },
    async deleteDocument(params) { calls.push(['delete', params]); return {} },
  }, resolveReviewConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db' }))
  const tx = { $id: 'tx-cleanup' }
  await repository.enqueuePhotoCleanup({
    fileId: 'old-file', inviteId: 'invite-1', reason: 'rotation', status: 'pending', attempts: 0,
    createdAt: fixedNow.toISOString(), updatedAt: fixedNow.toISOString(),
  }, tx)
  await repository.deletePhotoCleanup('new-file', tx)
  assert.equal(calls[0][1].transactionId, 'tx-cleanup')
  assert.equal(calls[1][1].transactionId, 'tx-cleanup')
})
