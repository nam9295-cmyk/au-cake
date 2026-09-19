import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function locale(name) {
  return JSON.parse(await readFile(join(root, 'src/content/hogirl/prologue-a-tiger-dream', `${name}.json`), 'utf8'))
}

test('Prologue caption layout follows the approved PDF composition in both locales', async () => {
  for (const copy of await Promise.all([locale('en'), locale('ko')])) {
    assert.deepEqual(copy.panels['panel-002'].captionLayout, { x: 7, y: 18, maxWidth: 55, align: 'left' })
    assert.deepEqual(copy.panels['panel-012'].captionLayout, { x: 45, y: 23, maxWidth: 48, align: 'right' })
    assert.equal(copy.panels['panel-003'].captions.length, 0)
    assert.deepEqual(copy.panels['panel-016'].captionLayout, { x: 7, y: 20, maxWidth: 44, align: 'left', tone: 'forest' })
  }
})
