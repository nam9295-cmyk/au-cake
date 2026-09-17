import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { getHogirlSeoDefinitions } from '../scripts/hogirl-seo.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = resolve(root, 'src/content/hogirl')

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(contentRoot, relativePath), 'utf8'))
}

test('real Prologue and EP01 are historically published but remain web drafts with exactly their approved 16 artworks', async () => {
  const [series, prologue, episode, prologueEnglish, prologueKorean] = await Promise.all([
    readJson('series.json'),
    readJson('prologue-a-tiger-dream/manifest.json'),
    readJson('season-01/episodes/ep01-i-know-what-i-want/manifest.json'),
    readJson('prologue-a-tiger-dream/en.json'),
    readJson('prologue-a-tiger-dream/ko.json'),
  ])

  assert.equal(series.historicalPublication.status, 'published')
  assert.deepEqual(series.publishedSeasons, [])
  assert.equal(prologue.kind, 'prologue')
  assert.equal(prologue.historicalPublication.status, 'published')
  assert.equal(episode.historicalPublication.status, 'published')
  assert.deepEqual(prologue.locales, { en: { status: 'draft' }, ko: { status: 'draft' } })
  assert.deepEqual(episode.locales, { en: { status: 'draft' }, ko: { status: 'draft' } })
  assert.equal(prologue.media.panels.length, 16)
  assert.equal(episode.media.panels.length, 16)
  assert.equal(prologue.media.panels.some((panel) => panel.id === 'panel-017'), false)
  assert.deepEqual(
    prologue.media.panels.map((panel) => panel.media.key),
    Array.from({ length: 16 }, (_, index) => `hogirl/v1/prologue-a-tiger-dream/${String(index + 1).padStart(2, '0')}`),
  )
  assert.deepEqual(
    episode.media.panels.map((panel) => panel.media.key),
    Array.from({ length: 16 }, (_, index) => `hogirl/v1/season-1/ep01-i-know-what-i-want/${String(index + 1).padStart(2, '0')}`),
  )
  for (const panel of [...prologue.media.panels, ...episode.media.panels]) {
    assert.equal(panel.media.sourceWidth, 1080)
    assert.equal(panel.media.sourceHeight, 1350)
  }
  assert.equal(prologueEnglish.panels['panel-001'].captions.some((caption) => caption.text === 'Before I was born, my mother had a strange dream.'), true)
  assert.equal(prologueKorean.panels['panel-016'].captions.some((caption) => caption.text === '넘어져도 내 손에는 진주가 있어.'), true)
})

test('Prologue retains the published panel 015 copy and checked ellipsis punctuation', async () => {
  const [english, korean] = await Promise.all([
    readJson('prologue-a-tiger-dream/en.json'),
    readJson('prologue-a-tiger-dream/ko.json'),
  ])

  const englishPanel015 = english.panels['panel-015'].captions.map((caption) => caption.text)
  const koreanPanel015 = korean.panels['panel-015'].captions.map((caption) => caption.text)

  assert.deepEqual(koreanPanel015, [
    '그때는 아무도 몰랐다.',
    '그 굴의 호랑이가',
    '평생 이렇게 어딘가',
    '돌아다니게 될 줄은.',
  ])
  assert.equal(koreanPanel015.includes('그 울음소리가'), false)
  assert.deepEqual(englishPanel015, [
    'Nobody knew it then...',
    'that the tiger from that cave',
    'would spend her life going somewhere.',
  ])
  assert.equal(englishPanel015.some((caption) => caption.includes('spread her life')), false)
  assert.deepEqual(english.panels['panel-007'].captions.map((caption) => caption.text), ['......'])
  assert.deepEqual(korean.panels['panel-007'].captions.map((caption) => caption.text), ['......'])
  assert.deepEqual(english.panels['panel-008'].captions.map((caption) => caption.text), ['So she reached out...'])
  assert.deepEqual(english.panels['panel-012'].captions.map((caption) => caption.text), ['Years later...'])
})

test('EP01 preserves the corrected page 7 copy and keeps the supplied composited cover as artwork', async () => {
  const [manifest, english, korean] = await Promise.all([
    readJson('season-01/episodes/ep01-i-know-what-i-want/manifest.json'),
    readJson('season-01/episodes/ep01-i-know-what-i-want/en.json'),
    readJson('season-01/episodes/ep01-i-know-what-i-want/ko.json'),
  ])

  assert.deepEqual(manifest.media.panels[0], {
    id: 'panel-001',
    presentation: 'integrated-cover',
    media: { key: 'hogirl/v1/season-1/ep01-i-know-what-i-want/01', sourceWidth: 1080, sourceHeight: 1350 },
  })
  assert.deepEqual(manifest.previous, { kind: 'prologue', storySlug: 'prologue-a-tiger-dream' })
  assert.deepEqual(english.panels['panel-001'].captions, [])
  assert.equal(english.panels['panel-007'].captions.some((caption) => caption.text === 'I found something I wanted to go after.'), true)
  assert.equal(JSON.stringify(english.panels['panel-007'].captions).includes('somthing'), false)
  assert.equal(korean.panels['panel-007'].captions.some((caption) => caption.text === '꿈이 생겼다.'), true)
})

test('draft production content neither needs a media origin nor emits sitemap or llms definitions', async () => {
  const definition = await getHogirlSeoDefinitions({
    siteUrl: 'https://au.verygood-chocolate.com',
    brand: 'verygood chocolate',
    mediaOrigin: '',
    useTestFixture: false,
    contentRoot,
  })

  assert.deepEqual(definition.pages, {})
  assert.deepEqual(definition.indexablePaths, [])
  assert.deepEqual(definition.llmsEntries, [])
})
