import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const pipeline = join(root, 'scripts/hogirl-media.mjs')

async function createSource(path, width, height) {
  await sharp({
    create: { width, height, channels: 3, background: '#f4eee5' },
  }).webp({ quality: 90 }).toFile(path)
}

function runPipeline(input, output, keyPrefix) {
  return spawnSync(process.execPath, [pipeline,
    '--input', input,
    '--output', output,
    '--key-prefix', keyPrefix,
  ], { cwd: root, encoding: 'utf8' })
}
test('1080px masters generate only guaranteed WebP and AVIF derivatives', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hogirl-media-'))
  const input = join(temp, 'input')
  const output = join(temp, 'output')
  await mkdir(input, { recursive: true })
  await createSource(join(input, '01.webp'), 1080, 1350)

  const result = runPipeline(input, output, 'hogirl/v1/prologue-a-tiger-dream')
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const target = join(output, 'hogirl/v1/prologue-a-tiger-dream')
  assert.deepEqual((await readdir(target)).sort(), [
    '01-1080.avif', '01-1080.webp',
    '01-540.avif', '01-540.webp',
    '01-720.avif', '01-720.webp',
  ])

  for (const width of [540, 720, 1080]) {
    const metadata = await sharp(join(target, `01-${width}.webp`)).metadata()
    assert.equal(metadata.width, width)
    assert.equal(metadata.height, Math.round(width * 1.25))
  }
})
test('pipeline writes immutable browser caching for versioned HOGIRL assets', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hogirl-media-cache-'))
  const input = join(temp, 'input')
  const output = join(temp, 'output')
  await mkdir(input, { recursive: true })
  await createSource(join(input, '01.webp'), 1080, 1350)

  const result = runPipeline(input, output, 'hogirl/v1/season-1/ep01-i-know-what-i-want')
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const headers = await import('node:fs/promises').then(({ readFile }) => readFile(join(output, '_headers'), 'utf8'))
  assert.match(headers, /\/hogirl\/v1\/\*/)
  assert.match(headers, /Cache-Control: public, max-age=31536000, immutable/)
})
