import { InputFile } from 'node-appwrite/file'
import { photoFail } from './custom-cake-photo-codec.js'

/** Bootstrap must verify the additive private bucket schema/permissions before
 * setting privateBucketVerified. No public URL or file permission is exposed.
 * A failed create is ambiguous; only a complete, private, immutable file proves
 * settlement. A 404 leaves unresolved intent for later recovery/operator review.
 */
export function createCustomCakePhotoStorage(storage, { bucketId, privateBucketVerified } = {}) {
  const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
  if (!id.test(bucketId ?? '') || privateBucketVerified !== true || !storage || ['createFile', 'getFile', 'getFileDownload', 'deleteFile'].some(k => typeof storage[k] !== 'function')) photoFail('CAPABILITY_UNAVAILABLE')
  const params = fileId => { if (typeof fileId !== 'string' || !id.test(fileId)) photoFail('PHOTO_STATE_CONFLICT'); return { bucketId, fileId } }
  function complete(record, fileId) {
    return record?.$id === fileId && Array.isArray(record.$permissions) && record.$permissions.length === 0 && record.mimeType === 'image/webp' &&
      Number.isSafeInteger(record.chunksTotal) && record.chunksTotal > 0 && record.chunksUploaded === record.chunksTotal &&
      Number.isSafeInteger(record.sizeOriginal) && record.sizeOriginal > 0 && record.sizeOriginal <= 10485760
  }
  async function read(fileId) {
    const p = params(fileId), record = await storage.getFile(p)
    if (!complete(record, fileId)) photoFail('NOT_FOUND')
    const bytes = Buffer.from(await storage.getFileDownload(p))
    if (bytes.length !== record.sizeOriginal) photoFail('NOT_FOUND')
    return bytes
  }
  return {
    async upload(fileId, bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 10485760) photoFail('PHOTO_STATE_CONFLICT')
      const record = await storage.createFile({ ...params(fileId), file: InputFile.fromBuffer(bytes, `${fileId}.webp`), permissions: [] })
      if (!complete(record, fileId) || record.sizeOriginal !== bytes.length) photoFail('PHOTO_STATE_CONFLICT')
    },
    read,
    async resolveUpload(fileId) { try { return { settled: true, bytes: await read(fileId) } } catch { return { settled: false } } },
    delete: fileId => storage.deleteFile(params(fileId)),
  }
}
