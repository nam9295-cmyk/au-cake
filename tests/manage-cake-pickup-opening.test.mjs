import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const scriptPath = fileURLToPath(new URL('../scripts/manage-cake-pickup-opening.mjs', import.meta.url))

function runInvalidSlot(slot) {
  const env = { ...process.env }
  delete env.APPWRITE_ENDPOINT
  delete env.VITE_APPWRITE_ENDPOINT
  delete env.APPWRITE_PROJECT_ID
  delete env.VITE_APPWRITE_PROJECT_ID
  delete env.APPWRITE_API_KEY

  return spawnSync(process.execPath, [scriptPath, 'open', slot], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env,
  })
}

test('cake pickup opening manager rejects malformed wall-clock minutes before loading Appwrite configuration', () => {
  for (const slot of ['2026-08-29:08:60', '2026-08-29:18:60']) {
    const result = runInvalidSlot(slot)
    assert.notEqual(result.status, 0, slot)
    assert.match(result.stderr, /픽업 시간은 08:00~20:00 사이의 15분 단위여야 합니다/)
    assert.doesNotMatch(result.stderr, /APPWRITE_ENDPOINT/)
  }
})
