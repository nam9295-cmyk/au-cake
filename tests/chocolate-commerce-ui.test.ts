import test from 'node:test'
import assert from 'node:assert/strict'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReservePage } from '../src/pages/ReservePage.js'
import CartPage from '../src/CartPage.js'
import { CHOCOLATE_OPTIONS_V1 } from '../appwrite-functions/reservation-api/src/chocolate-products.js'
import { DEFAULT_SETTINGS } from '../src/lib/constants.js'
import { addCartLine } from '../src/lib/cart.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'

const sixpack: CakeDetailSelection = { ...CHOCOLATE_OPTIONS_V1, productId: 'almond-chocoball-6pack', quantity: 1 }
const cake: CakeDetailSelection = { ...CHOCOLATE_OPTIONS_V1, productId: 'pave-cake', cakeSize: '6in', chocolateExtra: 'combo', quantity: 1 }
test('cart permits old-backend cakes but blocks single and mixed chocolate orders', () => {
  for (const selections of [[cake], [cake, { ...cake, chocolateExtra: 'none' as const }], [sixpack], [sixpack, cake]]) {
    const lines = selections.reduce((lines, selection) => addCartLine(lines, selection), [] as ReturnType<typeof addCartLine>)
    for (const chocolateOrderLinesAvailable of [false, true]) {
      const html = renderToStaticMarkup(createElement(CartPage, { language: 'en', lines, cakeOrderLinesAvailable: true, chocolateOrderLinesAvailable, onUpdate() {}, onRemove() {}, onContinue() {}, onBrowseCakes() {} }))
      const button = html.match(/<button[^>]*>Continue to reservation<\/button>/)![0]
      assert.equal(button.includes('disabled'), selections.includes(sixpack) && !chocolateOrderLinesAvailable)
      if (selections.length === 1 && selections[0] === sixpack) assert.doesNotMatch(html, /Cake Size|15cm|serves 8/)
    }
  }
})
test('six-pack-first mixed checkout discounts eligible cake and extras only, with honest photography', () => {
  const html = renderToStaticMarkup(createElement(ReservePage, {
    navigate() {}, settings: DEFAULT_SETTINGS, initialProductId: sixpack.productId, initialSelection: sixpack,
    initialOrderLines: [sixpack, cake], initialPromoCode: 'FOXKIWI7Q2MK', initialRewardPercent: 10,
    onInitialPromoConsumed() {}, reviewDemoMode: true, onComplete() {}, language: 'en', setLanguage() {}, cartItemCount: 2,
  }))
  assert.match(html, /9\.90/)
  assert.doesNotMatch(html, /15\.90/)
  assert.match(html, /Reference photo: single 80g pouch/)
  assert.match(html, /products\/chocolates\/almond-chocoball.webp/)
  assert.doesNotMatch(html, /<dt>Size<\/dt>|<dt>Cake Size<\/dt>/)
})

test('review demo mode cannot confirm a chocolate order without backend capability', async () => {
  // Exercise the real submit handler with filled form state. Only React's hook
  // storage is supplied here; repository capability checks remain real.
  const states: unknown[] = []
  let cursor = 0
  let completed = false
  let navigated = false
  const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previous = internals.H
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++
      if (!(index in states)) {
        const value = typeof initial === 'function' ? initial() : initial
        states[index] = value && typeof value === 'object' && 'productId' in value
          ? { ...value, customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com', privacy: true, pickupDate: '2099-07-11', pickupTime: '10:00' }
          : value
      }
      return [states[index], (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    },
    useMemo(compute: () => unknown) { return compute() },
    useEffect() {},
  }
  type Node = { type?: unknown; props?: { children?: unknown; onSubmit?: (event: { preventDefault(): void }) => Promise<void> } }
  function findForm(node: unknown): Node | undefined {
    if (Array.isArray(node)) return node.map(findForm).find(Boolean)
    if (!node || typeof node !== 'object') return undefined
    const element = node as Node
    return element.type === 'form' ? element : findForm(element.props?.children)
  }
  internals.H = dispatcher
  let tree
  try {
    tree = ReservePage({ navigate() { navigated = true }, settings: DEFAULT_SETTINGS,
      initialProductId: sixpack.productId, initialSelection: sixpack, initialOrderLines: null,
      initialPromoCode: 'FOXKIWI7Q2MK', initialRewardPercent: 10, onInitialPromoConsumed() {},
      reviewDemoMode: true, onComplete() { completed = true }, language: 'en', setLanguage() {}, cartItemCount: 1 })
  } finally { internals.H = previous }
  await findForm(tree)!.props!.onSubmit!({ preventDefault() {} })
  assert.equal(completed, false)
  assert.equal(navigated, false)
  assert.ok(states.some(value => typeof value === 'string' && value.includes('Chocolate ordering is not available on this server yet')))
})
