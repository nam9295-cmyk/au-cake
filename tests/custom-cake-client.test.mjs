import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
const path = new URL('../src/lib/custom-cake-client.ts', import.meta.url)
const client = existsSync(path) ? await import(path.href) : {}
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${name}.json`, import.meta.url)))
const custom = fixture('custom-v1')
const ordinary = fixture('cake-order-v2')
const repoPath = new URL('../src/lib/custom-cake-repository.ts', import.meta.url)
const adapters = existsSync(repoPath) ? await import(repoPath.href) : {}
const parse = (name, value) => { assert.equal(typeof client[name], 'function', `${name} must exist`); return client[name](value) }
for (const [name, value] of [
  ['parseCustomCakeCreateResponse', custom.created], ['parseCustomCakeLookupResponse', custom.lookup],
  ['parseCustomCakeMutationResponse', custom.finalLookup], ['parseCakeOrderV2CreateResponse', ordinary.created],
  ['parseCakeOrderV2LookupResponse', ordinary.lookup],
]) {
  test(`${name} selects exact saved wire shape`, () => {
    assert.deepEqual(parse(name, value), value)
    for (const bad of [{ ...value, secret: 'never echo' }, { ...value, contractVersion: 'unknown' }, null, []]) {
      assert.throws(() => parse(name, bad), /^Error: CAKE_WIRE_INVALID_RESPONSE$/)
    }
  })
}
test('creation and lookup cannot substitute for each other', () => {
  assert.throws(() => parse('parseCustomCakeCreateResponse', custom.lookup))
  assert.throws(() => parse('parseCustomCakeLookupResponse', custom.created))
  assert.throws(() => parse('parseCakeOrderV2CreateResponse', ordinary.lookup))
  assert.throws(() => parse('parseCakeOrderV2LookupResponse', ordinary.created))
  const parent = structuredClone(custom.created)
  parent.paidSmoreLines[0].parentCakeLineId = parent.paidSmoreLines[0].lineId
  assert.throws(() => parse('parseCustomCakeCreateResponse', parent))
})
test('custom parser rejects inconsistent money, parent graph, finality, status and history', () => {
  for (const change of [
    v => { v.quote.knownTotalCents++ }, v => { v.quote.baseCents = Number.MAX_SAFE_INTEGER },
    v => { v.quote.designExtraCents = -0 }, v => { v.quote.giftSmoreQuantity = 0.5 },
    v => { v.quote.finalTotalCents = null }, v => { v.quote.isFinalQuote = false },
    v => { v.acceptance.acceptedQuoteVersion = 1 }, v => { v.acceptanceHistory = [] },
    v => { v.acceptanceHistory.push(v.acceptance) }, v => { v.acceptanceHistory[0].acceptedAt = 'bad' },
    v => { v.status = '예약확정' }, v => { v.lines[1].parentCakeLineId = 'missing' },
    v => { v.lines[1].lineId = v.lines[0].lineId }, v => { v.paidSmoreLines[0].quantity++ },
    v => { v.lines[0].photoRefs = ['https://private.invalid/x'] },
    v => { v.lines[0].photoRefs.push(v.lines[0].photoRefs[0]) },
  ]) {
    const bad = structuredClone(custom.finalLookup); change(bad)
    assert.throws(() => parse('parseCustomCakeLookupResponse', bad), /^Error: CAKE_WIRE_INVALID_RESPONSE$/)
  }
  const revised = structuredClone(custom.finalLookup)
  revised.status = 'quoted'; revised.quote.quoteVersion++
  assert.deepEqual(parse('parseCustomCakeMutationResponse', revised), revised, 'stale history is valid until confirmation')
})
test('v2 validates saved arithmetic and graph without repricing against catalogue', () => {
  const historical = structuredClone(ordinary.lookup)
  historical.pricing.lines[0].unitPriceCents += 100
  historical.pricing.lines[0].subtotalCents += 100
  historical.pricing.lines[0].totalCents += 100
  historical.pricing.subtotalCents += 100
  historical.pricing.totalCents += 100
  assert.deepEqual(parse('parseCakeOrderV2LookupResponse', historical), historical)
  for (const change of [
    v => { v.pricing.totalCents++ }, v => { v.pricing.lines[0].subtotalCents++ },
    v => { v.pricing.lines[1].parentCakeLineId = v.pricing.lines[1].lineId },
    v => { v.pricing.lines[1].discountPercent = 10 }, v => { v.pricing.lines[0].options.extra = true },
    v => { v.pricing.lines[0].totalCents = Infinity }, v => { v.pricing.pricedAt = '2026-02-30T00:00:00.000Z' },
    v => { v.pricing.lines[0].discountPercent = 5 },
  ]) { const bad = structuredClone(ordinary.lookup); change(bad); assert.throws(() => parse('parseCakeOrderV2LookupResponse', bad)) }
})
test('capability is separate and fails closed', () => {
  const value = { contractVersion: 'cake-capabilities.v1', status: 'ready', customCakeV1: true, cakeOrderV2: true, legacyNewSubmissions: 'required' }
  assert.deepEqual(parse('parseCakeWireCapabilities', value), value)
  for (const change of [{ status: 'ok' }, { cakeOrderV2: 'true' }, { legacyNewSubmissions: 'unknown' }, { health: true }]) {
    assert.throws(() => parse('parseCakeWireCapabilities', { ...value, ...change }))
  }
})
test('photo parsers validate every selected response and never return URL shapes', () => {
  for (const [type, name] of [['PhotoSessionResponse', 'parsePhotoSessionResponse'], ['PhotoUploadResponse', 'parsePhotoUploadResponse'], ['PhotoReadResponse', 'parsePhotoReadResponse'], ['PhotoDeleteResponse', 'parsePhotoDeleteResponse']]) {
    const value = fixture('photo').wires.find(v => v.type === `P.${type}`).value
    assert.deepEqual(parse(name, value), value)
    assert.throws(() => parse(name, { ...value, url: 'https://private.invalid' }))
    assert.throws(() => parse(name, { ...value, contractVersion: 'custom-cake.v1' }))
  }
})
test('real Appwrite execution adapter selects actions, isolated headers and strict errors', async () => {
  assert.equal(typeof adapters.createAppwriteCakeWireTransport, 'function')
  assert.equal(typeof adapters.createCakeWireRepository, 'function')
  const calls = []
  let reply = { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: custom.created }) }
  const transport = adapters.createAppwriteCakeWireTransport({ functionId: 'reservation-api', functions: { createExecution: async input => { calls.push(input); if (reply instanceof Error) throw reply; return reply } }, account: { createJWT: async () => ({ jwt: 'test-admin-jwt' }) } })
  const repo = adapters.createCakeWireRepository(transport)
  const credential = { uploadSessionId: 'session_test', uploadToken: 'secret-test-only' }
  assert.deepEqual(await repo.createCustomCakeRequest(custom.request, credential), custom.created)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].async, false)
  assert.equal(calls[0].headers['x-custom-cake-upload-token'], credential.uploadToken)
  assert.deepEqual(JSON.parse(calls[0].body), { action: 'create-custom-cake-request', data: custom.request })
  reply = { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: custom.finalLookup }) }
  await repo.confirmCustomCakeRequest({ contractVersion: 'custom-cake.v1', requestNumber: custom.lookup.requestNumber, expectedQuoteVersion: 2 })
  assert.deepEqual(calls[1].headers, { 'x-appwrite-user-jwt': 'test-admin-jwt' })
  reply = { responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, contractVersion: 'custom-cake.v1', code: 'QUOTE_VERSION_CONFLICT' }) }
  await assert.rejects(repo.confirmCustomCakeRequest({}), /^Error: QUOTE_VERSION_CONFLICT$/)
  reply = { responseStatusCode: NaN, responseBody: JSON.stringify({ ok: true, result: custom.created }) }
  await assert.rejects(repo.createCustomCakeRequest(custom.request), /^Error: CAKE_WIRE_INVALID_RESPONSE$/)
  for (const body of [{ ok: false, code: 'CAKE_ORDER_UPGRADE_REQUIRED' }, { ok: false, contractVersion: 'cake-order.v2', code: 'QUOTE_VERSION_CONFLICT' }, { ok: false, contractVersion: 'custom-cake.v1', code: 'SECRET_PROVIDER_ERROR' }, { ok: true, result: custom.created, secret: true }]) {
    reply = { responseStatusCode: 409, responseBody: JSON.stringify(body) }
    await assert.rejects(repo.createCustomCakeRequest(custom.request), /^Error: CAKE_WIRE_INVALID_RESPONSE$/)
  }
  const before = calls.length
  reply = new Error('timeout containing a secret')
  await assert.rejects(repo.createCakeOrderV2(ordinary.request), /^Error: CAKE_WIRE_UNAVAILABLE$/)
  assert.equal(calls.length, before + 1, 'timeout never triggers a v1 fallback')
})
