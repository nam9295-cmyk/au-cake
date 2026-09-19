import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHogirlPageTurn } from '../src/stories/hogirl/page-turn.js'

test('soft page turn advances at most one panel for a deliberate swipe', () => {
  assert.equal(resolveHogirlPageTurn({
    current: 4,
    total: 16,
    distancePx: -140,
    widthPx: 480,
    elapsedMs: 280,
  }), 5)
})

test('soft page turn accepts a quick flick but never crosses story boundaries', () => {
  assert.equal(resolveHogirlPageTurn({ current: 4, total: 16, distancePx: -45, widthPx: 480, elapsedMs: 70 }), 5)
  assert.equal(resolveHogirlPageTurn({ current: 1, total: 16, distancePx: 100, widthPx: 480, elapsedMs: 80 }), 1)
  assert.equal(resolveHogirlPageTurn({ current: 16, total: 16, distancePx: -100, widthPx: 480, elapsedMs: 80 }), 16)
})

test('small slow drags settle back onto the current panel', () => {
  assert.equal(resolveHogirlPageTurn({
    current: 7,
    total: 16,
    distancePx: -35,
    widthPx: 480,
    elapsedMs: 420,
  }), 7)
})
