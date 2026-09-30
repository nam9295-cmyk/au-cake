// Pure saved-snapshot arithmetic. No catalogue, clocks, transport or storage.
const fail = () => { throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' }) }
const amount = value => {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail()
  return value
}
const sum = values => values.reduce((total, value) => amount(total + amount(value)), 0)
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function validateManualDiscountSelection(value) {
  if (value === null) return
  if (!exact(value, ['type', 'value', 'reason']) || !['percentage', 'fixed'].includes(value.type)) fail()
  amount(value.value)
  if (value.type === 'percentage' && value.value > 10000) fail()
  if (typeof value.reason !== 'string' || value.reason.trim() !== value.reason || value.reason.length > 1000 || (value.value > 0 && !value.reason)) fail()
}

export function calculateCustomCakeManualDiscount(baseQuote, paidSmoreLines, designExtraCents, figurineExtraCents, selection) {
  validateManualDiscountSelection(selection)
  if (selection === null || selection.value === 0) return null
  if (designExtraCents === null || figurineExtraCents === null || !Array.isArray(paidSmoreLines)) fail()
  const subtotal = sum(paidSmoreLines.map(line => line.subtotalCents))
  const discount = sum(paidSmoreLines.map(line => line.discountCents))
  if (sum(paidSmoreLines.map(line => line.totalCents)) !== baseQuote.paidSmoreTotalCents || subtotal - discount !== baseQuote.paidSmoreTotalCents
    || sum(paidSmoreLines.map(line => line.quantity)) !== baseQuote.paidSmoreQuantity) fail()
  const basisCents = sum([baseQuote.baseCents, designExtraCents, figurineExtraCents, subtotal])
  const replacedAutomaticDiscountCents = sum([baseQuote.cakeDiscountCents, discount])
  if (replacedAutomaticDiscountCents > basisCents) fail()
  // BigInt multiplication avoids overflowing an otherwise safe integer basis.
  const discountCents = selection.type === 'percentage'
    ? Number((BigInt(basisCents) * BigInt(selection.value) + 5000n) / 10000n)
    : selection.value
  amount(discountCents)
  if (discountCents > basisCents) fail()
  return { version: 1, ...selection, basisCents, discountCents, replacedAutomaticDiscountCents }
}

export function validateCustomCakeManualDiscountQuote(quote, paidSmoreLines) {
  if (!Object.hasOwn(quote, 'manualDiscount')) return
  const m = quote.manualDiscount
  if (!exact(m, ['version', 'type', 'value', 'reason', 'basisCents', 'discountCents', 'replacedAutomaticDiscountCents']) || m.version !== 1 || m.value === 0) fail()
  const expected = calculateCustomCakeManualDiscount(quote, paidSmoreLines, quote.designExtraCents, quote.figurineExtraCents, { type: m.type, value: m.value, reason: m.reason })
  for (const key of Object.keys(expected)) if (m[key] !== expected[key]) fail()
  if (quote.isFinalQuote !== true || quote.knownTotalCents !== m.basisCents - m.discountCents || quote.finalTotalCents !== quote.knownTotalCents) fail()
}
