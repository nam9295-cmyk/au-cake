import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BankAccountBox } from '../src/components/BankAccountBox'
import { RenewalPaymentNotice } from '../src/components/RenewalPaymentNotice'
import { MARKET_CONFIG, marketConfig } from '../src/lib/market'
import { CompletePage } from '../src/pages/CompletePage'
import type { Reservation } from '../src/lib/types'

const settings = MARKET_CONFIG.AU.defaultSettings

test('renewal notice directs payment from the order-received email once via PayID or configured bank, then manual confirmation', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderToStaticMarkup(<RenewalPaymentNotice settings={settings} language={language} />)
    for (const value of ['BSB 012263', 'Account 324999682', 'JEONGMIN CHEON', 'PayID', '0421 567 776']) assert.ok(html.includes(value), value)
    assert.match(html, language === 'ko' ? /지금은 결제되지 않습니다/ : /No payment is taken now/)
    assert.match(html, language === 'ko' ? /주문 접수 이메일.*결제 안내/ : /order-received email.*payment instructions/)
    assert.match(html, language === 'ko' ? /한 번만 입금/ : /[Pp]ay once/)
    assert.match(html, language === 'ko' ? /입금을 직접 확인한 뒤.*최종.*확정 이메일/ : /manually check.*payment.*final.*confirmation email/)
    assert.match(html, language === 'ko' ? /예약자 이름/ : /name on the booking/)
    assert.doesNotMatch(html, /Payment amount|입금 금액|AUD 45\.00|wait for our instructions|check availability|confirmed once payment is received/)
  }
})

test('renewal payment notice withholds incomplete accounts and keeps payment guidance available', () => {
  for (const field of ['bankName', 'bankAccount', 'accountHolder'] as const) {
    for (const value of ['', '   ']) {
      const html = renderToStaticMarkup(<RenewalPaymentNotice settings={{ ...settings, [field]: value }} language="en" />)
      assert.doesNotMatch(html, /bank-account-card|copy-button|BSB 012263|Account 324999682/)
      assert.match(html, /order-received email.*payment instructions/)
      assert.match(html, /PayID.*0421 567 776/)
    }
  }
})

test('transfer reference uses the booking customer name, never a reservation number, with a blank-safe fallback', () => {
  for (const language of ['en', 'ko'] as const) {
    for (const customerName of ['  Alex Kim  ', '', '   ', undefined]) {
      const html = renderToStaticMarkup(<RenewalPaymentNotice settings={settings} language={language} reservationNumber="VG-C-AU-RENEWAL" customerName={customerName} />)
      assert.doesNotMatch(html, /VG-C-AU-RENEWAL|booking number|예약번호|입금 참조 번호/)
      assert.match(html, language === 'ko' ? /입금자명/ : /Transfer reference/)
      assert.match(html, customerName?.trim() ? /Alex Kim/ : language === 'ko' ? /예약자 이름/ : /name on the booking/)
    }
  }
})

const completedReservation: Reservation = {
  id: 'cake-completed', reservationNumber: 'VG-C-AU-COMPLETED', customerName: 'Alex Kim', customerPhone: '0412345678', customerEmail: 'buyer@example.test',
  productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none', cacaoPercent: '70', quantity: 1,
  pickupDate: '2099-07-11', pickupTime: '10:00', requestNote: '', status: '예약신청', paymentStatus: '입금대기', totalPrice: 60, adminMemo: '',
  subtotalCents: 6000, discountPercent: 0, discountCents: 0, totalPriceCents: 6000,
  createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z',
}

test('AU saved-order completion uses the customer name and email payment instructions in English and Korean', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderToStaticMarkup(<CompletePage reservation={completedReservation} settings={settings} language={language} navigate={() => {}} setLanguage={() => {}} cartItemCount={0} />)
    assert.match(html, /renewal-payment-notice/)
    assert.match(html, language === 'ko' ? /입금자명: Alex Kim/ : /Transfer reference: Alex Kim/)
    assert.match(html, language === 'ko' ? /주문 접수 이메일/ : /order-received email/)
    assert.doesNotMatch(html, /check availability|가능 여부/)
  }
})

test('KR completion keeps the existing bank-only notice and AU demo does not promise a sent receipt', () => {
  const originalMarket = marketConfig.market
  try {
    marketConfig.market = 'KR'
    const kr = renderToStaticMarkup(<CompletePage reservation={completedReservation} settings={MARKET_CONFIG.KR.defaultSettings} language="ko" navigate={() => {}} setLanguage={() => {}} cartItemCount={0} />)
    assert.match(kr, /bank-account-card/)
    assert.doesNotMatch(kr, /renewal-payment-notice|PayID/)
    marketConfig.market = 'AU'
    const demo = renderToStaticMarkup(<CompletePage reservation={{ ...completedReservation, id: 'demo-reservation' }} settings={settings} language="en" navigate={() => {}} setLanguage={() => {}} cartItemCount={0} />)
    assert.match(demo, /This order was not saved or sent/)
    assert.doesNotMatch(demo, /renewal-payment-notice/)
  } finally { marketConfig.market = originalMarket }
})

function mountBank(language: 'en' | 'ko') {
  const slots: unknown[] = []
  let cursor = 0
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (next: unknown) => { slots[index] = next }]
    },
  }
  function render() {
    cursor = 0
    const internals = Reflect.get(React, '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE') as { H: unknown }
    const previous = internals.H
    internals.H = dispatcher
    try { return BankAccountBox({ settings, language }) }
    finally { internals.H = previous }
  }
  function copyButton(node: React.ReactNode): React.ReactElement<{ onClick(): Promise<void> }> | undefined {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return undefined
    if (node.type === 'button') return node as React.ReactElement<{ onClick(): Promise<void> }>
    for (const child of React.Children.toArray(node.props.children)) {
      const found = copyButton(child)
      if (found) return found
    }
    return undefined
  }
  return { render, copy: () => copyButton(render())!.props.onClick() }
}

test('bank account copy reports unsupported and denied clipboard access without an unhandled rejection', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  try {
    for (const language of ['en', 'ko'] as const) {
      for (const clipboard of [undefined, { writeText: async () => { throw new Error('denied') } }]) {
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } })
        const bank = mountBank(language)
        await assert.doesNotReject(bank.copy())
        const html = renderToStaticMarkup(bank.render())
        assert.match(html, /role="status"/)
        assert.match(html, language === 'ko' ? /직접 복사/ : /copy the account details manually/)
        assert.doesNotMatch(html, />Copied<|>복사됨</)
      }
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else Reflect.deleteProperty(globalThis, 'navigator')
  }
})

test('legacy account cards retain their amount and copy the configured account details', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let copied = ''
  t.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text: string) => { copied = text } } } })
    const bank = mountBank('en')
    await bank.copy()
    assert.equal(copied, 'BSB 012263 Account 324999682')
    assert.match(renderToStaticMarkup(bank.render()), />Copied</)
    assert.match(renderToStaticMarkup(<BankAccountBox settings={settings} totalPrice={75} language="en" />), /AUD 75\.00/)
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else Reflect.deleteProperty(globalThis, 'navigator')
  }
})
