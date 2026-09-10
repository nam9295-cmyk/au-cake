import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomCakePage } from '../src/pages/CustomCakePage'
import { CustomCakeCompletePage } from '../src/pages/CustomCakeCompletePage'
import { CustomCakeLookupResult } from '../src/components/CustomCakeLookupResult'
import { CustomCakePhoto } from '../src/components/CustomCakePhoto'
import { AdminCustomCakesSection } from '../src/components/AdminCustomCakesSection'
import { functions, account } from '../src/lib/appwrite'
import { parseCustomCakeCreateResponse, parseCustomCakeLookupResponse } from '../src/lib/custom-cake-client'

const fixture = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/custom-v1.json', 'utf8'))
const photoWires = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/photo.json', 'utf8')).wires
const photoRead = photoWires.find(w => w.type === 'P.PhotoReadResponse').value
const props = { language: 'en', navigate() {}, setLanguage() {}, cartItemCount: 0, onComplete() {} }
const capabilities = { contractVersion: 'cake-capabilities.v1', status: 'ready', customCakeV1: true, cakeOrderV2: true, legacyNewSubmissions: 'compat' }

// Invoke actual handlers with React's hook dispatcher while replacing only the
// external Appwrite execution/JWT boundary. Child elements remain real elements.
function mount(Component, properties = {}) {
  const slots = [], effects = [], cleanups = []
  let cursor = 0, tree
  const dispatcher = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) { return dispatcher.useState(() => ({ current: initial }))[0] },
    useId() { return dispatcher.useState(() => `test-${cursor}`)[0] },
    useEffect(effect, dependencies) {
      const index = cursor++
      if (!slots[index] || dependencies.some((dependency, i) => dependency !== slots[index][i])) {
        slots[index] = dependencies
        effects.push(() => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) })
      }
    },
  }
  const render = () => {
    cursor = 0
    const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
    const previous = internals.H
    internals.H = dispatcher
    try { tree = Component(properties) } finally { internals.H = previous }
    return tree
  }
  const flush = async () => { while (effects.length) effects.shift()(); await new Promise(setImmediate); render() }
  const find = predicate => {
    function visit(node) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { for (const child of node) { const result = visit(child); if (result) return result } return }
      if (predicate(node)) return node
      return visit(node.props?.children)
    }
    const found = visit(tree)
    assert.ok(found, 'expected rendered control')
    return found
  }
  render()
  return { render, flush, find, unmount() { cleanups.forEach(cleanup => cleanup()) } }
}
function wire(handler) {
  const calls = []
  functions.createExecution = async execution => {
    const body = JSON.parse(execution.body)
    calls.push({ ...body, headers: execution.headers })
    const response = await handler(body.action, body.data, execution.headers)
    return response?.responseStatusCode ? response : { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: response }) }
  }
  account.createJWT = async () => ({ jwt: 'synthetic-admin-jwt' })
  return calls
}
test('actual lookup and completion render literal parsed server cents, including zero and unknown extras', () => {
  const created = structuredClone(fixture.created)
  Object.assign(created.quote, { baseCents: 22222, cakeDiscountCents: 1111, knownTotalCents: 21741 })
  const receipt = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: parseCustomCakeCreateResponse(created), onGoToLookup() {} }))
  assert.match(receipt, /AUD \$222\.22/)
  assert.match(receipt, /-AUD \$11\.11/)
  assert.match(receipt, /AUD \$217\.41/)
  assert.match(receipt, /2 sticks \(Free\)/)
  assert.match(receipt, /To be confirmed/)
  const lookup = structuredClone(fixture.finalLookup)
  lookup.status = 'quoted'
  Object.assign(lookup.quote, { baseCents: 22222, cakeDiscountCents: 1111, designExtraCents: 0, figurineExtraCents: 3729, knownTotalCents: 25470, finalTotalCents: 25470 })
  const result = renderToStaticMarkup(React.createElement(CustomCakeLookupResult, { result: parseCustomCakeLookupResponse(lookup), language: 'en' }))
  assert.match(result, /AUD \$254\.70/)
  assert.match(result, /-AUD \$11\.11/)
  assert.match(result, /No extra charge \(AUD \$0\.00\)/)
  assert.match(result, /\+AUD \$37\.29/)
})

test('customer-facing promotion, response-time, and pickup copy stays conditional and appointment-only', () => {
  const english = renderToStaticMarkup(React.createElement(CustomCakePage, props))
  const korean = renderToStaticMarkup(React.createElement(CustomCakePage, { ...props, language: 'ko' }))

  assert.match(english, /September Opening Offer · Eligibility is confirmed when your request is received\./)
  assert.match(korean, /9월 오픈 프로모션 · 혜택 적용 여부는 요청 접수 시 확인됩니다\./)
  assert.doesNotMatch(english, /September 5% Off|September promo: 5% off|2 Free S’mores|within 24 hours/i)
  assert.doesNotMatch(korean, /9월 5% 할인|5% 할인 \+ 스모어 2개 증정|24시간 이내/)
  assert.match(english, /review your request and get back to you after checking the design and availability/)
  assert.match(korean, /디자인과 제작 가능 여부를 확인한 후 요청 내용을 검토해 연락드리겠습니다/)

  assert.match(english, /Pre-arranged pick-up in Melrose Park, Sydney\. Exact handoff details are provided after your request is confirmed\./)
  assert.match(korean, /시드니 Melrose Park에서 사전 약속 픽업으로 진행됩니다\. 정확한 전달 장소와 방법은 주문 확정 후 안내드립니다\./)
  assert.doesNotMatch(english, /our Melrose Park, Sydney kitchen|Melrose Park pickup location/)
  assert.doesNotMatch(korean, /멜로즈 파크 매장에서 픽업/)

  assert.match(english, /You may provide your own figurines or ask Verygood to source them\. Handoff details and timing for customer-provided figurines will be arranged during order confirmation\./)
  assert.match(korean, /직접 피규어를 준비하시거나 Verygood에서 준비하도록 요청하실 수 있습니다\. 고객이 준비한 피규어의 전달 방법과 일정은 주문 확정 과정에서 안내드립니다\./)
  assert.doesNotMatch(english, /2–3 days|safe sanitization|arrive.*before pick-up/i)
  assert.doesNotMatch(korean, /2~3일|매장으로 전달/)
})

test('receipt and lookup promotion rows reflect only non-zero server quote snapshots', () => {
  const created = structuredClone(fixture.created)
  Object.assign(created.quote, { cakeDiscountCents: 0, giftSmoreQuantity: 0, knownTotalCents: 16130 })
  const receipt = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: parseCustomCakeCreateResponse(created), onGoToLookup() {} }))
  assert.doesNotMatch(receipt, /September 5% Promotion|Gift S’more Sticks/)

  const lookup = structuredClone(fixture.lookup)
  Object.assign(lookup.quote, { cakeDiscountCents: 0, giftSmoreQuantity: 0, knownTotalCents: 16130 })
  const result = renderToStaticMarkup(React.createElement(CustomCakeLookupResult, { result: parseCustomCakeLookupResponse(lookup), language: 'en' }))
  assert.doesNotMatch(result, /September 5% Custom Promotion|Gift S’more Sticks|Gift: 0 sticks/)
})

test('actual request UI has catalogue copy and disables submit until capability is ready', async () => {
  const calls = wire(() => ({ ...capabilities, customCakeV1: false }))
  const page = mount(CustomCakePage, props)
  assert.equal(page.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true)
  await page.flush()
  assert.equal(page.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].action, 'get-cake-wire-capabilities')
  const html = renderToStaticMarkup(React.createElement(CustomCakePage, props))
  assert.match(html, /From AUD \$155/)
  assert.doesNotMatch(html, /Estimated Known Total|Base subtotal|AUD \$147\.25/)
  page.unmount()
})

test('actual submit handler freezes UUID line IDs, contact and options across timeout retry', async () => {
  let creates = 0, completed
  const calls = wire((action, data) => {
    if (action === 'get-cake-wire-capabilities') return capabilities
    if (++creates === 1) throw new Error('timeout')
    return { ...fixture.created, requestId: data.requestId }
  })
  const page = mount(CustomCakePage, { ...props, onComplete(result) { completed = result } })
  await page.flush()
  const change = (suffix, value) => { page.find(node => node.type === 'input' && node.props.id?.endsWith(suffix)).props.onChange({ target: { value } }); page.render() }
  change('-name', 'Original Customer'); change('-phone', '+61 412 345 678'); change('-email', 'EXAMPLE@EXAMPLE.COM'); change('-pickup-date', '2026-10-05')
  page.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); page.render()
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); page.render()
  assert.equal(page.find(node => node.type === 'fieldset').props.disabled, true)
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); page.render()
  const sent = calls.filter(call => call.action === 'create-custom-cake-request')
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1], sent[0])
  assert.equal(sent[0].data.customer.customerPhone, '0412345678')
  assert.equal(sent[0].data.customer.customerEmail, 'example@example.com')
  assert.match(sent[0].data.lines[0].lineId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(completed.requestId, sent[0].data.requestId)
  page.unmount()
})

test('actual photo component sends customer possession proof or authenticated admin JWT', async () => {
  const calls = wire(() => photoRead)
  const customer = mount(CustomCakePhoto, { requestNumber: 'CUSTOM-EXAMPLE-1', photoRef: photoRead.photoRef, customerPhone: '0412345678' })
  await customer.flush()
  assert.deepEqual(calls[0].data.authorization, { kind: 'customer', customerPhone: '0412345678' })
  assert.equal(calls[0].data.requestNumber, 'CUSTOM-EXAMPLE-1')
  assert.equal(calls[0].headers['x-appwrite-user-jwt'], undefined)
  assert.match(customer.find(node => node.type === 'img').props.src, /^data:image\/webp;base64,/)
  const admin = mount(CustomCakePhoto, { requestNumber: 'CUSTOM-EXAMPLE-1', photoRef: photoRead.photoRef })
  await admin.flush()
  assert.deepEqual(calls[1].data.authorization, { kind: 'admin' })
  assert.equal(calls[1].headers['x-appwrite-user-jwt'], 'synthetic-admin-jwt')
  customer.unmount(); admin.unmount()
})

test('actual admin search does no initial listing and quote conflict refetches captured search proof with JWT mutation', async () => {
  const calls = wire(action => action === 'get-custom-cake-request' ? fixture.lookup : { responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, contractVersion: 'custom-cake.v1', code: 'QUOTE_VERSION_CONFLICT' }) })
  const page = mount(AdminCustomCakesSection)
  await page.flush()
  assert.equal(calls.length, 0)
  page.find(node => node.type === 'input' && node.props['aria-label'] === 'Request number').props.onChange({ target: { value: 'CUSTOM-EXAMPLE-1' } })
  page.find(node => node.type === 'input' && node.props['aria-label'] === 'Customer phone').props.onChange({ target: { value: '+61 412 345 678' } })
  page.render()
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); page.render()
  page.find(node => node.type === 'tr' && node.props.onClick).props.onClick(); page.render()
  page.find(node => node.type === 'input' && node.props['aria-label'] === 'Customer phone').props.onChange({ target: { value: '0499999999' } }); page.render()
  await page.find(node => node.type === 'form' && node.props.className !== 'admin-filters-bar').props.onSubmit({ preventDefault() {} }); page.render()
  assert.equal(calls[1].headers['x-appwrite-user-jwt'], 'synthetic-admin-jwt')
  assert.deepEqual(calls[2].data, { contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1', customerPhone: '0412345678' })
  assert.ok(page.find(node => node.props?.role === 'alert'))
  page.unmount()
})

test('actual photo selection/removal is local, and submitting while a file is being read is blocked', async () => {
  const calls = wire(() => capabilities)
  const originalImage = globalThis.Image, originalReader = globalThis.FileReader
  let finishImage
  globalThis.Image = class { width = 10; height = 10; set src(_value) { finishImage = () => this.onload() } }
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,AQID'; this.onload() } }
  const page = mount(CustomCakePage, props)
  try {
    await page.flush()
    const input = page.find(node => node.type === 'input' && node.props.type === 'file')
    const pending = input.props.onChange({ target: { files: [new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })], value: '' } })
    await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.deepEqual(calls.map(call => call.action), ['get-cake-wire-capabilities'])
    finishImage(); await pending; page.render()
    page.find(node => node.type === 'button' && node.props['aria-label'] === 'Remove photo').props.onClick(); page.render()
    assert.deepEqual(calls.map(call => call.action), ['get-cake-wire-capabilities'])
    assert.equal(page.find(node => node.type === 'input' && node.props.type === 'file').props.disabled, false)
  } finally { page.unmount(); globalThis.Image = originalImage; globalThis.FileReader = originalReader }
})

test('completion without its in-memory receipt sends the customer to lookup instead of proposing another request', () => {
  const page = mount(CustomCakeCompletePage, { ...props, createdResult: null, onGoToLookup() {} })
  const html = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: null, onGoToLookup() {} }))
  assert.doesNotMatch(html, /AUD \$/)
  assert.match(html, /request number and mobile phone/)
  assert.equal(page.find(node => node.type === 'button' && node.props.className === 'primary-button').props.children, 'Check Request Status')
})
