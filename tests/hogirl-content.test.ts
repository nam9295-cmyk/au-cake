import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getHogirlResponsiveWidths,
  getPublishedHogirlLocales,
  resolveHogirlSocialImage,
} from '../src/stories/hogirl/media.js'
import productionSeries from '../src/content/hogirl/series.json' with { type: 'json' }
import productionPrologue from '../src/content/hogirl/prologue-a-tiger-dream/manifest.json' with { type: 'json' }
import productionEpisode from '../src/content/hogirl/season-01/episodes/ep01-i-know-what-i-want/manifest.json' with { type: 'json' }
import productionEpisodeEnglish from '../src/content/hogirl/season-01/episodes/ep01-i-know-what-i-want/en.json' with { type: 'json' }
import productionPrologueEnglish from '../src/content/hogirl/prologue-a-tiger-dream/en.json' with { type: 'json' }

test('responsive HOGIRL requests only guaranteed standard derivatives without upscaling', () => {
  assert.deepEqual(getHogirlResponsiveWidths(1080), [540, 720, 1080])
  assert.deepEqual(getHogirlResponsiveWidths(1440), [540, 720, 1080])
  assert.deepEqual(getHogirlResponsiveWidths(800), [540, 720])
  assert.deepEqual(getHogirlResponsiveWidths(500), [])
})

test('episode social metadata falls back to its designated clean artwork', () => {
  assert.equal(
    resolveHogirlSocialImage({
      socialImage: undefined,
      ogImagePanelId: 'panel-002',
      panels: [
        { id: 'panel-001', media: { key: 'hogirl/v1/season-01/ep01/panel-001', sourceWidth: 1080, sourceHeight: 1350 } },
        { id: 'panel-002', media: { key: 'hogirl/v1/season-01/ep01/panel-002', sourceWidth: 1080, sourceHeight: 1350 } },
      ],
    }),
    'hogirl/v1/season-01/ep01/panel-002',
  )
})

test('only complete explicitly published locales are exposed for routes and hreflang', () => {
  assert.deepEqual(getPublishedHogirlLocales({
    en: { status: 'published' },
    ko: { status: 'published' },
    ja: { status: 'draft' },
  }), ['en', 'ko'])
})

test('draft production stories retain their historical status, approved panel count, dimensions, cover, and corrected EP01 copy', () => {
  assert.equal(productionSeries.historicalPublication.status, 'published')
  assert.deepEqual(productionSeries.publishedSeasons, [])
  assert.equal(productionPrologue.kind, 'prologue')
  assert.equal(productionPrologue.media.panels.length, 16)
  assert.equal(productionEpisode.media.panels.length, 16)
  assert.equal(productionPrologue.media.panels.some((panel) => panel.id === 'panel-017'), false)
  for (const panel of [...productionPrologue.media.panels, ...productionEpisode.media.panels]) {
    assert.equal(panel.media.sourceWidth, 1080)
    assert.equal(panel.media.sourceHeight, 1350)
  }
  assert.deepEqual(productionEpisode.media.panels[0], {
    id: 'panel-001',
    presentation: 'integrated-cover',
    media: { key: 'hogirl/v1/season-1/ep01-i-know-what-i-want/01', sourceWidth: 1080, sourceHeight: 1350 },
  })
  assert.equal(productionEpisodeEnglish.panels['panel-007'].captions.some((caption) => caption.text === 'I found something I wanted to go after.'), true)
  assert.equal(JSON.stringify(productionEpisodeEnglish.panels['panel-007'].captions).includes('somthing'), false)
  assert.equal(productionPrologueEnglish.panels['panel-001'].captions.some((caption) => caption.text === 'Before I was born, my mother had a strange dream.'), true)
})
