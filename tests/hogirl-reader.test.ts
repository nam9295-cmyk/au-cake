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

test('a Prologue uses the shared reader without an episode number and supports an HTML text overlay', () => {
  const html = renderToStaticMarkup(createElement(HogirlReader, {
    locale: 'en-AU',
    mediaOrigin: 'https://hogirl-cdn.test',
    episode: {
      eyebrow: 'Prologue',
      title: 'A TIGER DREAM',
      panels: [{
        id: 'panel-007',
        media: { key: 'hogirl/fixture/plain-panel', sourceWidth: 1080, sourceHeight: 1350 },
        alt: 'Plain fixture background.',
        captions: [{ placement: 'overlay', text: 'A year before graduation,' }],
      }],
    },
  }))

  assert.match(html, /<p>Prologue<\/p>/)
  assert.doesNotMatch(html, /Episode undefined|Episode NaN/)
  assert.match(html, /hogirl-panel-captions--overlay/)
  assert.match(html, /A year before graduation,/)
})

test('ordinary captions render inside the artwork and expose swipe progress markup', () => {
  const html = renderToStaticMarkup(createElement(HogirlReader, {
    episode,
    locale: 'en',
    mediaOrigin: 'https://media.example.test',
  }))

  const firstPanel = html.match(/data-hogirl-panel="panel-001"[\s\S]*?<\/li>/)?.[0] || ''
  const secondPanel = html.match(/data-hogirl-panel="panel-002"[\s\S]*?<\/li>/)?.[0] || ''
  assert.match(firstPanel, /hogirl-panel-caption-layer--bottom/)
  assert.match(secondPanel, /hogirl-panel-caption-layer--bottom/)
  assert.match(html, /class="hogirl-swipe-progress"/)
  assert.match(html, />1 \/ 2</)
})

test('reader supports proportional panel and per-caption layout without nth-child CSS', () => {
  const html = renderToStaticMarkup(createElement(HogirlReader, {
    locale: 'en',
    mediaOrigin: 'https://media.example.test',
    episode: {
      title: 'Layout fixture',
      panels: [{
        id: 'panel-layout',
        media: { key: 'hogirl/fixture/layout', sourceWidth: 1080, sourceHeight: 1350 },
        alt: 'Layout fixture',
        captionLayout: { x: 8, y: 18, maxWidth: 58, align: 'left' as const },
        captions: [
          { placement: 'after' as const, text: 'Shared layout.' },
          { placement: 'after' as const, text: 'Independent.', layout: { x: 43, y: 28, maxWidth: 24, align: 'center' as const } },
        ],
      }],
    },
  }))

  assert.match(html, /hogirl-panel-caption-layer--positioned/)
  assert.match(html, /--hogirl-caption-x:8%/)
  assert.match(html, /--hogirl-caption-y:18%/)
  assert.match(html, /--hogirl-caption-width:58%/)
  assert.match(html, /--hogirl-caption-x:43%/)
  assert.doesNotMatch(html, /nth-child/)
})
