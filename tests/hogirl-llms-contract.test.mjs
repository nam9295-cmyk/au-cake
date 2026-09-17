import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import auPublicPages from '../src/content/au-public-pages.json' with { type: 'json' }
import { getHogirlSeoDefinitions } from '../scripts/hogirl-seo.mjs'
import { renderAuLlms } from '../scripts/render-au-llms.mjs'

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value))
}

test('llms entries contain only grounded published HOGIRL series and episode facts', async () => {
  const contentRoot = await mkdtemp(join(tmpdir(), 'hogirl-llms-content-'))
  const episodeRoot = join(contentRoot, 'season-01/episodes/ep01-approved')
  await writeJson(join(contentRoot, 'series.json'), {
    id: 'hogirl',
    locales: {
      en: { status: 'published', title: 'HOGIRL', description: 'A grounded published series description.' },
      ko: { status: 'draft', title: '비공개 제목', description: '공개하면 안 되는 설명입니다.' },
    },
    publishedSeasons: [{ number: 1, slug: 'season-1', directory: 'season-01' }],
  })
  await writeJson(join(contentRoot, 'season-01/manifest.json'), {
    number: 1,
    slug: 'season-1',
    episodes: [{ number: 1, slug: 'ep01-approved' }],
  })
  await writeJson(join(episodeRoot, 'manifest.json'), {
    number: 1,
    slug: 'ep01-approved',
    locales: { en: { status: 'published' }, ko: { status: 'draft' } },
    media: {
      ogImagePanelId: 'panel-001',
      panels: [{ id: 'panel-001', media: { key: 'hogirl/test/panel-001', sourceWidth: 1080, sourceHeight: 1350 } }],
    },
  })
  await writeJson(join(episodeRoot, 'en.json'), {
    title: 'Approved episode',
    description: 'Grounded episode description.',
    panels: { 'panel-001': { alt: 'Clean artwork', captions: [] } },
  })

  await assert.rejects(
    getHogirlSeoDefinitions({
      siteUrl: 'https://au.verygood-chocolate.com',
      brand: 'verygood chocolate',
      mediaOrigin: '',
      contentRoot,
    }),
    /VITE_HOGIRL_MEDIA_ORIGIN/,
  )

  const definition = await getHogirlSeoDefinitions({
    siteUrl: 'https://au.verygood-chocolate.com',
    brand: 'verygood chocolate',
    mediaOrigin: 'https://hogirl-cdn.test',
    contentRoot,
  })
  const llms = renderAuLlms(auPublicPages, definition.llmsEntries)

  assert.deepEqual(definition.llmsEntries, [
    'HOGIRL: A grounded published series description.',
    '- Season 1',
    '- Approved episode: https://au.verygood-chocolate.com/stories/hogirl/season-1/ep01-approved',
  ])
  assert.match(llms, /## HOGIRL/)
  assert.match(llms, /Approved episode: https:\/\/au\.verygood-chocolate\.com\/stories\/hogirl\/season-1\/ep01-approved/)
  assert.doesNotMatch(llms, /비공개 제목|공개하면 안 되는 설명/)
})
