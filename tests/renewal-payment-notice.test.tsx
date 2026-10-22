import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BankAccountBox } from '../src/components/BankAccountBox'
import { RenewalPaymentNotice } from '../src/components/RenewalPaymentNotice'
import { MARKET_CONFIG } from '../src/lib/market'

const settings = MARKET_CONFIG.AU.defaultSettings

test('renewal payment notice displays configured account details and the wait-for-instructions sequence without a payable quote', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderToStaticMarkup(<RenewalPaymentNotice settings={settings} language={language} />)
    for (const value of ['BSB 012263', 'Account 324999682', 'JEONGMIN CHEON']) assert.ok(html.includes(value), value)
    assert.match(html, language === 'ko' ? /지금은 결제되지 않습니다/ : /No payment is taken now/)
    assert.match(html, language === 'ko' ? /안내를 받으신 후 입금/ : /wait for our instructions before transferring/)
    assert.match(html, language === 'ko' ? /입금 확인 후 예약이 확정/ : /confirmed once payment is received/)
    assert.doesNotMatch(html, /Payment amount|입금 금액|PayID|AUD 45\.00/)
    assert.doesNotMatch(html, /Transfer reference|입금 참조 번호/)
  }
})

test('renewal payment notice withholds incomplete accounts and keeps payment guidance available', () => {
  for (const field of ['bankName', 'bankAccount', 'accountHolder'] as const) {
    for (const value of ['', '   ']) {
      const html = renderToStaticMarkup(<RenewalPaymentNotice settings={{ ...settings, [field]: value }} language="en" />)
      assert.doesNotMatch(html, /bank-account-card|copy-button|BSB 012263|Account 324999682/)
      assert.match(html, /send payment instructions/)
    }
  }
})

test('receipt payment guidance identifies the reservation as the reference only after payment instructions arrive', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderToStaticMarkup(<RenewalPaymentNotice settings={settings} language={language} reservationNumber="VG-C-AU-RENEWAL" />)
    assert.match(html, /VG-C-AU-RENEWAL/)
    assert.match(html, language === 'ko' ? /안내를 받으신 후 입금/ : /After receiving payment instructions/)
    assert.match(html, language === 'ko' ? /입금 참조 번호/ : /Transfer reference/)
  }
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
