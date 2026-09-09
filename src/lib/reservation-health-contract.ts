import type { ReservationApiCapabilities } from './types.js'

function invalidResponse(): never {
  throw new Error('RESERVATION_API_INVALID_RESPONSE')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function readPlainDataRecordSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key !== 'string')) return null
  const snapshot: Record<string, unknown> = Object.create(null)
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function readExactPlainDataRecordSnapshot(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  const snapshot = readPlainDataRecordSnapshot(value)
  if (!snapshot) return null
  const keys = Object.keys(snapshot)
  return keys.length === fields.length && fields.every((key) => Object.hasOwn(snapshot, key)) ? snapshot : null
}

export function parseReservationApiCapabilities(value: unknown): ReservationApiCapabilities {
  const row = readExactPlainDataRecordSnapshot(value, ['status', 'capabilities'])
  if (!row || row.status !== 'ready') invalidResponse()

  const legacyCapabilities = readExactPlainDataRecordSnapshot(row.capabilities, ['cakeOrderLines'])
  if (legacyCapabilities?.cakeOrderLines === 1) return { cakeOrderLines: 1 }

  const smoreCapabilities = readExactPlainDataRecordSnapshot(row.capabilities, [
    'cakeOrderLines', 'smoreStoredOrders', 'smoreWrites',
  ])
  if (
    !smoreCapabilities
    || smoreCapabilities.cakeOrderLines !== 1
    || smoreCapabilities.smoreStoredOrders !== 1
    || (smoreCapabilities.smoreWrites !== 0 && smoreCapabilities.smoreWrites !== 1)
  ) invalidResponse()
  return { cakeOrderLines: 1 }
}
