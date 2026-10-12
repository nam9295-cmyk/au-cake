import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import content from '../src/content/au-company-portfolio.json' with { type: 'json' }
import presentation from '../src/content/au-portfolio-v03.json' with { type: 'json' }
import postcss from 'postcss'

const normalize = (value) => value.replace(/\s+/g, ' ').trim()
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

test('portfolio metadata agrees with visible v0.3 copy and every CSS rule stays page-scoped', async () => {
  assert.equal(content.seo.description, presentation.hero.body)
  const css = postcss.parse(await readFile(new URL('../src/styles/company-portfolio.css', import.meta.url), 'utf8'))
  css.walkRules(rule => {
    for (const selector of rule.selectors) assert.ok(selector.startsWith('.company-portfolio'), `Unscoped selector: ${selector}`)
  })
})

test('direct portfolio HTML offers the v0.3 shopping and enquiry paths with responsive existing photographs', async () => {
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
    assert.match(html, /<h1[^>]*>FIND YOUR SWEET MOMENT\.<\/h1>/)
    for (const copy of [
      'Chocolate, cakes and treats for everyday moments, thoughtful gifts and celebrations.',
      'SOMETHING SWEET TO SHARE.',
      'Send your date, guest numbers and preferred mix.',
      'A LITTLE THANK-YOU FOR EVERY GUEST.',
      'Tell us the product, quantity and date. Packaging details are agreed when ordering.',
      'MADE FOR YOUR SPECIAL MOMENT.',
      'Tell us your date, servings, design ideas and budget.',
      'FOR CAFÉS & BUSINESSES.',
      'FOUND SOMETHING YOU LIKE?',
      'Choose your treats. Share your date and quantity. We confirm availability and details together.',
    ]) assert.ok(visible.includes(copy), copy)
    // Existing incoming hashes still work, including the two grouped business rows.
    for (const id of [...content.boards.map(board => board.slug), 'business']) assert.ok(html.includes(`id="${id}"`), id)
    for (const id of ['sharing', 'individual-packs', 'custom-cakes', 'business']) assert.ok(html.includes(`href="#${id}"`))
    const link = (label, href) => assert.match(html, new RegExp(`<a[^>]+href="${href}"[^>]*>${label.replaceAll('&', '&amp;')}[\\s<]`), label)
    link('Shop cakes & treats', '/cakes')
    link('Explore chocolates', '/chocolates')
    link('Browse party treats', '/cakes')
    link('Explore custom cakes', '/cakes/custom-cake')
    for (const label of ['Ask about guest favours', 'Enquire about café supply', 'Talk about your menu']) link(label, content.links.instagram)
    assert.doesNotMatch(html, /preview-note|data-target=|draft-banner|Visual proposal|24\/7/)
    assert.equal((html.match(/<main\b/g) || []).length, 1)
    assert.equal((html.match(/<h1\b/g) || []).length, 1)
    assert.equal((html.match(/<section\b/g) || []).length, 6)
    assert.equal((html.match(/loading="eager"/g) || []).length, 1)
    assert.equal((html.match(/loading="lazy"/g) || []).length, 9)
    assert.equal((html.match(/<img[^>]+fetchPriority="high"/gi) || []).length, 1)
    assert.equal((html.match(/<img[^>]+srcSet=/gi) || []).length, 10)
    assert.ok(html.includes('https://au.verygood-chocolate.com/portfolio'))
    assert.ok((await readFile(join(directory, 'dist/sitemap.xml'), 'utf8')).includes('/portfolio</loc>'))
    for (const board of content.boards) for (const photo of board.images) for (const variant of photo.web.variants) {
      const bytes = await readFile(new URL(`../public${variant.src}`, import.meta.url))
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
      assert.ok(variant.width <= 1280)
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
