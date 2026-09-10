export const CUSTOM_CAKE_LIST_PAGE_SIZE = 100
export const CUSTOM_CAKE_LIST_MAX_PAGES = 10
export const CUSTOM_CAKE_ADMIN_RESULT_LIMIT = 200

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const fail = () => { throw Object.assign(new Error('PERSISTENCE_INVALID_RECORD'), { code: 'PERSISTENCE_INVALID_RECORD' }) }
const lookupKeys = ['contractVersion', 'requestNumber', 'status', 'customer', 'pickup', 'lines', 'quote', 'paidSmoreLines', 'acceptance', 'acceptanceHistory']
const quoteKeys = ['currency', 'pricingPolicyVersion', 'promotionEligibilityAt', 'baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity', 'knownTotalCents', 'isFinalQuote', 'designExtraCents', 'figurineExtraCents', 'finalTotalCents', 'quoteVersion']
const customLineKeys = ['kind', 'lineId', 'parentCakeLineId', 'productId', 'quantity', 'tier', 'size', 'designNote', 'figurineSource', 'photoRefs']
const smoreLineKeys = ['kind', 'lineId', 'productId', 'quantity', 'parentCakeLineId']
const pricedSmoreKeys = [...smoreLineKeys, 'unitPriceCents', 'subtotalCents', 'discountPercent', 'discountCents', 'totalCents']
const acceptanceKeys = ['acceptedQuoteVersion', 'acceptedAt']

function safeCustomCakeLookup(value) {
  if (!exact(value, lookupKeys)
    || !exact(value.customer, ['customerName', 'customerPhone', 'customerEmail'])
    || !exact(value.pickup, ['pickupDate', 'pickupTime'])
    || !exact(value.quote, quoteKeys)
    || !Array.isArray(value.lines) || !value.lines.every(line => exact(line, line.kind === 'custom-cake' ? customLineKeys : smoreLineKeys))
    || !Array.isArray(value.paidSmoreLines) || !value.paidSmoreLines.every(line => exact(line, pricedSmoreKeys))
    || (value.acceptance !== null && !exact(value.acceptance, acceptanceKeys))
    || !Array.isArray(value.acceptanceHistory) || !value.acceptanceHistory.every(item => exact(item, acceptanceKeys))) fail()
  return structuredClone(value)
}

export async function scanCustomCakeSnapshots(repository) {
  const rows = []
  let cursor
  for (let page = 0; page < CUSTOM_CAKE_LIST_MAX_PAGES; page++) {
    const batch = await repository.list('snapshots', {
      limit: CUSTOM_CAKE_LIST_PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    })
    rows.push(...batch)
    if (batch.length < CUSTOM_CAKE_LIST_PAGE_SIZE) break
    cursor = batch.at(-1).id
  }
  return rows
}

export async function listRecentCustomCakeRequests(repository) {
  const rows = await scanCustomCakeSnapshots(repository)
  return rows
    .filter(row => row.value.request.contractVersion === 'custom-cake.v1')
    .map(row => safeCustomCakeLookup(row.value.lookupResponse))
    .sort((left, right) =>
      right.quote.promotionEligibilityAt.localeCompare(left.quote.promotionEligibilityAt)
      || right.requestNumber.localeCompare(left.requestNumber))
    .slice(0, CUSTOM_CAKE_ADMIN_RESULT_LIMIT)
}
