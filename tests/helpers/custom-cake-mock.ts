// Isolated historical frontend mock; never import from production.
import type {
  AcceptCustomCakeQuoteRequest,
  CancelCustomCakeRequest,
  CompleteCustomCakeRequest,
  ConfirmCustomCakeRequest,
  CustomCakeCreateRequest,
  CustomCakeCreateResponse,
  CustomCakeLookupResponse,
  CustomCakeMutationResponse,
  CustomCakeQuote,
  CustomCakeStatus,
  ProvisionalQuote,
  FinalQuote,
  QuoteAcceptance,
  UpdateCustomCakeQuoteRequest,
} from '../../src/lib/custom-cake-contract.js'
import type {
  PhotoDeleteRequest,
  PhotoDeleteResponse,
  PhotoReadRequest,
  PhotoReadResponse,
  PhotoRef,
  PhotoSessionResponse,
  PhotoUploadHeaders,
  PhotoUploadRequest,
  PhotoUploadResponse,
} from '../../src/lib/custom-cake-photo-contract.js'
import type { Cents, RequestId, SmorePricedLine } from '../../src/lib/cake-wire-types.js'
import type { Language } from '../../src/lib/i18n.js'

export const CUSTOM_CAKE_BASE_PRICES = {
  single: {
    '6in': 15900,
    '8in': 21900,
    '10in': 31900,
  },
  double: {
    '4in+6in': 23900,
    '6in+8in': 33900,
    '8in+10in': 45900,
  },
} as const

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '-'
  return `AUD $${(cents / 100).toFixed(2)}`
}

export function formatExtraCents(cents: Cents | null, language: Language = 'en'): string {
  if (cents === null) {
    return language === 'ko' ? '협의 예정 (To be confirmed)' : 'To be confirmed'
  }
  if (cents === 0) {
    return language === 'ko' ? '추가금 없음 (No extra charge)' : 'No extra charge (AUD $0.00)'
  }
  return `+AUD $${(cents / 100).toFixed(2)}`
}

export function getStatusInfo(status: CustomCakeStatus, language: Language = 'en'): { label: string; description: string; className: string } {
  switch (status) {
    case 'requested':
      return {
        label: language === 'ko' ? '접수 검토 중' : 'Request Received',
        description: language === 'ko'
          ? '접수가 완료되어 제작 가능 여부와 디자인을 검토 중입니다. (예약 확정 전)'
          : 'Your request has been received and is being reviewed. (Not confirmed yet)',
        className: 'status-badge status-requested',
      }
    case 'quoted':
      return {
        label: language === 'ko' ? '견적 안내' : 'Quote Ready',
        description: language === 'ko'
          ? '디자인/피규어 견적이 산출되었습니다. 내용을 확인하시고 동의해 주세요.'
          : 'Your customized quote is ready. Please review the breakdown.',
        className: 'status-badge status-quoted',
      }
    case 'confirmed':
      return {
        label: language === 'ko' ? '예약 확정' : 'Confirmed',
        description: language === 'ko'
          ? '견적 동의 및 예약이 확정되었습니다. 약속된 날짜에 픽업해 주세요.'
          : 'Your custom cake order is confirmed. See you at pickup!',
        className: 'status-badge status-confirmed',
      }
    case 'completed':
      return {
        label: language === 'ko' ? '픽업 완료' : 'Completed',
        description: language === 'ko'
          ? '케이크 픽업이 완료되었습니다. 특별한 날 되시길 바랍니다.'
          : 'Cake picked up. Thank you for celebrating with us!',
        className: 'status-badge status-completed',
      }
    case 'cancelled':
      return {
        label: language === 'ko' ? '주문 취소' : 'Cancelled',
        description: language === 'ko'
          ? '요청이 취소되었습니다.'
          : 'This request has been cancelled.',
        className: 'status-badge status-cancelled',
      }
    default:
      return {
        label: status,
        description: '',
        className: 'status-badge',
      }
  }
}

/**
 * Initial fixture record seeded from tests/fixtures/custom-cake-contract/custom-v1.json
 */
const INITIAL_FIXTURE_RECORDS: CustomCakeLookupResponse[] = [
  {
    contractVersion: 'custom-cake.v1',
    requestNumber: 'CUSTOM-EXAMPLE-1',
    status: 'requested',
    customer: {
      customerName: 'Contract Example',
      customerPhone: '0412345678',
      customerEmail: 'contract@example.invalid',
    },
    pickup: {
      pickupDate: '2026-10-05',
      pickupTime: '12:00',
    },
    lines: [
      {
        kind: 'custom-cake',
        lineId: 'cake_A',
        parentCakeLineId: null,
        productId: 'custom-cake',
        quantity: 1,
        tier: 'single',
        size: '6in',
        designNote: 'Blue flowers, soft buttercream piping with delicate white pearls',
        figurineSource: 'shop',
        photoRefs: ['photo_sample_1', 'photo_sample_2'],
      },
      {
        kind: 'cake-addon-smore',
        lineId: 'smore_A',
        productId: 'smore-stick',
        quantity: 2,
        parentCakeLineId: 'cake_A',
      },
    ],
    quote: {
      currency: 'AUD',
      pricingPolicyVersion: 'custom-cake.2026-09.v1',
      promotionEligibilityAt: '2026-09-30T13:59:59.999Z',
      baseCents: 15900,
      cakeDiscountCents: 0,
      paidSmoreQuantity: 2,
      paidSmoreTotalCents: 630,
      giftSmoreQuantity: 0,
      knownTotalCents: 16530,
      isFinalQuote: false,
      designExtraCents: null,
      figurineExtraCents: null,
      finalTotalCents: null,
      quoteVersion: 1,
    },
    paidSmoreLines: [
      {
        kind: 'cake-addon-smore',
        lineId: 'smore_A',
        productId: 'smore-stick',
        quantity: 2,
        parentCakeLineId: 'cake_A',
        unitPriceCents: 450,
        subtotalCents: 900,
        discountPercent: 30,
        discountCents: 270,
        totalCents: 630,
      },
    ],
    acceptance: null,
    acceptanceHistory: [],
  },
]

const STORAGE_KEY = 'verygood_custom_cake_requests_mock_v1'
const PHOTO_STORAGE_KEY = 'verygood_custom_cake_photos_mock_v1'
const PHOTO_SESSION_STORAGE_KEY = 'verygood_custom_cake_photo_sessions_mock_v1'

export type MockPhotoRecord = {
  photoRef: PhotoRef
  requestId: RequestId
  uploadId: string
  mimeType: 'image/webp'
  base64: string
  width: number
  height: number
  byteLength: number
  state: 'staged' | 'deletion-pending' | 'deleted'
}

function loadMockDatabase(): CustomCakeLookupResponse[] {
  if (typeof window === 'undefined') return INITIAL_FIXTURE_RECORDS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_FIXTURE_RECORDS))
      return INITIAL_FIXTURE_RECORDS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : INITIAL_FIXTURE_RECORDS
  } catch {
    return INITIAL_FIXTURE_RECORDS
  }
}

function saveMockDatabase(records: CustomCakeLookupResponse[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Ignore storage quota errors in mock mode
  }
}

const inMemorySessions: Record<string, PhotoSessionResponse> = {}
const inMemoryPhotos: Record<string, MockPhotoRecord> = {}

function loadMockPhotos(): Record<string, MockPhotoRecord> {
  const seed: Record<string, MockPhotoRecord> = {
    photo_sample_1: {
      photoRef: 'photo_sample_1',
      requestId: '11111111-1111-4111-8111-111111111111',
      uploadId: 'upload_seed_1',
      mimeType: 'image/webp',
      base64: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
      width: 1200,
      height: 1200,
      byteLength: 26,
      state: 'staged',
    },
    photo_sample_2: {
      photoRef: 'photo_sample_2',
      requestId: '11111111-1111-4111-8111-111111111111',
      uploadId: 'upload_seed_2',
      mimeType: 'image/webp',
      base64: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
      width: 1200,
      height: 1200,
      byteLength: 26,
      state: 'staged',
    },
  }
  if (typeof window === 'undefined') {
    return { ...seed, ...inMemoryPhotos }
  }
  try {
    const raw = localStorage.getItem(PHOTO_STORAGE_KEY)
    if (!raw) return seed
    const parsed = JSON.parse(raw)
    return { ...seed, ...parsed }
  } catch {
    return seed
  }
}

function saveMockPhotos(photos: Record<string, MockPhotoRecord>) {
  if (typeof window === 'undefined') {
    Object.assign(inMemoryPhotos, photos)
    return
  }
  try {
    localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(photos))
  } catch (e) {
    void e
  }
}

function loadMockSessions(): Record<string, PhotoSessionResponse> {
  if (typeof window === 'undefined') return inMemorySessions
  try {
    const raw = localStorage.getItem(PHOTO_SESSION_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveMockSessions(sessions: Record<string, PhotoSessionResponse>) {
  if (typeof window === 'undefined') {
    Object.assign(inMemorySessions, sessions)
    return
  }
  try {
    localStorage.setItem(PHOTO_SESSION_STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    void e
  }
}

/**
 * Custom Cake Frontend Service Adapter.
 * Currently backed by contract fixtures & LocalStorage mock.
 * Can be cleanly swapped with Appwrite Functions execution in production.
 */
export const customCakeService = {
  async createRequest(request: CustomCakeCreateRequest): Promise<CustomCakeCreateResponse> {
    // Simulate slight network latency
    await new Promise((resolve) => setTimeout(resolve, 300))

    const customLine = request.lines.find((l) => l.kind === 'custom-cake')
    if (!customLine || customLine.kind !== 'custom-cake') {
      throw new Error('INVALID_REQUEST: Missing custom cake line')
    }

    const smoreLine = request.lines.find((l) => l.kind === 'cake-addon-smore')
    const paidSmoreQuantity = smoreLine && smoreLine.kind === 'cake-addon-smore' ? smoreLine.quantity : 0

    // Server-authoritative calculations simulated from contract fixture logic
    const tier = customLine.tier
    const size = customLine.size
    const baseUnitCents = tier === 'single'
      ? CUSTOM_CAKE_BASE_PRICES.single[size as keyof typeof CUSTOM_CAKE_BASE_PRICES.single]
      : CUSTOM_CAKE_BASE_PRICES.double[size as keyof typeof CUSTOM_CAKE_BASE_PRICES.double]

    const baseCents = baseUnitCents * customLine.quantity
    const cakeDiscountCents = 0
    const giftSmoreQuantity = 0

    // Paid S'more: 30% off unit price $4.50 -> $3.15 (315 cents)
    const paidSmoreTotalCents = paidSmoreQuantity * 315
    const paidSmoreLines: SmorePricedLine[] = paidSmoreQuantity > 0 ? [
      {
        kind: 'cake-addon-smore',
        lineId: smoreLine?.lineId || 'smore_addon',
        productId: 'smore-stick',
        quantity: paidSmoreQuantity,
        parentCakeLineId: customLine.lineId,
        unitPriceCents: 450,
        subtotalCents: 450 * paidSmoreQuantity,
        discountPercent: 30,
        discountCents: 135 * paidSmoreQuantity,
        totalCents: 315 * paidSmoreQuantity,
      },
    ] : []

    // Known total excludes null extras
    const knownTotalCents = baseCents - cakeDiscountCents + paidSmoreTotalCents

    const requestNumber = `CUSTOM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`
    const nowIso = new Date().toISOString()

    const initialQuote: ProvisionalQuote & { quoteVersion: 1; designExtraCents: null; figurineExtraCents: null } = {
      quoteVersion: 1,
      currency: 'AUD',
      pricingPolicyVersion: 'custom-cake.2026-09.v1',
      promotionEligibilityAt: nowIso,
      baseCents,
      cakeDiscountCents,
      paidSmoreQuantity,
      paidSmoreTotalCents,
      giftSmoreQuantity,
      knownTotalCents,
      isFinalQuote: false,
      designExtraCents: null,
      figurineExtraCents: null,
      finalTotalCents: null,
    }

    const createResponse: CustomCakeCreateResponse = {
      contractVersion: 'custom-cake.v1',
      requestId: request.requestId,
      requestNumber,
      status: 'requested',
      quote: initialQuote,
      paidSmoreLines,
      acceptance: null,
    }

    // Persist as a lookup record in mock DB
    const lookupRecord: CustomCakeLookupResponse = {
      contractVersion: 'custom-cake.v1',
      requestNumber,
      status: 'requested',
      customer: request.customer,
      pickup: request.pickup,
      lines: request.lines,
      quote: initialQuote,
      paidSmoreLines,
      acceptance: null,
      acceptanceHistory: [],
    }

    const records = loadMockDatabase()
    records.unshift(lookupRecord)
    saveMockDatabase(records)

    return createResponse
  },

  async lookupRequest(requestNumber: string, customerPhone: string): Promise<CustomCakeLookupResponse | null> {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const trimmedNumber = requestNumber.trim().toUpperCase()
    const cleanPhone = customerPhone.replace(/\D/g, '')

    const records = loadMockDatabase()
    const found = records.find(
      (r) => r.requestNumber.toUpperCase() === trimmedNumber && r.customer.customerPhone.replace(/\D/g, '').endsWith(cleanPhone.slice(-8)),
    )
    return found || null
  },

  async listAdminRequests(): Promise<CustomCakeLookupResponse[]> {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return loadMockDatabase()
  },

  async updateQuote(payload: UpdateCustomCakeQuoteRequest): Promise<CustomCakeMutationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const records = loadMockDatabase()
    const index = records.findIndex((r) => r.requestNumber === payload.requestNumber)
    if (index === -1) throw new Error('NOT_FOUND')

    const current = records[index]
    if (current.status !== 'requested' && current.status !== 'quoted') {
      throw new Error('QUOTE_STATE_CONFLICT: Update is only allowed in requested or quoted status')
    }

    if (current.quote.quoteVersion !== payload.expectedQuoteVersion) {
      throw new Error(`QUOTE_VERSION_CONFLICT: Expected ${payload.expectedQuoteVersion} but was ${current.quote.quoteVersion}`)
    }

    const nextVersion = current.quote.quoteVersion + 1
    const designExtra = payload.designExtraCents
    const figurineExtra = payload.figurineExtraCents

    const isFinal = designExtra !== null && figurineExtra !== null
    const numericExtras = (designExtra ?? 0) + (figurineExtra ?? 0)
    const knownTotalCents = current.quote.baseCents - current.quote.cakeDiscountCents + numericExtras + current.quote.paidSmoreTotalCents

    let nextQuote: CustomCakeQuote
    if (isFinal) {
      nextQuote = {
        quoteVersion: nextVersion,
        currency: 'AUD',
        pricingPolicyVersion: current.quote.pricingPolicyVersion,
        promotionEligibilityAt: current.quote.promotionEligibilityAt,
        baseCents: current.quote.baseCents,
        cakeDiscountCents: current.quote.cakeDiscountCents,
        paidSmoreQuantity: current.quote.paidSmoreQuantity,
        paidSmoreTotalCents: current.quote.paidSmoreTotalCents,
        giftSmoreQuantity: current.quote.giftSmoreQuantity,
        knownTotalCents,
        isFinalQuote: true,
        designExtraCents: designExtra,
        figurineExtraCents: figurineExtra,
        finalTotalCents: knownTotalCents,
      }
    } else if (designExtra === null) {
      nextQuote = {
        quoteVersion: nextVersion,
        currency: 'AUD',
        pricingPolicyVersion: current.quote.pricingPolicyVersion,
        promotionEligibilityAt: current.quote.promotionEligibilityAt,
        baseCents: current.quote.baseCents,
        cakeDiscountCents: current.quote.cakeDiscountCents,
        paidSmoreQuantity: current.quote.paidSmoreQuantity,
        paidSmoreTotalCents: current.quote.paidSmoreTotalCents,
        giftSmoreQuantity: current.quote.giftSmoreQuantity,
        knownTotalCents,
        isFinalQuote: false,
        designExtraCents: null,
        figurineExtraCents: figurineExtra,
        finalTotalCents: null,
      }
    } else {
      nextQuote = {
        quoteVersion: nextVersion,
        currency: 'AUD',
        pricingPolicyVersion: current.quote.pricingPolicyVersion,
        promotionEligibilityAt: current.quote.promotionEligibilityAt,
        baseCents: current.quote.baseCents,
        cakeDiscountCents: current.quote.cakeDiscountCents,
        paidSmoreQuantity: current.quote.paidSmoreQuantity,
        paidSmoreTotalCents: current.quote.paidSmoreTotalCents,
        giftSmoreQuantity: current.quote.giftSmoreQuantity,
        knownTotalCents,
        isFinalQuote: false,
        designExtraCents: designExtra,
        figurineExtraCents: null,
        finalTotalCents: null,
      }
    }

    const updated: CustomCakeLookupResponse = {
      ...current,
      status: 'quoted',
      quote: nextQuote,
    }

    records[index] = updated
    saveMockDatabase(records)
    return updated
  },

  async recordAcceptance(payload: AcceptCustomCakeQuoteRequest): Promise<CustomCakeMutationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const records = loadMockDatabase()
    const index = records.findIndex((r) => r.requestNumber === payload.requestNumber)
    if (index === -1) throw new Error('NOT_FOUND')

    const current = records[index]
    if (current.status !== 'quoted') {
      throw new Error('QUOTE_STATE_CONFLICT: Acceptance is only allowed in quoted status')
    }

    if (!current.quote.isFinalQuote) {
      throw new Error('QUOTE_NOT_FINAL: Acceptance requires a final quote with all extras confirmed')
    }

    if (current.quote.quoteVersion !== payload.quoteVersion) {
      throw new Error('QUOTE_VERSION_CONFLICT: Accepted version does not match current quote')
    }

    const nowIso = new Date().toISOString()
    const acceptance: QuoteAcceptance = {
      acceptedQuoteVersion: payload.quoteVersion,
      acceptedAt: nowIso,
    }

    const updated: CustomCakeLookupResponse = {
      ...current,
      acceptance,
      acceptanceHistory: [...current.acceptanceHistory, acceptance],
    }

    records[index] = updated
    saveMockDatabase(records)
    return updated
  },

  async confirmRequest(payload: ConfirmCustomCakeRequest): Promise<CustomCakeMutationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const records = loadMockDatabase()
    const index = records.findIndex((r) => r.requestNumber === payload.requestNumber)
    if (index === -1) throw new Error('NOT_FOUND')

    const current = records[index]
    if (current.status !== 'quoted') {
      throw new Error('QUOTE_STATE_CONFLICT: Confirmation requires quoted status')
    }

    if (current.quote.quoteVersion !== payload.expectedQuoteVersion) {
      throw new Error('QUOTE_VERSION_CONFLICT: Expected quote version mismatch')
    }

    if (!current.quote.isFinalQuote) {
      throw new Error('QUOTE_NOT_FINAL: Cannot confirm a non-final provisional quote')
    }

    if (!current.acceptance || current.acceptance.acceptedQuoteVersion !== current.quote.quoteVersion) {
      throw new Error('QUOTE_ACCEPTANCE_REQUIRED: Active customer consent matching current version is required')
    }

    const updated: CustomCakeLookupResponse = {
      ...current,
      status: 'confirmed',
      quote: current.quote as FinalQuote & { quoteVersion: number },
      acceptance: current.acceptance,
    }

    records[index] = updated
    saveMockDatabase(records)
    return updated
  },

  async completeRequest(payload: CompleteCustomCakeRequest): Promise<CustomCakeMutationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const records = loadMockDatabase()
    const index = records.findIndex((r) => r.requestNumber === payload.requestNumber)
    if (index === -1) throw new Error('NOT_FOUND')

    const current = records[index]
    if (current.status !== payload.expectedStatus) {
      throw new Error(`QUOTE_STATE_CONFLICT: Current status is '${current.status}', expected '${payload.expectedStatus}'`)
    }

    if (current.quote.quoteVersion !== payload.expectedQuoteVersion) {
      throw new Error(`QUOTE_VERSION_CONFLICT: Current quoteVersion is ${current.quote.quoteVersion}, expected ${payload.expectedQuoteVersion}`)
    }

    const updated: CustomCakeLookupResponse = {
      ...current,
      status: 'completed',
    }

    records[index] = updated
    saveMockDatabase(records)
    return updated
  },

  async cancelRequest(payload: CancelCustomCakeRequest): Promise<CustomCakeMutationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const records = loadMockDatabase()
    const index = records.findIndex((r) => r.requestNumber === payload.requestNumber)
    if (index === -1) throw new Error('NOT_FOUND')

    const current = records[index]
    if (current.status !== payload.expectedStatus) {
      throw new Error(`QUOTE_STATE_CONFLICT: Current status is '${current.status}', expected '${payload.expectedStatus}'`)
    }

    if (current.quote.quoteVersion !== payload.expectedQuoteVersion) {
      throw new Error(`QUOTE_VERSION_CONFLICT: Current quoteVersion is ${current.quote.quoteVersion}, expected ${payload.expectedQuoteVersion}`)
    }

    const updated: CustomCakeLookupResponse = {
      ...current,
      status: 'cancelled',
    }

    records[index] = updated
    saveMockDatabase(records)
    return updated
  },

  async createPhotoSession(requestId: RequestId): Promise<PhotoSessionResponse> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const sessionId = `session_${Math.random().toString(36).slice(2, 10)}`
    const token = `token_${Math.random().toString(36).slice(2, 18)}`
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const session: PhotoSessionResponse = {
      contractVersion: 'custom-cake-photo.v1',
      requestId,
      uploadSessionId: sessionId,
      uploadToken: token,
      expiresAt,
      limits: {
        maxPhotosPerRequest: 5,
        maxInputBytes: 10485760,
        maxDecodedPixels: 20000000,
        maxStoredDimension: 2560,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        storedMimeType: 'image/webp',
        maxFrames: 1,
      },
    }
    const sessions = loadMockSessions()
    sessions[sessionId] = session
    saveMockSessions(sessions)
    return session
  },

  async uploadPhoto(
    headers: PhotoUploadHeaders,
    request: PhotoUploadRequest,
  ): Promise<PhotoUploadResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const sessions = loadMockSessions()
    const session = sessions[headers['x-custom-cake-upload-session']]
    if (!session || session.uploadToken !== headers['x-custom-cake-upload-token']) {
      throw new Error('PHOTO_SESSION_INVALID')
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      throw new Error('PHOTO_SESSION_EXPIRED')
    }
    if (session.requestId !== request.requestId) {
      throw new Error('FORBIDDEN')
    }

    const photos = loadMockPhotos()
    const forRequest = Object.values(photos).filter(
      (p) => p.requestId === request.requestId && p.state === 'staged',
    )
    if (forRequest.length >= session.limits.maxPhotosPerRequest) {
      throw new Error('PHOTO_LIMIT_EXCEEDED')
    }

    const photoRef = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const photoRecord: MockPhotoRecord = {
      photoRef,
      requestId: request.requestId,
      uploadId: request.uploadId,
      mimeType: 'image/webp',
      base64: request.base64,
      width: 1200,
      height: 1200,
      byteLength: Math.round(request.base64.length * 0.75),
      state: 'staged',
    }
    photos[photoRef] = photoRecord
    saveMockPhotos(photos)

    return {
      contractVersion: 'custom-cake-photo.v1',
      requestId: request.requestId,
      photoRef,
      state: 'staged',
      mimeType: 'image/webp',
      width: photoRecord.width,
      height: photoRecord.height,
      byteLength: photoRecord.byteLength,
    }
  },

  async readPhoto(request: PhotoReadRequest): Promise<PhotoReadResponse> {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const photos = loadMockPhotos()
    const photo = photos[request.photoRef]
    if (!photo || photo.state === 'deleted') {
      throw new Error('NOT_FOUND')
    }
    return {
      contractVersion: 'custom-cake-photo.v1',
      photoRef: photo.photoRef,
      mimeType: 'image/webp',
      base64: photo.base64,
      width: photo.width,
      height: photo.height,
      byteLength: photo.byteLength,
    }
  },

  async deletePhoto(request: PhotoDeleteRequest): Promise<PhotoDeleteResponse> {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const photos = loadMockPhotos()
    const photo = photos[request.photoRef]
    if (!photo) {
      throw new Error('NOT_FOUND')
    }
    photos[request.photoRef] = {
      ...photo,
      state: 'deleted',
    }
    saveMockPhotos(photos)
    return {
      contractVersion: 'custom-cake-photo.v1',
      photoRef: request.photoRef,
      state: 'deleted',
    }
  },
}
