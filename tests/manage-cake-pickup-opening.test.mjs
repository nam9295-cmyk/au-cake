import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(new URL('../scripts/manage-cake-pickup-opening.mjs', import.meta.url))

function runInvalidSlot(slot, cwd) {
  const env = { ...process.env }
  delete env.APPWRITE_ENDPOINT
  delete env.VITE_APPWRITE_ENDPOINT
  delete env.APPWRITE_PROJECT_ID
  delete env.VITE_APPWRITE_PROJECT_ID
  delete env.APPWRITE_API_KEY

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, 'open', slot], { cwd, env })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (status) => resolve({ status, stdout, stderr }))
  })
}

function assertInvalidResult(result, slot) {
  assert.notEqual(result.status, 0, slot)
  assert.match(result.stderr, /픽업 시간은 08:00~20:00 사이의 15분 단위여야 합니다/)
  assert.doesNotMatch(result.stderr, /APPWRITE_ENDPOINT/)
}

test('cake pickup opening manager rejects malformed wall-clock minutes before reading .env.local', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'au-cake-invalid-opening-'))
  try {
    await mkdir(join(cwd, '.env.local'))
    for (const slot of ['2026-08-29:08:60', '2026-08-29:18:60']) {
      const result = await runInvalidSlot(slot, cwd)
      assertInvalidResult(result, slot)
      assert.doesNotMatch(result.stderr, /EISDIR/)
    }
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('cake pickup opening manager rejects malformed wall-clock minutes before an Appwrite request', async () => {
  let requests = 0
  const server = createServer((_, response) => {
    requests += 1
    response.statusCode = 503
    response.end('unexpected Appwrite request')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  const cwd = await mkdtemp(join(tmpdir(), 'au-cake-invalid-opening-'))
  try {
    await writeFile(join(cwd, '.env.local'), [
      `APPWRITE_ENDPOINT=http://127.0.0.1:${port}/v1`,
      'APPWRITE_PROJECT_ID=test-project',
      'APPWRITE_API_KEY=test-key',
    ].join('\n'))
    for (const slot of ['2026-08-29:08:60', '2026-08-29:18:60']) {
      assertInvalidResult(await runInvalidSlot(slot, cwd), slot)
    }
    assert.equal(requests, 0)
  } finally {
    await rm(cwd, { recursive: true, force: true })
    server.close()
    await once(server, 'close')
  }
})
