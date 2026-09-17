import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { getHogirlMediaOriginFromEnvironment, getHogirlMediaUrl } from '../src/stories/hogirl/media-contract.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatorPath = join(root, 'scripts/generate-seo-pages.mjs')
const site = 'https://au.verygood-chocolate.com'

const template = `<!doctype html>
<html lang="en-AU">
  <head>
    <title>Template</title>
    <meta name="description" content="Template description" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${site}/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Template" />
    <meta property="og:description" content="Template description" />
    <meta property="og:url" content="${site}/" />
    <meta property="og:image" content="${site}/og-image.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:title" content="Template" />
    <meta name="twitter:description" content="Template description" />
    <meta name="twitter:image" content="${site}/og-image.jpg" />
  </head>
  <body><div id="root"></div></body>
</html>`

async function generate({ fixture, mediaOrigin }) {
  const workdir = await mkdtemp(join(tmpdir(), 'au-cake-hogirl-seo-'))
  const dist = join(workdir, 'dist')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), template)
  const result = spawnSync(process.execPath, [generatorPath], {
    cwd: workdir,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: fixture ? 'test' : process.env.NODE_ENV,
      HOGIRL_TEST_FIXTURE: fixture ? '1' : '',
      HOGIRL_TEST_FIXTURE_ACK: fixture ? 'test-only' : '',
      VITE_HOGIRL_MEDIA_ORIGIN: mediaOrigin || '',
    },
  })
  assert.equal(result.status, 0, result.stderr)
  return { dist }
}

async function serveStaticDirectory(rootDirectory) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    const safePath = normalize(decodeURIComponent(pathname)).replace(/^\/+/, '')
    const candidate = join(rootDirectory, safePath, 'index.html')
    if (!candidate.startsWith(rootDirectory)) {
      response.writeHead(400).end()
      return
    }
    try {
      const body = await readFile(candidate)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
    } catch {
      response.writeHead(404).end('Not found')
    }
  })
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Static test server did not expose a TCP port')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveServer, rejectServer) => server.close((error) => error ? rejectServer(error) : resolveServer())),
  }
}

test('fixture-only HOGIRL routes have direct static artifacts with localized visible metadata', async (t) => {
  const mediaOrigin = 'https://hogirl-cdn.test'
  const runtimeMediaUrl = getHogirlMediaUrl({
    mediaOrigin: getHogirlMediaOriginFromEnvironment({ VITE_HOGIRL_MEDIA_ORIGIN: mediaOrigin }),
    key: 'hogirl/fixture/season-01/ep01/panel-001',
    width: 1080,
    format: 'webp',
  })
  const { dist } = await generate({ fixture: true, mediaOrigin })
  const directServer = await serveStaticDirectory(dist)
  t.after(() => directServer.close())

  const routes = [
    '/stories/hogirl',
    '/stories/hogirl/season-1',
    '/stories/hogirl/season-1/ep01-reader-fixture',
    '/ko/stories/hogirl/season-1/ep01-reader-fixture',
  ]
  for (const route of routes) {
    const response = await fetch(`${directServer.origin}${route}`)
    assert.equal(response.status, 200, route)
  }
  assert.equal((await fetch(`${directServer.origin}/ja/stories/hogirl/season-1/ep01-reader-fixture`)).status, 404)

  const englishEpisode = await readFile(join(dist, 'stories/hogirl/season-1/ep01-reader-fixture/index.html'), 'utf8')
  const koreanEpisode = await readFile(join(dist, 'ko/stories/hogirl/season-1/ep01-reader-fixture/index.html'), 'utf8')
  assert.match(englishEpisode, /<html lang="en-AU">/)
  assert.match(koreanEpisode, /<html lang="ko">/)
  assert.match(englishEpisode, /Fixture narration visible to readers\./)
  assert.match(koreanEpisode, /독자에게 보이는 테스트 나레이션입니다\./)
  assert.match(englishEpisode, /loading="eager"[^>]*fetchpriority="high"/)
  assert.equal(runtimeMediaUrl, 'https://hogirl-cdn.test/hogirl/fixture/season-01/ep01/panel-001-1080.webp')
  assert.match(englishEpisode, new RegExp(runtimeMediaUrl.replaceAll('.', '\\.')))
  assert.match(englishEpisode, new RegExp(`<meta property="og:image" content="${runtimeMediaUrl.replaceAll('.', '\\.')}"`))
  assert.doesNotMatch(englishEpisode, /media\.example\.test/)
  assert.match(englishEpisode, new RegExp(`<link rel="canonical" href="${site}/stories/hogirl/season-1/ep01-reader-fixture"`))
  assert.match(englishEpisode, /hreflang="en-AU"/)
  assert.match(englishEpisode, /hreflang="ko"/)
  assert.match(englishEpisode, /hreflang="x-default"/)

  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  assert.match(sitemap, /stories\/hogirl\/season-1\/ep01-reader-fixture/)
  assert.match(sitemap, /ko\/stories\/hogirl\/season-1\/ep01-reader-fixture/)
  assert.doesNotMatch(sitemap, /ja\/stories\/hogirl/)
})

test('ordinary SEO generation never publishes the HOGIRL test fixture', async () => {
  const { dist } = await generate({ fixture: false })
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  const llms = await readFile(join(dist, 'llms.txt'), 'utf8')
  await assert.rejects(readFile(join(dist, 'stories/hogirl/index.html')))
  assert.doesNotMatch(sitemap, /hogirl/i)
  assert.doesNotMatch(llms, /hogirl test fixture/i)
})
