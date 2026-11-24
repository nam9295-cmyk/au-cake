import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publishedJournalEntries, storefrontReading, journalReading } from '../scripts/journal-relations.mjs'

test('storefront references follow the approved article slug and exclude unavailable articles', async t => {
  const root = await mkdtemp(join(tmpdir(), 'journal-reading-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [id, status, approved] of [['draft-09', 'archived', true], ['draft-15', 'published', false], ['draft-18', 'published', true]]) {
    await mkdir(join(root, id))
    await writeFile(join(root, id, 'article.json'), JSON.stringify({
      id, status, publication: { approved }, slug: 'story-' + id, title: id,
    }))
  }
  const entries = publishedJournalEntries(pathToFileURL(root + '/'))
  assert.deepEqual(entries.map(entry => entry.id), ['draft-18'])
  const links = storefrontReading(entries)
  assert.deepEqual(links['/cakes/pave-chocolate-cake'], [{ href: '/journal/story-draft-18', label: 'draft-18' }])
  assert.deepEqual(links['/chocolates/chocolate-mochi'], [])
})

test('stories link to relevant live siblings once and never to themselves', () => {
  const entries = ['draft-15', 'draft-18'].map(id => ({ id, title: id, slug: id }))
  const links = journalReading('draft-18', entries).map(link => link.href)
  assert.deepEqual(links, ['/journal/draft-15', '/cakes/pave-chocolate-cake', '/cakes/brownie-cheesecake'])
  assert.deepEqual(journalReading('unmapped', entries), [])
})
