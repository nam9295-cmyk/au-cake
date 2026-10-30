import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import postcss from 'postcss'
import { fixture } from './helpers/journal-fixture.mjs'
import { prepareImport } from '../scripts/journal-import.mjs'
import { buildJournal } from '../scripts/journal-build.mjs'

const approval = { approved: true, approvedBy: 'Test fixture only', approvedAt: '2026-01-01T00:00:00Z' }

test('production build emits complete article HTML, index, responsive cover, SEO, RSS and sitemap', async t => {
  const f = await fixture(t, { status: 'published', publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', publication: approval })
  const outputDirectory = join(f.root, 'output'), sourceDirectory = join(f.root, 'source')
  await mkdir(outputDirectory)
  await mkdir(sourceDirectory)
  await cp(f.inputDirectory, join(sourceDirectory, 'one'), { recursive: true })
  await writeFile(join(outputDirectory, 'sitemap.xml'), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/cakes</loc></url></urlset>')
  const result = await buildJournal({ outputDirectory, sourceDirectory, market: 'AU', siteUrl: 'https://example.com' })
  assert.equal(result.entries.length, 1)
  const html = await readFile(join(outputDirectory, 'journal/sample-story.html'), 'utf8')
  assert.match(html, /<h1>Sample story<\/h1>/)
  assert.match(html, /Actual readable text/)
  assert.match(html, /canonical" href="https:\/\/example.com\/journal\/sample-story"/)
  assert.match(html, /og:type" content="article"/)
  assert.match(html, /og:image" content="https:\/\/example.com\/journal-assets\//)
  assert.match(html, /"@type":"BlogPosting"/)
  assert.doesNotMatch(html, /type="module"|\/src\/main|id="root"/)
  assert.match(html, /<details[^>]+journal-mobile-menu/)
  assert.match(html, /au-redesign-footer/)
  const index = await readFile(join(outputDirectory, 'journal.html'), 'utf8')
  assert.match(index, /href="\/journal\/sample-story"/)
  assert.match(index, /srcset=/)
  assert.match(await readFile(join(outputDirectory, 'journal/feed.xml'), 'utf8'), /<guid isPermaLink="true">https:\/\/example.com\/journal\/sample-story<\/guid>/)
  const sitemap = await readFile(join(outputDirectory, 'sitemap.xml'), 'utf8')
  assert.match(sitemap, /https:\/\/example.com\/cakes/)
  assert.match(sitemap, /https:\/\/example.com\/journal\/sample-story/)
  assert.equal(await readFile(join(outputDirectory, 'journal/sample-story/index.html'), 'utf8'), html)
  const shellFile = (await readdir(join(outputDirectory, 'journal-assets'))).find(name => name.startsWith('shell-'))
  const shellCss = postcss.parse(await readFile(join(outputDirectory, 'journal-assets', shellFile), 'utf8'))
  shellCss.walkRules(rule => assert.doesNotMatch(rule.selector, /(^|,)\s*h[1-6]\b/, 'shared shell must not uppercase or restyle imported headings'))
})

test('default production ignores private workspace and draft assets; unapproved published packages fail before changing output', async t => {
  const f = await fixture(t)
  await prepareImport({ ...f, expectedRevision: 0 })
  const outputDirectory = join(f.root, 'output'), sourceDirectory = join(f.root, 'source')
  await mkdir(outputDirectory)
  await mkdir(sourceDirectory)
  await cp(f.inputDirectory, join(sourceDirectory, 'draft'), { recursive: true })
  await buildJournal({ outputDirectory, sourceDirectory, workspace: f.workspace, market: 'AU', siteUrl: 'https://example.com' })
  assert.doesNotMatch(await readFile(join(outputDirectory, 'journal.html'), 'utf8'), /Sample story/)
  assert.ok((await readdir(join(outputDirectory, 'journal-assets'))).every(name => /^shell-.*\.css$/.test(name)))
  const before = await readFile(join(outputDirectory, 'journal.html'))
  await writeFile(join(sourceDirectory, 'draft/article.json'), JSON.stringify({ ...f.entry, status: 'published', publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }))
  await assert.rejects(buildJournal({ outputDirectory, sourceDirectory, market: 'AU', siteUrl: 'https://example.com' }), /approv/i)
  assert.deepEqual(await readFile(join(outputDirectory, 'journal.html')), before)
})

test('private preview is noindex, labels unapproved content and excludes drafts from RSS/sitemap', async t => {
  const f = await fixture(t, { cover: null, source: { tool: 'content-review', version: 'markdown-review' } })
  await prepareImport({ ...f, expectedRevision: 0 })
  const outputDirectory = join(f.root, 'preview')
  await buildJournal({ outputDirectory, workspace: f.workspace, preview: true, market: 'AU', siteUrl: 'https://example.com' })
  const html = await readFile(join(outputDirectory, 'journal/sample-story.html'), 'utf8')
  assert.match(html, /noindex, nofollow/)
  assert.match(html, /Content review/)
  assert.match(html, /Pencil/)
  assert.doesNotMatch(await readFile(join(outputDirectory, 'journal/feed.xml'), 'utf8'), /<item>/)
  assert.doesNotMatch(await readFile(join(outputDirectory, 'sitemap.xml'), 'utf8'), /sample-story/)
})

test('KR build creates no Journal page, image, feed or sitemap entry', async t => {
  const f = await fixture(t)
  const outputDirectory = join(f.root, 'kr')
  await mkdir(outputDirectory)
  const result = await buildJournal({ outputDirectory, sourceDirectory: f.inputDirectory, market: 'KR' })
  assert.equal(result.entries.length, 0)
  assert.deepEqual(await readdir(outputDirectory), [])
})

test('output write obstruction preserves the previous article and assets for recovery', async t => {
  const f = await fixture(t, { status: 'published', publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', publication: approval })
  const outputDirectory = join(f.root, 'output'), sourceDirectory = join(f.root, 'source')
  await mkdir(sourceDirectory)
  await cp(f.inputDirectory, join(sourceDirectory, 'one'), { recursive: true })
  await buildJournal({ outputDirectory, sourceDirectory, market: 'AU' })
  const before = await readFile(join(outputDirectory, 'journal/sample-story.html'))
  const oldAssets = await readdir(join(outputDirectory, 'journal-assets/sample-story'))
  await rm(join(outputDirectory, 'journal.html'))
  await mkdir(join(outputDirectory, 'journal.html'))
  await writeFile(join(sourceDirectory, 'one/article.json'), JSON.stringify({ ...f.entry, status: 'archived' }))
  await assert.rejects(buildJournal({ outputDirectory, sourceDirectory, market: 'AU' }))
  assert.deepEqual(await readFile(join(outputDirectory, 'journal/sample-story.html')), before)
  assert.deepEqual(await readdir(join(outputDirectory, 'journal-assets/sample-story')), oldAssets)
  await rm(join(outputDirectory, 'journal.html'), { recursive: true })
  await buildJournal({ outputDirectory, sourceDirectory, market: 'AU' })
  assert.doesNotMatch(await readFile(join(outputDirectory, 'journal.html'), 'utf8'), /Sample story/)
})
