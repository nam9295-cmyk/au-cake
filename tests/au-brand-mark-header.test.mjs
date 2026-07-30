import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const chrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const header = chrome.slice(chrome.indexOf('export function SiteHeader'), chrome.indexOf('export function SiteFooter'))

test('AU public header uses the supplied favicon brand mark instead of a text-only wordmark', () => {
  assert.match(header, /<img\s+className="brand-mark"\s+src="\/favicon\.png"\s+alt="Verygood Chocolate"/)
  assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*72px[\s\S]*?height:\s*72px/)
  assert.match(css, /@media \(max-width: 600px\)\s*\{[\s\S]*?\.brand-mark\s*\{[\s\S]*?width:\s*64px[\s\S]*?height:\s*64px/)
  assert.match(css, /@media \(max-width: 600px\)\s*\{[\s\S]*?\.site-header nav\s*\{[\s\S]*?flex-wrap:\s*nowrap/)
})
