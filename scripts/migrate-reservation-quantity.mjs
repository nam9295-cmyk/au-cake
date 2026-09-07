import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'

// Technical signed-32-bit ceiling, NOT a product/business quantity limit.
// Appwrite 1.8.1 keeps the previous bound when PATCH max is null.
export const QUANTITY_TECHNICAL_MAX = 2147483647
const DEFAULT_WAIT_ATTEMPTS = 30
const DEFAULT_WAIT_MS = 1000
const expected = { key: 'quantity', type: 'integer', required: false, array: false, min: 1, default: null, status: 'available', error: '' }
const fields = [...Object.keys(expected), 'max']
const view = (attribute) => Object.fromEntries(fields.map(key => [key, attribute[key]]))

export function planQuantityMigration(attribute, version) {
  if (version !== '1.8.1') throw new Error('Unsupported server version; re-audit implementation before proceeding')
  for (const [key, value] of Object.entries(expected)) {
    if (attribute?.[key] !== value) throw new Error(`Unexpected quantity schema field: ${key}`)
  }
  if (![5, QUANTITY_TECHNICAL_MAX].includes(attribute.max)) throw new Error('Unexpected quantity max')
  return {
    action: attribute.max === QUANTITY_TECHNICAL_MAX ? 'noop' : 'update',
    before: view(attribute),
    patch: { required: false, min: 1, max: QUANTITY_TECHNICAL_MAX, default: null },
  }
}

export function parseArgs(args) {
  const result = { apply: false }
  const seen = new Set()
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (seen.has(flag)) throw new Error('Duplicate flag')
    seen.add(flag)
    if (flag === '--apply') result.apply = true
    else if (flag === '--dry-run') { /* default */ }
    else if (flag === '--env-file' && args[i + 1] && !args[i + 1].startsWith('--')) result.envFile = args[++i]
    else throw new Error('Unknown or incomplete flag')
  }
  if (seen.has('--apply') && seen.has('--dry-run')) throw new Error('Conflicting flags')
  return result
}

async function waitForTargetQuantity(getter, version, {
  attempts = DEFAULT_WAIT_ATTEMPTS,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!Number.isSafeInteger(attempts) || attempts < 1 || typeof sleep !== 'function') {
    throw new Error('Invalid quantity postcheck polling configuration')
  }
  let lastStatus = 'unknown'
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let current
    try {
      current = await getter()
    } catch (error) {
      throw new Error(`Quantity PATCH accepted; postcheck request failed (${error.message})`)
    }
    lastStatus = typeof current?.status === 'string' ? current.status : 'unknown'
    if (lastStatus === 'available') {
      try {
        if (planQuantityMigration(current, version).action !== 'noop') throw new Error('target max not observed')
      } catch (error) {
        throw new Error(`Quantity PATCH accepted; postcheck schema drift (${error.message})`)
      }
      return current
    }
    if (lastStatus === 'failed' || lastStatus === 'stuck') {
      throw new Error(`Quantity PATCH accepted; attribute update failed (last status: ${lastStatus})`)
    }
    if (lastStatus !== 'processing') {
      throw new Error(`Quantity PATCH accepted; unexpected postcheck status: ${lastStatus}`)
    }
    if (attempt + 1 < attempts) await sleep(DEFAULT_WAIT_MS)
  }
  throw new Error(`Quantity PATCH accepted; postcheck timeout (last status: ${lastStatus})`)
}

export async function runMigration({ env, apply = false, fetchImpl = fetch, waitOptions }) {
  const keys = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_CAKE_DATABASE_ID', 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID']
  for (const key of keys) {
    if (!env[key] || env[key] !== env[`VITE_${key}`]) throw new Error(`Missing or mismatched mapping: ${key}`)
  }
  if (env.VITE_MARKET !== 'AU' || !env.APPWRITE_API_KEY) throw new Error('AU market and private API key required')
  let endpoint
  try { endpoint = new URL(env.APPWRITE_ENDPOINT) } catch { throw new Error('Invalid endpoint') }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/^\/v1\/?$/.test(endpoint.pathname)) throw new Error('Unsafe endpoint')
  if (typeof apply !== 'boolean') throw new Error('Explicit boolean apply required')
  const base = endpoint.href.replace(/\/$/, '')
  const root = `/databases/${encodeURIComponent(env.APPWRITE_CAKE_DATABASE_ID)}/collections/${encodeURIComponent(env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID)}/attributes`
  const request = async (path, method = 'GET', body, authenticated = true) => {
    const headers = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    if (authenticated) { headers['X-Appwrite-Project'] = env.APPWRITE_PROJECT_ID; headers['X-Appwrite-Key'] = env.APPWRITE_API_KEY }
    if (body) headers['Content-Type'] = 'application/json'
    let response
    try {
      response = await fetchImpl(base + path, { method, headers, redirect: 'error', signal: AbortSignal.timeout(30000), ...(body ? { body: JSON.stringify(body) } : {}) })
    } catch { throw new Error('Request failed (details redacted); inspect quantity read-only before retrying') }
    if (!response.ok) throw new Error(`HTTP ${response.status}; no automatic mutation retry`)
    try { return await response.json() } catch { throw new Error('Invalid JSON response') }
  }
  // Public version GET avoids requiring health.read on the schema-scoped key.
  const { version } = await request('/health/version', 'GET', undefined, false)
  const before = await request(`${root}/quantity`)
  const plan = planQuantityMigration(before, version)
  const result = { mode: apply ? 'apply' : 'dry-run', version, mappingVerified: true, ...plan }
  if (!apply || plan.action === 'noop') return result
  // Narrow race window; Appwrite has no schema CAS. Coordinate a maintenance window.
  const recheck = await request(`${root}/quantity`)
  const latest = planQuantityMigration(recheck, version)
  if (latest.action === 'noop') return { ...result, action: 'noop', after: view(recheck) }
  await request(`${root}/integer/quantity`, 'PATCH', plan.patch)
  const after = await waitForTargetQuantity(() => request(`${root}/quantity`), version, waitOptions)
  return { ...result, action: 'updated', after: view(after) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { envFile, apply } = parseArgs(process.argv.slice(2))
    // Explicit private file only; never source shell, copy credentials, or change process.env.
    const env = envFile ? parseEnv(readFileSync(envFile, 'utf8')) : { ...process.env }
    console.log(JSON.stringify(await runMigration({ env, apply }), null, 2))
  } catch (error) {
    // File/network errors may contain private paths or URL identifiers.
    console.error(error.code ? 'Migration stopped: local configuration could not be read' : error.message)
    process.exitCode = 1
  }
}
