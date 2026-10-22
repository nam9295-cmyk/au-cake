import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { PickupDatePicker, WeekendDatePicker } from '../src/components/WeekendDatePicker'
import { RenewalPickupDatePicker } from '../src/components/RenewalPickupDatePicker'
import type { RenewalSelection } from '../appwrite-functions/reservation-api/src/au-renewal.js'

const cake: RenewalSelection[] = [{ lineId: 'cake', offerId: 'pave-cake', size: '6in', quantity: 1 }]
const mochi: RenewalSelection[] = [{ lineId: 'mochi', offerId: 'mochi', mode: 'gift-four', quantity: 1, flavourCounts: { strawberry: 4, green_grape: 0, mandarin: 0, banana: 0, butter_redbean: 0, nama_chocolate: 0 } }]
const openPolicy = { enabled: true, preordersEnabled: true }
const monday = new Date('2026-10-18T23:00:00Z') // Monday 10:00 Sydney.

interface CalendarControlProps {
  children?: unknown
  'aria-haspopup'?: string
  'aria-label'?: string
  'aria-expanded'?: boolean
  disabled?: boolean
  onClick?: () => void
}
type CalendarElement = React.ReactElement<CalendarControlProps>
interface ReactHookInternals {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown }
}

// Follow the project's component-handler harness: real components, state and
// callbacks; browser effect registration is irrelevant to these date decisions.
function mountCalendar(properties: React.ComponentProps<typeof RenewalPickupDatePicker>) {
  const slots: unknown[] = []
  let cursor = 0
  let tree: unknown
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next: unknown) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial: unknown) { return dispatcher.useState(() => ({ current: initial }))[0] },
    useMemo(compute: () => unknown) { return compute() },
    useEffect() {},
  }
  function resolve(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(resolve)
    if (!React.isValidElement<CalendarControlProps>(node)) return node
    if (typeof node.type === 'function') {
      const Component = node.type as (props: CalendarControlProps) => unknown
      return resolve(Component(node.props))
    }
    return { ...node, props: { ...node.props, children: resolve(node.props.children) } }
  }
  const render = () => {
    cursor = 0
    const internals = (React as unknown as ReactHookInternals).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
    const previous = internals.H
    internals.H = dispatcher
    try { tree = resolve(<RenewalPickupDatePicker {...properties} />) } finally { internals.H = previous }
  }
  const find = (predicate: (node: CalendarElement) => boolean) => {
    function visit(node: unknown): CalendarElement | undefined {
      if (Array.isArray(node)) return node.map(visit).find(Boolean)
      if (!React.isValidElement<CalendarControlProps>(node)) return undefined
      return predicate(node) ? node : visit(node.props.children)
    }
    const found = visit(tree)
    assert.ok(found, 'expected calendar control')
    return found
  }
  render()
  find(node => node.props['aria-haspopup'] === 'dialog').props.onClick!()
  render()
  return {
    find,
    render,
    update(next: Partial<typeof properties>) { Object.assign(properties, next); render() },
    day(date: string) { return find(node => node.type === 'button' && node.props['aria-label']?.startsWith(date) === true) },
  }
}

test('an unselected pickup date renders a prompt without inventing a selected date', () => {
  let html = ''
  assert.doesNotThrow(() => {
    html = renderToStaticMarkup(<PickupDatePicker label="Pickup date" value="" minDate="2026-10-22" onChange={() => {}} />)
  })
  assert.match(html, /Select date/)
  assert.doesNotMatch(html, /Invalid Date|22 October/)
})

test('existing weekend callers retain their selected date and Korean label', () => {
  const html = renderToStaticMarkup(<WeekendDatePicker label="예약 날짜" value="2026-10-24" minDate="2026-10-22" locale="ko-KR" onChange={() => {}} />)
  assert.match(html, /예약 날짜/)
  assert.match(html, /2026년 10월 24일/)
})

test('the Renewal calendar disables closed weekdays and preserves selection callbacks', () => {
  const selected: string[] = []
  const calendar = mountCalendar({ value: '', onChange: value => selected.push(value), lines: cake, policy: openPolicy, language: 'en', now: monday })
  for (const [date, disabled] of [['2026-10-19', true], ['2026-10-20', true], ['2026-10-21', false], ['2026-10-22', true], ['2026-10-23', false], ['2026-10-24', false], ['2026-10-25', false]] as const) {
    assert.equal(calendar.day(date).props.disabled, disabled, date)
  }
  calendar.day('2026-10-23').props.onClick!()
  calendar.render()
  assert.deepEqual(selected, ['2026-10-23'])
  assert.equal(calendar.find(node => node.props?.['aria-haspopup'] === 'dialog').props['aria-expanded'], false)
})

test('available dates follow the cart lead time and elapsed Sydney time', () => {
  const calendar = mountCalendar({ value: '', onChange() {}, lines: cake, policy: openPolicy, language: 'en', now: new Date('2026-10-23T02:01:00Z') }) // Friday 13:01 Sydney.
  assert.equal(calendar.day('2026-10-24').props.disabled, false)
  calendar.update({ lines: [...cake, ...mochi] })
  assert.equal(calendar.day('2026-10-24').props.disabled, true, 'Saturday closes before 24 hours can elapse')
  assert.equal(calendar.day('2026-10-25').props.disabled, false)
  calendar.update({ now: new Date('2026-10-23T02:00:00Z') })
  assert.equal(calendar.day('2026-10-24').props.disabled, false, 'Saturday 13:00 is exactly 24 hours away')
})

test('disabled capabilities and supplied closures cannot produce selectable days', () => {
  const calendar = mountCalendar({ value: '', onChange() {}, lines: cake, policy: { ...openPolicy, enabled: false }, language: 'en', now: monday })
  assert.equal(calendar.day('2026-10-21').props.disabled, true)
  calendar.update({ policy: { ...openPolicy, closedDates: ['2026-10-21'], closedIntervals: { '2026-10-23': [{ start: '09:00', end: '20:15' }] } } })
  assert.equal(calendar.day('2026-10-21').props.disabled, true)
  assert.equal(calendar.day('2026-10-23').props.disabled, true)
  assert.equal(calendar.day('2026-10-24').props.disabled, false)
  calendar.update({ lines: mochi, policy: { enabled: true, preordersEnabled: false } })
  assert.equal(calendar.day('2026-10-24').props.disabled, true)
})

test('the blank calendar starts in the Sydney month and does not impose a booking horizon', () => {
  const calendar = mountCalendar({ value: '', onChange() {}, lines: cake, policy: openPolicy, language: 'en', now: new Date('2026-10-31T13:30:00Z') }) // Nov 1 in Sydney, Oct 31 UTC.
  assert.equal(calendar.day('2026-11-01').props.disabled, true)
  assert.equal(calendar.day('2026-11-04').props.disabled, false)
  assert.equal(calendar.find(node => node.props?.['aria-label'] === 'Previous month').props.disabled, true)
  for (let month = 0; month < 14; month++) {
    const next = calendar.find(node => node.props?.['aria-label'] === 'Next month')
    assert.equal(next.props.disabled, false)
    next.props.onClick!()
    calendar.render()
  }
  assert.equal(calendar.day('2028-01-05').props.disabled, false)
})

test('a restored date in the past opens the current month without changing the saved selection', () => {
  const selected: string[] = []
  const calendar = mountCalendar({ value: '2026-09-30', onChange: value => selected.push(value), lines: cake, policy: openPolicy, language: 'en', now: monday })
  assert.equal(calendar.day('2026-10-21').props.disabled, false)
  assert.deepEqual(selected, [])
  calendar.update({ now: new Date('2026-11-01T01:00:00Z') })
  assert.equal(calendar.day('2026-11-04').props.disabled, false)
})
