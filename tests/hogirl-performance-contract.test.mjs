import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vitePath = join(root, 'node_modules/vite/bin/vite.js')

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return files.flat()
}

test('the homepage entry does not contain HOGIRL content, media URLs, or lazy reader CSS', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'au-cake-hogirl-bundle-'))
  t.after(() => rm(outDir, { recursive: true, force: true }))
  const result = spawnSync(process.execPath, [vitePath, 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, VITE_MARKET: 'AU', CF_PAGES_COMMIT_SHA: 'hogirl-contract' },
  })
  assert.equal(result.status, 0, result.stderr)

  const index = await readFile(join(outDir, 'index.html'), 'utf8')
  assert.doesNotMatch(index, /HogirlApp/)
  const entryPath = index.match(/<script[^>]+src="([^"]+)"/)?.[1]
  assert.ok(entryPath, 'Vite homepage entry script is required')
  const entry = await readFile(join(outDir, entryPath.replace(/^\//, '')), 'utf8')
  const homepageCssPaths = [...index.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((match) => match[1])
  const homepageCss = await Promise.all(homepageCssPaths.map((path) => readFile(join(outDir, path.replace(/^\//, '')), 'utf8')))

  for (const payload of [entry, ...homepageCss]) {
    assert.doesNotMatch(payload, /Fixture narration visible to readers\./)
    assert.doesNotMatch(payload, /hogirl\/fixture\//)
    assert.doesNotMatch(payload, /media\.example\.test/)
    assert.doesNotMatch(payload, /hogirl-reader/)
    assert.doesNotMatch(payload, /publishedSeasons/)
  }

  const output = await Promise.all((await listFiles(outDir)).map((path) => readFile(path, 'utf8').catch(() => '')))
  assert.ok(output.some((content) => content.includes('hogirl-reader')), 'reader CSS must remain in a deferred HOGIRL artifact')

  const hogirlAppSource = await readFile(join(root, 'src/stories/hogirl/HogirlApp.tsx'), 'utf8')
  assert.doesNotMatch(hogirlAppSource, /import\s+['"][^'"]+hogirl\.css['"]/, 'the App graph must not statically import HOGIRL CSS')
  assert.match(hogirlAppSource, /document\.head\.appendChild\(stylesheet\)/)
  assert.match(hogirlAppSource, /['"]\/hogirl\.css['"]/, 'the lazy reader must request its isolated stylesheet')

  const loadersSource = await readFile(join(root, 'src/stories/hogirl/loaders.ts'), 'utf8')
  assert.doesNotMatch(loadersSource, /eager\s*:\s*true/)
})
