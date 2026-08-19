import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AppwriteException, Client, Databases } from 'node-appwrite'

export const CUPCAKE_FINISH_ATTRIBUTE = Object.freeze({
  key: 'cupcakeFinish',
  type: 'string',
  size: 40,
  required: false,
})

const sleepFor = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

function isMissing(error) {
  return error instanceof AppwriteException ? error.code === 404 : error?.code === 404
}

function isConflict(error) {
  return error instanceof AppwriteException ? error.code === 409 : error?.code === 409
}

function assertCompatible(attribute) {
  if (
    attribute?.key !== CUPCAKE_FINISH_ATTRIBUTE.key ||
    attribute?.type !== CUPCAKE_FINISH_ATTRIBUTE.type ||
    attribute?.size !== CUPCAKE_FINISH_ATTRIBUTE.size ||
    attribute?.required !== CUPCAKE_FINISH_ATTRIBUTE.required
  ) {
    throw new Error('Existing cupcakeFinish attribute is incompatible; no changes were made.')
  }
}

async function waitForAvailability({ databases, databaseId, collectionId, sleep, maxAttempts }) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attribute = await databases.getAttribute({
      databaseId,
      collectionId,
      key: CUPCAKE_FINISH_ATTRIBUTE.key,
    })
    assertCompatible(attribute)
    if (attribute.status === 'available') return attribute
    if (attribute.status === 'failed' || attribute.status === 'stuck') {
      throw new Error(`cupcakeFinish attribute is ${attribute.status}`)
    }
    if (attempt < maxAttempts - 1) await sleep()
  }
  throw new Error('cupcakeFinish attribute did not become available in time')
}

export async function ensureCupcakeFinishAttribute({
  databases,
  databaseId,
  collectionId,
  sleep = () => sleepFor(1000),
  maxAttempts = 60,
}) {
  let existing
  try {
    existing = await databases.getAttribute({
      databaseId,
      collectionId,
      key: CUPCAKE_FINISH_ATTRIBUTE.key,
    })
  } catch (error) {
    if (!isMissing(error)) throw error
  }

  if (existing) {
    assertCompatible(existing)
    const attribute = existing.status === 'available'
      ? existing
      : await waitForAvailability({ databases, databaseId, collectionId, sleep, maxAttempts })
    return { created: false, attribute }
  }

  let created = false
  try {
    await databases.createStringAttribute({
      databaseId,
      collectionId,
      key: CUPCAKE_FINISH_ATTRIBUTE.key,
      size: CUPCAKE_FINISH_ATTRIBUTE.size,
      required: CUPCAKE_FINISH_ATTRIBUTE.required,
    })
    created = true
  } catch (error) {
    if (!isConflict(error)) throw error
  }

  const attribute = await waitForAvailability({ databases, databaseId, collectionId, sleep, maxAttempts })
  return { created, attribute }
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
    console.log(JSON.stringify({
      mode: 'dry-run',
      network: false,
      action: 'ensure optional reservations.cupcakeFinish string attribute (size 40)',
    }))
    return
  }

  loadDotEnvLocal()
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY
  const databaseId = process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake'
  const collectionId = process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations'

  if (!endpoint || !projectId || !apiKey) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are required.')
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  const result = await ensureCupcakeFinishAttribute({
    databases: new Databases(client),
    databaseId,
    collectionId,
  })
  console.log(`cupcakeFinish attribute ${result.created ? 'created' : 'already exists'} and is available`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
