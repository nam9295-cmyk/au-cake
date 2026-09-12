import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

test('unknown URLs keep the hard 404 page without a global SPA rewrite', () => {
  const html = readFileSync(join(repoRoot, 'public/404.html'), 'utf8')
  assert.match(html, /Page not found/)
  assert.match(html, /<meta name="robots" content="noindex, follow"/)
  assert.doesNotMatch(html, /<script[^>]+src=/)
  const redirectsPath = join(repoRoot, 'public/_redirects')
  const redirects = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : ''
  assert.doesNotMatch(redirects, /^\s*\/\*\s+\/index\.html\s+200\s*$/m)
})

test('keeps Appwrite function sources outside the Cloudflare Pages reserved functions directory', () => {
  assert.equal(
    existsSync(join(repoRoot, 'functions')),
    false,
    'root functions/ is reserved by Cloudflare Pages and must not contain Appwrite sources',
  )
  assert.equal(existsSync(join(repoRoot, 'appwrite-functions/reservation-api/src/main.js')), true)
  assert.equal(existsSync(join(repoRoot, 'appwrite-functions/reservation-notification/src/main.js')), true)
})
