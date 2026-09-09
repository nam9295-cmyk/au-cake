import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-photo-storage.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }
test('private storage adapter uploads normalized WebP with empty permissions and no URL', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakePhotoStorage, 'function')
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).webp().toBuffer()
  const calls = [], record = { $id: 'file1', $permissions: [], mimeType: 'image/webp', chunksTotal: 1, chunksUploaded: 1, sizeOriginal: bytes.length }
  const sdk = {
    async createFile(args) { calls.push(['create', args]); return record },
    async getFile(args) { calls.push(['get', args]); return record },
    async getFileDownload(args) { calls.push(['download', args]); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) },
    async deleteFile(args) { calls.push(['delete', args]) },
  }
  assert.throws(() => m.createCustomCakePhotoStorage(sdk, { bucketId: 'private' }), { code: 'CAPABILITY_UNAVAILABLE' })
  const storage = m.createCustomCakePhotoStorage(sdk, { bucketId: 'private', privateBucketVerified: true })
  await storage.upload('file1', bytes)
  assert.deepEqual(calls[0][1].permissions, []); assert.equal(calls[0][1].file.name, 'file1.webp')
  assert.deepEqual(Buffer.from(await calls[0][1].file.arrayBuffer()), bytes)
  assert.deepEqual(await storage.read('file1'), bytes)
  assert.deepEqual(await storage.resolveUpload('file1'), { settled: true, bytes })
  await storage.delete('file1')
  for (const [, args] of calls) { assert.equal(args.bucketId, 'private'); assert.equal(args.fileId, 'file1') }
})

test('storage absence, incomplete chunks or public metadata fail before download', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakePhotoStorage, 'function')
  const good = { $id: 'f1', $permissions: [], mimeType: 'image/webp', chunksTotal: 1, chunksUploaded: 1, sizeOriginal: 2 }
  for (const record of [null, { ...good, chunksUploaded: 0 }, { ...good, $permissions: ['read("any")'] }, { ...good, sizeOriginal: 10485761 }, { ...good, mimeType: 'image/jpeg' }]) {
    let downloads = 0
    const sdk = { async createFile() {}, async deleteFile() {}, async getFile() { if (!record) throw Object.assign(new Error('missing'), { code: 404 }); return record }, async getFileDownload() { downloads++; return Uint8Array.from([1, 2]) } }
    const storage = m.createCustomCakePhotoStorage(sdk, { bucketId: 'private', privateBucketVerified: true })
    assert.deepEqual(await storage.resolveUpload('f1'), { settled: false })
    assert.equal(downloads, 0)
  }
})

test('valid storage metadata with a failed download does not prove settled upload', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakePhotoStorage, 'function')
  const record = { $id: 'f1', $permissions: [], mimeType: 'image/webp', chunksTotal: 1, chunksUploaded: 1, sizeOriginal: 2 }
  let downloads = 0
  const sdk = { async createFile() {}, async deleteFile() {}, async getFile() { return record }, async getFileDownload() { downloads++; throw new Error('uncertain') } }
  const storage = m.createCustomCakePhotoStorage(sdk, { bucketId: 'private', privateBucketVerified: true })
  assert.deepEqual(await storage.resolveUpload('f1'), { settled: false })
  assert.equal(downloads, 1)
})
