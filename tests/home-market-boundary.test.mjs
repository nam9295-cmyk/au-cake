import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { rolldown } from 'rolldown'
import postcss from 'postcss'

const baseline = '9510e77ff2d0d5dff29fe868a2c09d5dd6db90de'

async function renderHome(market, original = false) {
  const directory = await mkdtemp(join(tmpdir(), 'home-market-'))
  const bundle = await rolldown({
    input: 'home-render-test', platform: 'node',
    transform: { jsx: { runtime: 'automatic' }, define: { 'import.meta.env': JSON.stringify({ VITE_MARKET: market }) } },
    plugins: [{
      name: 'home-render-test',
      resolveId(id) { if (id === 'home-render-test') return resolve('home-render-test.ts') },
      load(id) {
        if (id.endsWith('/home-render-test.ts')) return `
          import React from 'react';
          import { renderToStaticMarkup } from 'react-dom/server';
          import { HomePage } from './src/pages/HomePage';
          console.log(renderToStaticMarkup(React.createElement(HomePage, {
            navigate() {}, navigateToCake() {}, language: '${market === 'KR' ? 'ko' : 'en'}',
            setLanguage() {}, cartItemCount: 2
          })));
        `
        if (original && id.endsWith('/src/pages/HomePage.tsx')) {
          return execFileSync('git', ['show', `${baseline}:src/pages/HomePage.tsx`], { encoding: 'utf8' })
        }
        if (/\.(png|jpg|webp|svg)$/.test(id)) return 'export default "test-image"'
      },
    }],
  })
  try {
    const file = join(directory, 'render.mjs')
    await bundle.write({ file, format: 'esm', codeSplitting: false })
    return execFileSync(process.execPath, [file], {
      encoding: 'utf8', env: { ...process.env, VITE_MARKET: market },
    }).trim()
  } finally {
    await bundle.close()
    await rm(directory, { recursive: true, force: true })
  }
}

test('AU renders the editorial home, product tabs and redesign navigation', async () => {
  const html = await renderHome('AU')
  assert.match(html, /class="home-redesign-wrap"/)
  assert.match(html, /class="rd-header"/)
  assert.match(html, /ALL PRODUCTS/)
  assert.match(html, /class="rd-footer"/)
})

test('AU Hero provides responsive first-frame artwork before video playback is available', async () => {
  const html = await renderHome('AU')
  const hero = html.match(/<section class="rd-hero"[\s\S]*?<\/section>/)?.[0]
  assert.ok(hero)
  assert.match(hero, /<picture/)
  assert.match(hero, /media="\(max-width: 768px\)"[^>]*srcSet="\/redesign\/hero\/cake-mobile.webp"/)
  assert.match(hero, /src="\/redesign\/hero\/cake-desktop.webp"/)
  assert.match(hero, /alt="Chocolate cake with a cut slice"/)
  assert.doesNotMatch(hero, /53935\.jpg|<video/)
  const kr = await renderHome('KR')
  assert.doesNotMatch(kr, /\/redesign\/hero\/|rd-hero-video/)
})

test('KR renders exactly the pre-redesign home, with carousel and no AU editorial DOM', async () => {
  const actual = await renderHome('KR')
  const previous = await renderHome('KR', true)
  assert.doesNotMatch(actual, /home-redesign-wrap|class="rd-/)
  assert.match(actual, /hero-carousel-arrow-next/)
  assert.match(actual, /home-brand-curtain/)
  assert.equal(actual, previous)
})

test('every AU redesign CSS selector requires an AU-only shell, including footer and announcement overrides', () => {
  const css = postcss.parse(readFileSync('src/styles/au-redesign.css', 'utf8'))
  let rules = 0
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes('.au-home-shell'), `Unscoped selector: ${selector}`)
      rules++
    }
  })
  assert.ok(rules > 0)
})
