import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { AppwriteException, Client, Functions, Runtime } from 'node-appwrite'
import { File } from 'node-fetch-native-with-agent'

const execFileAsync = promisify(execFile)

loadDotEnvLocal()

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const databaseId =
  process.env.APPWRITE_CAKE_DATABASE_ID ||
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_CAKE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  'verygood_cake'
const reservationsId =
  process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
  process.env.APPWRITE_RESERVATIONS_TABLE_ID ||
  process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
  process.env.VITE_APPWRITE_RESERVATIONS_TABLE_ID ||
  'reservations'

const functionId = process.env.APPWRITE_RESERVATION_NOTIFY_FUNCTION_ID || 'reservation-notification'
const functionRuntimes = process.env.APPWRITE_RESERVATION_NOTIFY_RUNTIME
  ? [process.env.APPWRITE_RESERVATION_NOTIFY_RUNTIME]
  : [Runtime.Node160]
const reservationCreateEvents = process.env.APPWRITE_RESERVATION_CREATE_EVENT
  ? [process.env.APPWRITE_RESERVATION_CREATE_EVENT]
  : [
      `tablesdb.${databaseId}.tables.${reservationsId}.rows.*.create`,
      `databases.${databaseId}.collections.${reservationsId}.documents.*.create`,
    ]

const requiredRuntimeVariables = {
  MARKET: process.env.MARKET || process.env.VITE_MARKET || 'AU',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_TO_EMAILS: process.env.RESEND_TO_EMAILS,
}

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

for (const [key, value] of Object.entries(requiredRuntimeVariables)) {
  if (!value) {
    console.error(`${key} 환경변수가 필요합니다.`)
    process.exit(1)
  }
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const functions = new Functions(client)

try {
  await ensureFunction()
  await ensureVariables()
  await deployFunction()
  console.log('Reservation notification function deployment complete')
} catch (error) {
  if (error instanceof AppwriteException && error.type === 'general_unauthorized_scope') {
    console.error('Appwrite API key에 functions.read/functions.write 스코프가 필요합니다.')
  }
  throw error
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function isMissing(error) {
  return error instanceof AppwriteException && error.code === 404
}

async function ensureFunction() {
  const baseConfig = {
    name: 'Reservation Notification',
    execute: [],
    timeout: 15,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: '',
  }

  let lastError
  for (const runtime of functionRuntimes) {
    for (const event of reservationCreateEvents) {
      const config = { ...baseConfig, runtime, events: [event] }
      try {
        await functions.get({ functionId })
        await functions.update({ functionId, ...config })
        console.log(`updated function ${functionId} with runtime ${runtime} and event ${event}`)
        return
      } catch (error) {
        if (isMissing(error)) {
          try {
            await functions.create({ functionId, ...config })
            console.log(`created function ${functionId} with runtime ${runtime} and event ${event}`)
            return
          } catch (createError) {
            lastError = createError
          }
        } else {
          lastError = error
        }

        if (!isRetryableFunctionConfigError(lastError)) {
          throw lastError
        }
      }
    }
  }

  throw lastError
}

function isRetryableFunctionConfigError(error) {
  return (
    error instanceof AppwriteException &&
    (error.type === 'general_argument_invalid' || error.type === 'function_runtime_unsupported')
  )
}

async function ensureVariables() {
  const current = await functions.listVariables({ functionId })
  const variablesByKey = new Map(current.variables.map((variable) => [variable.key, variable]))

  for (const [key, value] of Object.entries(requiredRuntimeVariables)) {
    const existing = variablesByKey.get(key)
    const secret = key === 'RESEND_API_KEY'

    if (existing) {
      await functions.updateVariable({
        functionId,
        variableId: existing.$id,
        key,
        value,
        secret,
      })
      console.log(`updated variable ${key}`)
    } else {
      await functions.createVariable({
        functionId,
        key,
        value,
        secret,
      })
      console.log(`created variable ${key}`)
    }
  }
}

async function deployFunction() {
  const functionDir = resolve(process.cwd(), 'functions/reservation-notification')
  const tempDir = await mkdtemp(join(tmpdir(), 'reservation-notification-'))
  const archivePath = join(tempDir, 'code.tar.gz')

  try {
    await execFileAsync('tar', ['-czf', archivePath, '-C', functionDir, '.'])
    const archive = await readFile(archivePath)
    const deployment = await functions.createDeployment({
      functionId,
      code: new File([archive], 'code.tar.gz'),
      activate: true,
      entrypoint: 'src/main.js',
      commands: '',
    })
    console.log(`created deployment ${deployment.$id}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
