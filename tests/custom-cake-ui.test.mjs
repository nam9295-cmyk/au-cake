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
import { AdminDashboardPage } from '../src/AdminDashboardPage'
import { functions, account, databases } from '../src/lib/appwrite'
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
  account.createJWT = async () => { throw new Error('manual browser JWT creation must not run') }
  return calls
}
test('actual lookup and completion render literal parsed server cents, including zero and unknown extras', () => {
  const created = structuredClone(fixture.created)
  Object.assign(created.quote, { baseCents: 22222, cakeDiscountCents: 1111, giftSmoreQuantity: 2, knownTotalCents: 21741 })
  const receipt = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: parseCustomCakeCreateResponse(created), onGoToLookup() {} }))
  assert.match(receipt, /AUD \$222\.22/)
  assert.match(receipt, /-AUD \$11\.11/)
  assert.match(receipt, /AUD \$217\.41/)
  assert.doesNotMatch(receipt, /Gift S.more|sticks \(Free\)/)
  assert.match(receipt, /To be confirmed/)
  const lookup = structuredClone(fixture.finalLookup)
  lookup.status = 'quoted'
  Object.assign(lookup.quote, { baseCents: 22222, cakeDiscountCents: 1111, designExtraCents: 0, figurineExtraCents: 3729, giftSmoreQuantity: 2, knownTotalCents: 25470, finalTotalCents: 25470 })
  const result = renderToStaticMarkup(React.createElement(CustomCakeLookupResult, { result: parseCustomCakeLookupResponse(lookup), language: 'en' }))
  assert.match(result, /AUD \$254\.70/)
  assert.match(result, /-AUD \$11\.11/)
  assert.match(result, /No extra charge \(AUD \$0\.00\)/)
  assert.match(result, /\+AUD \$37\.29/)
})

test('customer-facing promotion, response-time, and pickup copy stays conditional and appointment-only', () => {
  const english = renderToStaticMarkup(React.createElement(CustomCakePage, props))
  const korean = renderToStaticMarkup(React.createElement(CustomCakePage, { ...props, language: 'ko' }))

  assert.match(english, /September Pre-order Offer/)
  assert.match(english, /10% OFF CUSTOM CAKES/)
  assert.match(english, /Promo code/)
  assert.match(english, /VERYGOOD CUSTOM/)
  assert.match(english, /Order in September and reserve your cake for September, October or November pickup\./)
  assert.match(korean, /9월 선주문 프로모션/)
  assert.match(korean, /커스텀 케이크 10% 할인/)
  assert.match(korean, /프로모션 코드/)
  assert.match(korean, /9월 주문 시 9월·10월·11월 픽업 예약에 적용됩니다\./)
  assert.doesNotMatch(english, /September Opening Offer|2 complimentary S.more|5% off the custom cake/i)
  assert.doesNotMatch(korean, /9월 오픈 프로모션|5% 할인과 케이크 1개당 스모어/)
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
  Object.assign(created.quote, { cakeDiscountCents: 0, giftSmoreQuantity: 0, knownTotalCents: 16530 })
  const receipt = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: parseCustomCakeCreateResponse(created), onGoToLookup() {} }))
  assert.doesNotMatch(receipt, /September 5% Promotion|Gift S’more Sticks/)

  const lookup = structuredClone(fixture.lookup)
  Object.assign(lookup.quote, { cakeDiscountCents: 0, giftSmoreQuantity: 0, knownTotalCents: 16530 })
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
  assert.match(html, /From AUD \$159/)
  for (const price of ['159', '219', '319']) assert.match(html, new RegExp(`AUD \\$${price}`))
  assert.doesNotMatch(html, /Estimated Known Total|Base subtotal|AUD \$143\.10/)
  page.find(node => node.type?.name === 'OptionButton' && node.props.children?.[0]?.props?.children === 'Double Tier').props.onClick()
  page.render()
  for (const price of ['239', '339', '459']) {
    page.find(node => node.type === 'span' && node.props.children === `From AUD $${price}`)
  }
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
  change('-promo-code', ' VeryGood Custom ')
  page.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); page.render()
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); page.render()
  assert.equal(page.find(node => node.type === 'fieldset').props.disabled, true)
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); page.render()
  const sent = calls.filter(call => call.action === 'create-custom-cake-request')
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1], sent[0])
  assert.equal(sent[0].data.customer.customerPhone, '0412345678')
  assert.equal(sent[0].data.customer.customerEmail, 'example@example.com')
  assert.equal(sent[0].data.promoCode, ' VeryGood Custom ')
  assert.deepEqual(sent[0].data.lines[0].photoRefs, [])
  assert.match(sent[0].data.lines[0].lineId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(completed.requestId, sent[0].data.requestId)
  page.unmount()
})

test('actual photo component sends customer possession proof or uses platform-authenticated admin execution', async () => {
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
  assert.equal(calls[1].headers['x-appwrite-user-jwt'], undefined)
  customer.unmount(); admin.unmount()
})

test('actual admin auto-loads and filters requests, refreshes, and mutates an adopted snapshot', async () => {
  const request = structuredClone(fixture.lookup)
  Object.assign(request.quote, { cakeDiscountCents: 1590, giftSmoreQuantity: 2, knownTotalCents: 14940 })
  const calls = wire(action => {
    if (action === 'admin-list-custom-cake-requests') return { requests: [request] }
    if (action === 'get-custom-cake-request') return request
    return { responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, contractVersion: 'custom-cake.v1', code: 'QUOTE_VERSION_CONFLICT' }) }
  })
  const page = mount(AdminCustomCakesSection)
  await page.flush()
  assert.equal(calls[0].action, 'admin-list-custom-cake-requests')
  assert.equal(calls[0].headers['x-appwrite-user-jwt'], undefined)
  assert.ok(page.find(node => node.type === 'tr' && node.props.onClick))

  const search = page.find(node => node.type === 'input' && node.props['aria-label'] === 'Search custom cake requests')
  search.props.onChange({ target: { value: 'no-match' } })
  page.render()
  assert.equal(page.find(node => node.type === 'td' && node.props.className === 'empty-cell').props.children, '접수된 커스텀 케이크 주문이 없습니다.')
  assert.equal(calls.length, 1, 'local filtering performs no request')
  search.props.onChange({ target: { value: fixture.lookup.customer.customerPhone } })
  page.render()
  page.find(node => node.type === 'tr' && node.props.onClick).props.onClick(); page.render()
  assert.equal(page.find(node => node.type === 'span' && node.props.children === '커스텀 케이크 프로모션 할인').props.children, '커스텀 케이크 프로모션 할인')
  assert.throws(() => page.find(node => node.type === 'span' && node.props.children === '무료 스모어 증정'))
  await page.find(node => node.type === 'form' && node.props.className !== 'admin-filters-bar').props.onSubmit({ preventDefault() {} }); page.render()
  assert.equal(calls[1].headers['x-appwrite-user-jwt'], undefined)
  assert.deepEqual(calls[2].data, { contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1', customerPhone: '0412345678' })
  assert.ok(page.find(node => node.props?.role === 'alert'))
  await page.find(node => node.type === 'button' && node.props['aria-label'] === 'Refresh custom cake requests').props.onClick()
  await page.flush()
  assert.equal(calls[3].action, 'admin-list-custom-cake-requests')
  page.unmount()
})

test('dashboard loads Custom Cake schedules through the authenticated admin list and retains no customer fields in the event', async () => {
  const lookup = structuredClone(fixture.lookup)
  const now = new Date()
  lookup.pickup.pickupDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousAccountGet = account.get
  const previousListDocuments = databases.listDocuments
  globalThis.window = {
    setInterval,
    clearInterval,
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
  }
  let completeList
  const listed = new Promise(resolve => { completeList = resolve })
  const calls = wire((action) => {
    if (action === 'admin-list-custom-cake-requests') {
      setImmediate(completeList)
      return { requests: [lookup] }
    }
    throw new Error(`unexpected action: ${action}`)
  })
  account.get = async () => ({ email: 'nam9295@gmail.com' })
  databases.listDocuments = async () => ({ documents: [], total: 0 })
  const navigations = []
  const page = mount(AdminDashboardPage, { navigate(pageName) { navigations.push(pageName) } })
  try {
    await page.flush()
    await page.flush()
    await listed
    page.render()

    assert.equal(calls[0].action, 'admin-list-custom-cake-requests')
    const calendar = page.find(node => typeof node.type === 'function' && node.type.name === 'AdminMonthlyCalendar')
    const [customEvent] = calendar.props.customCakeEvents
    assert.equal(customEvent.title, 'Custom Cake · Single 6in ×1')
    assert.equal(customEvent.subtitle, 'Requested')
    for (const privateValue of [lookup.customer.customerName, lookup.customer.customerPhone, lookup.customer.customerEmail, lookup.lines[0].designNote, lookup.lines[0].photoRefs[0]]) {
      assert.equal(JSON.stringify(customEvent).includes(privateValue), false)
    }
    calendar.props.onSelectCustomCake()
    assert.deepEqual(navigations, ['admin-custom-cakes'])
  } finally {
    page.unmount()
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    account.get = previousAccountGet
    databases.listDocuments = previousListDocuments
  }
})

test('customer request UI offers no photo upload and directs reference images to post-receipt sharing', () => {
  const english = renderToStaticMarkup(React.createElement(CustomCakePage, props))
  const korean = renderToStaticMarkup(React.createElement(CustomCakePage, { ...props, language: 'ko' }))
  const source = readFileSync('src/pages/CustomCakePage.tsx', 'utf8')

  assert.match(english, /Reference images can be shared with Verygood after your request is received\./)
  assert.match(korean, /참고 이미지는 접수 후 베리굿과 별도로 공유해 주세요\./)
  assert.doesNotMatch(english, /type="file"|Add Photo|Reference Photos \(Optional/)
  assert.doesNotMatch(korean, /사진 추가하기|참고 사진 첨부/)
  assert.doesNotMatch(source, /\bCamera\b|handlePhotoUpload|custom-cake-upload-box/)
})

test('completion without its in-memory receipt sends the customer to lookup instead of proposing another request', () => {
  const page = mount(CustomCakeCompletePage, { ...props, createdResult: null, onGoToLookup() {} })
  const html = renderToStaticMarkup(React.createElement(CustomCakeCompletePage, { ...props, createdResult: null, onGoToLookup() {} }))
  assert.doesNotMatch(html, /AUD \$/)
  assert.match(html, /request number and mobile phone/)
  assert.equal(page.find(node => node.type === 'button' && node.props.className === 'primary-button').props.children, 'Check Request Status')
})
