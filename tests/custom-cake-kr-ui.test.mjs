import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomCakePage } from '../src/pages/CustomCakePage'
import { functions, account } from '../src/lib/appwrite'
import { marketConfig } from '../src/lib/market'

const props = { language: 'en', navigate() {}, setLanguage() {}, cartItemCount: 0, onComplete() {} }
const capabilities = { contractVersion: 'cake-capabilities.v1', status: 'ready', customCakeV1: true, cakeOrderV2: true, legacyNewSubmissions: 'compat' }
const fixture = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/custom-v1.json', 'utf8'))

function mount() {
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
    try { tree = CustomCakePage(props) } finally { internals.H = previous }
  }
  const find = predicate => {
    function visit(node) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { for (const child of node) { const result = visit(child); if (result) return result } return }
      if (predicate(node)) return node
      return visit(node.props?.children)
    }
    const result = visit(tree)
    assert.ok(result, 'expected rendered control')
    return result
  }
  render()
  return {
    render,
    find,
    async flush() { while (effects.length) effects.shift()(); await new Promise(setImmediate); render() },
    unmount() { cleanups.forEach(cleanup => cleanup()) },
  }
}

test('KR Custom Cake keeps its existing UI and unchanged designNote wire payload', async () => {
  assert.equal(marketConfig.market, 'KR')
  const html = renderToStaticMarkup(React.createElement(CustomCakePage, props))
  assert.doesNotMatch(html, /Choose your flavour|Triple Berry|Nutella|Oreo|Biscoff/)
  assert.match(html, /0 \/ 1000/)

  const calls = []
  functions.createExecution = async execution => {
    const body = JSON.parse(execution.body)
    calls.push(body)
    return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: body.action === 'get-cake-wire-capabilities' ? capabilities : fixture.created }) }
  }
  account.createJWT = async () => { throw new Error('manual browser JWT creation must not run') }
  const page = mount()
  await page.flush()
  for (const [suffix, value] of [
    ['-name', 'Original Customer'], ['-phone', '010-1234-5678'],
    ['-email', 'example@example.com'], ['-pickup-date', '2026-12-01'],
  ]) {
    page.find(node => node.type === 'input' && node.props.id?.endsWith(suffix)).props.onChange({ target: { value } })
    page.render()
  }
  page.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  page.render()
  const textarea = page.find(node => node.type === 'textarea' && node.props.id?.endsWith('-design-note'))
  assert.equal(textarea.props.maxLength, 1000)
  textarea.props.onChange({ target: { value: '  Blue ribbon  ' } })
  page.render()
  await page.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  const sent = calls.find(call => call.action === 'create-custom-cake-request')?.data
  assert.ok(sent)
  assert.equal(sent.lines[0].designNote, 'Blue ribbon')
  assert.equal(Object.hasOwn(sent.lines[0], 'flavour'), false)
  page.unmount()
})
