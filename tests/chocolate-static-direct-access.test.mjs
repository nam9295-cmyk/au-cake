import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const dist = join(repoRoot, 'dist')
const chocolateRoutes = [
  ['/chocolates', 'CHOCOLATES'],
  ['/chocolates/almond-chocoball', 'Almond Chocoball'],
  ['/chocolates/pave-chocolate', 'Pavé Chocolate'],
  ['/chocolates/eiffel-tower-chocolate', 'Eiffel Tower Chocolate'],
]
const existingRoutes = ['/', '/cakes', '/cakes/pave-chocolate-cake', '/cakes/custom-cake']

async function staticFileFor(pathname) {
  const relative = pathname.slice(1)
  const candidates = pathname === '/' ? ['index.html'] : [
    `${relative}.html`,
    `${relative}/index.html`,
  ]
  for (const candidate of candidates) {
    const path = join(dist, candidate)
    if ((await stat(path).catch(() => null))?.isFile()) return path
  }
  return null
}

async function withStaticServer(run) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname
      const file = await staticFileFor(pathname)
      response.writeHead(file ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' })
      response.end(await readFile(file || join(dist, '404.html')))
    } catch (error) {
      response.writeHead(500)
      response.end(String(error))
    }
  })
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  try {
    return await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose))
  }
}

async function renderAuHome() {
  const directory = await mkdtemp(join(tmpdir(), 'au-chocolate-static-home-'))
  const bundle = await rolldown({
    input: 'au-chocolate-home-render',
    platform: 'node',
    transform: { jsx: { runtime: 'automatic' }, define: { 'import.meta.env': JSON.stringify({ VITE_MARKET: 'AU' }) } },
    plugins: [{
      name: 'au-chocolate-home-render',
      resolveId(id) { if (id === 'au-chocolate-home-render') return resolve(repoRoot, 'au-chocolate-home-render.ts') },
      load(id) {
        if (id.endsWith('/au-chocolate-home-render.ts')) return `
          import React from 'react';
          import { renderToStaticMarkup } from 'react-dom/server';
          import { HomePage } from './src/pages/HomePage';
          console.log(renderToStaticMarkup(React.createElement(HomePage, {
            navigate() {}, navigateToCake() {}, language: 'en', setLanguage() {}, cartItemCount: 0
          })));
        `
        if (/\.(png|jpg|webp|svg)$/.test(id)) return 'export default "test-image"'
      },
    }],
  })
  try {
    const file = join(directory, 'home.mjs')
    await bundle.write({ file, format: 'esm', codeSplitting: false })
    return execFileSync(process.execPath, [file], { encoding: 'utf8', env: { ...process.env, VITE_MARKET: 'AU' } })
  } finally {
    await bundle.close()
    await rm(directory, { recursive: true, force: true })
  }
}

test('AU production dist serves each Chocolate route by its extensionless URL', { skip: process.env.VITE_MARKET === 'KR' }, async () => {
  await withStaticServer(async (origin) => {
    for (const [pathname, heading] of chocolateRoutes) {
      const response = await fetch(`${origin}${pathname}`)
      assert.equal(response.status, 200, `${pathname} must resolve without an SPA fallback`)
      const html = await response.text()
      assert.match(html, /<div id="root">/, pathname)
      assert.doesNotMatch(html, /<h1>Page not found<\/h1>/i, pathname)
      assert.ok(html.includes(`<h1>${heading}</h1>`), `${pathname} must have its own fallback heading`)
      assert.ok(html.includes(`<link rel="canonical" href="https://au.verygood-chocolate.com${pathname}"`), `${pathname} needs its own canonical URL`)
      assert.match(html, /<meta name="robots" content="noindex, nofollow"/, pathname)
    }
  })
})

test('AU Home CHOCOLATES link points to a generated direct-load route', { skip: process.env.VITE_MARKET === 'KR' }, async () => {
  const home = await renderAuHome()
  const hrefs = [...home.matchAll(/<a href="([^"]+)"[^>]*>CHOCOLATES<\/a>/g)].map((match) => match[1])
  assert.ok(hrefs.length > 0, 'Home must expose a CHOCOLATES link')
  const homeDetails = [...new Set([...home.matchAll(/href="(\/chocolates\/[^"]+)"/g)].map((match) => match[1]))].sort()
  const generatedDetails = (await readdir(join(dist, 'chocolates')))
    .filter((file) => file.endsWith('.html'))
    .map((file) => `/chocolates/${file.slice(0, -5)}`).sort()
  assert.deepEqual(homeDetails, chocolateRoutes.slice(1).map(([path]) => path).sort())
  assert.deepEqual(generatedDetails, homeDetails, 'static details must match the frontend catalogue links')
  await withStaticServer(async (origin) => {
    for (const href of hrefs) {
      assert.equal((await fetch(`${origin}${href}`)).status, 200, `Home link ${href} must load directly`)
    }
  })
})

test('existing public Cake routes retain direct static access', async () => {
  await withStaticServer(async (origin) => {
    for (const pathname of existingRoutes) {
      const response = await fetch(`${origin}${pathname}`)
      assert.equal(response.status, 200, `${pathname} must still resolve directly`)
      assert.doesNotMatch(await response.text(), /<h1>Page not found<\/h1>/i, pathname)
    }
  })
})

test('KR production dist does not publish AU Chocolate pages', { skip: process.env.VITE_MARKET !== 'KR' }, async () => {
  await withStaticServer(async (origin) => {
    for (const [pathname] of chocolateRoutes) {
      assert.equal((await fetch(`${origin}${pathname}`)).status, 404, pathname)
    }
  })
})
