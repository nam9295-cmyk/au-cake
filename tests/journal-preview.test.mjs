import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startPreview } from '../scripts/journal-preview.mjs'

test('local preview serves static direct URLs, canonicalizes slash and gives hard 404 with no repository access', async t => {
  const root = await mkdtemp(join(tmpdir(), 'journal-server-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'journal'))
  await writeFile(join(root, 'journal.html'), '<h1>Journal</h1>')
  await writeFile(join(root, 'journal/sample.html'), '<h1>Sample</h1>')
  await writeFile(join(root, 'private.txt'), 'do not serve')
  const server = await startPreview({ directory: root, port: 0, privatePreview: true })
  t.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${origin}/journal/sample`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.match(await response.text(), /<h1>Sample/)
  assert.equal((await fetch(`${origin}/journal/sample/`, { redirect: 'manual' })).status, 308)
  assert.equal((await fetch(`${origin}/journal/missing`)).status, 404)
  assert.equal((await fetch(`${origin}/.git/config`)).status, 404)
  assert.equal((await fetch(`${origin}/private.txt`)).status, 404)
  assert.equal((await fetch(`${origin}/journal/%2e%2e%2fprivate.txt`)).status, 404)
})
