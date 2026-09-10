/** Photo wire only: no credentials enter order data, canonical bytes or fingerprints. */
import type { RequestId, UtcTimestamp } from './cake-wire-types.js'

export type PhotoVersion = 'custom-cake-photo.v1'
export type PhotoRef = string // Same opaque ASCII ID syntax as order photoRefs.
export type PhotoUploadCredential = {
  uploadSessionId: string
  uploadToken: string // Secret opaque bearer, never URL/log/canonical material.
}
export type PhotoSessionRequest = { contractVersion: PhotoVersion; requestId: RequestId }
export type PhotoSessionResponse = PhotoUploadCredential & {
  contractVersion: PhotoVersion
  requestId: RequestId
  expiresAt: UtcTimestamp
  limits: {
    maxPhotosPerRequest: 5
    maxInputBytes: 10485760
    maxDecodedPixels: 20000000
    maxStoredDimension: 2560
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    storedMimeType: 'image/webp'
    maxFrames: 1
  }
}
export type PhotoUploadRequest = {
  contractVersion: PhotoVersion
  requestId: RequestId
  uploadId: string // Stable per-file intent ID; same bytes retry same photoRef.
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string // Strict canonical base64 of input bytes, no data URL.
}
export type PhotoUploadResponse = {
  contractVersion: PhotoVersion
  requestId: RequestId
  photoRef: PhotoRef
  state: 'staged'
  mimeType: 'image/webp'
  width: number
  height: number
  byteLength: number
}
/** Credential encoded in these headers for upload and create-with-photos only. */
export type PhotoUploadHeaders = {
  'x-custom-cake-upload-session': string
  'x-custom-cake-upload-token': string
}
export type PhotoAccessAuthorization =
  | { kind: 'admin' } // Existing independently verified admin transport identity.
  | { kind: 'customer'; customerPhone: string } // Existing request lookup proof, NOT phone alone.
export type PhotoReadRequest = {
  contractVersion: PhotoVersion
  requestNumber: string
  photoRef: PhotoRef
  authorization: PhotoAccessAuthorization
}
export type PhotoReadResponse = {
  contractVersion: PhotoVersion
  photoRef: PhotoRef
  mimeType: 'image/webp'
  base64: string // Authenticated bytes; no public/signed bucket URL.
  width: number
  height: number
  byteLength: number
}
export type PhotoDeleteRequest = PhotoReadRequest
export type PhotoDeleteResponse = {
  contractVersion: PhotoVersion
  photoRef: PhotoRef
  state: 'deletion-pending' | 'deleted'
}
export type PhotoAction =
  | { action: 'create-custom-cake-photo-session'; data: PhotoSessionRequest }
  | { action: 'upload-custom-cake-photo'; data: PhotoUploadRequest }
  | { action: 'read-custom-cake-photo'; data: PhotoReadRequest }
  | { action: 'delete-custom-cake-photo'; data: PhotoDeleteRequest }
export type PhotoErrorCode =
  | 'INVALID_REQUEST' | 'PHOTO_SESSION_INVALID' | 'PHOTO_SESSION_EXPIRED'
  | 'PHOTO_LIMIT_EXCEEDED' | 'PHOTO_TOO_LARGE' | 'PHOTO_INVALID_IMAGE'
  | 'PHOTO_UPLOAD_CONFLICT' | 'PHOTO_STATE_CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CAPABILITY_UNAVAILABLE'
export type PhotoError = { ok: false; contractVersion: PhotoVersion; code: PhotoErrorCode }
