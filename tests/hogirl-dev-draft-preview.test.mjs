import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8'))
}

test('development can preview audited HOGIRL drafts without publishing them', async () => {
  const series = await readJson('src/content/hogirl/series.json')
  const appSource = await readFile(join(root, 'src/stories/hogirl/HogirlApp.tsx'), 'utf8')
  const loaderSource = await readFile(join(root, 'src/stories/hogirl/loaders.ts'), 'utf8')

  assert.equal(series.locales.en.status, 'draft')
  assert.equal(series.locales.ko.status, 'draft')
  assert.deepEqual(series.publishedSeasons, [])
  assert.equal(series.publishedPrologue, undefined)
  assert.equal(series.draftPrologue.slug, 'prologue-a-tiger-dream')
  assert.equal(series.draftSeasons[0].slug, 'season-1')

  assert.match(appSource, /import\.meta\.env\.DEV/)
  assert.match(loaderSource, /allowDrafts/)
  assert.ok(loaderSource.includes("return status === 'published' || (allowDrafts && status === 'draft')"))
})

test('EP06 draft uses all 22 recovered masters and bridges EP05 to EP07 with default captions', async () => {
  const [season, ep05, ep06, ep07, english, korean] = await Promise.all([
    readJson('src/content/hogirl/season-01/manifest.json'),
    readJson('src/content/hogirl/season-01/episodes/ep05-night-bus-university/manifest.json'),
    readJson('src/content/hogirl/season-01/episodes/ep06-never-again-australia/manifest.json'),
    readJson('src/content/hogirl/season-01/episodes/ep07-my-name-starts-with-c/manifest.json'),
    readJson('src/content/hogirl/season-01/episodes/ep06-never-again-australia/en.json'),
    readJson('src/content/hogirl/season-01/episodes/ep06-never-again-australia/ko.json'),
  ])

  assert.deepEqual(season.episodes.slice(4, 7), [
    { number: 5, slug: 'ep05-night-bus-university' },
    { number: 6, slug: 'ep06-never-again-australia' },
    { number: 7, slug: 'ep07-my-name-starts-with-c' },
  ])
  assert.deepEqual(ep06.previous, {
    kind: 'episode',
    seasonSlug: 'season-1',
    episodeSlug: 'ep05-night-bus-university',
  })
  assert.deepEqual(ep07.previous, {
    kind: 'episode',
    seasonSlug: 'season-1',
    episodeSlug: 'ep06-never-again-australia',
  })
  assert.equal(ep05.number, 5)
  assert.equal(ep06.media.panels.length, 22)
  assert.deepEqual(
    ep06.media.panels.map((panel) => panel.media.key),
    Array.from({ length: 22 }, (_, index) => `hogirl/v1/season-1/ep06-never-again-australia/${String(index + 1).padStart(2, '0')}`),
  )
  assert.deepEqual(ep06.media.panels[0], {
    id: 'panel-001',
    presentation: 'integrated-cover',
    media: { key: 'hogirl/v1/season-1/ep06-never-again-australia/01', sourceWidth: 1080, sourceHeight: 1350 },
  })
  for (const panel of ep06.media.panels.slice(1)) {
    assert.deepEqual(panel.media, {
      key: `hogirl/v1/season-1/ep06-never-again-australia/${Number(panel.id.slice(-3)).toString().padStart(2, '0')}`,
      sourceWidth: 1122,
      sourceHeight: 1402,
    })
  }
  assert.deepEqual(english.panels['panel-019'].captions.map((caption) => caption.text), ['Then—', 'WHOOSH!!!', 'MY CHIPS!!!'])
  assert.deepEqual(korean.panels['panel-022'].captions.map((caption) => caption.text), ['인생은 내 말을 별로 진지하게 듣지 않았다.', 'NEXT — MY NAME STARTS WITH C'])
  for (const locale of [english, korean]) {
    for (const panel of Object.values(locale.panels)) {
      for (const caption of panel.captions) {
        assert.equal(caption.placement, 'after')
        assert.equal(caption.layout, undefined)
      }
    }
  }
})
