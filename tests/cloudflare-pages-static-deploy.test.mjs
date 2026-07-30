import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

test('keeps Appwrite function sources outside the Cloudflare Pages reserved functions directory', () => {
  assert.equal(
    existsSync(join(repoRoot, 'functions')),
    false,
    'root functions/ is reserved by Cloudflare Pages and must not contain Appwrite sources',
  )
  assert.equal(existsSync(join(repoRoot, 'appwrite-functions/reservation-api/src/main.js')), true)
  assert.equal(existsSync(join(repoRoot, 'appwrite-functions/reservation-notification/src/main.js')), true)
})
