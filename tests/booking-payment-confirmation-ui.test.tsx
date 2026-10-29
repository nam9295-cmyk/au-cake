import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BookingConfirmationEmailButton } from '../src/BookingConfirmationEmailButton'
import { ReservationDrawer } from '../src/ReservationDrawer'
import { appwriteConfig, functions } from '../src/lib/appwrite'
import { marketConfig } from '../src/lib/market'
import type { Reservation } from '../src/lib/types'

type Props = React.ComponentProps<typeof BookingConfirmationEmailButton> & { paymentStatus?: string }
type ElementProps = { children?: React.ReactNode; disabled?: boolean; onClick?: () => Promise<void>; value?: string; onChange?: (event: { target: { value: string } }) => void }
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return []
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
}
function mount<P>(component: (props: P) => React.ReactNode, initialProps: P) {
  const states: unknown[] = []
  const effects: (() => void)[] = []
  let cursor = 0, first = true, props = initialProps
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    },
    useCallback(callback: unknown) { return callback },
    useEffect(effect: () => void) { if (first) effects.push(effect) },
  }
  function render(next = props) {
    props = next
    cursor = 0
    const internals = Reflect.get(React, '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE') as { H: unknown }
    const previous = internals.H
    internals.H = dispatcher
    try { return component(props) }
    finally { internals.H = previous; first = false }
  }
  render()
  return { render, async settle() { effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)) } }
}
const defaults: Props = { sourceType: 'cake', reservationId: 'cake-123', status: '예약확정', paymentStatus: '입금확인', recipientEmail: 'buyer@example.test' }
const notSent = { status: 'not_sent', retry: 'not_needed' }
const sent = { status: 'sent', retry: 'not_needed', sentAt: '2026-10-29T00:00:00.000Z' }
const eligible = { status: 'uncertain', retry: 'eligible' }
function setup(options: { confirmation?: object; receipt?: object; failStatus?: boolean; failSend?: boolean; failRetry?: boolean } = {}) {
  const original = { execute: functions.createExecution, functionId: appwriteConfig.reservationNotificationFunctionId, market: marketConfig.market, mode: appwriteConfig.reservationApiMode }
  const calls: { action: string; data: { emailKind?: string; sourceType: string; reservationId: string } }[] = []
  let confirmation = options.confirmation ?? notSent
  appwriteConfig.reservationNotificationFunctionId = 'reservation-notification'
  marketConfig.market = 'AU'
  functions.createExecution = (async (input: { body: string }) => {
    const payload = JSON.parse(input.body)
    calls.push(payload)
    if (payload.action === 'get-booking-email-status') {
      if (options.failStatus) throw Error('Status unavailable')
      return { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: payload.data.emailKind === 'booking-confirmed-customer' ? confirmation : options.receipt ?? notSent }) }
    }
    if (payload.action === 'send-booking-confirmation') {
      if (options.failSend) return { status: 'completed', responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, code: 'BOOKING_CONFIRMATION_PAYMENT_REQUIRED' }) }
      confirmation = sent
      return { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: { status: 'sent', sentAt: sent.sentAt } }) }
    }
    if (payload.action === 'retry-booking-email') {
      if (options.failRetry) throw Error('Retry rejected')
      confirmation = sent
      return { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: sent }) }
    }
    throw Error(`Unexpected API action: ${payload.action}`)
  }) as never
  return { calls, writes: () => calls.filter(call => call.action !== 'get-booking-email-status'), cleanup() { functions.createExecution = original.execute; appwriteConfig.reservationNotificationFunctionId = original.functionId; marketConfig.market = original.market; appwriteConfig.reservationApiMode = original.mode } }
}
function buttons(node: React.ReactNode) { return elements(node).filter(element => element.type === 'button') }

test('AU cake final email requires saved paid AND confirmed state; pending, refund, on-site and unknown values fail closed', async () => {
  const s = setup()
  try {
    for (const paymentStatus of [undefined, '', '입금대기', '현장결제', '환불필요', 'paid', '입금확인']) {
      for (const status of ['예약확정', '예약신청', '픽업완료', '취소']) {
        const ui = mount(BookingConfirmationEmailButton, { ...defaults, status, paymentStatus })
        await ui.settle()
        const allowed = paymentStatus === '입금확인' && status === '예약확정'
        assert.equal(buttons(ui.render())[0].props.disabled, !allowed, `${status}/${paymentStatus}`)
        if (!allowed) {
          assert.match(renderToStaticMarkup(ui.render()), /Save payment received and confirmed status before sending email/)
          await buttons(ui.render())[0].props.onClick!()
        }
      }
    }
    assert.deepEqual(s.writes(), [])
  } finally { s.cleanup() }
})

test('saved payment/status updates never auto-send; manual click uses the existing API in every site mode', async () => {
  for (const mode of ['off', 'lookup', 'all'] as const) {
    const s = setup()
    try {
      appwriteConfig.reservationApiMode = mode
      const ui = mount<Props>(BookingConfirmationEmailButton, { ...defaults, paymentStatus: '입금대기' })
      await ui.settle()
      ui.render(defaults)
      assert.deepEqual(s.writes(), [])
      assert.match(renderToStaticMarkup(ui.render()), /Send payment confirmation email/)
      await buttons(ui.render())[0].props.onClick!()
      assert.deepEqual(s.writes(), [{ action: 'send-booking-confirmation', data: { sourceType: 'cake', reservationId: 'cake-123' } }])
      assert.match(renderToStaticMarkup(ui.render()), /Payment confirmation email sent/)
      assert.equal(buttons(ui.render())[0].props.disabled, true)
    } finally { s.cleanup() }
  }
})

test('KR cake and AU class keep their previous status-only gate and labels', async () => {
  for (const scenario of [{ market: 'KR' as const, sourceType: 'cake' as const, status: '예약확정' }, { market: 'AU' as const, sourceType: 'class' as const, status: 'Confirmed' }]) {
    const s = setup()
    try {
      marketConfig.market = scenario.market
      const ui = mount(BookingConfirmationEmailButton, { ...defaults, sourceType: scenario.sourceType, status: scenario.status, paymentStatus: undefined })
      await ui.settle()
      assert.equal(buttons(ui.render())[0].props.disabled, false)
      assert.match(renderToStaticMarkup(ui.render()), /Send confirmation email/)
      await buttons(ui.render())[0].props.onClick!()
      assert.equal(s.writes().length, 1)
      assert.match(renderToStaticMarkup(ui.render()), /Confirmation email sent/)
    } finally { s.cleanup() }
  }
})

test('confirmation retry cannot bypass saved payment/status gate but receipt retry remains available', async () => {
  for (const props of [{ paymentStatus: '입금대기' }, { paymentStatus: '환불필요' }, { status: '취소' }]) {
    const s = setup({ confirmation: eligible, receipt: eligible })
    try {
      const ui = mount(BookingConfirmationEmailButton, { ...defaults, ...props })
      await ui.settle()
      const [, receiptRetry, confirmationRetry] = buttons(ui.render())
      assert.equal(confirmationRetry.props.disabled, true)
      await confirmationRetry.props.onClick!()
      assert.deepEqual(s.writes(), [])
      assert.equal(receiptRetry.props.disabled, false)
      await receiptRetry.props.onClick!()
      await ui.settle()
      assert.equal(s.writes()[0].data.emailKind, 'booking-received-customer')
    } finally { s.cleanup() }
  }
})

test('paid confirmation retry succeeds and error paths retain manual fallback without automatic sends', async () => {
  for (const failRetry of [false, true]) {
    const s = setup({ confirmation: eligible, failRetry })
    try {
      const ui = mount(BookingConfirmationEmailButton, defaults)
      await ui.settle()
      assert.deepEqual(s.writes(), [])
      await buttons(ui.render())[1].props.onClick!()
      await ui.settle()
      assert.equal(s.writes().length, 1)
      assert.match(renderToStaticMarkup(ui.render()), failRetry ? /could not be retried safely/ : /Payment confirmation email sent/)
    } finally { s.cleanup() }
  }
  const s = setup({ failSend: true })
  try {
    const ui = mount(BookingConfirmationEmailButton, defaults)
    await ui.settle()
    await buttons(ui.render())[0].props.onClick!()
    assert.match(renderToStaticMarkup(ui.render()), /Email could not be sent/)
    assert.equal(s.writes().length, 1)
  } finally { s.cleanup() }
})

test('status lookup failure cannot bypass pending payment; paid orders still use old send API', async () => {
  for (const paymentStatus of ['입금대기', '입금확인']) {
    const s = setup({ failStatus: true })
    try {
      const ui = mount(BookingConfirmationEmailButton, { ...defaults, paymentStatus })
      await ui.settle()
      assert.match(renderToStaticMarkup(ui.render()), /Email status is unavailable/)
      assert.equal(buttons(ui.render())[0].props.disabled, paymentStatus !== '입금확인')
      await buttons(ui.render())[0].props.onClick!()
      assert.equal(s.writes().length, paymentStatus === '입금확인' ? 1 : 0)
    } finally { s.cleanup() }
  }
})

test('missing email/function and locked delivery states still block a paid confirmed order', async () => {
  for (const status of ['pending', 'sent', 'failed', 'uncertain']) {
    const s = setup({ confirmation: { status, retry: 'not_needed' } })
    try {
      const ui = mount(BookingConfirmationEmailButton, defaults)
      await ui.settle()
      assert.equal(buttons(ui.render())[0].props.disabled, true)
      await buttons(ui.render())[0].props.onClick!()
      assert.deepEqual(s.writes(), [])
    } finally { s.cleanup() }
  }
  for (const missing of ['email', 'function']) {
    const s = setup()
    try {
      if (missing === 'function') appwriteConfig.reservationNotificationFunctionId = ''
      const ui = mount(BookingConfirmationEmailButton, { ...defaults, recipientEmail: missing === 'email' ? '' : defaults.recipientEmail })
      await ui.settle()
      assert.equal(buttons(ui.render())[0].props.disabled, true)
      await buttons(ui.render())[0].props.onClick!()
      assert.deepEqual(s.writes(), [])
    } finally { s.cleanup() }
  }
})

const reservation: Reservation = {
  id: 'cake-123', reservationNumber: 'VG-C-AU-123', customerName: 'Test Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.test',
  productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none', cacaoPercent: '70', quantity: 1,
  pickupDate: '2099-07-11', pickupTime: '10:00', requestNote: '', status: '예약신청', paymentStatus: '입금대기', totalPrice: 60, adminMemo: '', createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z',
}
test('drawer passes saved payment and booking status even after both unsaved selects change', () => {
  const s = setup()
  let saves = 0
  try {
    const props = { reservation, settings: marketConfig.defaultSettings, onClose() {}, async onCopy() {}, async onSave() { saves++ } }
    const drawer = mount(ReservationDrawer, props)
    for (const [oldValue, newValue] of [['입금대기', '입금확인'], ['예약신청', '예약확정']]) {
      const select = elements(drawer.render()).find(element => element.type === 'select' && element.props.value === oldValue)!
      select.props.onChange!({ target: { value: newValue } })
    }
    const email = elements(drawer.render()).find(element => element.type === BookingConfirmationEmailButton) as React.ReactElement<Props>
    assert.equal(email.props.paymentStatus, '입금대기')
    assert.equal(email.props.status, '예약신청')
    assert.equal(saves, 0)
    assert.deepEqual(s.writes(), [])
    const saved = elements(drawer.render({ ...props, reservation: { ...reservation, status: '예약확정', paymentStatus: '입금확인' } })).find(element => element.type === BookingConfirmationEmailButton) as React.ReactElement<Props>
    assert.equal(saved.props.paymentStatus, '입금확인')
    assert.equal(saved.props.status, '예약확정')
  } finally { s.cleanup() }
})
