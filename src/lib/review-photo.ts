export const MAX_REVIEW_PHOTO_INPUT_BYTES = 15 * 1024 * 1024
export const MAX_REVIEW_PHOTO_OUTPUT_BYTES = 1_350_000
export const MAX_REVIEW_PHOTO_DIMENSION = 1600
// Modern phone cameras commonly produce 24MP photos. Allow those while still
// rejecting 48MP/RAW originals that can require roughly 192MB when decoded.
export const MAX_REVIEW_PHOTO_SOURCE_PIXELS = 25_000_000
export const MAX_REVIEW_PHOTO_HEADER_BYTES = 512 * 1024
export const MAX_REVIEW_PHOTO_SERVER_FALLBACK_BYTES = 7_000_000

const MAX_FALLBACK_PHOTO_BYTES = MAX_REVIEW_PHOTO_INPUT_BYTES
const MAX_FALLBACK_PHOTO_PIXELS = MAX_REVIEW_PHOTO_SOURCE_PIXELS

export type ReviewPhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif' | 'image/avif'
type ReviewPhotoFile = Pick<Blob, 'type' | 'size'> & { name?: string }

const SUPPORTED_PHOTO_TYPES = new Set<ReviewPhotoMimeType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
])
const SERVER_FALLBACK_PHOTO_TYPES = new Set<ReviewPhotoMimeType>(['image/avif'])
const HEIF_CONVERSION_TYPES = new Set<ReviewPhotoMimeType>(['image/heic', 'image/heif'])
const PHOTO_EXTENSION_TYPES: Readonly<Record<string, ReviewPhotoMimeType>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
}
const PHOTO_MIME_ALIASES: Readonly<Record<string, ReviewPhotoMimeType>> = {
  'image/heic-sequence': 'image/heic',
  'image/x-heic': 'image/heic',
  'image/heif-sequence': 'image/heif',
  'image/x-heif': 'image/heif',
}

export type PhotoErrorCode = 'PHOTO_INVALID' | 'PHOTO_TOO_LARGE' | 'PHOTO_DIMENSIONS_TOO_LARGE'

export class ReviewPhotoError extends Error {
  readonly code: PhotoErrorCode

  constructor(code: PhotoErrorCode) {
    super(code)
    this.name = 'ReviewPhotoError'
    this.code = code
  }
}

export function resolveReviewPhotoMimeType(file: ReviewPhotoFile): ReviewPhotoMimeType {
  const rawType = file.type.trim().toLowerCase()
  const suppliedType = PHOTO_MIME_ALIASES[rawType] ?? rawType as ReviewPhotoMimeType
  if (SUPPORTED_PHOTO_TYPES.has(suppliedType)) return suppliedType
  const extension = typeof file.name === 'string' ? file.name.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] : undefined
  const extensionType = extension ? PHOTO_EXTENSION_TYPES[extension] : undefined
  if (extensionType) return extensionType
  throw new ReviewPhotoError('PHOTO_INVALID')
}

export function validateReviewPhotoFile(file: ReviewPhotoFile): ReviewPhotoMimeType {
  if (file.size < 1) throw new ReviewPhotoError('PHOTO_INVALID')
  const mimeType = resolveReviewPhotoMimeType(file)
  if (file.size > MAX_REVIEW_PHOTO_INPUT_BYTES) throw new ReviewPhotoError('PHOTO_TOO_LARGE')
  return mimeType
}

type PhotoDimensions = Readonly<{ width: number; height: number }>

function checkedDimensions(width: number, height: number): PhotoDimensions {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new ReviewPhotoError('PHOTO_INVALID')
  }
  if (width * height > MAX_REVIEW_PHOTO_SOURCE_PIXELS) {
    throw new ReviewPhotoError('PHOTO_DIMENSIONS_TOO_LARGE')
  }
  return { width, height }
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function probeJpeg(bytes: Uint8Array, view: DataView): PhotoDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    if (offset >= bytes.length) break
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length) break
    const isSof = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    if (isSof) {
      if (length < 7) return null
      return checkedDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3))
    }
    offset += length
  }
  return null
}

function probePng(bytes: Uint8Array, view: DataView): PhotoDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value) || ascii(bytes, 12, 4) !== 'IHDR') return null
  return checkedDimensions(view.getUint32(16), view.getUint32(20))
}

function probeWebp(bytes: Uint8Array, view: DataView): PhotoDimensions | null {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const kind = ascii(bytes, offset, 4)
    const length = view.getUint32(offset + 4, true)
    const payload = offset + 8
    if (kind === 'VP8X') {
      if (length < 10 || payload + 10 > bytes.length) return null
      const width = 1 + bytes[payload + 4] + (bytes[payload + 5] << 8) + (bytes[payload + 6] << 16)
      const height = 1 + bytes[payload + 7] + (bytes[payload + 8] << 8) + (bytes[payload + 9] << 16)
      return checkedDimensions(width, height)
    }
    if (kind === 'VP8L') {
      if (length < 5 || payload + 5 > bytes.length || bytes[payload] !== 0x2f) return null
      const width = 1 + bytes[payload + 1] + ((bytes[payload + 2] & 0x3f) << 8)
      const height = 1 + (bytes[payload + 2] >>> 6) + (bytes[payload + 3] << 2) + ((bytes[payload + 4] & 0x0f) << 10)
      return checkedDimensions(width, height)
    }
    if (kind === 'VP8 ') {
      if (length < 10 || payload + 10 > bytes.length
        || bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a) return null
      return checkedDimensions(view.getUint16(payload + 6, true) & 0x3fff, view.getUint16(payload + 8, true) & 0x3fff)
    }
    if (payload + length > bytes.length) return null
    offset = payload + length + (length % 2)
  }
  return null
}

function probeHeif(bytes: Uint8Array, view: DataView): PhotoDimensions | null {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return null
  const knownBrand = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif', 'avis'].some((brand) => {
    for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
      if (ascii(bytes, offset, 4) === brand) return true
    }
    return false
  })
  if (!knownBrand) return null
  for (let offset = 4; offset + 16 <= bytes.length; offset += 1) {
    if (ascii(bytes, offset, 4) !== 'ispe') continue
    const boxStart = offset - 4
    const boxLength = view.getUint32(boxStart)
    if (boxLength >= 20 && boxStart + boxLength <= bytes.length) {
      return checkedDimensions(view.getUint32(offset + 8), view.getUint32(offset + 12))
    }
  }
  return null
}

export async function probeReviewPhotoDimensions(file: Blob, suppliedMimeType?: ReviewPhotoMimeType): Promise<PhotoDimensions> {
  const mimeType = suppliedMimeType ?? resolveReviewPhotoMimeType(file)
  const bytes = new Uint8Array(await file.slice(0, MAX_REVIEW_PHOTO_HEADER_BYTES).arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let dimensions: PhotoDimensions | null = null
  if (mimeType === 'image/jpeg') dimensions = probeJpeg(bytes, view)
  else if (mimeType === 'image/png') dimensions = probePng(bytes, view)
  else if (mimeType === 'image/webp') dimensions = probeWebp(bytes, view)
  else if (mimeType === 'image/heic' || mimeType === 'image/heif' || mimeType === 'image/avif') dimensions = probeHeif(bytes, view)
  if (!dimensions) throw new ReviewPhotoError('PHOTO_INVALID')
  return dimensions
}

export function calculateContainDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maximum = MAX_REVIEW_PHOTO_DIMENSION,
): { width: number; height: number } {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new ReviewPhotoError('PHOTO_INVALID')
  }
  const scale = Math.min(1, maximum / sourceWidth, maximum / sourceHeight)
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

export type PhotoCompressionAttempt = Readonly<{ width: number; height: number; quality: number }>

export function buildPhotoCompressionPlan(sourceWidth: number, sourceHeight: number): PhotoCompressionAttempt[] {
  const initial = calculateContainDimensions(sourceWidth, sourceHeight)
  const attempts: PhotoCompressionAttempt[] = []
  const add = (scale: number, quality: number) => {
    attempts.push({
      width: Math.max(1, Math.round(initial.width * scale)),
      height: Math.max(1, Math.round(initial.height * scale)),
      quality,
    })
  }
  add(1, 0.82)
  add(1, 0.72)
  add(1, 0.62)
  add(0.85, 0.72)
  add(0.85, 0.62)
  add(0.7, 0.68)
  add(0.55, 0.62)
  add(0.4, 0.55)
  return attempts
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let output = ''
  const chunkSize = 0x6000 // divisible by 3, so concatenated chunks remain canonical base64
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
    let binary = ''
    for (let index = 0; index < chunk.length; index += 1) binary += String.fromCharCode(chunk[index])
    output += btoa(binary)
  }
  return output
}

type ObjectUrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>

export function createPreviewUrlController(urlApi: ObjectUrlApi = URL) {
  let current: string | null = null
  const clear = () => {
    if (!current) return
    urlApi.revokeObjectURL(current)
    current = null
  }
  return {
    replace(blob: Blob): string {
      clear()
      current = urlApi.createObjectURL(blob)
      return current
    },
    clear,
    dispose: clear,
  }
}

type DecodedPhoto = {
  source: CanvasImageSource
  width: number
  height: number
  cleanup(): void
}

async function decodeWithImageBitmap(file: Blob, target: PhotoDimensions): Promise<DecodedPhoto | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    })
    if (!bitmap.width || !bitmap.height || bitmap.width > MAX_REVIEW_PHOTO_DIMENSION || bitmap.height > MAX_REVIEW_PHOTO_DIMENSION) {
      bitmap.close()
      throw new ReviewPhotoError('PHOTO_INVALID')
    }
    return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() }
  } catch (error) {
    if (error instanceof ReviewPhotoError) throw error
    return null
  }
}

async function decodeWithImage(file: Blob, dimensions: PhotoDimensions): Promise<DecodedPhoto> {
  if (file.size > MAX_FALLBACK_PHOTO_BYTES || dimensions.width * dimensions.height > MAX_FALLBACK_PHOTO_PIXELS) {
    throw new ReviewPhotoError('PHOTO_INVALID')
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_FALLBACK_PHOTO_PIXELS) {
      throw new ReviewPhotoError('PHOTO_INVALID')
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    if (error instanceof ReviewPhotoError) throw error
    throw new ReviewPhotoError('PHOTO_INVALID')
  }
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size < 1 || blob.type !== 'image/webp') {
        reject(new ReviewPhotoError('PHOTO_INVALID'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

export async function compressReviewPhoto(file: File | Blob): Promise<Blob> {
  const mimeType = validateReviewPhotoFile(file)
  let decoded: DecodedPhoto | null = null
  try {
    const sourceDimensions = await probeReviewPhotoDimensions(file, mimeType)
    const target = calculateContainDimensions(sourceDimensions.width, sourceDimensions.height)
    decoded = await decodeWithImageBitmap(file, target) ?? await decodeWithImage(file, sourceDimensions)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new ReviewPhotoError('PHOTO_INVALID')

    for (const attempt of buildPhotoCompressionPlan(decoded.width, decoded.height)) {
      canvas.width = attempt.width
      canvas.height = attempt.height
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, attempt.width, attempt.height)
      context.drawImage(decoded.source, 0, 0, attempt.width, attempt.height)
      const blob = await canvasToWebp(canvas, attempt.quality)
      if (blob.size <= MAX_REVIEW_PHOTO_OUTPUT_BYTES) return blob
    }
    throw new ReviewPhotoError('PHOTO_TOO_LARGE')
  } catch (error) {
    if (error instanceof ReviewPhotoError) throw error
    throw new ReviewPhotoError('PHOTO_INVALID')
  } finally {
    decoded?.cleanup()
  }
}

export type PreparedReviewPhotoUpload = Readonly<{
  uploadBlob: Blob
  uploadMimeType: ReviewPhotoMimeType
  previewBlob: Blob | null
}>

type PrepareReviewPhotoOptions = Readonly<{
  convertHeif?: (file: Blob) => Promise<Blob>
}>

async function convertHeifInBrowser(file: Blob): Promise<Blob> {
  type Heic2Any = (options: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>
  const module = await import('heic2any')
  const heic2any = module.default as unknown as Heic2Any
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const output = Array.isArray(converted) ? converted[0] : converted
  if (!(output instanceof Blob) || output.size < 1 || output.type !== 'image/jpeg') {
    throw new ReviewPhotoError('PHOTO_INVALID')
  }
  return output
}

export async function prepareReviewPhotoUpload(
  file: Blob & { name?: string },
  options: PrepareReviewPhotoOptions = {},
): Promise<PreparedReviewPhotoUpload> {
  const sourceMimeType = validateReviewPhotoFile(file)
  if (HEIF_CONVERSION_TYPES.has(sourceMimeType) && file.size <= MAX_REVIEW_PHOTO_SERVER_FALLBACK_BYTES) {
    return { uploadBlob: file, uploadMimeType: sourceMimeType, previewBlob: null }
  }
  try {
    const compressed = await compressReviewPhoto(file)
    return { uploadBlob: compressed, uploadMimeType: 'image/webp', previewBlob: compressed }
  } catch (error) {
    if (!(error instanceof ReviewPhotoError) || error.code !== 'PHOTO_INVALID') throw error
    if (HEIF_CONVERSION_TYPES.has(sourceMimeType)) {
      try {
        const converted = await (options.convertHeif ?? convertHeifInBrowser)(file)
        const compressed = await compressReviewPhoto(converted)
        return { uploadBlob: compressed, uploadMimeType: 'image/webp', previewBlob: compressed }
      } catch {
        if (file.size > MAX_REVIEW_PHOTO_SERVER_FALLBACK_BYTES) throw new ReviewPhotoError('PHOTO_TOO_LARGE')
        return { uploadBlob: file, uploadMimeType: sourceMimeType, previewBlob: null }
      }
    }
    if (!SERVER_FALLBACK_PHOTO_TYPES.has(sourceMimeType)) throw error
    if (file.size > MAX_REVIEW_PHOTO_SERVER_FALLBACK_BYTES) throw new ReviewPhotoError('PHOTO_TOO_LARGE')
    return { uploadBlob: file, uploadMimeType: sourceMimeType, previewBlob: null }
  }
}
