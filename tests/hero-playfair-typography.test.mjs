import { readFileSync } from 'node:fs'
import { readExpandedCssSync } from './helpers/read-expanded-css.mjs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const css = readExpandedCssSync(new URL('../src/index.css', import.meta.url))
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  assert.ok(match, `missing CSS rule: ${selector}`)
  return match[1]
}

test('mobile hero leaves a clear carousel-to-copy gap without CTA buttons', () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-copy\s*\{[\s\S]*?margin-top:\s*clamp\(412px, 103vw, 482px\)/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-description\s*\{[\s\S]*?margin-bottom:\s*26px/)
  assert.doesNotMatch(home, /className="hero-actions"/)
  assert.doesNotMatch(home, /className="sticky-cta"/)
  assert.doesNotMatch(home, /className="content-section policy-section"/)
})

test('hero keeps centered typography and transparent text and image layers', () => {
  const title = rule('.hero-title')
  const copy = rule('.hero-copy')
  const imageWrap = rule('.hero-image-wrap')

  assert.match(title, /text-align:\s*center/)
  assert.match(title, /text-wrap:\s*balance/)
  assert.match(copy, /background:\s*transparent/)
  assert.match(imageWrap, /background:\s*transparent/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-copy\s*\{[\s\S]*?width:\s*calc\(100% \+ 24px\)/)
})

test('all public heading levels use Work Sans Bold', () => {
  const headings = css.match(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/)
  assert.ok(headings, 'missing shared h1-h6 rule')
  assert.match(headings[1], /font-family:\s*var\(--font-sans\)/)
  assert.match(headings[1], /font-weight:\s*700/)
})

test('display, controls, and review labels keep Work Sans regular and bold', () => {
  assert.match(css, /family=Work\+Sans:wght@400;700/)
  assert.doesNotMatch(css, /Playfair Display|Georgia, serif|ui-monospace|SFMono-Regular|Menlo|Consolas/)

  const title = rule('.hero-title')
  const displayWord = rule('.hero-display-word')
  const smsPreview = rule('.sms-preview pre')
  const englishReview = rule(".korean-cake-review blockquote[lang='en-AU']")

  assert.match(title, /font-family:\s*var\(--font-sans\)/)
  assert.match(title, /font-weight:\s*700/)
  assert.match(title, /letter-spacing:\s*-0\.02em/)
  assert.match(displayWord, /font-family:\s*var\(--font-sans\)/)
  assert.match(displayWord, /font-weight:\s*700/)
  assert.match(displayWord, /letter-spacing:\s*-0\.035em/)
  assert.match(smsPreview, /font-family:\s*var\(--font-sans\)/)
  assert.match(englishReview, /font-weight:\s*400/)
})

test('English reading copy uses SUIT while display typography stays Work Sans', () => {
  const root = rule(':root')
  const englishDocument = rule('html:lang(en)')
  const headings = css.match(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/)

  assert.match(css, /SUIT-Variable\.css/)
  assert.match(root, /--font-display:\s*'Work Sans'/)
  assert.match(root, /--font-sans:\s*var\(--font-display\)/)
  assert.match(root, /--font-body:\s*var\(--font-display\)/)
  assert.match(englishDocument, /--font-body:\s*'SUIT Variable'/)
  assert.match(rule('body'), /font-family:\s*var\(--font-body\)/)
  assert.ok(headings, 'missing shared h1-h6 rule')
  assert.match(headings[1], /font-family:\s*var\(--font-sans\)/)
})

test('mobile hero keeps its headline readable and gives pickup copy its own compact line', () => {
  assert.match(home, /<span className="hero-pickup-copy">\{publicHomeContent\.pickup\}<\/span>/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-title\s*\{[\s\S]*?font-size:\s*29px/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.hero-pickup-copy\s*\{[\s\S]*?font-size:\s*14px/)
})
