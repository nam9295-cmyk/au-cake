import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
const disallowed = [...robots.matchAll(/^Disallow:\s*(\S*)\s*$/gm)].map((match) => match[1])
const noindexOperationalRoutes = [
  '/cart',
  '/reserve',
  '/complete',
  '/lookup',
  '/class-reserve',
  '/class-complete',
  '/calendar',
  '/review',
  '/admin',
  '/admin/login',
  '/admin/reservations',
  '/admin/classes',
  '/admin/reviews',
]

function isDisallowed(pathname) {
  return disallowed.some((rule) => {
    if (!rule) return false
    return pathname === rule || pathname.startsWith(`${rule.replace(/\/$/, '')}/`)
  })
}

test('robots.txt does not block noindex operational routes', () => {
  for (const pathname of noindexOperationalRoutes) {
    assert.equal(isDisallowed(pathname), false, `${pathname} must remain crawlable so crawlers can read noindex`)
  }
})

test('robots.txt is not treated as the admin data protection boundary', () => {
  assert.match(robots, /User-agent:\s*\*/)
  assert.match(robots, /Sitemap:\s*https:\/\/au\.verygood-chocolate\.com\/sitemap\.xml/)
})
