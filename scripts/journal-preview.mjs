import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { join, resolve, relative, extname, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.woff':'font/woff', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.ico':'image/x-icon' }

export async function startPreview({ directory, fallbackDirectory, port = 4317, privatePreview = false }) {
  const roots = [await realpath(directory)]
  if (fallbackDirectory) { try { roots.push(await realpath(fallbackDirectory)) } catch { /* optional local AU build */ } }
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (privatePreview) response.setHeader('X-Robots-Tag', 'noindex, nofollow')
    try {
      let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (path.includes('\\') || path.split('/').some(part => part.startsWith('.')) || !['GET','HEAD'].includes(request.method)) throw Error('not found')
      if (/^\/journal(?:\/[a-z0-9-]+)?\/$/.test(path)) {
        response.writeHead(308, { Location: path.slice(0,-1) }); response.end(); return
      }
      // Private root exposes only generated Journal paths, never its source/state/revisions.
      const journalRequest = /^\/(journal(?:\/|$)|journal-assets\/|sitemap\.xml$)/.test(path)
      const candidateRoots = privatePreview && !journalRequest ? roots.slice(1) : roots
      if (!path.startsWith('/')) throw Error('not found')
      if (path === '/') path = '/index.html'
      const candidates = extname(path) ? [path] : [`${path}.html`, `${path}/index.html`]
      for (const root of candidateRoots) for (const candidate of candidates) {
        try {
          const file = await realpath(join(root, candidate))
          if (relative(root, file).startsWith('..') || isAbsolute(relative(root, file))) continue
          const body = await readFile(file)
          response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
          response.end(request.method === 'HEAD' ? undefined : body); return
        } catch (error) { if (!['ENOENT','ENOTDIR','EISDIR'].includes(error.code)) throw error }
      }
    } catch { /* hard 404, no SPA fallback */ }
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html lang="en"><head><meta name="robots" content="noindex"><title>Page not found</title></head><body><h1>Page not found</h1><a href="/journal">Journal</a></body></html>')
  })
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done) })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const privatePreview = process.argv.includes('--private')
  const server = await startPreview({ directory: resolve(privatePreview ? '.journal-workspace/preview' : 'dist'), fallbackDirectory: privatePreview ? resolve('dist') : undefined, privatePreview, port: 4317 })
  console.log(`Local ${privatePreview ? 'private content review' : 'AU build'} preview: http://127.0.0.1:${server.address().port}/journal`)
}
