import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  assert.ok(match, `missing CSS rule: ${selector}`)
  return match[1]
}

test('mobile hero leaves a clear carousel-to-copy gap without covering its CTA', () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-copy\s*\{[\s\S]*?margin-top:\s*clamp\(412px, 103vw, 482px\)/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-description\s*\{[\s\S]*?margin-bottom:\s*26px/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-actions \.primary-button\s*\{[\s\S]*?min-height:\s*52px/)
})

test('hero keeps centered typography and transparent text and image layers', () => {
  const title = rule('.hero-title')
  const copy = rule('.hero-copy')
  const imageWrap = rule('.hero-image-wrap')

  assert.match(title, /text-align:\s*center/)
  assert.match(title, /text-wrap:\s*balance/)
  assert.match(copy, /background:\s*transparent/)
  assert.match(imageWrap, /background:\s*transparent/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-copy\s*\{[\s\S]*?width:\s*100%/)
})

test('all public heading levels use Playfair Display', () => {
  const headings = css.match(/h1,\s*h2,\s*h3\s*\{([^}]*)\}/)
  assert.ok(headings, 'missing shared h1/h2/h3 rule')
  assert.match(headings[1], /font-family:\s*'Playfair Display', Georgia, serif/)
})

test('home hero uses Playfair Display with restrained display tracking', () => {
  assert.match(css, /family=Playfair\+Display:wght@700/)

  const title = rule('.hero-title')
  const displayWord = rule('.hero-display-word')

  assert.match(title, /font-family:\s*'Playfair Display', Georgia, serif/)
  assert.match(title, /letter-spacing:\s*-0\.02em/)
  assert.match(displayWord, /font-family:\s*'Playfair Display', Georgia, serif/)
  assert.match(displayWord, /letter-spacing:\s*-0\.035em/)
})
