import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, readFile, symlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { fixture } from './helpers/journal-fixture.mjs'
import { inspectPackage, prepareImport, rollbackImport } from '../scripts/journal-import.mjs'


test('batch import rewrites HTML and CSS paths, scopes styles and generates real sized WebP variants', async t => {
  const f = await fixture(t)
  const result = await inspectPackage(f)
  assert.match(result.html, /src="\/journal-assets\/sample-story\//)
  assert.match(result.html, /srcset="[^\"]+480w[^\"]+900w/)
  assert.match(result.html, /width="900" height="600"/)
  assert.match(result.css, /#journal-sample-story h1/)
  assert.doesNotMatch(result.css, /(?:^|})\s*(?:body|:root)\s*\{/)
  assert.match(result.css, /@keyframes j-sample-story-appear/)
  assert.match(result.css, /animation: j-sample-story-appear/)
  assert.match(result.css, /url\("?\/journal-assets\//)
  assert.equal(result.report.images.length, 1)
  assert.equal(result.entry.cover.width, 900)
  for (const file of result.files) {
    const meta = await sharp(file.data).metadata()
    assert.equal(meta.format, 'webp')
    assert.ok(meta.width <= 900)
  }
  assert.equal(result.report.externalLinks[0], 'https://example.com/source')
})

test('a designed heading line break preserves the HTML and matches the plain metadata title', async t => {
  const f = await fixture(t)
  const html = await readFile(join(f.inputDirectory, 'index.html'), 'utf8')
  await writeFile(join(f.inputDirectory, 'index.html'), html.replace('Sample story</h1>', 'Sample<br>story</h1>'))
  const result = await inspectPackage(f)
  assert.match(result.html, /Sample<br>story<\/h1>/)
  assert.deepEqual(result.report.headings[0], { level: 1, text: 'Sample story' })
})

test('failed/stale updates preserve the active revision; rollback preserves a monotonic revision counter', async t => {
  const f = await fixture(t)
  const first = await prepareImport({ ...f, expectedRevision: 0 })
  assert.equal(first.revision, 1)
  await writeFile(join(f.inputDirectory, 'index.html'), '<h1>Sample story</h1><p>Second revision.</p>')
  const second = await prepareImport({ ...f, expectedRevision: 1 })
  assert.equal(second.revision, 2)
  await assert.rejects(prepareImport({ ...f, expectedRevision: 1 }), /revision/i)
  await writeFile(join(f.inputDirectory, 'index.html'), '<h1>Sample story</h1><script>alert(1)</script>')
  await assert.rejects(prepareImport({ ...f, expectedRevision: 2 }), /script/i)
  const state = JSON.parse(await readFile(join(f.workspace, 'state.json')))
  assert.equal(state.entries[0].activeRevision, 2)
  const restored = await rollbackImport({ workspace: f.workspace, id: 'sample-story', expectedRevision: 2, targetRevision: 1 })
  assert.equal(restored.revision, 3)
  assert.equal(restored.activeRevision, 1)
})

test('same id keeps its original URL and another id cannot claim its slug', async t => {
  const f = await fixture(t)
  await prepareImport({ ...f, expectedRevision: 0 })
  await writeFile(join(f.inputDirectory, 'article.json'), JSON.stringify({ ...f.entry, slug: 'changed-url' }))
  await assert.rejects(prepareImport({ ...f, expectedRevision: 1 }), /slug/i)
  await writeFile(join(f.inputDirectory, 'article.json'), JSON.stringify({ ...f.entry, id: 'different-id' }))
  await assert.rejects(prepareImport({ ...f, expectedRevision: 0 }), /slug/i)
})

test('concurrent imports cannot overwrite one another', async t => {
  const f = await fixture(t)
  const results = await Promise.allSettled([prepareImport({ ...f, expectedRevision: 0 }), prepareImport({ ...f, expectedRevision: 0 })])
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1)
})

for (const [label, html] of [
  ['events', '<h1>Sample story</h1><img src="photos/Sample%20Photo.JPG" alt="x" onerror="alert(1)">'],
  ['encoded URL', '<h1>Sample story</h1><a href="java&#x73;cript:alert(1)">x</a>'],
  ['iframe', '<h1>Sample story</h1><iframe src="https://example.com"></iframe>'],
  ['SVG', '<h1>Sample story</h1><svg><use href="x"/></svg>'],
  ['missing alt', '<h1>Sample story</h1><img src="photos/Sample%20Photo.JPG">'],
  ['remote image', '<h1>Sample story</h1><img src="https://drive.google.com/photo.jpg" alt="x">'],
  ['traversal', '<h1>Sample story</h1><img src="%2e%2e/secret.jpg" alt="x">'],
  ['duplicate h1', '<h1>Sample story</h1><h1>Again</h1>'],
  ['wrong title', '<h1>A different title</h1>'],
  ['broken fragment', '<h1>Sample story</h1><a href="#missing">Read more</a>'],
  ['body title handler', '<h1>Sample story</h1><title onclick="alert(1)">Click me</title><style>title{display:block}</style>'],
  ['body meta handler', '<h1>Sample story</h1><meta onmouseover="alert(1)" content="x">'],
]) test(`unsafe or incomplete ${label} is rejected before preparation`, async t => {
  const f = await fixture(t)
  await writeFile(join(f.inputDirectory, 'index.html'), html)
  await assert.rejects(inspectPackage(f))
})

for (const css of ['@import "https://example.com/style.css";', 'p{position:fixed}', 'p{background:url(https://example.com/pixel)}', '@page{margin:0}', 'p{behavior:url(x.htc)}', 'p{p\\6fsition:fixed}']) {
  test(`unsupported CSS is rejected: ${css}`, async t => {
    const f = await fixture(t)
    await writeFile(join(f.inputDirectory, 'style.css'), css)
    await assert.rejects(inspectPackage(f))
  })
}

test('symlinked assets outside the input package are rejected', async t => {
  const f = await fixture(t)
  await writeFile(join(f.root, 'outside.jpg'), 'private')
  await symlink(join(f.root, 'outside.jpg'), join(f.inputDirectory, 'photos', 'leak.jpg'))
  await writeFile(join(f.inputDirectory, 'index.html'), '<h1>Sample story</h1><img src="photos/leak.jpg" alt="x">')
  await assert.rejects(inspectPackage(f), /outside|package|symlink/i)
})

test('nested stylesheet paths resolve within package and preserve distinct files with the same basename', async t => {
  const f = await fixture(t)
  await mkdir(join(f.inputDirectory, 'css'))
  await mkdir(join(f.inputDirectory, 'other'))
  await sharp({ create: { width: 600, height: 400, channels: 3, background: '#edc5c4' } }).png().toFile(join(f.inputDirectory, 'other/Sample Photo.JPG'))
  await writeFile(join(f.inputDirectory, 'css/layout.css'), '.photo{background:url("../other/Sample%20Photo.JPG")}')
  await writeFile(join(f.inputDirectory, 'index.html'), '<html><head><link rel="stylesheet" href="css/layout.css"></head><body><h1>Sample story</h1><img src="photos/Sample%20Photo.JPG" alt="test"></body></html>')
  const result = await inspectPackage(f)
  assert.equal(result.report.images.length, 2)
  assert.notEqual(result.report.images[0].variants[0].src, result.report.images[1].variants[0].src)
})

test('body class, body inline style and body id selectors survive the article boundary conversion', async t => {
  const f = await fixture(t)
  await writeFile(join(f.inputDirectory, 'index.html'), '<html><head><style>#story{color:red}body>h1{color:green}</style></head><body id="story" class="paper" style="padding:24px"><h1>Sample story</h1><p>Text.</p></body></html>')
  const result = await inspectPackage(f)
  assert.match(result.html, /class="[^"]*paper/)
  assert.match(result.html, /class="[^"]*j-inline-/)
  assert.match(result.css, /#journal-sample-story\s*\{/)
})

test('variable position cannot bypass the static CSS positioning policy', async t => {
  const f = await fixture(t)
  await writeFile(join(f.inputDirectory, 'style.css'), ':root{--mode:fixed}p{position:var(--mode)}')
  await assert.rejects(inspectPackage(f), /position/i)
})

test('uppercase CSS properties cannot register a font under the shared chrome font name', async t => {
  const f = await fixture(t)
  await writeFile(join(f.inputDirectory, 'style.css'), '@font-face{FONT-FAMILY:"SUIT Variable";SRC:local("Arial")}p{FONT-FAMILY:"SUIT Variable";--MixedCase:green;color:var(--MixedCase)}')
  const result = await inspectPackage(f)
  assert.doesNotMatch(result.css, /font-family\s*:\s*"SUIT Variable"/i)
  assert.match(result.css, /font-family:\s*"j-sample-story-/)
  assert.match(result.css, /--MixedCase:green/)
})

test('published content requires explicit approval, a cover and valid nonfuture timezone dates', async t => {
  const f = await fixture(t, { status: 'published' })
  await assert.rejects(inspectPackage({ ...f, publicMode: true }), /approv|date/i)
  for (const changed of [
    { publishedAt: '2099-01-01T00:00:00Z' },
    { publishedAt: '2026-01-01' },
    { publishedAt: '2026-02-31T00:00:00Z', updatedAt: '2026-03-04T00:00:00Z' },
    { cover: null },
  ]) {
    await writeFile(join(f.inputDirectory, 'article.json'), JSON.stringify({ ...f.entry, publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', publication: { approved: true, approvedBy: 'Test', approvedAt: '2026-01-01T00:00:00Z' }, ...changed }))
    await assert.rejects(inspectPackage({ ...f, publicMode: true }))
  }
})

test('owner-approved native FigCraft exports retain honest provenance through public validation', async t => {
  const f=await fixture(t,{status:'published',publishedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',publication:{approved:true,approvedBy:'Test owner',approvedAt:'2026-01-01T00:00:00Z'},source:{tool:'figcraft',version:'0.12.1'}})
  const result=await inspectPackage({...f,publicMode:true})
  assert.equal(result.entry.source.tool,'figcraft')
  assert.ok(!result.report.warnings.some(w=>/not a real Pencil export/i.test(w)))
})
