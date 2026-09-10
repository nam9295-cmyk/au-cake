import type { Account, ExecutionMethod, Functions } from 'appwrite'
import type { CustomCakeCreateRequest, CustomCakeLookupRequest, UpdateCustomCakeQuoteRequest, AcceptCustomCakeQuoteRequest, ConfirmCustomCakeRequest, CompleteCustomCakeRequest, CancelCustomCakeRequest } from './custom-cake-contract.js'
import type { CakeOrderV2Request, CakeOrderV2LookupRequest } from './cake-order-v2-contract.js'
import type { PhotoUploadCredential, PhotoSessionRequest, PhotoUploadRequest, PhotoReadRequest, PhotoDeleteRequest } from './custom-cake-photo-contract.js'
import { parseCustomCakeCreateResponse, parseCustomCakeLookupResponse, parseCustomCakeMutationResponse, parseCakeOrderV2CreateResponse, parseCakeOrderV2LookupResponse, parseCakeWireCapabilities, parsePhotoSessionResponse, parsePhotoUploadResponse, parsePhotoReadResponse, parsePhotoDeleteResponse } from './custom-cake-client.ts'

type Context = { admin?: boolean; credential?: PhotoUploadCredential }
type Execution = { responseStatusCode: number; responseBody: string }
export type CakeWireTransport = (action: string, data: unknown, context?: Context) => Promise<Execution>
export function createAppwriteCakeWireTransport({ functions, account, functionId }: { functions: Pick<Functions, 'createExecution'>; account: Pick<Account, 'createJWT'>; functionId: string }): CakeWireTransport {
  return async (action, data, context = {}) => {
    try {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(functionId)) throw new Error()
      const headers: Record<string, string> = {}
      if (context.admin) headers['x-appwrite-user-jwt'] = (await account.createJWT()).jwt
      if (context.credential) {
        headers['x-custom-cake-upload-session'] = context.credential.uploadSessionId
        headers['x-custom-cake-upload-token'] = context.credential.uploadToken
      }
      return await functions.createExecution({ functionId, body: JSON.stringify(data === undefined ? { action } : { action, data }), async: false, xpath: '/', method: 'POST' as ExecutionMethod, headers })
    } catch { throw new Error('CAKE_WIRE_UNAVAILABLE') }
  }
}
const orderCodes: Record<string, number> = { INVALID_REQUEST: 400, INVALID_LINE_ID: 400, INVALID_LINE_REFERENCE: 400, INVALID_PHOTO_REFERENCE: 400, PROMO_CODE_INVALID: 400, FORBIDDEN: 403, NOT_FOUND: 404, REQUEST_ID_CONFLICT: 409, QUOTE_VERSION_CONFLICT: 409, QUOTE_NOT_FINAL: 409, QUOTE_ACCEPTANCE_REQUIRED: 409, QUOTE_STATE_CONFLICT: 409, CAPABILITY_UNAVAILABLE: 503 }
const photoCodes: Record<string, number> = { INVALID_REQUEST: 400, PHOTO_INVALID_IMAGE: 400, PHOTO_SESSION_INVALID: 403, PHOTO_SESSION_EXPIRED: 403, FORBIDDEN: 403, NOT_FOUND: 404, PHOTO_UPLOAD_CONFLICT: 409, PHOTO_STATE_CONFLICT: 409, PHOTO_LIMIT_EXCEEDED: 409, PHOTO_TOO_LARGE: 413, CAPABILITY_UNAVAILABLE: 503 }
export function createCakeWireRepository(transport: CakeWireTransport) {
  async function execute<T>(action: string, data: unknown, version: string, parse: (v: unknown) => T, context?: Context): Promise<T> {
    let execution: Execution
    try { execution = await transport(action, data, context) } catch { throw new Error('CAKE_WIRE_UNAVAILABLE') }
    let body: Record<string, unknown>
    const invalid = () => new Error('CAKE_WIRE_INVALID_RESPONSE')
    if (!Number.isInteger(execution.responseStatusCode)) throw invalid()
    try { body = JSON.parse(execution.responseBody) } catch { throw invalid() }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid()
    if (body.ok === false) {
      const codes = version === 'custom-cake-photo.v1' ? photoCodes : orderCodes
      if (Object.keys(body).length !== 3 || body.contractVersion !== version || typeof body.code !== 'string' || !Object.hasOwn(codes, body.code) || codes[body.code] !== execution.responseStatusCode) throw invalid()
      throw new Error(body.code)
    }
    if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300 || body.ok !== true || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'result')) throw invalid()
    return parse(body.result)
  }
  const customMutation = (action: string, data: unknown) => execute(action, data, 'custom-cake.v1', parseCustomCakeMutationResponse, { admin: true })
  return {
    getCapabilities: () => execute('get-cake-wire-capabilities', undefined, 'custom-cake.v1', parseCakeWireCapabilities),
    createCustomCakeRequest: (data: CustomCakeCreateRequest, credential?: PhotoUploadCredential) => execute('create-custom-cake-request', data, 'custom-cake.v1', parseCustomCakeCreateResponse, { credential }),
    getCustomCakeRequest: (data: CustomCakeLookupRequest) => execute('get-custom-cake-request', data, 'custom-cake.v1', parseCustomCakeLookupResponse),
    updateCustomCakeQuote: (data: UpdateCustomCakeQuoteRequest) => customMutation('admin-update-custom-cake-quote', data),
    recordCustomCakeAcceptance: (data: AcceptCustomCakeQuoteRequest) => customMutation('admin-record-custom-cake-acceptance', data),
    confirmCustomCakeRequest: (data: ConfirmCustomCakeRequest) => customMutation('admin-confirm-custom-cake-request', data),
    completeCustomCakeRequest: (data: CompleteCustomCakeRequest) => customMutation('admin-complete-custom-cake-request', data),
    cancelCustomCakeRequest: (data: CancelCustomCakeRequest) => customMutation('admin-cancel-custom-cake-request', data),
    createCakeOrderV2: (data: CakeOrderV2Request) => execute('create-cake-order-v2', data, 'cake-order.v2', parseCakeOrderV2CreateResponse),
    getCakeOrderV2: (data: CakeOrderV2LookupRequest) => execute('get-cake-order-v2', data, 'cake-order.v2', parseCakeOrderV2LookupResponse),
    createPhotoSession: (data: PhotoSessionRequest) => execute('create-custom-cake-photo-session', data, 'custom-cake-photo.v1', parsePhotoSessionResponse),
    uploadPhoto: (data: PhotoUploadRequest, credential: PhotoUploadCredential) => execute('upload-custom-cake-photo', data, 'custom-cake-photo.v1', parsePhotoUploadResponse, { credential }),
    readPhoto: (data: PhotoReadRequest) => execute('read-custom-cake-photo', data, 'custom-cake-photo.v1', parsePhotoReadResponse, { admin: data.authorization.kind === 'admin' }),
    deletePhoto: (data: PhotoDeleteRequest) => execute('delete-custom-cake-photo', data, 'custom-cake-photo.v1', parsePhotoDeleteResponse, { admin: data.authorization.kind === 'admin' }),
  }
}
/** Actual browser wiring, kept separate from legacy repository and health parsing. */
export async function getCakeWireRepository() {
  const { functions, account, appwriteConfig, isAppwriteConfigured } = await import('./appwrite')
  if (!isAppwriteConfigured || appwriteConfig.reservationApiMode === 'off') throw new Error('CAKE_WIRE_UNAVAILABLE')
  const transport = createAppwriteCakeWireTransport({ functions, account, functionId: appwriteConfig.reservationApiFunctionId })
  return createCakeWireRepository((action, data, context) => {
    if (appwriteConfig.reservationApiMode !== 'all' && !['get-cake-wire-capabilities', 'get-custom-cake-request', 'get-cake-order-v2', 'read-custom-cake-photo'].includes(action)) throw new Error('CAKE_WIRE_UNAVAILABLE')
    return transport(action, data, context)
  })
}
