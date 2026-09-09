import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  customCakeService,
  formatCents,
  formatExtraCents,
  getStatusInfo,
  CUSTOM_CAKE_BASE_PRICES,
} from '../src/lib/custom-cake-client.js'

test('formatCents formats integer cents to formatted AUD currency string', () => {
  assert.equal(formatCents(15500), 'AUD $155.00')
  assert.equal(formatCents(775), 'AUD $7.75')
  assert.equal(formatCents(0), 'AUD $0.00')
  assert.equal(formatCents(null), '-')
  assert.equal(formatCents(undefined), '-')
})

test('formatExtraCents respects null, zero and positive cents contract', () => {
  assert.equal(formatExtraCents(null, 'en'), 'To be confirmed')
  assert.equal(formatExtraCents(null, 'ko'), '협의 예정 (To be confirmed)')

  assert.equal(formatExtraCents(0, 'en'), 'No extra charge (AUD $0.00)')
  assert.equal(formatExtraCents(0, 'ko'), '추가금 없음 (No extra charge)')

  assert.equal(formatExtraCents(2000, 'en'), '+AUD $20.00')
  assert.equal(formatExtraCents(1500, 'ko'), '+AUD $15.00')
})

test('getStatusInfo provides correct label and class for requested, quoted, and confirmed', () => {
  const reqInfo = getStatusInfo('requested', 'en')
  assert.equal(reqInfo.label, 'Request Received')
  assert.equal(reqInfo.className, 'status-badge status-requested')

  const quoteInfo = getStatusInfo('quoted', 'ko')
  assert.equal(quoteInfo.label, '견적 안내')

  const confInfo = getStatusInfo('confirmed', 'en')
  assert.equal(confInfo.label, 'Confirmed')
})

test('all six custom base prices match the approved contract', () => {
  assert.equal(CUSTOM_CAKE_BASE_PRICES.single['6in'], 15500)
  assert.equal(CUSTOM_CAKE_BASE_PRICES.single['8in'], 20000)
  assert.equal(CUSTOM_CAKE_BASE_PRICES.single['10in'], 25000)

  assert.equal(CUSTOM_CAKE_BASE_PRICES.double['4in+6in'], 25500)
  assert.equal(CUSTOM_CAKE_BASE_PRICES.double['6in+8in'], 36500)
  assert.equal(CUSTOM_CAKE_BASE_PRICES.double['8in+10in'], 47500)
})

test('customCakeService.createRequest creates valid provisional request matching contract rules', async () => {
  const req = {
    contractVersion: 'custom-cake.v1',
    requestId: 'test-req-uuid-1',
    customer: {
      customerName: 'Alice Test',
      customerPhone: '0412345678',
      customerEmail: 'alice@example.com',
    },
    pickup: {
      pickupDate: '2026-10-15',
      pickupTime: '14:00',
    },
    requestNote: 'First birthday party',
    privacyConsent: true,
    lines: [
      {
        kind: 'custom-cake',
        lineId: 'cake_1',
        parentCakeLineId: null,
        productId: 'custom-cake',
        quantity: 1,
        tier: 'single',
        size: '6in',
        designNote: 'Pastel balloons',
        figurineSource: 'shop',
        photoRefs: ['photo_1'],
      },
      {
        kind: 'cake-addon-smore',
        lineId: 'smore_1',
        productId: 'smore-stick',
        quantity: 2,
        parentCakeLineId: 'cake_1',
      },
    ],
  }

  const res = await customCakeService.createRequest(req)
  assert.equal(res.contractVersion, 'custom-cake.v1')
  assert.equal(res.status, 'requested')
  assert.equal(res.quote.quoteVersion, 1)
  assert.equal(res.quote.baseCents, 15500)
  assert.equal(res.quote.cakeDiscountCents, 775)
  assert.equal(res.quote.giftSmoreQuantity, 2)
  assert.equal(res.quote.paidSmoreQuantity, 2)
  assert.equal(res.quote.paidSmoreTotalCents, 630)
  assert.equal(res.quote.knownTotalCents, 15355)
  assert.equal(res.quote.isFinalQuote, false)
  assert.equal(res.quote.designExtraCents, null)
  assert.equal(res.quote.figurineExtraCents, null)
  assert.equal(res.quote.finalTotalCents, null)
  assert.equal(res.acceptance, null)

  // Lookup the created request
  const lookup = await customCakeService.lookupRequest(res.requestNumber, '0412345678')
  assert.ok(lookup)
  assert.equal(lookup.customer.customerName, 'Alice Test')
  assert.equal(lookup.lines.length, 2)
})

test('customCakeService quote revision, acceptance, and confirmation lifecycle', async () => {
  const req = {
    contractVersion: 'custom-cake.v1',
    requestId: 'test-req-lifecycle-1',
    customer: {
      customerName: 'Bob Lifecycle',
      customerPhone: '0498765432',
      customerEmail: 'bob@example.com',
    },
    pickup: {
      pickupDate: '2026-10-20',
      pickupTime: '11:00',
    },
    requestNote: '',
    privacyConsent: true,
    lines: [
      {
        kind: 'custom-cake',
        lineId: 'cake_bob',
        parentCakeLineId: null,
        productId: 'custom-cake',
        quantity: 1,
        tier: 'single',
        size: '6in',
        designNote: 'Blue ribbon',
        figurineSource: 'shop',
        photoRefs: [],
      },
    ],
  }

  const created = await customCakeService.createRequest(req)
  assert.equal(created.quote.quoteVersion, 1)

  // 1. Version conflict test
  await assert.rejects(
    () =>
      customCakeService.updateQuote({
        contractVersion: 'custom-cake.v1',
        requestNumber: created.requestNumber,
        expectedQuoteVersion: 999, // Wrong version
        designExtraCents: 2000,
        figurineExtraCents: 1500,
        explanation: 'Invalid version retry',
      }),
    /QUOTE_VERSION_CONFLICT/,
  )

  // 2. Successful quote update to Final
  const updated = await customCakeService.updateQuote({
    contractVersion: 'custom-cake.v1',
    requestNumber: created.requestNumber,
    expectedQuoteVersion: 1,
    designExtraCents: 2000,
    figurineExtraCents: 1500,
    explanation: 'Agreed $20 design + $15 figurine',
  })

  assert.equal(updated.status, 'quoted')
  assert.equal(updated.quote.quoteVersion, 2)
  assert.equal(updated.quote.isFinalQuote, true)
  assert.equal(updated.quote.designExtraCents, 2000)
  assert.equal(updated.quote.figurineExtraCents, 1500)
  // known total: 15500 - 775 + 2000 + 1500 = 18225
  assert.equal(updated.quote.knownTotalCents, 18225)
  assert.equal(updated.quote.finalTotalCents, 18225)

  // 3. Confirmation fails before acceptance
  await assert.rejects(
    () =>
      customCakeService.confirmRequest({
        contractVersion: 'custom-cake.v1',
        requestNumber: created.requestNumber,
        expectedQuoteVersion: 2,
      }),
    /QUOTE_ACCEPTANCE_REQUIRED/,
  )

  // 4. Record customer acceptance
  const accepted = await customCakeService.recordAcceptance({
    contractVersion: 'custom-cake.v1',
    requestNumber: created.requestNumber,
    quoteVersion: 2,
    customerConsent: true,
  })

  assert.ok(accepted.acceptance)
  assert.equal(accepted.acceptance.acceptedQuoteVersion, 2)
  assert.equal(accepted.acceptanceHistory.length, 1)

  // 5. Confirm request atomically
  const confirmed = await customCakeService.confirmRequest({
    contractVersion: 'custom-cake.v1',
    requestNumber: created.requestNumber,
    expectedQuoteVersion: 2,
  })

  assert.equal(confirmed.status, 'confirmed')
  assert.equal(confirmed.quote.isFinalQuote, true)
  assert.equal(confirmed.acceptance.acceptedQuoteVersion, 2)

  // 6. Complete request (confirmed -> completed)
  // 6a. Version conflict on complete
  await assert.rejects(
    () =>
      customCakeService.completeRequest({
        contractVersion: 'custom-cake.v1',
        requestNumber: created.requestNumber,
        expectedStatus: 'confirmed',
        expectedQuoteVersion: 99,
      }),
    /QUOTE_VERSION_CONFLICT/,
  )

  // 6b. Successful completion
  const completed = await customCakeService.completeRequest({
    contractVersion: 'custom-cake.v1',
    requestNumber: created.requestNumber,
    expectedStatus: 'confirmed',
    expectedQuoteVersion: 2,
  })
  assert.equal(completed.status, 'completed')

  // 6c. Cancellation fails when already completed (state conflict)
  await assert.rejects(
    () =>
      customCakeService.cancelRequest({
        contractVersion: 'custom-cake.v1',
        requestNumber: created.requestNumber,
        expectedStatus: 'confirmed',
        expectedQuoteVersion: 2,
      }),
    /QUOTE_STATE_CONFLICT/,
  )
})

test('customCakeService cancellation flow from requested status', async () => {
  const req = {
    contractVersion: 'custom-cake.v1',
    requestId: 'test-req-cancel-1',
    customer: {
      customerName: 'Charlie Cancel',
      customerPhone: '0411223344',
      customerEmail: 'charlie@example.com',
    },
    pickup: {
      pickupDate: '2026-10-25',
      pickupTime: '13:00',
    },
    requestNote: '',
    privacyConsent: true,
    lines: [
      {
        kind: 'custom-cake',
        lineId: 'cake_charlie',
        parentCakeLineId: null,
        productId: 'custom-cake',
        quantity: 1,
        tier: 'single',
        size: '8in',
        designNote: 'Chocolate ribbons',
        figurineSource: 'none',
        photoRefs: [],
      },
    ],
  }

  const created = await customCakeService.createRequest(req)
  assert.equal(created.status, 'requested')

  const cancelled = await customCakeService.cancelRequest({
    contractVersion: 'custom-cake.v1',
    requestNumber: created.requestNumber,
    expectedStatus: 'requested',
    expectedQuoteVersion: 1,
  })
  assert.equal(cancelled.status, 'cancelled')
})

test('giftSmoreQuantity is proportional to cake quantity (quantity 2 yields 4 gifts)', async () => {
  const req = {
    contractVersion: 'custom-cake.v1',
    requestId: 'test-req-gift-proportional',
    customer: {
      customerName: 'Dana Multi',
      customerPhone: '0422334455',
      customerEmail: 'dana@example.com',
    },
    pickup: {
      pickupDate: '2026-10-30',
      pickupTime: '15:00',
    },
    requestNote: '',
    privacyConsent: true,
    lines: [
      {
        kind: 'custom-cake',
        lineId: 'cake_dana',
        parentCakeLineId: null,
        productId: 'custom-cake',
        quantity: 2,
        tier: 'single',
        size: '6in',
        designNote: 'Twin celebration',
        figurineSource: 'none',
        photoRefs: [],
      },
    ],
  }

  const created = await customCakeService.createRequest(req)
  // Cake qty 2 -> base: 15500 * 2 = 31000
  assert.equal(created.quote.baseCents, 31000)
  // Cake qty 2 -> 2 * 2 = 4 gift smore sticks (not hardcoded 2)
  assert.equal(created.quote.giftSmoreQuantity, 4)
})

test('custom-cake-photo.v1 session, upload, read, and delete adapter flow', async () => {
  const requestId = '12345678-1234-4234-8234-123456789abc'

  // 1. Create photo session
  const session = await customCakeService.createPhotoSession(requestId)
  assert.equal(session.contractVersion, 'custom-cake-photo.v1')
  assert.equal(session.requestId, requestId)
  assert.equal(session.limits.maxPhotosPerRequest, 5)
  assert.equal(session.limits.maxInputBytes, 10485760)
  assert.equal(session.limits.maxDecodedPixels, 20000000)
  assert.ok(new Date(session.expiresAt).getTime() > Date.now())

  // 2. Upload photo
  const uploadRes = await customCakeService.uploadPhoto(
    {
      'x-custom-cake-upload-session': session.uploadSessionId,
      'x-custom-cake-upload-token': session.uploadToken,
    },
    {
      contractVersion: 'custom-cake-photo.v1',
      requestId,
      uploadId: 'upload_test_1',
      mimeType: 'image/jpeg',
      base64: '/9j/2Q==',
    },
  )
  assert.equal(uploadRes.contractVersion, 'custom-cake-photo.v1')
  assert.equal(uploadRes.state, 'staged')
  assert.ok(uploadRes.photoRef.startsWith('photo_'))

  // 3. Read uploaded photo
  const readRes = await customCakeService.readPhoto({
    contractVersion: 'custom-cake-photo.v1',
    requestNumber: 'REQ_TEST',
    photoRef: uploadRes.photoRef,
    authorization: { kind: 'admin' },
  })
  assert.equal(readRes.photoRef, uploadRes.photoRef)
  assert.equal(readRes.mimeType, 'image/webp')

  // 4. Delete photo
  const delRes = await customCakeService.deletePhoto({
    contractVersion: 'custom-cake-photo.v1',
    requestNumber: 'REQ_TEST',
    photoRef: uploadRes.photoRef,
    authorization: { kind: 'admin' },
  })
  assert.equal(delRes.state, 'deleted')

  // 5. Read after delete fails
  await assert.rejects(
    () =>
      customCakeService.readPhoto({
        contractVersion: 'custom-cake-photo.v1',
        requestNumber: 'REQ_TEST',
        photoRef: uploadRes.photoRef,
        authorization: { kind: 'admin' },
      }),
    /NOT_FOUND/,
  )
})

function getProjectRoot() {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), '../au-cake-clone'),
    '/Users/nam9295/Desktop/john_2.0/code/au-cake-clone',
  ]
  for (const c of candidates) {
    if (existsSync(resolve(c, 'src/CakesPage.tsx'))) return c
  }
  return process.cwd()
}

test('CakesPage source renders Section 05 CUSTOM & CREATIVE and CUSTOM CAKE card', async () => {
  const root = getProjectRoot()
  const cakesPageSource = await readFile(resolve(root, 'src/CakesPage.tsx'), 'utf8')
  assert.match(cakesPageSource, /05/)
  assert.match(cakesPageSource, /CUSTOM & CREATIVE/)
  assert.match(cakesPageSource, /CUSTOM CAKE/)
  assert.match(cakesPageSource, /From AUD \$155/)
  assert.match(cakesPageSource, /Your celebration, made your way\./)
  assert.match(cakesPageSource, /\/cakes\/custom-cake/)
})

test('App.tsx routes correctly configure custom-cake paths', async () => {
  const root = getProjectRoot()
  const appRoutesSource = await readFile(resolve(root, 'src/lib/app-routes.ts'), 'utf8')
  assert.match(appRoutesSource, /'custom-cake'/)
  assert.match(appRoutesSource, /'custom-cake-complete'/)
  assert.match(appRoutesSource, /'admin-custom-cakes'/)
})
