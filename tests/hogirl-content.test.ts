import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getHogirlResponsiveWidths,
  getPublishedHogirlLocales,
  resolveHogirlSocialImage,
} from '../src/stories/hogirl/media.js'

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
