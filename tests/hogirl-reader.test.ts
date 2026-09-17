import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HogirlReader } from '../src/stories/hogirl/HogirlReader.js'

const episode = {
  number: 1,
  title: 'Reader fixture',
  panels: [
    {
      id: 'panel-001',
      media: { key: 'hogirl/fixture/season-01/ep01/panel-001', sourceWidth: 1080, sourceHeight: 1350 },
      alt: 'Fixture first clean artwork',
      captions: [{ placement: 'after' as const, text: 'Fixture narration visible to readers.' }],
    },
    {
      id: 'panel-002',
      media: { key: 'hogirl/fixture/season-01/ep01/panel-002', sourceWidth: 1080, sourceHeight: 1350 },
      alt: 'Fixture second clean artwork',
      captions: [{ placement: 'before' as const, text: 'A second visible fixture caption.' }],
    },
  ],
}

test('reader renders visible HTML captions and protects the first image loading priority', () => {
  const html = renderToStaticMarkup(createElement(HogirlReader, {
    episode,
    locale: 'en',
    mediaOrigin: 'https://media.example.test',
  }))

  assert.match(html, /<main[^>]+class="hogirl-reader"/)
  assert.match(html, /<h1>Reader fixture<\/h1>/)
  assert.match(html, /Fixture narration visible to readers\./)
  assert.match(html, /A second visible fixture caption\./)
  const firstPanel = html.match(/data-hogirl-panel="panel-001"[\s\S]*?<\/li>/)?.[0] || ''
  const secondPanel = html.match(/data-hogirl-panel="panel-002"[\s\S]*?<\/li>/)?.[0] || ''
  assert.match(firstPanel, /fetchPriority="high"/)
  assert.match(firstPanel, /loading="eager"/)
  assert.match(secondPanel, /loading="lazy"/)
  assert.doesNotMatch(secondPanel, /fetchPriority="high"/)
  assert.match(html, /width="1080" height="1350"/)
  assert.match(html, /panel-001-540\.avif 540w, https:\/\/media\.example\.test\/hogirl\/fixture\/season-01\/ep01\/panel-001-720\.avif 720w, https:\/\/media\.example\.test\/hogirl\/fixture\/season-01\/ep01\/panel-001-1080\.avif 1080w/)
})

test('reader uses the optimized original without inventing a derivative below 540px', () => {
  const html = renderToStaticMarkup(createElement(HogirlReader, {
    episode: {
      number: 2,
      title: 'Small source fixture',
      panels: [{
        id: 'panel-small',
        media: { key: 'hogirl/fixture/panel-small', sourceWidth: 500, sourceHeight: 625 },
        alt: 'Small clean artwork',
        captions: [],
      }],
    },
    locale: 'en',
    mediaOrigin: 'https://hogirl-cdn.test',
  }))

  assert.match(html, /src="https:\/\/hogirl-cdn\.test\/hogirl\/fixture\/panel-small\.webp"/)
  assert.doesNotMatch(html, /panel-small-500\.(?:avif|webp)/)
  assert.doesNotMatch(html, /<source\b/)
})
