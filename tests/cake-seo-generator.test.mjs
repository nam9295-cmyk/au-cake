import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const generatorPath = fileURLToPath(new URL('../scripts/generate-seo-pages.mjs', import.meta.url))
const cakeSlugs = [
  'chocolate-pound-cake-and-cupcakes',
  'pave-chocolate-cake',
  'chocolatiers-basque-cheesecake',
  'lemon-cake',
  'vanilla-fresh-cream-cake',
]

const template = `<!doctype html>
<html lang="en-AU">
  <head>
    <title>Template</title>
    <meta name="description" content="Template description" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://au.verygood-chocolate.com/" />
    <meta property="og:title" content="Template" />
    <meta property="og:description" content="Template description" />
    <meta property="og:url" content="https://au.verygood-chocolate.com/" />
    <meta name="twitter:title" content="Template" />
    <meta name="twitter:description" content="Template description" />
  </head>
  <body><div id="root"></div></body>
</html>`

test('SEO generator writes the cake catalogue and every canonical cake detail page', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'au-cake-seo-generator-'))
  const dist = join(workdir, 'dist')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), template)

  const result = spawnSync(process.execPath, [generatorPath], {
    cwd: workdir,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const catalogue = await readFile(join(dist, 'cakes.html'), 'utf8')
  assert.match(catalogue, /<link rel="canonical" href="https:\/\/au\.verygood-chocolate\.com\/cakes"/)
  assert.match(catalogue, /<h1>Choose Your Cake<\/h1>/)

  for (const slug of cakeSlugs) {
    const detail = await readFile(join(dist, 'cakes', `${slug}.html`), 'utf8')
    assert.match(detail, new RegExp(`canonical" href="https://au\\.verygood-chocolate\\.com/cakes/${slug}"`))
    assert.match(detail, /<main class="seo-fallback">/)
  }
})
