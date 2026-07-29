import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  assert.ok(match, `missing CSS rule: ${selector}`)
  return match[1]
}

test('AU public design tokens use cream, forest green, and restrained berry accents', () => {
  const root = rule(':root')
  assert.match(root, /--canvas:\s*#f0eee9/i)
  assert.match(root, /--forest:\s*#1f5a46/i)
  assert.match(root, /--charcoal:\s*#362f31/i)
  assert.match(root, /--soft-pink:\s*#edc5c4/i)
  assert.match(root, /--berry-emphasis:\s*#b83f4c/i)
  assert.match(root, /--pink-accent:\s*#f46e95/i)
})

test('AU primary actions are forest green with cream text, not pink', () => {
  const primary = rule('.primary-button')
  assert.match(primary, /background:\s*var\(--forest\)/)
  assert.match(primary, /color:\s*var\(--canvas\)/)
  assert.doesNotMatch(primary, /pink|berry/i)
})

test('AU cake catalogue uses cutout-style products without card or image-frame chrome', () => {
  const card = rule('.product-card')
  const imageWrap = rule('.product-image-wrap')
  const imageHalo = rule('.product-image-wrap::before')

  assert.match(card, /padding:\s*0/)
  assert.match(card, /background:\s*transparent/)
  assert.match(card, /border:\s*0/)
  assert.match(card, /box-shadow:\s*none/)
  assert.match(imageWrap, /background:\s*transparent/)
  assert.match(imageWrap, /border-radius:\s*0/)
  assert.match(imageHalo, /display:\s*none/)
})
