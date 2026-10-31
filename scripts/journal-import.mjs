import { readFile, writeFile, mkdir, rename, realpath, rm } from 'node:fs/promises'
import { resolve, relative, dirname, extname, join, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parse, serializeOuter } from 'parse5'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import valueParser from 'postcss-value-parser'
import sharp from 'sharp'

const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const allowedTags = new Set('html head body title meta link style article section main div span p h1 h2 h3 h4 h5 h6 a img figure figcaption blockquote q cite strong em b i u s small sub sup br hr ul ol li dl dt dd table caption thead tbody tfoot tr th td time abbr address pre code details summary'.split(' '))
const attributes = new Set('id class title lang dir role href target rel src srcset alt width height loading decoding colspan rowspan scope datetime open start reversed value'.split(' '))
const sha = data => createHash('sha256').update(data).digest('hex').slice(0, 16)
const fail = message => { throw new Error(message) }
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value
function setAttr(node, name, value) {
  const existing = node.attrs.find(a => a.name === name)
  if (existing) existing.value = String(value)
  else node.attrs.push({ name, value: String(value) })
}
function walk(node, fn) {
  fn(node)
  for (const child of node.childNodes || []) walk(child, fn)
}
function textContent(node) { return node.nodeName === '#text' ? node.value : node.tagName === 'br' ? '\n' : (node.childNodes || []).map(textContent).join('') }
const normalized = text => text.replace(/\s+/g, ' ').trim()

export async function packageFile(directory, reference, baseDirectory = directory) {
  let decoded
  try { decoded = decodeURIComponent(reference) } catch { fail(`Invalid encoded asset: ${reference}`) }
  if (!decoded || /[\\\x00-\x1f?#:]/.test(decoded) || isAbsolute(decoded)) fail(`Asset must stay inside package: ${reference}`)
  const root = await realpath(directory)
  const resolved = resolve(await realpath(baseDirectory), decoded)
  if (relative(root, resolved).startsWith('..') || isAbsolute(relative(root, resolved))) fail(`Asset outside package: ${reference}`)
  const file = await realpath(resolved)
  if (relative(root, file).startsWith('..') || isAbsolute(relative(root, file))) fail(`Asset outside package (including symlinks): ${reference}`)
  return file
}

function requiredText(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) fail(`Invalid ${name}`)
  return value
}
function date(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now()) fail(`Invalid or future timezone date: ${field}`)
  const [year, month, day] = value.slice(0,10).split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) fail(`Invalid calendar date: ${field}`)
}
export function validateEntry(input, publicMode = false) {
  if (!input || typeof input !== 'object') fail('article.json must be an object')
  for (const name of ['id', 'slug']) if (typeof input[name] !== 'string' || !identifier.test(input[name]) || input[name].length > 100 || ['index','feed','404','sitemap'].includes(input[name])) fail(`Invalid ${name}`)
  for (const key of ['title', 'excerpt']) requiredText(input[key], key)
  if (input.seoTitle) requiredText(input.seoTitle, 'seoTitle')
  if (!['en-AU', 'ko'].includes(input.locale)) fail('Unsupported locale')
  if (!['draft', 'published', 'archived'].includes(input.status)) fail('Invalid publication status')
  if (!input.source || !['pencil', 'figcraft', 'content-review', 'fixture'].includes(input.source.tool)) fail('Missing source provenance')
  if (input.status === 'published') {
    date(input.publishedAt, 'publishedAt')
    date(input.updatedAt, 'updatedAt')
    if (Date.parse(input.updatedAt) < Date.parse(input.publishedAt)) fail('updatedAt precedes publishedAt')
    if (!input.cover) fail('Published article requires cover image')
    if (publicMode) {
      if (input.publication?.approved !== true) fail('Public build requires explicit publication approval')
      requiredText(input.publication.approvedBy, 'approvedBy')
      date(input.publication.approvedAt, 'approvedAt')
      if (!['pencil','figcraft','fixture'].includes(input.source.tool)) fail('Content review is not a design export approved for publication')
    }
  }
  if (input.cover) {
    requiredText(input.cover.src, 'cover.src')
    requiredText(input.cover.alt, 'cover.alt')
  }
  // Copy only supported, public metadata. Never propagate arbitrary input fields.
  return Object.fromEntries(['id','slug','title','seoTitle','excerpt','locale','status','publishedAt','updatedAt','cover','source','publication'].filter(k => input[k] !== undefined).map(k => [k, structuredClone(input[k])]))
}

/** Inspect and compile without writing files or contacting external hosts. */
export async function inspectPackage({ inputDirectory, publicMode = false }) {
  const manifestPath = await packageFile(inputDirectory, 'article.json')
  const input = JSON.parse(await readFile(manifestPath, 'utf8'))
  const entry = validateEntry(input, publicMode)
  const htmlPath = await packageFile(inputDirectory, input.html || 'index.html')
  const document = parse(await readFile(htmlPath, 'utf8'))
  const scope = `journal-${entry.id}`
  const files = new Map(), images = new Map(), fonts = new Map()
  const report = { source: entry.source, warnings: [], images: [], externalLinks: [], headings: [], missing: [] }
  if (!entry.cover) report.warnings.push('Cover/photo missing: content preview only; publication blocked.')
  if (!['pencil','figcraft'].includes(entry.source.tool)) report.warnings.push('Not a real Pencil export. Pencil design/import compatibility is unverified.')

  async function image(reference, baseDirectory = dirname(htmlPath)) {
    const file = await packageFile(inputDirectory, reference, baseDirectory)
    // A stylesheet may live in a subdirectory; its resolved assets must also stay inside the package.
    const root = await realpath(inputDirectory)
    if (relative(root, file).startsWith('..')) fail('Asset outside package')
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file)) fail(`Unsupported image format (SVG must be reviewed/rasterized): ${reference}`)
    if (images.has(file)) return images.get(file)
    const bytes = await readFile(file)
    const meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()
    if (!meta.width || !meta.height || (meta.pages || 1) > 1) fail(`Unsupported image: ${reference}`)
    const rotated = [5,6,7,8].includes(meta.orientation)
    const width = rotated ? meta.height : meta.width
    const height = rotated ? meta.width : meta.height
    const digest = sha(bytes)
    const variants = []
    for (const size of [...new Set([480, 960, 1600, Math.min(width, 2000)].filter(n => n <= width && n <= 2000))].sort((a,b) => a-b)) {
      const path = `/journal-assets/${entry.id}/${digest}/${size}.webp`
      const result = await sharp(bytes).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
      files.set(path, { path, data: result.data })
      variants.push({ src: path, width: result.info.width, height: result.info.height })
    }
    const result = { ...variants.at(-1), variants, originalWidth: width, originalHeight: height }
    images.set(file, result)
    report.images.push({ reference, width, height, variants })
    return result
  }

  async function cssUrl(reference, baseDirectory, font = false) {
    if (font) {
      const file = await packageFile(inputDirectory, reference, baseDirectory)
      if (!/\.woff2?$/i.test(file)) fail('Only bundled WOFF/WOFF2 fonts are supported')
      const bytes = await readFile(file)
      const path = `/journal-assets/${entry.id}/${sha(bytes)}/font${extname(file).toLowerCase()}`
      files.set(path, { path, data: bytes })
      return path
    }
    return (await image(reference, baseDirectory)).src
  }

  const styleSources = [], imageNodes = [], h1s = [], ids = new Set(), links = []
  let body, bodyId
  walk(document, node => {
    if (!node.tagName) return
    const tag = node.tagName
    if (!allowedTags.has(tag)) fail(`Unsupported active/dynamic element: <${tag}>`)
    if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml') fail(`Unsupported namespace: ${tag}`)
    for (const a of node.attrs) {
      if (a.name.startsWith('on') || a.namespace || a.name === 'srcdoc') fail(`Unsupported attribute ${tag}[${a.name}]`)
    }
    if (tag === 'body') { body = node; bodyId = attr(node, 'id') }
    if (tag === 'meta' && attr(node, 'http-equiv')) fail('Unsupported meta http-equiv')
    if (tag === 'link') {
      if (attr(node, 'rel') !== 'stylesheet') fail('Only local stylesheet links are supported')
      styleSources.push({ reference: attr(node, 'href') })
      return
    }
    if (tag === 'style') { styleSources.push({ css: textContent(node), base: dirname(htmlPath) }); return }
    if (['html','head','title','meta'].includes(tag)) return
    for (const a of node.attrs) {
      if (a.name === 'style') continue
      if (a.name.startsWith('on') || a.namespace || (!attributes.has(a.name) && !/^aria-[a-z-]+$/.test(a.name) && !/^data-[a-z-]+$/.test(a.name))) fail(`Unsupported attribute ${tag}[${a.name}]`)
      if (['href','target','rel'].includes(a.name) && tag !== 'a') fail(`Unsupported URL attribute: ${tag}[${a.name}]`)
      if (['src','srcset'].includes(a.name) && tag !== 'img') fail(`Unsupported resource attribute: ${tag}[${a.name}]`)
    }
    if (attr(node, 'id')) {
      const original = attr(node, 'id')
      if (!/^[a-zA-Z][\w-]*$/.test(original) || ids.has(original)) fail(`Invalid/duplicate HTML id: ${original}`)
      ids.add(original)
      setAttr(node, 'id', node === body ? scope : `j-${entry.id}-${original}`)
    }
    if (/^h[1-6]$/.test(tag)) report.headings.push({ level: Number(tag[1]), text: normalized(textContent(node)) })
    if (tag === 'h1') h1s.push(node)
    if (tag === 'img') {
      if (attr(node, 'alt') === undefined) fail('Image is missing alt text (use alt="" only for decoration)')
      if (!attr(node, 'src')) fail('Image src missing')
      imageNodes.push(node)
    }
    if (tag === 'a') {
      const href = attr(node, 'href') || ''
      if (!href || /[\x00-\x20\\]/.test(href) || !(href.startsWith('#') || /^\/(?!\/)/.test(href) || /^(https:\/\/|mailto:|tel:)/.test(href))) fail(`Unsafe/unsupported link URL: ${href}`)
      if (href.startsWith('https:')) {
        const url = new URL(href)
        if (url.username || url.password) fail('Credentials in URL are unsupported')
        report.externalLinks.push(href)
      }
      if (attr(node, 'target') && !['_blank','_self'].includes(attr(node, 'target'))) fail('Unsupported link target')
      if (attr(node, 'target') === '_blank') setAttr(node, 'rel', 'noopener noreferrer')
      links.push(node)
    }
  })
  if (h1s.length !== 1 || normalized(textContent(h1s[0])) !== normalized(entry.title)) fail('Exactly one h1 matching article title is required')
  if (report.headings.some((h,i,a) => i && h.level > a[i-1].level + 1)) fail('Heading level skips reading hierarchy')
  for (const link of links) {
    const href = attr(link, 'href')
    if (href.startsWith('#')) {
      if (!ids.has(href.slice(1))) fail(`Broken fragment link: ${href}`)
      setAttr(link, 'href', href.slice(1) === bodyId ? `#${scope}` : `#j-${entry.id}-${href.slice(1)}`)
    }
  }
  walk(body, node => {
    for (const name of ['aria-labelledby','aria-describedby','aria-controls']) {
      if (!attr(node, name)) continue
      const refs = attr(node, name).split(/\s+/)
      if (refs.some(ref => !ids.has(ref))) fail(`Broken ${name} reference`)
      setAttr(node, name, refs.map(ref => ref === bodyId ? scope : `j-${entry.id}-${ref}`).join(' '))
    }
  })

  for (const node of imageNodes) {
    if (attr(node, 'srcset')) {
      for (const candidate of attr(node, 'srcset').split(',')) {
        const match = candidate.trim().match(/^(\S+)(?:\s+\d+(?:\.\d+)?[wx])?$/)
        if (!match) fail('Unsupported srcset syntax; use encoded local paths')
        await image(match[1])
      }
    }
    const mapped = await image(attr(node, 'src'))
    setAttr(node, 'src', mapped.src)
    setAttr(node, 'srcset', mapped.variants.map(v => `${v.src} ${v.width}w`).join(', '))
    setAttr(node, 'sizes', '(max-width: 768px) 100vw, 960px')
    setAttr(node, 'width', mapped.width)
    setAttr(node, 'height', mapped.height)
    setAttr(node, 'loading', node === imageNodes[0] ? 'eager' : 'lazy')
    setAttr(node, 'decoding', 'async')
  }
  if (entry.cover) {
    const mapped = await image(entry.cover.src, inputDirectory)
    entry.cover = { ...mapped, alt: entry.cover.alt }
  }

  const roots = []
  for (const source of styleSources) {
    if (source.reference) {
      const file = await packageFile(inputDirectory, source.reference, dirname(htmlPath))
      if (extname(file).toLowerCase() !== '.css') fail('Stylesheet must be CSS')
      roots.push({ root: postcss.parse(await readFile(file, 'utf8')), base: dirname(file) })
    } else roots.push({ root: postcss.parse(source.css), base: source.base })
  }
  // Convert inline declarations to generated scoped classes; no style text bypasses validation.
  let inlineIndex = 0
  walk(body, node => {
    const value = attr(node, 'style')
    if (!value) return
    const className = `j-inline-${++inlineIndex}`
    const root = postcss.parse(`.${className}{${value}}`)
    if (root.nodes.length !== 1 || root.first.type !== 'rule' || root.first.nodes.some(n => !['decl','comment'].includes(n.type))) fail('Unsupported inline style')
    setAttr(node, 'class', `${attr(node, 'class') || ''} ${className}`.trim())
    node.attrs = node.attrs.filter(a => a.name !== 'style')
    roots.push({ root, base: dirname(htmlPath) })
  })

  // Collect names first: declarations can precede their @font-face/@keyframes rules.
  for (const { root } of roots) root.walkDecls(d => {
    if (d.prop.includes('\\')) fail('Escaped CSS property names are unsupported')
    if (!d.prop.startsWith('--')) d.prop = d.prop.toLowerCase()
  })
  const animations = new Map()
  for (const { root } of roots) root.walkAtRules(at => {
    if (at.name === 'keyframes') {
      if (!/^[\w-]+$/.test(at.params)) fail('Unsupported keyframe name')
      animations.set(at.params, `j-${entry.id}-${at.params}`)
    }
    if (at.name === 'font-face') at.walkDecls('font-family', d => {
      const name = valueParser(d.value).nodes.filter(n => n.type !== 'space').map(n => n.value).join(' ')
      fonts.set(name, `j-${entry.id}-${sha(name)}`)
    })
  })
  for (const { root, base } of roots) {
    root.walkComments(c => c.remove())
    root.walkAtRules(at => {
      if (!['media','supports','keyframes','font-face'].includes(at.name)) fail(`Unsupported CSS @${at.name}`)
      if (at.name === 'keyframes') at.params = animations.get(at.params)
    })
    root.walkRules(rule => {
      if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return
      rule.selector = selectorParser(selectors => {
        selectors.each(selector => {
          if (selector.nodes.some(n => n.type === 'nesting')) fail('Nested CSS is unsupported; export flat CSS')
          selector.walkIds(node => { node.value = node.value === bodyId ? scope : `j-${entry.id}-${node.value}` })
          selector.walk(node => {
            if ((node.type === 'tag' && ['html','body'].includes(node.value)) || (node.type === 'pseudo' && node.value === ':root')) node.replaceWith(selectorParser.id({ value: scope }))
          })
          // html body becomes a single boundary, preserving body > child semantics.
          const first = selector.nodes[0]
          if (first?.type === 'id' && first.value === scope) {
            while (selector.nodes[1]?.type === 'combinator' && selector.nodes[2]?.type === 'id' && selector.nodes[2].value === scope) { selector.nodes[2].remove(); selector.nodes[1].remove() }
          } else { selector.prepend(selectorParser.combinator({ value: ' ' })); selector.prepend(selectorParser.id({ value: scope })) }
        })
      }).processSync(rule.selector)
    })
    const declarations = []
    root.walkDecls(d => declarations.push(d))
    for (const d of declarations) {
      if (/behavior|binding/i.test(d.prop) || /expression\s*\(/i.test(d.value) || (d.prop.toLowerCase() === 'position' && !/^(static|relative|absolute)$/i.test(d.value.trim()))) fail(`Unsupported CSS property/value: ${d.prop}: ${d.value}`)
      const parsed = valueParser(d.value), urls = []
      parsed.walk(n => { if (n.type === 'function' && n.value.toLowerCase() === 'url') urls.push(n) })
      for (const n of urls) {
        if (n.nodes.length !== 1 || !['word','string'].includes(n.nodes[0].type)) fail('Unsupported CSS url()')
        n.nodes = [{ type: 'string', quote: '"', value: await cssUrl(n.nodes[0].value, base, d.parent.type === 'atrule' && d.parent.name === 'font-face') }]
      }
      parsed.walk(n => {
        if ((d.prop === 'animation' || d.prop === 'animation-name') && n.type === 'word' && animations.has(n.value)) n.value = animations.get(n.value)
        if (['font','font-family'].includes(d.prop) && ['word','string'].includes(n.type) && fonts.has(n.value)) n.value = fonts.get(n.value)
      })
      if (d.prop === 'font-family') {
        const family = normalized(d.value.replace(/["']/g, ''))
        if (fonts.has(family)) { d.value = `"${fonts.get(family)}"`; continue }
      }
      // image-set and escaped function names can hide network requests; require url() exports.
      if (/\\|image-set\s*\(|(?:https?:|data:|javascript:|\/\/)/i.test(parsed.toString())) {
        if (urls.length === 0 || /\\|image-set\s*\(/i.test(parsed.toString())) fail('Unsupported CSS resource/value')
      }
      d.value = parsed.toString()
    }
  }
  const prune = node => {
    node.childNodes = (node.childNodes || []).filter(child => !['style','link'].includes(child.tagName) && child.nodeName !== '#comment')
    node.childNodes.forEach(prune)
  }
  prune(body)
  report.externalLinks = [...new Set(report.externalLinks)]
  body.tagName = body.nodeName = 'article'
  setAttr(body, 'id', scope)
  setAttr(body, 'class', `journal-article ${attr(body, 'class') || ''}`.trim())
  return { entry, html: serializeOuter(body), css: roots.map(r => r.root.toString()).join('\n'), report, files: [...files.values()] }
}

async function stateAt(workspace) {
  try { return JSON.parse(await readFile(join(workspace, 'state.json'), 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return { version: 1, entries: [] }; throw error }
}
async function locked(workspace, run) {
  await mkdir(workspace, { recursive: true })
  const lock = join(workspace, '.import-lock')
  try { await mkdir(lock) } catch { fail('Journal import locked by another process; retry after it finishes') }
  try { return await run() } finally { await rm(lock, { recursive: true, force: true }) }
}
async function saveState(workspace, state) {
  const temp = join(workspace, `state-${randomUUID()}.tmp`)
  await writeFile(temp, JSON.stringify(state, null, 2))
  await rename(temp, join(workspace, 'state.json'))
}
function checkRevision(existing, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision !== (existing?.revision || 0)) fail(`Revision conflict: expected ${expectedRevision}; current ${existing?.revision || 0}`)
}
export async function prepareImport({ inputDirectory, workspace, expectedRevision }) {
  return locked(workspace, async () => {
    const state = await stateAt(workspace)
    const result = await inspectPackage({ inputDirectory })
    const existing = state.entries.find(e => e.id === result.entry.id)
    checkRevision(existing, expectedRevision)
    if (existing && existing.slug !== result.entry.slug) fail('Existing article slug cannot change; keep the original URL')
    if (state.entries.some(e => e.id !== result.entry.id && e.slug === result.entry.slug)) fail('Slug already belongs to another article')
    const revision = (existing?.revision || 0) + 1
    const packagePath = join(workspace, 'revisions', result.entry.id, String(revision))
    // Immutable snapshot first, atomic state pointer last. A failed import never changes active content.
    await mkdir(packagePath, { recursive: true })
    const filePaths = []
    for (const file of result.files) {
      const destination = join(packagePath, file.path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, file.data)
      filePaths.push(file.path)
    }
    await writeFile(join(packagePath, 'prepared.json'), JSON.stringify({ ...result, files: filePaths }, null, 2))
    const record = { id: result.entry.id, slug: result.entry.slug, revision, activeRevision: revision, history: [...(existing?.history || []), revision] }
    state.entries = [...state.entries.filter(e => e.id !== record.id), record]
    await saveState(workspace, state)
    return { ...record, packagePath, report: result.report }
  })
}
export async function rollbackImport({ workspace, id, expectedRevision, targetRevision }) {
  return locked(workspace, async () => {
    const state = await stateAt(workspace)
    const record = state.entries.find(e => e.id === id)
    checkRevision(record, expectedRevision)
    if (!record?.history.includes(targetRevision)) fail('Unknown target revision')
    await readFile(join(workspace, 'revisions', id, String(targetRevision), 'prepared.json'))
    record.activeRevision = targetRevision
    record.revision++
    await saveState(workspace, state)
    return record
  })
}
export async function readPrepared(workspace) {
  const state = await stateAt(workspace)
  return Promise.all(state.entries.map(async record => {
    const directory = join(workspace, 'revisions', record.id, String(record.activeRevision))
    const result = JSON.parse(await readFile(join(directory, 'prepared.json'), 'utf8'))
    result.files = await Promise.all(result.files.map(async path => ({ path, data: await readFile(join(directory, path)) })))
    return result
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = key => args[args.indexOf(key) + 1]
  try {
    const workspace = resolve('.journal-workspace')
    if (args.includes('--rollback')) {
      console.log(JSON.stringify(await rollbackImport({ workspace, id: option('--id'), expectedRevision: Number(option('--expected-revision')), targetRevision: Number(option('--target-revision')) }), null, 2))
    } else {
      if (!args.includes('--input')) fail('Usage: --input /absolute/package [--prepare --expected-revision 0]')
      const inputDirectory = resolve(option('--input'))
      const result = args.includes('--prepare') ? await prepareImport({ inputDirectory, workspace, expectedRevision: args.includes('--expected-revision') ? Number(option('--expected-revision')) : NaN }) : await inspectPackage({ inputDirectory })
      console.log(JSON.stringify({ id: result.entry?.id || result.id, slug: result.entry?.slug || result.slug, revision: result.revision, report: result.report }, null, 2))
    }
  } catch (error) { console.error(`Journal import failed: ${error.message}`); process.exitCode = 1 }
}
