import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import content from '../src/content/au-company-portfolio.json' with { type: 'json' }

const normalize = (value) => value.replace(/\s+/g, ' ').trim()
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

test('direct portfolio HTML retains all Penpot copy, accessible hash destinations and responsive image hints', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'company-portfolio-static-'))
  try {
    await mkdir(join(directory, 'dist'))
    const template = await readFile(new URL('../index.html', import.meta.url), 'utf8')
    await writeFile(join(directory, 'dist/index.html'), template)
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/generate-seo-pages.mjs', import.meta.url))], {
      cwd: directory, encoding: 'utf8', env: { ...process.env, VITE_MARKET: 'AU' },
    })
    assert.equal(run.status, 0, run.stderr)
    const html = await readFile(join(directory, 'dist/portfolio/index.html'), 'utf8')
    assert.equal(await readFile(join(directory, 'dist/portfolio.html'), 'utf8'), html)
    const visible = normalize(decode(html.replace(/<[^>]+>/g, ' ')))
    for (const board of content.boards) {
      assert.ok(html.includes(`id="${board.slug}"`), board.slug)
      for (const item of board.texts) {
        if (item.name.startsWith('BRAND') || item.name.startsWith('FOOTER')) continue
        assert.ok(visible.includes(normalize(item.text)), `${board.name}: ${item.name}: ${item.text}`)
      }
    }
    for (const board of content.boards.slice(0, 6)) assert.ok(html.includes(`href="#${board.slug}"`))
    assert.equal((html.match(/<main\b/g) || []).length, 1)
    assert.equal((html.match(/<section\b/g) || []).length, 7)
    assert.equal((html.match(/loading="eager"/g) || []).length, 1)
    assert.equal((html.match(/loading="lazy"/g) || []).length, 13)
    assert.equal((html.match(/<img[^>]+fetchPriority="high"/gi) || []).length, 1)
    assert.equal((html.match(/<img[^>]+srcSet=/gi) || []).length, 14)
    assert.ok(html.includes('https://au.verygood-chocolate.com/portfolio'))
    assert.ok((await readFile(join(directory, 'dist/sitemap.xml'), 'utf8')).includes('/portfolio</loc>'))
    for (const board of content.boards) for (const photo of board.images) for (const variant of photo.web.variants) {
      const bytes = await readFile(new URL(`../public${variant.src}`, import.meta.url))
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
      assert.ok(variant.width <= 1280)
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
