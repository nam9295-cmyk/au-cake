import { readFile, writeFile, mkdir, readdir, mkdtemp, rm, lstat, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { rolldown } from 'rolldown'
import postcss from 'postcss'
import { inspectPackage, readPrepared, packageFile } from './journal-import.mjs'
import content from '../src/content/au-public-pages.json' with { type: 'json' }

const project = fileURLToPath(new URL('../', import.meta.url))
const escape = text => String(text ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&#39;')
let chromePromise
async function chromeRenderer() {
  if (!chromePromise) chromePromise = (async () => {
    const directory = await mkdtemp(join(tmpdir(), 'au-journal-shell-'))
    try {
      const bundle = await rolldown({ input: join(project, 'scripts/journal-shell.tsx'), platform: 'node', transform: { jsx: { runtime: 'automatic' } } })
      const file = join(directory, 'shell.mjs')
      try { await bundle.write({ file, format: 'esm', codeSplitting: false }) } finally { await bundle.close() }
      return (await import(pathToFileURL(file).href)).renderJournalChrome
    } finally { await rm(directory, { recursive: true, force: true }) }
  })()
  return chromePromise
}
function publicEntry(entry) {
  return Object.fromEntries(['id','slug','title','excerpt','locale','publishedAt','updatedAt','cover'].filter(k => entry[k] !== undefined).map(k => [k, entry[k]]))
}
async function shellStyles() {
  const tokens = postcss.parse(await readFile(join(project, 'src/styles/tokens.css'), 'utf8'))
  tokens.nodes.filter(node => !(node.type === 'atrule' && node.name === 'import') && !(node.type === 'rule' && node.selector === ':root')).forEach(node => node.remove())
  const chrome = postcss.parse(await readFile(join(project, 'src/styles/au-phase1.css'), 'utf8'))
  // Reuse actual AU shell/footer rules, without importing product or global typography into articles.
  chrome.walkRules(rule => { if (!rule.selector.includes('.au-redesign-footer') && rule.selector !== '.app-shell.au-redesign-shell') rule.remove() })
  chrome.walkAtRules(at => { if (!at.nodes?.length) at.remove() })
  chrome.walkComments(node => node.remove())
  return [tokens.toString(), chrome.toString(), ...await Promise.all(['src/styles/au-navigation.css','src/journal/journal.css'].map(path => readFile(join(project, path), 'utf8')))].join('\n')
}

async function commitOutput(stage, outputDirectory) {
  const names = ['journal', 'journal-assets', 'journal.html', 'sitemap.xml']
  const previous = [], installed = []
  await mkdir(outputDirectory, { recursive: true })
  // Refuse unexpected output shapes before moving any known-good files.
  for (const name of names) {
    try {
      const info = await lstat(join(outputDirectory, name))
      if (info.isSymbolicLink() || (name.includes('.') ? !info.isFile() : !info.isDirectory())) throw new Error(`Journal output obstructed: ${name}`)
      previous.push(name)
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const backup = join(stage, '.previous')
  await mkdir(backup)
  const saved = []
  try {
    for (const name of previous) { await rename(join(outputDirectory, name), join(backup, name)); saved.push(name) }
    for (const name of names) { await rename(join(stage, name), join(outputDirectory, name)); installed.push(name) }
  } catch (error) {
    try {
      for (const name of installed) await rm(join(outputDirectory, name), { recursive: true, force: true })
      for (const name of saved) await rename(join(backup, name), join(outputDirectory, name))
    } catch (recoveryError) {
      const failure = new Error(`Journal output restore failed. Previous files retained at ${backup}: ${recoveryError.message}`, { cause: error })
      failure.recoveryPath = stage
      throw failure
    }
    throw error
  }
}
function cover(entry) {
  if (!entry.cover) return ''
  const c = entry.cover
  return `<img src="${escape(c.src)}" srcset="${c.variants.map(v => `${escape(v.src)} ${v.width}w`).join(', ')}" sizes="(max-width: 600px) 100vw, 560px" width="${c.width}" height="${c.height}" alt="${escape(c.alt)}" loading="lazy" decoding="async">`
}
function documentHtml({ entry, title, description, body, shell, shellCss, articleCss, siteUrl, preview, isArticle }) {
  const path = isArticle ? `/journal/${entry.slug}` : '/journal'
  const canonical = `${siteUrl}${path}`
  const image = entry?.cover ? `${siteUrl}${entry.cover.src}` : null
  const schema = isArticle ? { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: entry.title, description, url: canonical, mainEntityOfPage: canonical, inLanguage: entry.locale, ...(image ? { image: [image] } : {}), ...(entry.publishedAt ? { datePublished: entry.publishedAt, dateModified: entry.updatedAt } : {}), publisher: { '@type': 'Organization', name: content.site.brand, url: siteUrl } } : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Journal', url: canonical, inLanguage: 'en-AU' }
  return `<!doctype html>
<html lang="${escape(entry?.locale || 'en-AU')}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" href="/favicon.png">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
<meta name="robots" content="${preview ? 'noindex, nofollow' : 'index, follow'}">
<link rel="canonical" href="${escape(canonical)}">
<meta property="og:site_name" content="${escape(content.site.brand)}"><meta property="og:type" content="${isArticle ? 'article' : 'website'}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}">
<meta property="og:locale" content="${entry?.locale === 'ko' ? 'ko_KR' : 'en_AU'}">
${image ? `<meta property="og:image" content="${escape(image)}"><meta property="og:image:type" content="image/webp"><meta property="og:image:alt" content="${escape(entry.cover.alt)}"><meta property="og:image:width" content="${entry.cover.width}"><meta property="og:image:height" content="${entry.cover.height}"><meta name="twitter:image" content="${escape(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<link rel="alternate" type="application/rss+xml" title="verygood Journal" href="${escape(siteUrl)}/journal/feed.xml">
<link rel="stylesheet" href="${shellCss}">${articleCss ? `<link rel="stylesheet" href="${articleCss}">` : ''}
<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>
</head><body class="journal-site"><div class="app-shell au-redesign-shell">
${shell.header}
${preview ? `<aside class="journal-preview-notice" aria-label="Preview status"><strong>${entry?.source.tool === 'content-review' ? 'Content review' : 'Publication preview'}</strong><p>Local preview. ${entry?.source.tool === 'content-review' ? 'Design, photographs and publication require review. Pencil export compatibility has not been verified.' : 'Source design and web publication are checked separately.'}</p></aside>` : ''}
${body}
${shell.footer}</div></body></html>`
}

/** Production never reads private workspace. Validate everything before writing output. */
export async function buildJournal({ outputDirectory, sourceDirectory = join(project, 'journal-source'), workspace = join(project, '.journal-workspace'), preview = false, market = process.env.VITE_MARKET, siteUrl = content.site.url }) {
  if (String(market).toUpperCase() !== 'AU') return { entries: [] }
  if (preview && resolve(outputDirectory).split('/').at(-1) === 'dist') throw new Error('Private previews must not be written to dist')
  const packages = []
  if (preview) packages.push(...await readPrepared(workspace))
  else {
    let directories
    try { directories = await readdir(sourceDirectory, { withFileTypes: true }) } catch (error) { if (error.code !== 'ENOENT') throw error; directories = [] }
    for (const directory of directories.filter(d => d.isDirectory())) {
      const inputDirectory = join(sourceDirectory, directory.name)
      const entry = JSON.parse(await readFile(await packageFile(inputDirectory, 'article.json'), 'utf8'))
      if (entry.status === 'published') packages.push(await inspectPackage({ inputDirectory, publicMode: true }))
      else if (!['draft','archived'].includes(entry.status)) throw new Error('Invalid article status')
    }
  }
  for (const key of ['id','slug']) {
    const values = packages.map(p => p.entry[key])
    if (new Set(values).size !== values.length) throw new Error(`Duplicate article ${key}`)
  }
  packages.sort((a,b) => (Date.parse(b.entry.publishedAt) || 0) - (Date.parse(a.entry.publishedAt) || 0))
  const entries = packages.map(p => p.entry)
  const renderChrome = await chromeRenderer()
  const css = await shellStyles()
  const cssPath = `/journal-assets/shell-${createHash('sha256').update(css).digest('hex').slice(0,12)}.css`
  await mkdir(dirname(resolve(outputDirectory)), { recursive: true })
  const stage = await mkdtemp(join(dirname(resolve(outputDirectory)), '.au-journal-build-'))
  let retainStage = false
  async function put(path, data) { const file = join(stage, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, data) }
  async function page(path, html) {
    await put(`${path}.html`, html)
    await put(`${path}/index.html`, html)
  }
  try {
    await put(cssPath, css)
    const indexBody = `<main id="journal-main" class="journal-index"><h1>Journal</h1>${entries.length ? `<div class="journal-list">${entries.map(entry => `<article class="journal-card"><a href="/journal/${entry.slug}">${cover(entry)}<h2>${escape(entry.title)}</h2><p>${escape(entry.excerpt)}</p>${entry.publishedAt ? `<time datetime="${escape(entry.publishedAt)}">${escape(new Date(entry.publishedAt).toLocaleDateString('en-AU', { day:'numeric',month:'long',year:'numeric', timeZone:'Australia/Sydney' }))}</time>` : ''}</a></article>`).join('')}</div>` : '<p class="journal-empty">Stories from verygood are on their way.</p><a href="/cakes">Explore our cakes</a>'}</main>`
    await page('/journal', documentHtml({ title: 'Journal | verygood chocolate', description: 'Stories about chocolate, cake and gatherings from verygood in Sydney.', body: indexBody, shell: renderChrome('en-AU'), shellCss: cssPath, siteUrl, preview, isArticle: false }))
    for (const pkg of packages) {
      const { entry } = pkg
      for (const file of pkg.files) await put(file.path, file.data)
      const articleCss = `/journal-assets/${entry.id}/article-${createHash('sha256').update(pkg.css).digest('hex').slice(0,12)}.css`
      await put(articleCss, pkg.css)
      const body = `<nav class="journal-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/journal">Journal</a></nav><main id="journal-main">${pkg.html}</main><nav class="journal-back" aria-label="Back to Journal"><a href="/journal">← ${entry.locale === 'ko' ? '저널로 돌아가기' : 'Back to Journal'}</a></nav>`
      await page(`/journal/${entry.slug}`, documentHtml({ entry, title: entry.seoTitle || `${entry.title} | verygood chocolate`, description: entry.excerpt, body, shell: renderChrome(entry.locale), shellCss: cssPath, articleCss, siteUrl, preview, isArticle: true }))
    }
    const publicEntries = preview ? [] : entries
    await put('/journal/catalog.json', JSON.stringify(publicEntries.map(publicEntry), null, 2))
    await put('/journal/feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>verygood Journal</title><link>${escape(siteUrl)}/journal</link><description>Chocolate, cake and gatherings.</description><language>en-AU</language>${publicEntries.map(entry => `<item><title>${escape(entry.title)}</title><link>${escape(siteUrl)}/journal/${entry.slug}</link><guid isPermaLink="true">${escape(siteUrl)}/journal/${entry.slug}</guid><description>${escape(entry.excerpt)}</description><pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`)
    let sitemap
    try { sitemap = await readFile(join(outputDirectory, 'sitemap.xml'), 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error; sitemap = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>' }
    sitemap = sitemap.replace(/\s*<url>\s*<loc>[^<]*\/journal(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g, '')
    await put('/sitemap.xml', sitemap.replace('</urlset>', `${preview ? '' : [`${siteUrl}/journal`, ...publicEntries.map(e => `${siteUrl}/journal/${e.slug}`)].map(url => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`))
    await commitOutput(stage, outputDirectory)
    return { entries: entries.map(publicEntry), preview }
  } catch (error) { retainStage = Boolean(error.recoveryPath); throw error }
  finally { if (!retainStage) await rm(stage, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const preview = process.argv.includes('--preview')
  try {
    const result = await buildJournal({ outputDirectory: resolve(preview ? '.journal-workspace/preview' : 'dist'), preview, market: process.env.VITE_MARKET })
    console.log(`Journal: ${result.entries.length} ${preview ? 'private preview' : 'approved published'} articles; market ${process.env.VITE_MARKET || 'unset'}.`)
  } catch (error) { console.error(`Journal build failed: ${error.message}`); process.exitCode = 1 }
}
