import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('mobile HOGIRL uses a stacked soft page turn instead of a scrolling strip', async () => {
  const css = await readFile(join(root, 'public/hogirl.css'), 'utf8')
  const source = await readFile(join(root, 'src/stories/hogirl/HogirlReader.tsx'), 'utf8')
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /touch-action:\s*pan-y/)
  assert.match(css, /perspective:\s*\d+px/)
  assert.match(css, /\.hogirl-panel--active/)
  assert.match(css, /transform-origin:/)
  assert.doesNotMatch(css, /scroll-snap-type:\s*x mandatory/)
  assert.match(source, /onPointerDown=/)
  assert.match(source, /onPointerMove=/)
  assert.match(source, /onPointerUp=/)
  assert.match(source, /TURN_DURATION_MS/)
})

test('soft page turn has a reduced-motion fallback', async () => {
  const css = await readFile(join(root, 'public/hogirl.css'), 'utf8')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /transition-duration:\s*0\.01ms/)
})

test('soft page turn adds paper edge light, fold shadow, and slower settling', async () => {
  const css = await readFile(join(root, 'public/hogirl.css'), 'utf8')
  const source = await readFile(join(root, 'src/stories/hogirl/HogirlReader.tsx'), 'utf8')
  assert.match(css, /\.hogirl-panel--active figure::before/)
  assert.match(css, /linear-gradient\([^\n]+rgba\(255, 255, 255/)
  assert.match(css, /box-shadow:/)
  assert.match(css, /filter:\s*brightness\(/)
  assert.match(css, /480ms cubic-bezier/)
  assert.match(source, /const TURN_DURATION_MS = 480/)
})
