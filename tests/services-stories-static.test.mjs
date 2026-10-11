import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import routes from '../src/content/au-service-routes.json' with { type: 'json' }

test('production extensionless static URLs resolve without an SPA fallback; existing paths survive', async () => {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const candidates =
      path === '/'
        ? ['index.html']
        : [`${path.slice(1)}.html`, `${path.slice(1)}/index.html`]
    for (const candidate of candidates) {
      const file = join('dist', candidate)
      if ((await stat(file).catch(() => null))?.isFile()) {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(await readFile(file))
        return
      }
    }
    res.writeHead(404)
    res.end('Not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    for (const route of routes) {
      const response = await fetch(origin + route.path)
      assert.equal(
        response.status,
        process.env.VITE_MARKET === 'KR' ? 404 : 200,
        route.path,
      )
      if (process.env.VITE_MARKET !== 'KR') {
        const html = await response.text()
        assert.ok(
          html.includes(
            `<link rel="canonical" href="https://au.verygood-chocolate.com${route.path}"`,
          ),
        )
        assert.doesNotMatch(html, /<h1>Page not found/)
        assert.ok(
          (await readFile('dist/sitemap.xml', 'utf8')).includes(route.path),
        )
      }
    }
    for (const path of [
      '/',
      '/cakes',
      '/cakes/pave-chocolate-cake',
      '/cakes/custom-cake',
      '/cart',
      '/reserve',
      '/reviews',
      '/classes',
    ])
      assert.equal((await fetch(origin + path)).status, 200, path)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
