import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import content from '../src/content/au-company-portfolio.json' with { type: 'json' }
import postcss from 'postcss'

const normalize = (value) => value.replace(/\s+/g, ' ').trim()
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

test('portfolio metadata agrees with visible editorial copy and every CSS rule stays page-scoped', async () => {
  assert.match(content.seo.description, /digital invitations in beta/)
  const css = postcss.parse(await readFile(new URL('../src/styles/company-portfolio.css', import.meta.url), 'utf8'))
  css.walkRules(rule => {
    for (const selector of rule.selectors) assert.ok(selector.startsWith('.company-portfolio'), `Unscoped selector: ${selector}`)
  })
})

test('direct portfolio HTML offers the editorial shopping and enquiry paths with responsive existing photographs', async () => {
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
    for (const text of ['Cakes for gatherings.', 'Meet Jenny.', 'Something good', 'Practical pastry craft', 'Before the cake is cut', 'From our daily bakehouse.', 'Have something']) assert.ok(visible.includes(text), text)
    for (const id of [...content.boards.map(board => board.slug), 'business', 'about', 'invitations']) assert.ok(html.includes(`id="${id}"`), id)
    assert.ok(html.includes('href="https://invite.verygood-chocolate.com/gallery/chocolate-collage"'))
    assert.ok(html.includes(`href="${content.links.instagram}"`))
    assert.equal((html.match(/<main\b/g) || []).length, 1)
    assert.equal((html.match(/<h1\b/g) || []).length, 1)
    assert.ok(html.includes('hero-mobile.webp'))
    assert.ok(html.includes('https://au.verygood-chocolate.com/portfolio'))
    assert.ok((await readFile(join(directory, 'dist/sitemap.xml'), 'utf8')).includes('/portfolio</loc>'))
    for (const [, asset] of html.matchAll(/(?:src|srcSet)="(\/portfolio\/editorial\/[^"]+)"/gi)) {
      const bytes = await readFile(new URL(`../public${asset}`, import.meta.url))
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
