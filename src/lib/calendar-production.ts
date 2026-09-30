export type CalendarProductionLine = {
  tier: 'single' | 'double'
  size: string
  quantity: number
  flavour: string | null
  designRequest: string
  figurineSource: 'none' | 'customer' | 'shop'
}
export type CalendarProductionDetail = {
  id: string
  pickupDate: string
  pickupTime: string
  status: string
  lines: CalendarProductionLine[]
  additionalRequest: string
}
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)))
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
export function parseCalendarProductionDetail(value: unknown): CalendarProductionDetail {
  const invalid = () => { throw new Error('RESERVATION_API_INVALID_RESPONSE') }
  if (!exact(value, ['id', 'pickupDate', 'pickupTime', 'status', 'lines', 'additionalRequest'])
    || typeof value.id !== 'string' || !/^custom-cake:[A-Za-z0-9_-]{1,64}$/.test(value.id)
    || typeof value.pickupDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.pickupDate)
    || !Number.isFinite(Date.parse(value.pickupDate)) || new Date(value.pickupDate).toISOString().slice(0, 10) !== value.pickupDate
    || typeof value.pickupTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.pickupTime)
    || !['Requested', 'Quoted', 'Confirmed', 'Completed', 'Cancelled'].includes(String(value.status))
    || !text(value.additionalRequest, 1000) || !Array.isArray(value.lines) || !value.lines.length || value.lines.length > 30) invalid()
  const v = value as CalendarProductionDetail
  for (const line of v.lines) {
    if (!exact(line, ['tier', 'size', 'quantity', 'flavour', 'designRequest', 'figurineSource'])
      || !['single', 'double'].includes(line.tier) || !(line.tier === 'single' ? ['6in', '8in', '10in'] : ['4in+6in', '6in+8in', '8in+10in']).includes(line.size)
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 5
      || !(line.flavour === null || (text(line.flavour, 64) && line.flavour.length > 0))
      || !text(line.designRequest, 1000) || !['none', 'customer', 'shop'].includes(line.figurineSource)) invalid()
  }
  return structuredClone(v)
}
