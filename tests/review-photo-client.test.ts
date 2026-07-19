import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_REVIEW_PHOTO_HEADER_BYTES,
  MAX_REVIEW_PHOTO_INPUT_BYTES,
  MAX_REVIEW_PHOTO_OUTPUT_BYTES,
  MAX_REVIEW_PHOTO_SOURCE_PIXELS,
  blobToBase64,
  buildPhotoCompressionPlan,
  calculateContainDimensions,
  compressReviewPhoto,
  createPreviewUrlController,
  probeReviewPhotoDimensions,
  validateReviewPhotoFile,
} from '../src/lib/review-photo.js'
import {
  buildRemoveReviewPhotoPayload,
  buildSubmitReviewPayload,
  buildUploadReviewPhotoPayload,
  parseLoadReviewInviteResult,
} from '../src/lib/review-page.js'
import { reviewDemoSubmission } from '../src/lib/review-page-demo.js'
import { removeReviewPhoto, uploadReviewPhoto } from '../src/lib/review-repository.js'

const TOKEN = 'A'.repeat(43)

function pngHeader(width: number, height: number): Blob {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new Blob([bytes], { type: 'image/png' })
}

function jpegHeader(width: number, height: number): Blob {
  return new Blob([Uint8Array.of(
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x08, 0x08,
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
    0x00,
  )], { type: 'image/jpeg' })
}

function webpHeader(kind: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number): Blob {
  let payload: Uint8Array
  if (kind === 'VP8X') {
    payload = new Uint8Array(10)
    const view = new DataView(payload.buffer)
    view.setUint8(4, (width - 1) & 0xff); view.setUint8(5, ((width - 1) >>> 8) & 0xff); view.setUint8(6, ((width - 1) >>> 16) & 0xff)
    view.setUint8(7, (height - 1) & 0xff); view.setUint8(8, ((height - 1) >>> 8) & 0xff); view.setUint8(9, ((height - 1) >>> 16) & 0xff)
  } else if (kind === 'VP8L') {
    payload = Uint8Array.of(0x2f, (width - 1) & 0xff, (((width - 1) >>> 8) & 0x3f) | (((height - 1) & 0x03) << 6), ((height - 1) >>> 2) & 0xff, ((height - 1) >>> 10) & 0x0f)
  } else {
    payload = Uint8Array.of(0, 0, 0, 0x9d, 0x01, 0x2a, width & 0xff, (width >>> 8) & 0x3f, height & 0xff, (height >>> 8) & 0x3f)
  }
  const bytes = new Uint8Array(20 + payload.length)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([...kind].map((char) => char.charCodeAt(0)), 12)
  new DataView(bytes.buffer).setUint32(16, payload.length, true)
  bytes.set(payload, 20)
  return new Blob([bytes], { type: 'image/webp' })
}

function heifIspeHeader(width: number, height: number): Blob {
  const bytes = new Uint8Array(32)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 12); bytes.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4)
  view.setUint32(12, 20); bytes.set([0x69, 0x73, 0x70, 0x65], 16)
  view.setUint32(24, width); view.setUint32(28, height)
  return new Blob([bytes], { type: 'image/heic' })
}

function installCompressionBrowserMock(outputBlobs: Array<Blob | null>) {
  const originals = {
    bitmap: Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  }
  const bitmapCalls: unknown[][] = []
  const qualities: number[] = []
  let closeCount = 0
  const bitmap = { width: 1600, height: 1200, close: () => { closeCount += 1 } }
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: async (...args: unknown[]) => { bitmapCalls.push(args); return bitmap },
  })
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
    toBlob(callback: (blob: Blob | null) => void, type: string, quality: number) {
      assert.equal(type, 'image/webp')
      qualities.push(quality)
      callback(outputBlobs.shift() ?? null)
    },
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (name: string) => { assert.equal(name, 'canvas'); return canvas } },
  })
  return {
    bitmapCalls,
    qualities,
    closeCount: () => closeCount,
    restore() {
      if (originals.bitmap) Object.defineProperty(globalThis, 'createImageBitmap', originals.bitmap)
      else delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap
      if (originals.document) Object.defineProperty(globalThis, 'document', originals.document)
      else delete (globalThis as { document?: unknown }).document
    },
  }
}

function completed(result: unknown) {
  return {
    status: 'completed',
    responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result }),
  }
}

test('source validation accepts supported browser image types and caps input before decode', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
    assert.doesNotThrow(() => validateReviewPhotoFile({ type, size: 1 }))
  }
  assert.throws(() => validateReviewPhotoFile({ type: 'image/gif', size: 1 }), /PHOTO_INVALID/)
  assert.throws(() => validateReviewPhotoFile({ type: '', size: 1 }), /PHOTO_INVALID/)
  assert.throws(() => validateReviewPhotoFile({ type: 'image/png', size: 0 }), /PHOTO_INVALID/)
  assert.throws(() => validateReviewPhotoFile({ type: 'image/png', size: MAX_REVIEW_PHOTO_INPUT_BYTES + 1 }), /PHOTO_TOO_LARGE/)
})

test('bounded source probe reads JPEG, PNG, WebP variants, and HEIF ispe dimensions', async () => {
  assert.equal(MAX_REVIEW_PHOTO_HEADER_BYTES <= 512 * 1024, true)
  assert.deepEqual(await probeReviewPhotoDimensions(jpegHeader(4000, 3000)), { width: 4000, height: 3000 })
  assert.deepEqual(await probeReviewPhotoDimensions(pngHeader(3200, 1800)), { width: 3200, height: 1800 })
  for (const kind of ['VP8 ', 'VP8L', 'VP8X'] as const) {
    assert.deepEqual(await probeReviewPhotoDimensions(webpHeader(kind, 1600, 900)), { width: 1600, height: 900 }, kind)
  }
  assert.deepEqual(await probeReviewPhotoDimensions(heifIspeHeader(3024, 4032)), { width: 3024, height: 4032 })
})

test('WebP probe reads dimensions from a large declared image chunk without buffering the full chunk', async () => {
  const declaredLength = MAX_REVIEW_PHOTO_HEADER_BYTES + 64
  const bytes = new Uint8Array(declaredLength + 20)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(4, bytes.length - 8, true)
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c], 8)
  view.setUint32(16, declaredLength, true)
  const width = 1200
  const height = 1200
  bytes.set(Uint8Array.of(
    0x2f,
    (width - 1) & 0xff,
    (((width - 1) >>> 8) & 0x3f) | (((height - 1) & 0x03) << 6),
    ((height - 1) >>> 2) & 0xff,
    ((height - 1) >>> 10) & 0x0f,
  ), 20)
  assert.deepEqual(
    await probeReviewPhotoDimensions(new Blob([bytes], { type: 'image/webp' })),
    { width, height },
  )
})

test('source probe rejects invalid, zero, unknown HEIF, and 48MP dimensions before decode', async () => {
  assert.equal(MAX_REVIEW_PHOTO_SOURCE_PIXELS, 20_000_000)
  await assert.rejects(() => probeReviewPhotoDimensions(pngHeader(8000, 6000)), /PHOTO_DIMENSIONS_TOO_LARGE/)
  await assert.rejects(() => probeReviewPhotoDimensions(pngHeader(0, 100)), /PHOTO_INVALID/)
  await assert.rejects(() => probeReviewPhotoDimensions(new Blob([new Uint8Array(64)], { type: 'image/jpeg' })), /PHOTO_INVALID/)
  await assert.rejects(() => probeReviewPhotoDimensions(new Blob([new Uint8Array(64)], { type: 'image/heic' })), /PHOTO_INVALID/)
})

test('contain dimensions cap at 1600 without upscaling and preserve aspect ratio', () => {
  assert.deepEqual(calculateContainDimensions(3200, 1200), { width: 1600, height: 600 })
  assert.deepEqual(calculateContainDimensions(1200, 3200), { width: 600, height: 1600 })
  assert.deepEqual(calculateContainDimensions(640, 480), { width: 640, height: 480 })
  assert.throws(() => calculateContainDimensions(0, 10), /PHOTO_INVALID/)
})

test('compression retry plan is deterministic and lowers quality before dimensions', () => {
  const plan = buildPhotoCompressionPlan(3200, 2400)
  assert.deepEqual(plan.slice(0, 4), [
    { width: 1600, height: 1200, quality: 0.82 },
    { width: 1600, height: 1200, quality: 0.72 },
    { width: 1600, height: 1200, quality: 0.62 },
    { width: 1360, height: 1020, quality: 0.72 },
  ])
  assert.ok(plan.every(({ width, height }) => width <= 1600 && height <= 1600))
  assert.equal(MAX_REVIEW_PHOTO_OUTPUT_BYTES, 1_350_000)
})

test('maximum canonical photo upload JSON stays below the 2.4MB Function request cap', () => {
  const maximumBase64Length = 4 * Math.ceil(MAX_REVIEW_PHOTO_OUTPUT_BYTES / 3)
  const payload = buildUploadReviewPhotoPayload(TOKEN, 'A'.repeat(maximumBase64Length), MAX_REVIEW_PHOTO_OUTPUT_BYTES)
  assert.ok(Buffer.byteLength(JSON.stringify(payload), 'utf8') < 2_400_000)
})

test('compression passes exact decoder resize hints, retries oversize output, and closes bitmap', async () => {
  const tooLarge = new Blob([new Uint8Array(MAX_REVIEW_PHOTO_OUTPUT_BYTES + 1)], { type: 'image/webp' })
  const accepted = new Blob([Uint8Array.of(1, 2, 3)], { type: 'image/webp' })
  const mock = installCompressionBrowserMock([tooLarge, accepted])
  try {
    const input = pngHeader(3200, 2400)
    assert.equal(await compressReviewPhoto(input), accepted)
    assert.deepEqual(mock.bitmapCalls[0]?.[1], {
      imageOrientation: 'from-image', resizeWidth: 1600, resizeHeight: 1200, resizeQuality: 'high',
    })
    assert.deepEqual(mock.qualities, [0.82, 0.72])
    assert.equal(mock.closeCount(), 1)
  } finally {
    mock.restore()
  }
})

test('compression rejects null and wrong-MIME canvas output and still closes bitmap', async () => {
  for (const output of [null, new Blob(['x'], { type: 'image/png' })]) {
    const mock = installCompressionBrowserMock([output])
    try {
      await assert.rejects(() => compressReviewPhoto(pngHeader(800, 600)), /PHOTO_INVALID/)
      assert.equal(mock.closeCount(), 1)
    } finally {
      mock.restore()
    }
  }
})

test('safe Image fallback revokes its object URL after successful compression', async () => {
  const output = new Blob(['ok'], { type: 'image/webp' })
  const mock = installCompressionBrowserMock([output])
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const revoked: string[] = []
  try {
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async () => { throw new Error('unsupported') } })
    class MockImage {
      decoding = ''
      src = ''
      naturalWidth = 800
      naturalHeight = 600
      async decode() {}
    }
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:fallback' })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url: string) => revoked.push(url) })
    assert.equal(await compressReviewPhoto(pngHeader(800, 600)), output)
    assert.deepEqual(revoked, ['blob:fallback'])
  } finally {
    mock.restore()
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage)
    else delete (globalThis as { Image?: unknown }).Image
    if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor)
    if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor)
  }
})

test('blob base64 is exact canonical output across chunk boundaries with no data URL prefix', async () => {
  const bytes = Uint8Array.from({ length: 70_003 }, (_, index) => index % 251)
  const expected = Buffer.from(bytes).toString('base64')
  const actual = await blobToBase64(new Blob([bytes], { type: 'image/webp' }))
  assert.equal(actual, expected)
  assert.equal(actual.startsWith('data:'), false)
  assert.equal(await blobToBase64(new Blob([Uint8Array.of(0, 255, 1)], { type: 'image/webp' })), 'AP8B')
})

test('preview URL controller revokes replaced, removed, and disposed URLs exactly once', () => {
  const revoked: string[] = []
  let next = 0
  const controller = createPreviewUrlController({
    createObjectURL: () => `blob:${++next}`,
    revokeObjectURL: (url) => revoked.push(url),
  })
  assert.equal(controller.replace(new Blob(['a'])), 'blob:1')
  assert.equal(controller.replace(new Blob(['b'])), 'blob:2')
  controller.clear()
  controller.clear()
  assert.deepEqual(revoked, ['blob:1', 'blob:2'])
  assert.equal(controller.replace(new Blob(['c'])), 'blob:3')
  controller.dispose()
  assert.deepEqual(revoked, ['blob:1', 'blob:2', 'blob:3'])
})

test('photo payloads are exact allowlists and never accept a forged file ID', () => {
  const blob = new Blob([Uint8Array.of(1, 2, 3)], { type: 'image/webp' })
  assert.deepEqual(buildUploadReviewPhotoPayload(TOKEN, 'AQID', blob.size), {
    action: 'upload-photo', token: TOKEN, mimeType: 'image/webp', base64: 'AQID', byteLength: 3,
  })
  assert.deepEqual(buildRemoveReviewPhotoPayload(TOKEN), { action: 'remove-photo', token: TOKEN })
  const contaminated = {
    token: TOKEN, rating: 5, body: 'Good', displayName: '', publishConsent: true,
    photoPublishConsent: true, website: '', photoFileId: 'forged', hasPhoto: true, rewardPercent: 10,
  }
  const submit = buildSubmitReviewPayload(contaminated)
  assert.deepEqual(submit.data.review, {
    rating: 5, body: 'Good', displayName: '', publishConsent: true, photoPublishConsent: true, website: '',
  })
  assert.equal(JSON.stringify(submit).includes('photoFileId'), false)
  assert.equal(JSON.stringify(submit).includes('hasPhoto'), false)
  assert.equal(JSON.stringify(submit).includes('rewardPercent'), false)
})

test('load requires a server boolean hasPhoto and demo reward follows in-memory photo state', () => {
  const base = { sourceType: 'cake', label: 'Verified cake order', experienceDate: '2026-07-01' }
  assert.equal(parseLoadReviewInviteResult({ ...base, hasPhoto: true }).hasPhoto, true)
  assert.equal(parseLoadReviewInviteResult({ ...base, hasPhoto: false }).hasPhoto, false)
  assert.throws(() => parseLoadReviewInviteResult(base), /INVALID_REVIEW_RESPONSE/)
  assert.equal(reviewDemoSubmission(false).rewardPercent, 5)
  assert.equal(reviewDemoSubmission(true).rewardPercent, 10)
})

test('repository uploads base64 webp and parses only boolean attachment state', async () => {
  const bodies: unknown[] = []
  const executor = {
    async createExecution(input: { body: string }) {
      bodies.push(JSON.parse(input.body))
      return completed({ uploaded: true, hasPhoto: true, fileId: 'private-server-id' })
    },
  }
  const blob = new Blob([Uint8Array.of(1, 2, 3)], { type: 'image/webp' })
  assert.deepEqual(await uploadReviewPhoto(executor, 'review-api', TOKEN, blob), { uploaded: true, hasPhoto: true })
  assert.deepEqual(bodies, [buildUploadReviewPhotoPayload(TOKEN, 'AQID', 3)])
  assert.equal(JSON.stringify(bodies).includes('fileId'), false)
})

test('repository removes by token only and rejects malformed allowlist results stably', async () => {
  const bodies: unknown[] = []
  const executor = {
    async createExecution(input: { body: string }) {
      bodies.push(JSON.parse(input.body))
      return completed({ removed: true, hasPhoto: false, ignored: 'x' })
    },
  }
  assert.deepEqual(await removeReviewPhoto(executor, 'review-api', TOKEN), { removed: true, hasPhoto: false })
  assert.deepEqual(bodies, [buildRemoveReviewPhotoPayload(TOKEN)])

  const malformed = { async createExecution() { return completed({ hasPhoto: true }) } }
  await assert.rejects(() => uploadReviewPhoto(malformed, 'review-api', TOKEN, new Blob(['x'], { type: 'image/webp' })),
    (error: unknown) => (error as { code?: unknown }).code === 'REVIEW_INVITE_REQUEST_FAILED')
})
