import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { resolve } from 'node:path'
import ts from 'typescript'

const read = name => JSON.parse(readFileSync(`tests/fixtures/custom-cake-contract/${name}.json`, 'utf8'))
const custom = read('custom-v1'), v2 = read('cake-order-v2'), lifecycle = read('lifecycle'), canonical = read('canonical')
const cents = value => assert.ok(Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0), `invalid cents ${value}`)
const count = value => assert.ok(Number.isSafeInteger(value) && value > 0)
const timestamp = value => {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.equal(new Date(value).toISOString(), value)
}

// Invariant checkers are test-only consumers of static examples, not API mocks.
function checkQuote(q) {
  for (const key of ['baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity', 'knownTotalCents']) cents(q[key])
  for (const key of ['designExtraCents', 'figurineExtraCents']) if (q[key] !== null) cents(q[key])
  count(q.quoteVersion)
  timestamp(q.promotionEligibilityAt)
  assert.equal(q.currency, 'AUD')
  assert.equal(q.pricingPolicyVersion, 'custom-cake.2026-09.v1')
  assert.ok(q.cakeDiscountCents <= q.baseCents)
  const settled = q.designExtraCents !== null && q.figurineExtraCents !== null
  assert.equal(q.isFinalQuote, settled)
  assert.equal(q.knownTotalCents, q.baseCents - q.cakeDiscountCents + (q.designExtraCents ?? 0) + (q.figurineExtraCents ?? 0) + q.paidSmoreTotalCents)
  assert.equal(q.finalTotalCents, settled ? q.knownTotalCents : null)
  assert.ok(!Object.hasOwn(q, 'totalCents'))
}

function referenceError(lines) {
  const ids = new Map()
  for (const line of lines) {
    if (typeof line.lineId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(line.lineId) || ids.has(line.lineId)) return 'INVALID_LINE_ID'
    ids.set(line.lineId, line)
  }
  for (const line of lines) {
    if (line.kind !== 'cake-addon-smore') {
      if (line.parentCakeLineId !== null) return 'INVALID_LINE_REFERENCE'
    } else {
      const parent = ids.get(line.parentCakeLineId)
      if (!parent || parent.lineId === line.lineId || !['cake', 'custom-cake'].includes(parent.kind)) return 'INVALID_LINE_REFERENCE'
    }
  }
  return null
}

function checkSmore(line) {
  count(line.quantity)
  for (const key of ['unitPriceCents', 'subtotalCents', 'discountCents', 'totalCents']) cents(line[key])
  assert.equal(line.productId, 'smore-stick')
  assert.equal(line.unitPriceCents, 450)
  assert.equal(line.subtotalCents, line.quantity * 450)
  assert.equal(line.discountPercent, line.kind === 'cake-addon-smore' ? 30 : 0)
  assert.equal(line.discountCents, line.kind === 'cake-addon-smore' ? line.quantity * 135 : 0)
  assert.equal(line.totalCents, line.subtotalCents - line.discountCents)
}

function checkPricing(p) {
  for (const key of ['subtotalCents', 'discountCents', 'individualPackagingFeeCents', 'totalCents']) cents(p[key])
  assert.equal(referenceError(p.lines), null)
  for (const line of p.lines) {
    if (line.kind !== 'cake') checkSmore(line)
    else {
      for (const key of ['unitPriceCents', 'chocolateExtraCents', 'subtotalCents', 'discountCents', 'individualPackagingFeeCents', 'totalCents']) cents(line[key])
      assert.equal(line.subtotalCents, line.unitPriceCents * line.quantity + line.chocolateExtraCents)
      assert.equal(line.totalCents, line.subtotalCents - line.discountCents + line.individualPackagingFeeCents)
    }
  }
  assert.equal(p.subtotalCents, p.lines.reduce((n, l) => n + l.subtotalCents, 0))
  assert.equal(p.discountCents, p.lines.reduce((n, l) => n + l.discountCents, 0))
  assert.equal(p.individualPackagingFeeCents, p.lines.reduce((n, l) => n + (l.individualPackagingFeeCents || 0), 0))
  assert.equal(p.totalCents, p.subtotalCents - p.discountCents + p.individualPackagingFeeCents)
}

function confirmationResult(q) {
  if (!['quoted', 'confirmed'].includes(q.status)) return 'QUOTE_STATE_CONFLICT'
  if (q.expectedQuoteVersion !== q.currentQuoteVersion) return 'QUOTE_VERSION_CONFLICT'
  if (!q.isFinalQuote) return 'QUOTE_NOT_FINAL'
  if (q.acceptedQuoteVersion === null || q.acceptedAt === null) return 'QUOTE_ACCEPTANCE_REQUIRED'
  return q.acceptedQuoteVersion === q.currentQuoteVersion ? 'ok' : 'QUOTE_VERSION_CONFLICT'
}

// Compiler checks the actual declaration artifacts against complete JSON literals.
// This is not emitting code or importing a production runtime validator.
function typeDiagnostics(assignments) {
  const path = resolve('tests/__wire_contract_probe__.ts')
  const content = `import type * as C from '../src/lib/custom-cake-contract.js';\nimport type * as V from '../src/lib/cake-order-v2-contract.js';\nimport type * as W from '../src/lib/cake-wire-types.js';\nimport type * as P from '../src/lib/custom-cake-photo-contract.js';\n${assignments.map(([type, value], i) => `const value${i}: ${type} = ${JSON.stringify(value)};`).join('\n')}`
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext }
  const host = ts.createCompilerHost(options)
  const original = host.getSourceFile.bind(host)
  host.getSourceFile = (file, ...args) => file === path ? ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true) : original(file, ...args)
  return ts.getPreEmitDiagnostics(ts.createProgram([path], options, host))
}

test('complete custom/v2 response fixtures conform to their distinct wire types', () => {
  const assignments = [
    ['C.CustomCakeCreateRequest', custom.request], ['C.CustomCakeCreateResponse', custom.created],
    ['C.CustomCakeLookupResponse', custom.lookup], ['C.CustomCakeLookupResponse', custom.finalLookup],
    ['C.CustomCakeLookupResponse', lifecycle.revisedLookup], ['C.FinalQuote', custom.zeroExtrasQuote],
    ['V.CakeOrderV2Request', v2.request], ['V.CakeOrderV2CreateResponse', v2.created],
    ['V.CakeOrderV2LookupResponse', v2.lookup], ['V.CakeOrderV2Pricing', v2.couponExample],
    ['C.UpdateCustomCakeQuoteRequest', lifecycle.mutationRequests.update],
    ['C.AcceptCustomCakeQuoteRequest', lifecycle.mutationRequests.accept],
    ['C.ConfirmCustomCakeRequest', lifecycle.mutationRequests.confirm],
    ...lifecycle.capabilities.map(x => ['W.CakeWireCapabilities', x]),
    ...lifecycle.errors.map(x => ['W.ContractError', x]),
    ['W.LegacyCakeUpgradeError', lifecycle.legacyUpgradeError],
  ]
  assert.deepEqual(typeDiagnostics(assignments).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
})

test('wire types reject final-null, missing line identity, wrong tier and legacy bulk', () => {
  const invalid = [
    ['C.CustomCakeQuote', { ...custom.created.quote, isFinalQuote: true }],
    ['C.CustomCakeQuote', { ...custom.zeroExtrasQuote, isFinalQuote: false, finalTotalCents: null }],
    ['C.CustomCakeLine', { ...custom.request.lines[0], tier: 'double', size: '6in' }],
    ['W.SmorePricedLine', { ...v2.smoreCases[1], discountPercent: 10 }],
    ['V.CakeOrderV2Request', { ...v2.request, pricing: v2.created.pricing }],
    ['C.CustomCakeCreateResponse', { ...custom.created, acceptance: { acceptedQuoteVersion: 1, acceptedAt: '2026-09-09T00:00:00.000Z' } }],
    ['C.CustomCakeCreateResponse', { ...custom.created, quote: { ...custom.created.quote, designExtraCents: 0 } }],
    ['W.ContractError', { ok: false, contractVersion: 'cake-order.v2', code: 'CAKE_ORDER_UPGRADE_REQUIRED' }],
  ]
  const { lineId: omitted, ...missingId } = custom.request.lines[0]
  assert.ok(omitted)
  invalid.push(['C.CustomCakeLine', missingId])
  for (const assignment of invalid) assert.ok(typeDiagnostics([assignment]).length > 0, assignment[0])
})

test('declaration artifacts erase to no runtime implementation', () => {
  for (const name of ['cake-wire-types', 'custom-cake-contract', 'cake-order-v2-contract', 'custom-cake-photo-contract']) {
    const source = readFileSync(`src/lib/${name}.ts`, 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText.trim()
    assert.equal(output, 'export {};')
  }
})

test('null/zero/positive agreed extras preserve provisional versus final sums', () => {
  for (const example of custom.extraCases) checkQuote({ ...custom.created.quote, ...example })
  checkQuote(custom.finalLookup.quote)
  checkQuote(lifecycle.revisedLookup.quote)
  assert.equal(custom.finalLookup.quote.finalTotalCents, 18855)
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, undefined]) {
    assert.throws(() => checkQuote({ ...custom.finalLookup.quote, designExtraCents: value }))
  }
  assert.throws(() => checkQuote({ ...custom.created.quote, isFinalQuote: true, finalTotalCents: 15355 }))
  assert.throws(() => checkQuote({ ...custom.zeroExtrasQuote, isFinalQuote: false, finalTotalCents: null }))
})

test('all six base prices keep five percent on base only and gifts per cake item', () => {
  assert.equal(custom.sizes.length, 6)
  for (const row of custom.sizes) {
    assert.equal(row.cakeDiscountCents, Math.round(row.baseCents * 5 / 100))
    assert.equal(row.knownTotalCents, row.baseCents - row.cakeDiscountCents)
    assert.equal(row.giftSmoreQuantity, row.quantity * 2)
  }
  assert.equal(custom.finalLookup.quote.cakeDiscountCents, custom.created.quote.cakeDiscountCents)
  assert.equal(custom.finalLookup.quote.giftSmoreQuantity, custom.created.quote.giftSmoreQuantity)
})

test('Sydney exclusive event boundary uses initial receipt, not pickup or quote edit', () => {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  assert.match(format.format(new Date('2026-09-30T14:00:00.000Z')), /2026-10-01.*00:00/)
  for (const row of custom.eventCases) {
    const eligible = row.receivedAt < '2026-09-30T14:00:00.000Z'
    assert.equal(row.cakeDiscountCents, eligible ? Math.round(row.baseCents * 5 / 100) : 0)
    assert.equal(row.giftSmoreQuantity, eligible ? row.quantity * 2 : 0)
    assert.ok(row.quoteUpdatedAt > '2026-09-30T14:00:00.000Z')
  }
})

test('standalone 1/6/12 has no bulk; add-on 1/6/12 remains thirty percent after September', () => {
  for (const row of v2.smoreCases) checkSmore(row)
  checkPricing(v2.created.pricing)
  checkPricing(v2.couponExample)
  assert.equal(v2.couponExample.lines[1].discountCents, 270)
  assert.equal(v2.couponExample.totalCents, 8135)
  assert.throws(() => checkSmore({ ...v2.smoreCases[1], discountPercent: 10, discountCents: 270, totalCents: 2430 }))
  assert.throws(() => checkSmore({ ...v2.smoreCases[5], discountPercent: 35 }))
})

test('stable ID graph rejects missing/self/smore parents and duplicate IDs', () => {
  assert.equal(referenceError(custom.request.lines), null)
  assert.equal(referenceError(v2.request.lines), null)
  for (const row of v2.referenceCases) assert.equal(referenceError(row.lines), row.error, row.name)
  assert.deepEqual(JSON.parse(JSON.stringify(v2.request.lines)), v2.request.lines, 'cart save/restore retains identity')
})

test('quote revisions cannot use stale acceptance for confirmation', () => {
  for (const row of lifecycle.confirmationCases) assert.equal(confirmationResult(row), row.result, row.name)
  const revised = lifecycle.revisedLookup
  assert.equal(confirmationResult({ status: revised.status, currentQuoteVersion: revised.quote.quoteVersion, expectedQuoteVersion: revised.quote.quoteVersion, ...revised.acceptance, isFinalQuote: revised.quote.isFinalQuote }), 'QUOTE_VERSION_CONFLICT')
  assert.deepEqual(revised.acceptanceHistory[0], custom.finalLookup.acceptance)
  for (const row of lifecycle.updates) {
    if (row.expectedQuoteVersion === row.currentQuoteVersion) assert.equal(row.nextQuoteVersion, row.currentQuoteVersion + 1)
    else { assert.equal(row.result, 'QUOTE_VERSION_CONFLICT'); assert.equal(row.nextQuoteVersion, row.currentQuoteVersion) }
  }
})

test('required rejects old new submission but replays exact stored retry before cutover gate', () => {
  for (const row of lifecycle.cutover) {
    const result = row.existing ? row.match ? 'stored-replay' : 'REQUEST_ID_CONFLICT'
      : row.version === 'v1' ? row.phase === 'required' ? 'CAKE_ORDER_UPGRADE_REQUIRED' : 'legacy-new-allowed' : 'v2-new-allowed'
    assert.equal(result, row.result)
  }
})

test('canonical bytes survive reorder, preserve ID/parent distinctions and use separate hash domains', () => {
  for (const row of canonical.cases) {
    const canonicalizeFixture = request => {
      const { requestId, ...payload } = structuredClone(request)
      assert.match(requestId, /^[a-f0-9-]{36}$/)
      payload.lines.sort((a, b) => a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0)
      for (const line of payload.lines) if (line.photoRefs) line.photoRefs.sort()
      return JSON.stringify(payload)
    }
    assert.equal(canonicalizeFixture(row.request), row.canonicalJson)
    assert.equal(canonicalizeFixture(row.permuted), row.canonicalJson)
    const hash = createHmac('sha256', Buffer.alloc(32, 7)).update(row.domain).update(row.canonicalJson).digest('hex')
    assert.equal(hash, row.fingerprint)
    const changed = structuredClone(row.request)
    changed.lines[0].lineId = 'cake_B'
    assert.notEqual(canonicalizeFixture(changed), row.canonicalJson)
    assert.equal(referenceError(changed.lines), 'INVALID_LINE_REFERENCE')
    changed.lines[1].parentCakeLineId = 'cake_B'
    assert.equal(referenceError(changed.lines), null)
    assert.notEqual(canonicalizeFixture(changed), row.canonicalJson)
    const distinct = structuredClone(row.request)
    distinct.lines.push({ ...distinct.lines[0], lineId: 'cake_C' })
    assert.equal(JSON.parse(canonicalizeFixture(distinct)).lines.length, 3, 'distinct IDs are not merged')
  }
  assert.notEqual(canonical.cases[0].domain, canonical.cases[1].domain)
})

// Contract artifacts, not a production endpoint/pricing implementation.
test('approved custom/v2 contract artifacts exist before frontend/backend split', () => {
  for (const path of [
    'docs/custom-cake-api-contract.md',
    'src/lib/custom-cake-contract.ts',
    'src/lib/cake-order-v2-contract.ts',
    'tests/fixtures/custom-cake-contract/custom-v1.json',
    'tests/fixtures/custom-cake-contract/cake-order-v2.json',
    'tests/fixtures/custom-cake-contract/lifecycle.json',
    'tests/fixtures/custom-cake-contract/canonical.json',
  ]) assert.ok(existsSync(path), `missing approved contract artifact: ${path}`)
})

test('admin list contract contains only strict custom cake lookup snapshots', () => {
  assert.deepEqual(typeDiagnostics([['C.CustomCakeAdminListResponse', { requests: [custom.lookup, custom.finalLookup] }]]), [])
  assert.ok(typeDiagnostics([['C.CustomCakeAdminListResponse', { requests: [{ ...custom.lookup, payloadJson: 'private' }] }]]).length > 0)
})

test('existing immutable golden is still present with 17 cases', () => {
  const golden = JSON.parse(readFileSync('tests/fixtures/order-core-golden.json', 'utf8'))
  assert.equal(golden.cases.length, 17)
})

test('lifecycle supplement requires both status and quote CAS on exact action wires', () => {
  assert.ok(existsSync('tests/fixtures/custom-cake-contract/lifecycle-supplement.json'))
  const fixture = read('lifecycle-supplement')
  assert.deepEqual(typeDiagnostics(fixture.requests.map(x => ['C.CustomCakeLifecycleAction', x])).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  assert.deepEqual(typeDiagnostics(fixture.responses.map(x => ['C.CustomCakeMutationResponse', x])).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  for (const response of fixture.responses) {
    assert.deepEqual(response.quote, custom.finalLookup.quote)
    assert.deepEqual(response.acceptance, custom.finalLookup.acceptance)
    assert.deepEqual(response.acceptanceHistory, custom.finalLookup.acceptanceHistory)
  }
  for (const request of fixture.requests) {
    for (const key of ['expectedStatus', 'expectedQuoteVersion']) {
      const invalid = structuredClone(request)
      delete invalid.data[key]
      assert.ok(typeDiagnostics([['C.CustomCakeLifecycleAction', invalid]]).length > 0)
    }
  }
  assert.ok(typeDiagnostics([['C.CustomCakeLifecycleAction', { ...fixture.requests[0], data: { ...fixture.requests[0].data, expectedStatus: 'cancelled' } }]]).length > 0)
})

test('terminal transition fixtures never overwrite terminal states or accept unproven replay', () => {
  assert.ok(existsSync('tests/fixtures/custom-cake-contract/lifecycle-supplement.json'))
  for (const row of read('lifecycle-supplement').cases) {
    // Static contract consumer; backend must separately prove atomic persistence.
    const replay = row.current === row.target && row.recordedSource === row.expectedStatus && row.recordedVersion === row.expectedQuoteVersion
    const result = row.current !== row.expectedStatus && !replay ? 'QUOTE_STATE_CONFLICT'
      : row.currentQuoteVersion !== row.expectedQuoteVersion ? 'QUOTE_VERSION_CONFLICT'
        : replay ? 'noop'
          : (row.target === 'completed' ? row.current === 'confirmed' : ['requested', 'quoted', 'confirmed'].includes(row.current)) ? 'transition' : 'QUOTE_STATE_CONFLICT'
    assert.equal(result, row.result, row.name)
    assert.equal(row.paymentEffects, 0)
    assert.equal(row.implicitEmailEvents, 0)
    assert.equal(row.preserveHistory, true)
  }
})

test('photo session/upload/read/delete fixtures conform without public URLs or order credentials', () => {
  assert.ok(existsSync('tests/fixtures/custom-cake-contract/photo.json'))
  const p = read('photo')
  assert.deepEqual(typeDiagnostics(p.wires.map(x => [x.type, x.value])).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  const upload = p.wires.find(x => x.type === 'P.PhotoUploadRequest').value
  const readRequest = p.wires.find(x => x.type === 'P.PhotoReadRequest').value
  const invalid = [
    ['P.PhotoUploadRequest', { ...upload, mimeType: 'image/gif' }],
    ['P.PhotoReadRequest', { ...readRequest, authorization: { kind: 'upload-session', token: 'not-customer-lookup-proof' } }],
    ['P.PhotoReadResponse', { contractVersion: 'custom-cake-photo.v1', photoRef: 'photo_A', publicUrl: 'https://example.invalid/photo' }],
    ['C.CustomCakeCreateRequest', { ...custom.request, uploadToken: 'must-not-enter-data' }],
  ]
  for (const item of invalid) assert.ok(typeDiagnostics([item]).length > 0, item[0])
  for (const row of canonical.cases) assert.ok(!/uploadToken|uploadSessionId/.test(row.canonicalJson))
})

test('photo security fixture boundaries include size pixels frames ownership and metadata normalization', () => {
  assert.ok(existsSync('tests/fixtures/custom-cake-contract/photo.json'))
  const p = read('photo')
  for (const row of p.validationCases) {
    const accepted = ['image/jpeg', 'image/png', 'image/webp'].includes(row.mimeType)
      && row.bytes > 0 && row.bytes <= 10485760 && row.pixels > 0 && row.pixels <= 20000000
      && row.frames === 1 && row.signatureMatches && row.decodeValid && row.requestPhotoCount <= 5;
    assert.equal(accepted, row.accepted, row.name)
  }
  for (const row of p.ownershipCases) assert.equal(row.validToken && row.sameSession && row.sameRequest && !row.expired && row.staged, row.attachAllowed, row.name)
  assert.deepEqual(p.normalizedExample, { mimeType: 'image/webp', width: 2560, height: 1920, metadataPresent: false, frames: 1 })
})

test('cleanup contract scenarios retain attached or uncertain photos and fence late attaches', () => {
  assert.ok(existsSync('tests/fixtures/custom-cake-contract/photo.json'))
  for (const row of read('photo').cleanupCases) {
    const mayDelete = row.ageHours >= 24 && row.authoritativeReadSucceeded && !row.requestReferencesPhoto && !row.metadataAttached && row.exclusiveDeleteClaim;
    assert.equal(mayDelete, row.mayDeleteStorage, row.name)
    assert.equal(row.requestDataChanged, false)
    if (row.exclusiveDeleteClaim) assert.equal(row.lateAttachAllowed, false)
    if (row.storageDeleteFailed) assert.equal(row.durableRetryRetained, true)
  }
})
