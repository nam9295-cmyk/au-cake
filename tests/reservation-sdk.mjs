import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// SDK exceptions use instanceof in the production action layer. Resolve from
// that function package, including its ESM export (the CJS class also differs).
// This works with both isolated function installs and root-only test installs.
export async function loadReservationSdk(packageUrl = new URL('../appwrite-functions/reservation-api/package.json', import.meta.url)) {
  const entry = createRequire(packageUrl).resolve('node-appwrite')
  const manifestUrl = new URL('../package.json', pathToFileURL(entry))
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'))
  return import(new URL(manifest.exports['.'].import.default, manifestUrl).href)
}
export const { AppwriteException, Query } = await loadReservationSdk()
