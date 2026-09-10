import type { CustomCakeCreateRequest, CustomCakeCreateResponse } from './custom-cake-contract.js'
import type { PhotoSessionResponse, PhotoUploadRequest } from './custom-cake-photo-contract.js'
import type { createCakeWireRepository } from './custom-cake-repository.ts'

type Repository = ReturnType<typeof createCakeWireRepository>
type Entropy = Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>>
export function secureIntentId(entropy: Partial<Entropy> | undefined = globalThis.crypto): string {
  if (entropy?.randomUUID) return entropy.randomUUID().toLowerCase()
  if (!entropy?.getRandomValues) throw new Error('SECURE_RANDOM_UNAVAILABLE')
  const bytes = new Uint8Array(16)
  entropy.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type SelectedPhoto = Readonly<Pick<PhotoUploadRequest, 'mimeType' | 'base64'> & { uploadId: string; name: string }>
type Draft = Omit<CustomCakeCreateRequest, 'requestId'>
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Owns a single in-memory intent. A timeout never authorizes a replacement intent. */
export function createSubmissionIntent() {
  const requestId = secureIntentId(), cakeLineId = secureIntentId(), smoreLineId = secureIntentId()
  let photos: SelectedPhoto[] = []
  let frozen: CustomCakeCreateRequest | undefined
  let session: PhotoSessionResponse | undefined
  let refs = new Map<string, string>()
  let attached: CustomCakeCreateRequest | undefined
  let uncertain = false
  let result: CustomCakeCreateResponse | undefined
  let inFlight: Promise<CustomCakeCreateResponse> | undefined

  async function create(repository: Repository) {
    try {
      uncertain = true
      result = await repository.createCustomCakeRequest(attached!, session && {
        uploadSessionId: session.uploadSessionId, uploadToken: session.uploadToken,
      })
      uncertain = false
      return result
    } catch (error) {
      // Only unknown transport/parse outcomes may have committed. Replay them first,
      // even after token expiry, before considering different photo references.
      const code = error instanceof Error ? error.message : ''
      uncertain = code === 'CAKE_WIRE_UNAVAILABLE' || code === 'CAKE_WIRE_INVALID_RESPONSE' || !code
      throw error
    }
  }
  async function send(repository: Repository, now: () => number) {
    if (result) return result
    if (uncertain && attached) return create(repository)
    if (photos.length) {
      // At most one renewal per send. Quota/repeated expiry is surfaced safely.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!session || Date.parse(session.expiresAt) <= now()) {
          session = await repository.createPhotoSession({ contractVersion: 'custom-cake-photo.v1', requestId })
          refs = new Map()
          attached = undefined
        }
        try {
          for (const photo of photos) {
            if (refs.has(photo.uploadId)) continue
            const uploaded = await repository.uploadPhoto({
              contractVersion: 'custom-cake-photo.v1', requestId, uploadId: photo.uploadId,
              mimeType: photo.mimeType, base64: photo.base64,
            }, { uploadSessionId: session.uploadSessionId, uploadToken: session.uploadToken })
            refs.set(photo.uploadId, uploaded.photoRef)
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'PHOTO_SESSION_EXPIRED' && attempt === 0) {
            session = undefined
            continue
          }
          throw error
        }
        if (Date.parse(session.expiresAt) > now()) break
        if (attempt === 1) throw new Error('PHOTO_SESSION_EXPIRED')
      }
    }
    if (!attached) {
      const data = structuredClone(frozen!)
      const cake = data.lines.find(line => line.kind === 'custom-cake')
      if (!cake || cake.kind !== 'custom-cake') throw new Error('INVALID_REQUEST')
      cake.photoRefs = photos.map(photo => refs.get(photo.uploadId)!)
      attached = freeze(data)
    }
    return create(repository)
  }
  return {
    requestId, cakeLineId, smoreLineId,
    get locked() { return !!frozen },
    get photos(): readonly SelectedPhoto[] { return [...photos] },
    selectPhoto(input: Omit<SelectedPhoto, 'uploadId'>) {
      if (frozen) throw new Error('INTENT_LOCKED')
      if (photos.length >= 5) throw new Error('PHOTO_LIMIT_EXCEEDED')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType) || !input.base64) throw new Error('PHOTO_INVALID_IMAGE')
      const selected = Object.freeze({ ...input, uploadId: secureIntentId() })
      photos.push(selected)
      return selected
    },
    removePhoto(uploadId: string) {
      if (frozen) throw new Error('INTENT_LOCKED')
      photos = photos.filter(photo => photo.uploadId !== uploadId)
    },
    submit(repository: Repository, draft: Draft, now = Date.now): Promise<CustomCakeCreateResponse> {
      if (inFlight) return inFlight
      if (!frozen) frozen = freeze(structuredClone({ ...draft, requestId }))
      inFlight = send(repository, now).finally(() => { inFlight = undefined })
      return inFlight
    },
  }
}
