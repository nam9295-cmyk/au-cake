import sharp from 'sharp'

export const CUSTOM_CAKE_PHOTO_LIMITS = Object.freeze({
  maxPhotosPerRequest: 5, maxInputBytes: 10485760, maxDecodedPixels: 20000000,
  maxStoredDimension: 2560, allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  storedMimeType: 'image/webp', maxFrames: 1,
})
const status = { INVALID_REQUEST: 400, PHOTO_INVALID_IMAGE: 400, PHOTO_TOO_LARGE: 413, PHOTO_SESSION_INVALID: 403, PHOTO_SESSION_EXPIRED: 403, FORBIDDEN: 403, NOT_FOUND: 404, PHOTO_UPLOAD_CONFLICT: 409, PHOTO_STATE_CONFLICT: 409, PHOTO_LIMIT_EXCEEDED: 409, CAPABILITY_UNAVAILABLE: 503, INVALID_PHOTO_REFERENCE: 400 }
export function photoFail(code) { throw Object.assign(new Error(code), { code, status: status[code] ?? 503 }) }

export function decodeCustomCakePhotoInput(base64) {
  if (typeof base64 !== 'string' || !base64.length) photoFail('PHOTO_INVALID_IMAGE')
  if (base64.length > 4 * Math.ceil(10485760 / 3)) photoFail('PHOTO_TOO_LARGE')
  if (base64.length % 4) photoFail('PHOTO_INVALID_IMAGE')
  const end = base64.length - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  for (let i = 0; i < end; i++) {
    const c = base64.charCodeAt(i)
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47)) photoFail('PHOTO_INVALID_IMAGE')
  }
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length > 10485760) photoFail('PHOTO_TOO_LARGE')
  if (!bytes.length || bytes.toString('base64') !== base64) photoFail('PHOTO_INVALID_IMAGE')
  return bytes
}

// Container checks catch animation that a decoder may silently flatten. Pixel
// decoding below remains mandatory: signatures alone never establish validity.
function containerFormat(b) {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let at = 8, ended = false
    while (at + 12 <= b.length) {
      const size = b.readUInt32BE(at), type = b.toString('ascii', at + 4, at + 8)
      if (size > b.length - at - 12 || ['acTL', 'fcTL', 'fdAT'].includes(type)) photoFail('PHOTO_INVALID_IMAGE')
      at += size + 12
      if (type === 'IEND') { if (size !== 0) photoFail('PHOTO_INVALID_IMAGE'); ended = true; break }
    }
    if (!ended || at !== b.length) photoFail('PHOTO_INVALID_IMAGE')
    return 'png'
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    if (b.length < 20 || b.readUInt32LE(4) + 8 !== b.length) photoFail('PHOTO_INVALID_IMAGE')
    let at = 12
    while (at + 8 <= b.length) {
      const type = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4)
      if (size > b.length - at - 8 || ['ANIM', 'ANMF'].includes(type) || (type === 'VP8X' && size > 0 && (b[at + 8] & 2))) photoFail('PHOTO_INVALID_IMAGE')
      at += 8 + size + (size % 2)
    }
    if (at !== b.length) photoFail('PHOTO_INVALID_IMAGE')
    return 'webp'
  }
  if (b[0] === 255 && b[1] === 216) {
    let at = 2, scan = false, ended = false
    while (at < b.length) {
      if (b[at++] !== 255) { if (!scan) photoFail('PHOTO_INVALID_IMAGE'); continue }
      while (b[at] === 255) at++
      const marker = b[at++]
      if (scan && (marker === 0 || (marker >= 208 && marker <= 215))) continue
      if (marker === 217) { ended = true; break }
      if (marker === 216 || at + 2 > b.length) photoFail('PHOTO_INVALID_IMAGE')
      const size = b.readUInt16BE(at)
      if (size < 2 || at + size > b.length || (marker === 226 && b.toString('ascii', at + 2, at + 6) === 'MPF\0')) photoFail('PHOTO_INVALID_IMAGE')
      at += size; scan = marker === 218
    }
    if (!ended || at !== b.length) photoFail('PHOTO_INVALID_IMAGE')
    return 'jpeg'
  }
  photoFail('PHOTO_INVALID_IMAGE')
}

export async function normalizeCustomCakePhoto(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) photoFail('PHOTO_INVALID_IMAGE')
  if (bytes.length > 10485760) photoFail('PHOTO_TOO_LARGE')
  const format = containerFormat(bytes)
  if (`image/${format === 'jpeg' ? 'jpeg' : format}` !== mimeType) photoFail('PHOTO_INVALID_IMAGE')
  try {
    const options = { failOn: 'warning', limitInputPixels: 20000000, unlimited: false }
    const meta = await sharp(bytes, options).metadata()
    if (meta.format !== format || (meta.pages ?? 1) !== 1) photoFail('PHOTO_INVALID_IMAGE')
    if (!Number.isSafeInteger(meta.width) || !Number.isSafeInteger(meta.height) || meta.width < 1 || meta.height < 1) photoFail('PHOTO_INVALID_IMAGE')
    if (meta.width * meta.height > 20000000) photoFail('PHOTO_TOO_LARGE')
    // Fully decode before resizing so decoder shrink-on-load cannot hide malformed
    // pixels or substitute a smaller dimension for the input pixel limit.
    const raw = await sharp(bytes, options).autoOrient().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
    if (raw.info.width * raw.info.height > 20000000) photoFail('PHOTO_TOO_LARGE')
    const out = await sharp(raw.data, { raw: raw.info }).resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 100, effort: 4, smartSubsample: false, lossless: false, nearLossless: false }).toBuffer({ resolveWithObject: true })
    if (!out.data.length || out.data.length > 10485760) photoFail('PHOTO_TOO_LARGE')
    return { bytes: out.data, width: out.info.width, height: out.info.height, byteLength: out.data.length, mimeType: 'image/webp' }
  } catch (error) {
    if (error.code?.startsWith('PHOTO_')) throw error
    if (/pixel limit/i.test(error.message)) photoFail('PHOTO_TOO_LARGE')
    photoFail('PHOTO_INVALID_IMAGE')
  }
}
