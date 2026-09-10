import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-photo-codec.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }
const make = (width = 32, height = 16) => sharp({ create: { width, height, channels: 3, background: '#aa5588' } })
function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]), chunk = Buffer.alloc(data.length + 12)
  chunk.writeUInt32BE(data.length); content.copy(chunk, 4)
  let crc = 0xffffffff
  for (const byte of content) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4)
  return chunk
}
function pngData(png) {
  const chunks = []
  for (let at = 8; at < png.length;) { const n = png.readUInt32BE(at); if (png.toString('ascii', at + 4, at + 8) === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + n)); at += n + 12 }
  return Buffer.concat(chunks)
}

test('real JPEG PNG and WebP decode to deterministic metadata-free WebP without upscaling', async () => {
  const m = await load(); assert.equal(typeof m.normalizeCustomCakePhoto, 'function')
  for (const [format, mimeType] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    const input = await make()[format]().withMetadata({ orientation: 6 }).toBuffer()
    const output = await m.normalizeCustomCakePhoto(input, mimeType)
    const meta = await sharp(output.bytes).metadata()
    assert.equal(meta.format, 'webp'); assert.equal(meta.width, 16); assert.equal(meta.height, 32)
    for (const key of ['exif', 'icc', 'iptc', 'xmp', 'orientation']) assert.equal(meta[key], undefined)
    assert.deepEqual(await m.normalizeCustomCakePhoto(input, mimeType), output)
  }
})

test('strict base64 rejects noncanonical input and permits exactly 10 MiB', async () => {
  const m = await load(); assert.equal(typeof m.decodeCustomCakePhotoInput, 'function')
  for (const base64 of ['', 'a===', 'Zh==', 'Zg==\n', 'data:image/png;base64,Zg==']) assert.throws(() => m.decodeCustomCakePhotoInput(base64), { code: 'PHOTO_INVALID_IMAGE' })
  assert.equal(m.decodeCustomCakePhotoInput(Buffer.alloc(10485760).toString('base64')).length, 10485760)
  assert.throws(() => m.decodeCustomCakePhotoInput(Buffer.alloc(10485761).toString('base64')), { code: 'PHOTO_TOO_LARGE' })
})

test('real decode enforces inclusive pixel bounds, 2560 output, MIME signature and truncation', async () => {
  const m = await load(); assert.equal(typeof m.normalizeCustomCakePhoto, 'function')
  const inclusive = await make(5000, 4000).png().toBuffer()
  const out = await m.normalizeCustomCakePhoto(inclusive, 'image/png')
  assert.equal(out.width, 2560); assert.equal(out.height, 2048)
  const oversized = await make(5001, 4000).png().toBuffer()
  await assert.rejects(m.normalizeCustomCakePhoto(oversized, 'image/png'), { code: 'PHOTO_TOO_LARGE' })
  for (const [bytes, mime] of [[inclusive, 'image/jpeg'], [Buffer.from('<svg/>'), 'image/png'], [inclusive.subarray(0, inclusive.length - 12), 'image/png'], [Buffer.from('/9j/2Q==', 'base64'), 'image/jpeg']]) await assert.rejects(m.normalizeCustomCakePhoto(bytes, mime), { code: 'PHOTO_INVALID_IMAGE' })
})

test('animation, APNG chunks and JPEG multi-picture markers cannot be flattened', async () => {
  const m = await load(); assert.equal(typeof m.normalizeCustomCakePhoto, 'function')
  const pixels = Buffer.concat([Buffer.alloc(24, 0), Buffer.alloc(24, 255)])
  const animation = await sharp(pixels, { raw: { width: 4, height: 4, channels: 3, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer()
  assert.equal((await sharp(animation).metadata()).pages, 2, 'fixture must actually contain two frames')
  await assert.rejects(m.normalizeCustomCakePhoto(animation, 'image/webp'), { code: 'PHOTO_INVALID_IMAGE' })
  const png = await make().png().toBuffer(), second = await sharp({ create: { width: 32, height: 16, channels: 3, background: 'red' } }).png().toBuffer()
  const control = Buffer.alloc(8); control.writeUInt32BE(2)
  const frame = sequence => { const b = Buffer.alloc(26); b.writeUInt32BE(sequence); b.writeUInt32BE(32, 4); b.writeUInt32BE(16, 8); b.writeUInt16BE(1, 20); b.writeUInt16BE(10, 22); return pngChunk('fcTL', b) }
  const sequence = Buffer.alloc(4); sequence.writeUInt32BE(2)
  const apng = Buffer.concat([png.subarray(0, 33), pngChunk('acTL', control), frame(0), pngChunk('IDAT', pngData(png)), frame(1), pngChunk('fdAT', Buffer.concat([sequence, pngData(second)])), pngChunk('IEND', Buffer.alloc(0))])
  assert.ok((await sharp(apng, { failOn: 'warning' }).raw().toBuffer()).length, 'valid APNG can otherwise decode/flatten')
  await assert.rejects(m.normalizeCustomCakePhoto(apng, 'image/png'), { code: 'PHOTO_INVALID_IMAGE' })
  const jpeg = await make().jpeg().toBuffer(), mpf = Buffer.from([255, 226, 0, 8, 77, 80, 70, 0, 0, 0])
  await assert.rejects(m.normalizeCustomCakePhoto(Buffer.concat([jpeg.subarray(0, 2), mpf, jpeg.subarray(2)]), 'image/jpeg'), { code: 'PHOTO_INVALID_IMAGE' })
  assert.ok((await sharp(Buffer.concat([jpeg, jpeg]), { failOn: 'warning' }).raw().toBuffer()).length, 'JPEG decoder otherwise ignores an appended second image')
  await assert.rejects(m.normalizeCustomCakePhoto(Buffer.concat([jpeg, jpeg]), 'image/jpeg'), { code: 'PHOTO_INVALID_IMAGE' })
})
