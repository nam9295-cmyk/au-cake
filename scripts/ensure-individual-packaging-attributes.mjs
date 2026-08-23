import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AppwriteException, Client, Databases } from 'node-appwrite'

export const INDIVIDUAL_PACKAGING_ATTRIBUTES = Object.freeze([
  Object.freeze({ key: 'individualPackagingPieces', type: 'integer', required: false, min: 0 }),
  Object.freeze({ key: 'individualPackagingFeeCents', type: 'integer', required: false, min: 0 }),
])

const sleepFor = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

function hasCode(error, code) {
  return error instanceof AppwriteException ? error.code === code : error?.code === code
}

function assertCompatible(expected, actual) {
  if (actual?.key !== expected.key || actual?.type !== expected.type || actual?.required !== expected.required || Number(actual?.min) !== expected.min) {
    throw new Error(`Existing ${expected.key} attribute is incompatible; no changes were made.`)
  }
}

async function waitForAvailability({ databases, databaseId, collectionId, definition, sleep, maxAttempts }) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attribute = await databases.getAttribute({ databaseId, collectionId, key: definition.key })
    assertCompatible(definition, attribute)
    if (attribute.status === 'available') return attribute
    if (attribute.status === 'failed' || attribute.status === 'stuck') throw new Error(`${definition.key} attribute is ${attribute.status}`)
    if (attempt < maxAttempts - 1) await sleep()
  }
  throw new Error(`${definition.key} attribute did not become available in time`)
}

async function ensureAttribute({ databases, databaseId, collectionId, definition, sleep, maxAttempts }) {
  let existing
  try {
    existing = await databases.getAttribute({ databaseId, collectionId, key: definition.key })
  } catch (error) {
    if (!hasCode(error, 404)) throw error
  }

  if (existing) {
    const attribute = existing.status === 'available'
      ? existing
      : await waitForAvailability({ databases, databaseId, collectionId, definition, sleep, maxAttempts })
    assertCompatible(definition, attribute)
    return { key: definition.key, created: false, attribute }
  }

  let created = false
  try {
    await databases.createIntegerAttribute({
      databaseId,
      collectionId,
      key: definition.key,
      required: definition.required,
      min: definition.min,
    })
    created = true
  } catch (error) {
    if (!hasCode(error, 409)) throw error
  }

  const attribute = await waitForAvailability({ databases, databaseId, collectionId, definition, sleep, maxAttempts })
  return { key: definition.key, created, attribute }
}

export async function ensureIndividualPackagingAttributes({ databases, databaseId, collectionId, sleep = () => sleepFor(1000), maxAttempts = 60 }) {
  const results = []
  for (const definition of INDIVIDUAL_PACKAGING_ATTRIBUTES) {
    results.push(await ensureAttribute({ databases, databaseId, collectionId, definition, sleep, maxAttempts }))
  }
  return results
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ mode: 'dry-run', network: false, action: 'ensure optional reservations packaging integer attributes' }))
    return
  }
  loadDotEnvLocal()
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY
  const databaseId = process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake'
  const collectionId = process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations'
  if (!endpoint || !projectId || !apiKey) throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are required.')

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  const results = await ensureIndividualPackagingAttributes({ databases: new Databases(client), databaseId, collectionId })
  for (const result of results) console.log(`${result.key} attribute ${result.created ? 'created' : 'already exists'} and is available`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
