import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import sharp from 'sharp'
import {
  MAX_REVIEW_PHOTO_BYTES,
  decodePhotoUpload,
  normalizeReviewPhoto,
  cleanupPhotoFiles,
  removeReviewPhoto,
  uploadReviewPhoto,
} from '../functions/review-api/src/photo.js'
import { ReviewApiError, hashSecret } from '../functions/review-api/src/business.js'
import { createReviewPhotoStorage } from '../functions/review-api/src/main.js'

const VALID_TOKEN = 'A'.repeat(43)
const NOW = new Date('2026-07-19T00:00:00.000Z')
const ACTIVE_INVITE = {
  $id: 'invite-1',
  sourceType: 'cake',
  sourceReservationId: 'cake-1',
  tokenHash: hashSecret(VALID_TOKEN),
  expiresAt: '2026-08-18T00:00:00.000Z',
}
const COMPLETED_SOURCE = { $id: 'cake-1', status: '픽업완료' }

function reviewError(code) {
  return (error) => error instanceof ReviewApiError && error.code === code
}

async function tinyWebp(options = {}) {
  return sharp({
    create: {
      width: options.width || 3,
      height: options.height || 2,
      channels: 4,
      background: { r: 220, g: 90, b: 60, alpha: 1 },
    },
  }).webp({ quality: 90 }).toBuffer()
}

function makePhotoRepository(overrides = {}) {
  const calls = []
  return {
    calls,
    async findInviteByTokenHash(tokenHash, transaction) {
      calls.push(['findInvite', tokenHash, transaction])
      return overrides.invite === null ? null : { ...ACTIVE_INVITE, ...(overrides.invite || {}) }
    },
    async getSource(sourceType, id, transaction) {
      calls.push(['getSource', sourceType, id, transaction])
      return overrides.source === null ? null : { ...COMPLETED_SOURCE, ...(overrides.source || {}) }
    },
    async beginTransaction() { calls.push(['begin']); return { id: 'tx-photo' } },
    async updateInvite(id, data, transaction) {
      calls.push(['updateInvite', id, data, transaction])
      if (overrides.updateError) throw overrides.updateError
    },
    async commitTransaction(transaction) {
      calls.push(['commit', transaction])
      if (overrides.commitError) throw overrides.commitError
    },
    async rollbackTransaction(transaction) { calls.push(['rollback', transaction]) },
    async getInvite(id) {
      calls.push(['getInvite', id])
      if (overrides.refetchError) throw overrides.refetchError
      return overrides.refetchedInvite === null ? null : { ...ACTIVE_INVITE, ...(overrides.refetchedInvite || overrides.invite || {}), $id: id }
    },
    async enqueuePhotoCleanup(entry, transaction) {
      calls.push(['enqueueCleanup', entry, transaction])
      if (overrides.enqueueError) throw overrides.enqueueError
    },
    async updatePhotoCleanup(id, data, transaction) {
      calls.push(['updateCleanup', id, data, transaction])
      if (overrides.updateCleanupError) throw overrides.updateCleanupError
    },
    async deletePhotoCleanup(id, transaction) {
      calls.push(['deleteCleanup', id, transaction])
      if (overrides.deleteCleanupError) throw overrides.deleteCleanupError
    },
  }
}

function makePhotoStorage(overrides = {}) {
  const calls = []
  return {
    calls,
    async createPrivatePhoto(input) {
      calls.push(['create', input])
      if (overrides.createError) throw overrides.createError
    },
    async deletePhoto(id) {
      calls.push(['delete', id])
      if (overrides.deleteError) throw overrides.deleteError
    },
  }
}

test('photo upload decoder accepts canonical nonempty webp base64 and exact optional byte length', async () => {
  const image = await tinyWebp()
  assert.deepEqual(decodePhotoUpload({
    mimeType: 'image/webp',
    base64: image.toString('base64'),
    byteLength: image.length,
  }), image)
})

test('photo upload decoder rejects MIME, malformed/noncanonical base64, empty input, length mismatch, and oversize', () => {
  const cases = [
    [{ mimeType: 'image/png', base64: 'YQ==' }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: '' }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: 'YQ' }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: 'YQ==junk' }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: 'YR==' }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: 'YQ==', byteLength: 2 }, 'PHOTO_INVALID'],
    [{ mimeType: 'image/webp', base64: Buffer.alloc(MAX_REVIEW_PHOTO_BYTES + 1).toString('base64') }, 'PHOTO_TOO_LARGE'],
  ]
  for (const [input, code] of cases) assert.throws(() => decodePhotoUpload(input), reviewError(code))
})

test('photo normalization accepts actual webp, strips metadata, rotates, and bounds dimensions', async () => {
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: '#336699' },
  }).withMetadata({ orientation: 6 }).webp().toBuffer()
  const output = await normalizeReviewPhoto(source)
  const metadata = await sharp(output).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width, 800)
  assert.equal(metadata.height, 1600)
  assert.equal(metadata.orientation, undefined)
  assert.ok(output.length <= MAX_REVIEW_PHOTO_BYTES)
})

test('photo normalization rejects MIME/actual format mismatch, animation, pixel bombs, and invalid bytes stably', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(() => normalizeReviewPhoto(png), reviewError('PHOTO_INVALID'))
  await assert.rejects(() => normalizeReviewPhoto(Buffer.from('not an image')), reviewError('PHOTO_INVALID'))

  const red = await sharp({ create: { width: 2, height: 2, channels: 4, background: 'red' } }).png().toBuffer()
  const blue = await sharp({ create: { width: 2, height: 2, channels: 4, background: 'blue' } }).png().toBuffer()
  const animated = await sharp([red, blue], { join: { animated: true } })
    .webp({ loop: 0, delay: [100, 100] }).toBuffer()
  await assert.rejects(() => normalizeReviewPhoto(animated), reviewError('PHOTO_INVALID'))

  const pixelBombHeader = Buffer.from('UklGRiIAAABXRUJQVlA4WAoAAAAwMDAw/////wAAAA==', 'base64')
  await assert.rejects(() => normalizeReviewPhoto(pixelBombHeader),
    (error) => error instanceof ReviewApiError && ['PHOTO_INVALID', 'PHOTO_TOO_LARGE'].includes(error.code))
})

test('upload validates active completed invite, stores a private randomized webp, and atomically attaches it', async () => {
  const repository = makePhotoRepository()
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  const result = await uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'), byteLength: image.length,
  }, {
    now: NOW,
    idFactory: () => 'random-file-id',
    nameFactory: () => 'random-name.webp',
  })
  assert.deepEqual(result, { uploaded: true, hasPhoto: true })
  const create = storage.calls[0][1]
  assert.equal(create.fileId, 'random-file-id')
  assert.equal(create.name, 'random-name.webp')
  assert.equal(create.mimeType, 'image/webp')
  assert.ok(Buffer.isBuffer(create.buffer))
  assert.equal('permissions' in create, false)
  assert.deepEqual(repository.calls.find(([name]) => name === 'updateInvite').slice(1, 3), [
    'invite-1',
    { pendingPhotoFileId: 'random-file-id', pendingPhotoUploadedAt: NOW.toISOString(), photoUploadCount: 1 },
  ])
  assert.equal(repository.calls.some(([name]) => name === 'commit'), true)
})

test('upload replacement deletes the old pending file only after commit', async () => {
  const repository = makePhotoRepository({ invite: { pendingPhotoFileId: 'old-private-file' } })
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  await uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'new-private-file', nameFactory: () => 'new.webp' })
  assert.deepEqual(storage.calls.map(([name, value]) => [name, typeof value === 'object' ? value.fileId : value]), [
    ['create', 'new-private-file'],
    ['delete', 'old-private-file'],
  ])
  assert.ok(repository.calls.findIndex(([name]) => name === 'commit') < repository.calls.length)
})

test('upload compensates the new file on transaction/race failure and never deletes the current old file', async () => {
  const conflict = Object.assign(new Error('used invite race'), { code: 409 })
  const repository = makePhotoRepository({ invite: { pendingPhotoFileId: 'old-private-file' }, commitError: conflict })
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  await assert.rejects(() => uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'new-private-file', nameFactory: () => 'new.webp', isConflict: (error) => error.code === 409 }),
  (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_CHANGED')
  assert.deepEqual(storage.calls.map(([name, value]) => [name, typeof value === 'object' ? value.fileId : value]), [
    ['create', 'new-private-file'],
    ['delete', 'new-private-file'],
  ])
  assert.equal(repository.calls.some(([name]) => name === 'rollback'), true)
})

test('upload compensates the new file when beginning the attach transaction fails', async () => {
  const repository = makePhotoRepository()
  repository.beginTransaction = async () => { throw new Error('transaction unavailable') }
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  await assert.rejects(() => uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'orphan-candidate', nameFactory: () => 'random.webp' }), /transaction unavailable/)
  assert.deepEqual(storage.calls.map(([name, value]) => [name, typeof value === 'object' ? value.fileId : value]), [
    ['create', 'orphan-candidate'],
    ['delete', 'orphan-candidate'],
  ])
})

test('upload rejects inactive or incomplete invites before creating storage files', async () => {
  const image = await tinyWebp()
  for (const overrides of [
    { invite: { usedAt: NOW.toISOString() } },
    { source: { status: '예약확정' } },
  ]) {
    const repository = makePhotoRepository(overrides)
    const storage = makePhotoStorage()
    await assert.rejects(() => uploadReviewPhoto(repository, storage, VALID_TOKEN, {
      mimeType: 'image/webp', base64: image.toString('base64'),
    }, { now: NOW }), reviewError('REVIEW_INVITE_INVALID'))
    assert.deepEqual(storage.calls, [])
  }
})

test('remove photo atomically clears pending fields, then best-effort deletes, and is idempotent', async () => {
  for (const pendingPhotoFileId of ['pending-file', undefined]) {
    const repository = makePhotoRepository({ invite: { pendingPhotoFileId } })
    const storage = makePhotoStorage({ deleteError: new Error('best effort') })
    assert.deepEqual(await removeReviewPhoto(repository, storage, VALID_TOKEN, { now: NOW }), { removed: true, hasPhoto: false })
    const update = repository.calls.find(([name]) => name === 'updateInvite')
    assert.deepEqual(update.slice(1, 3), [
      'invite-1',
      { pendingPhotoFileId: null, pendingPhotoUploadedAt: null },
    ])
    assert.equal(repository.calls.some(([name]) => name === 'commit'), true)
    assert.deepEqual(storage.calls, pendingPhotoFileId ? [
      ['delete', pendingPhotoFileId], ['delete', pendingPhotoFileId], ['delete', pendingPhotoFileId],
    ] : [])
  }
})

test('remove validates the source is still completed before clearing the pending photo', async () => {
  const repository = makePhotoRepository({ source: { status: '예약확정' }, invite: { pendingPhotoFileId: 'keep-file' } })
  const storage = makePhotoStorage()
  await assert.rejects(() => removeReviewPhoto(repository, storage, VALID_TOKEN, { now: NOW }), reviewError('REVIEW_INVITE_INVALID'))
  assert.equal(repository.calls.some(([name]) => name === 'updateInvite'), false)
  assert.deepEqual(storage.calls, [])
})

test('storage adapter uses Appwrite InputFile with private permissions and configured bucket', async () => {
  const calls = []
  const storage = createReviewPhotoStorage({
    async createFile(params) { calls.push(['create', params]) },
    async deleteFile(params) { calls.push(['delete', params]) },
    async updateFile(params) { calls.push(['update', params]) },
  }, { reviewPhotosBucketId: 'private-review-photos' })
  const bytes = await tinyWebp()
  await storage.createPrivatePhoto({ fileId: 'server-id', name: 'server-random.webp', buffer: bytes, mimeType: 'image/webp' })
  await storage.deletePhoto('server-id')
  await storage.makePublic('server-id')
  await storage.makePrivate('server-id')
  assert.equal(calls[0][1].bucketId, 'private-review-photos')
  assert.equal(calls[0][1].fileId, 'server-id')
  assert.equal(calls[0][1].file.name, 'server-random.webp')
  assert.equal(calls[0][1].file.size, bytes.length)
  assert.deepEqual(calls[0][1].permissions, [])
  assert.deepEqual(calls[1][1], { bucketId: 'private-review-photos', fileId: 'server-id' })
  assert.deepEqual(calls[2][1], {
    bucketId: 'private-review-photos', fileId: 'server-id', permissions: ['read("any")'],
  })
  assert.deepEqual(calls[3][1], {
    bucketId: 'private-review-photos', fileId: 'server-id', permissions: [],
  })
})

test('upload commit transport error refetches and treats the newly attached file as committed', async () => {
  const repository = makePhotoRepository({
    invite: { pendingPhotoFileId: 'old-private-file' },
    refetchedInvite: { pendingPhotoFileId: 'new-private-file', photoUploadCount: 1 },
    commitError: new Error('transport reset after server commit'),
  })
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  assert.deepEqual(await uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'new-private-file', nameFactory: () => 'new.webp' }), { uploaded: true, hasPhoto: true })
  assert.deepEqual(storage.calls.map(([name, value]) => [name, typeof value === 'object' ? value.fileId : value]), [
    ['create', 'new-private-file'], ['delete', 'old-private-file'],
  ])
})

test('upload commit ambiguity never deletes a potentially referenced file and records reconciliation', async () => {
  const repository = makePhotoRepository({ commitError: new Error('transport reset'), refetchError: new Error('read unavailable') })
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  await assert.rejects(() => uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'uncertain-file', nameFactory: () => 'uncertain.webp' }), reviewError('PHOTO_UPLOAD_UNCERTAIN'))
  assert.deepEqual(storage.calls.map(([name]) => name), ['create'])
  const entry = repository.calls.filter(([name]) => name === 'enqueueCleanup').at(-1)[1]
  assert.equal(entry.inviteId, 'invite-1')
  assert.equal(entry.fileId, 'uncertain-file')
  assert.equal(entry.reason, 'uncertain_attach')
})

test('remove commit transport error deletes only when an outside refetch confirms attachment cleared', async () => {
  for (const [refetchedPhoto, expectedDeletes, expectedCode] of [[null, ['pending-file'], null], ['pending-file', [], 'REVIEW_INVITE_CHANGED']]) {
    const repository = makePhotoRepository({
      invite: { pendingPhotoFileId: 'pending-file' }, refetchedInvite: { pendingPhotoFileId: refetchedPhoto },
      commitError: new Error('transport reset'),
    })
    const storage = makePhotoStorage()
    const operation = removeReviewPhoto(repository, storage, VALID_TOKEN, { now: NOW })
    if (expectedCode) await assert.rejects(() => operation, reviewError(expectedCode))
    else assert.deepEqual(await operation, { removed: true, hasPhoto: false })
    assert.deepEqual(storage.calls.map(([, id]) => id), expectedDeletes)
  }
})

test('upload enforces a lifetime cap of ten and increments a missing count transactionally', async () => {
  const image = await tinyWebp()
  const capped = makePhotoRepository({ invite: { photoUploadCount: 10 } })
  const cappedStorage = makePhotoStorage()
  await assert.rejects(() => uploadReviewPhoto(capped, cappedStorage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW }), reviewError('PHOTO_UPLOAD_LIMIT_REACHED'))
  assert.deepEqual(cappedStorage.calls, [])

  const repository = makePhotoRepository()
  await uploadReviewPhoto(repository, makePhotoStorage(), VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'first-file' })
  assert.equal(repository.calls.find(([name]) => name === 'updateInvite')[2].photoUploadCount, 1)
})

test('durable cleanup retries three times then writes a PII-free ledger entry', async () => {
  const repository = makePhotoRepository()
  const storage = makePhotoStorage({ deleteError: new Error('storage unavailable') })
  const result = await cleanupPhotoFiles(repository, storage, {
    fileId: 'private-file', inviteId: 'invite-1', reason: 'replacement', now: NOW,
  })
  assert.equal(result, 'queued')
  assert.equal(storage.calls.length, 3)
  const entry = repository.calls.find(([name]) => name === 'enqueueCleanup')[1]
  assert.deepEqual(entry, {
    fileId: 'private-file', inviteId: 'invite-1', reason: 'replacement', status: 'pending', attempts: 3,
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  })
})

test('admin cleanup bounds batches and never deletes an uncertain file still referenced by its invite', async () => {
  const calls = []
  const repository = {
    async listPhotoCleanup(limit) { calls.push(['list', limit]); return [
      { $id: 'cleanup-1', fileId: 'referenced-file', inviteId: 'invite-1', reason: 'uncertain_attach', attempts: 3 },
      { $id: 'cleanup-2', fileId: 'orphan-file', inviteId: 'invite-2', reason: 'remove', attempts: 3 },
    ] },
    async getInvite(id) { return { $id: id, pendingPhotoFileId: id === 'invite-1' ? 'referenced-file' : null } },
    async deletePhotoCleanup(id) { calls.push(['done', id]) },
    async updatePhotoCleanup(id, data) { calls.push(['update', id, data]) },
  }
  const storage = makePhotoStorage()
  const result = await cleanupPhotoFiles(repository, storage, { batchLimit: 100, now: NOW })
  assert.deepEqual(result, { processed: 2, deleted: 1, retained: 1, failed: 0 })
  assert.deepEqual(storage.calls, [['delete', 'orphan-file']])
  assert.deepEqual(calls[0], ['list', 25])
  assert.equal(JSON.stringify(result).includes('file'), false)
})

test('upload reserves a staged-upload ledger before Storage and atomically promotes it with the invite attachment', async () => {
  const events = []
  const repository = makePhotoRepository({ invite: { pendingPhotoFileId: 'old-private-file' } })
  for (const method of ['enqueuePhotoCleanup', 'updateInvite', 'deletePhotoCleanup', 'commitTransaction']) {
    const original = repository[method].bind(repository)
    repository[method] = async (...args) => {
      events.push([method, ...args])
      return original(...args)
    }
  }
  const storage = makePhotoStorage()
  storage.createPrivatePhoto = async (input) => { events.push(['createPrivatePhoto', input]) }
  const image = await tinyWebp()

  await uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'new-private-file', nameFactory: () => 'new.webp' })

  assert.deepEqual(events.map(([name]) => name), [
    'enqueuePhotoCleanup', 'createPrivatePhoto', 'enqueuePhotoCleanup',
    'updateInvite', 'deletePhotoCleanup', 'commitTransaction', 'deletePhotoCleanup',
  ])
  assert.deepEqual(events[0].slice(1, 2), [{
    fileId: 'new-private-file', inviteId: 'invite-1', reason: 'staged_upload', status: 'staging', attempts: 0,
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  }])
  assert.equal(events[2][1].fileId, 'old-private-file')
  assert.equal(events[2][1].reason, 'replacement')
  assert.equal(events[2][1].status, 'pending')
  assert.deepEqual(events[2][2], { id: 'tx-photo' })
  assert.deepEqual(events[4].slice(1), ['new-private-file', { id: 'tx-photo' }])
})

test('staged ledger failure prevents Storage creation and leaves no untracked upload', async () => {
  const repository = makePhotoRepository({ enqueueError: new Error('ledger unavailable') })
  const storage = makePhotoStorage()
  const image = await tinyWebp()
  await assert.rejects(() => uploadReviewPhoto(repository, storage, VALID_TOKEN, {
    mimeType: 'image/webp', base64: image.toString('base64'),
  }, { now: NOW, idFactory: () => 'never-created-file' }), reviewError('PHOTO_CLEANUP_RECORD_FAILED'))
  assert.deepEqual(storage.calls, [])
})

test('cleanup converges after Storage 404 and after a prior delete whose ledger removal failed', async () => {
  const entries = [{
    $id: 'gone-file', fileId: 'gone-file', inviteId: 'invite-1', reason: 'remove', status: 'pending', attempts: 3,
  }]
  const deletedRows = []
  const repository = {
    async listPhotoCleanup() { return entries },
    async deletePhotoCleanup(id) { deletedRows.push(id) },
    async updatePhotoCleanup() {},
  }
  const storage = { async deletePhoto() { throw Object.assign(new Error('file missing'), { code: 404 }) } }
  assert.deepEqual(await cleanupPhotoFiles(repository, storage, { now: NOW }), {
    processed: 1, deleted: 1, retained: 0, failed: 0,
  })
  assert.deepEqual(deletedRows, ['gone-file'])
})

test('cleanup dead-letters bounded poison rows so newer pending work is not permanently starved', async () => {
  const poison = Array.from({ length: 25 }, (_, index) => ({
    $id: `poison-${index}`, fileId: `poison-${index}`, inviteId: 'invite-1', reason: 'remove', status: 'pending', attempts: 8,
  }))
  const newer = { $id: 'newer', fileId: 'newer', inviteId: 'invite-2', reason: 'remove', status: 'pending', attempts: 0 }
  const rows = [...poison, newer]
  const repository = {
    async listPhotoCleanup(limit) { return rows.filter(({ status }) => status === 'pending').slice(0, limit) },
    async updatePhotoCleanup(id, data) { Object.assign(rows.find((row) => row.$id === id), data) },
    async deletePhotoCleanup(id) { rows.splice(rows.findIndex((row) => row.$id === id), 1) },
  }
  const storage = {
    async deletePhoto(id) {
      if (id.startsWith('poison-')) throw new Error('persistent poison')
    },
  }
  const first = await cleanupPhotoFiles(repository, storage, { now: NOW })
  const second = await cleanupPhotoFiles(repository, storage, { now: NOW })
  assert.equal(first.failed, 25)
  assert.equal(rows.filter(({ status }) => status === 'failed').length, 25)
  assert.equal(second.deleted, 1)
  assert.equal(rows.some(({ $id }) => $id === 'newer'), false)
})

test('staged and uncertain cleanup resolves referenced files without deleting Storage', async () => {
  for (const reason of ['staged_upload', 'uncertain_attach']) {
    const deletedRows = []
    const repository = {
      async listPhotoCleanup() { return [{
        $id: `${reason}-file`, fileId: `${reason}-file`, inviteId: 'invite-1', reason,
        status: reason === 'staged_upload' ? 'staging' : 'pending', attempts: 0,
        createdAt: '2026-07-18T00:00:00.000Z',
      }] },
      async getInvite() { return { pendingPhotoFileId: `${reason}-file` } },
      async deletePhotoCleanup(id) { deletedRows.push(id) },
      async updatePhotoCleanup() {},
    }
    const storage = makePhotoStorage()
    const result = await cleanupPhotoFiles(repository, storage, { now: NOW })
    assert.equal(result.retained, 1)
    assert.deepEqual(storage.calls, [])
    assert.deepEqual(deletedRows, [`${reason}-file`])
  }
})
