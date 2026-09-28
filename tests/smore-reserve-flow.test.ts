import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReservePage } from '../src/pages/ReservePage.js'
import { DEFAULT_SETTINGS } from '../src/lib/constants.js'
import { buildCakeReservationRequest } from '../src/lib/review-coupon-client.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'
import type { ReservationInput } from '../src/lib/types.js'

function smoreSelection(quantity: number): CakeDetailSelection {
  return {
    productId: 'smore-stick',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    chocolateExtra: 'none',
    brownieCreamOption: 'none',
    cupcakeFinish: 'basic',
    chocolateIcingCount: 0,
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla',
    vanillaCakeFlavor: 'triple-berry',
    individualPackaging: false,
    quantity,
  }
}

function renderSingleSmoreReserve(quantity: number) {
  return renderToStaticMarkup(React.createElement(ReservePage, {
    navigate: () => {},
    settings: DEFAULT_SETTINGS,
    initialProductId: 'smore-stick',
    initialSelection: smoreSelection(quantity),
    initialOrderLines: null,
    initialPromoCode: '',
    initialRewardPercent: null,
    onInitialPromoConsumed: () => {},
    reviewDemoMode: false,
    onComplete: () => {},
    language: 'en',
    setLanguage: () => {},
    cartItemCount: quantity,
  }))
}

function singleSmoreRequest(quantity: number): ReservationInput {
  return {
    customerName: 'Customer',
    customerPhone: '0412345678',
    customerEmail: 'customer@example.com',
    productId: 'smore-stick',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    chocolateExtra: 'none',
    brownieCreamOption: 'none',
    cupcakeFinish: 'basic',
    chocolateIcingCount: 0,
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla',
    vanillaCakeFlavor: 'triple-berry',
    individualPackaging: false,
    quantity,
    pickupDate: '2099-07-11',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111',
    website: '',
  }
}

for (const [quantity, total] of [[6, '24.30'], [12, '43.20']] as const) {
  test(`single S’more ${quantity} reaches ReservePage with bulk price and preserved request quantity`, () => {
    const html = renderSingleSmoreReserve(quantity)
    assert.match(html, new RegExp(`name="quantity"[^>]*value="${quantity}"`))
    assert.match(html, new RegExp(`AUD(?:\\s|&nbsp;|\\u00a0)+${total.replace('.', '\\.')}`))
    assert.equal(buildCakeReservationRequest(singleSmoreRequest(quantity)).quantity, quantity)
  })
}

test('normal cakes retain the one-through-five reserve selector', () => {
  const html = renderToStaticMarkup(React.createElement(ReservePage, {
    navigate: () => {}, settings: DEFAULT_SETTINGS, initialProductId: 'pound-cake', initialSelection: null,
    initialOrderLines: null, initialPromoCode: '', initialRewardPercent: null, onInitialPromoConsumed: () => {},
    reviewDemoMode: false, onComplete: () => {}, language: 'en', setLanguage: () => {}, cartItemCount: 0,
  }))
  assert.match(html, /<select[^>]*><option value="1"/)
  assert.match(html, /<option value="5"/)
  assert.doesNotMatch(html, /<option value="6"/)
})
