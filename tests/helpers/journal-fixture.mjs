import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

export async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'au-journal-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const inputDirectory = join(root, 'input')
  await mkdir(join(inputDirectory, 'photos'), { recursive: true })
  await sharp({ create: { width: 900, height: 600, channels: 3, background: '#1f5a46' } }).jpeg().toFile(join(inputDirectory, 'photos', 'Sample Photo.JPG'))
  const entry = {
    id: 'sample-story', slug: 'sample-story', title: 'Sample story', seoTitle: 'Sample story | verygood',
    excerpt: 'A synthetic article used only for automated package contract testing.', locale: 'en-AU',
    status: 'draft', cover: { src: 'photos/Sample%20Photo.JPG', alt: 'Synthetic green test image' },
    source: { tool: 'fixture', version: 'test' }, ...overrides,
  }
  await writeFile(join(inputDirectory, 'article.json'), JSON.stringify(entry))
  await writeFile(join(inputDirectory, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Sample story</h1><img src="photos/Sample%20Photo.JPG" alt="Synthetic green test image"><p>Actual readable text.</p><a href="https://example.com/source">Source</a></body></html>')
  await writeFile(join(inputDirectory, 'style.css'), ':root { --ink: #123; } body { color: var(--ink); } h1, p { margin: 1em; } @media(max-width:600px) { .columns { display:block } } @keyframes appear { from {opacity:0} to {opacity:1} } p {animation: appear 1s} .photo {background: url("photos/Sample%20Photo.JPG")}')
  return { root, inputDirectory, workspace: join(root, 'workspace'), entry }
}
