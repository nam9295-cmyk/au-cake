import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { Client as BrowserClient, ExecutionMethod, Functions as BrowserFunctions } from 'appwrite'
import {
  AppwriteException,
  Client,
  Functions,
  Role,
  Runtime,
  Scopes,
} from 'node-appwrite'
import { File } from 'node-fetch-native-with-agent'

const execFileAsync = promisify(execFile)
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

loadDotEnvLocal()

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const functionId = process.env.APPWRITE_RESERVATION_API_FUNCTION_ID || 'reservation-api'
const requestedRuntime = process.env.APPWRITE_RESERVATION_API_RUNTIME || Runtime.Node160
const runtimeCandidates = [...new Set([
  requestedRuntime,
  Runtime.Node200,
  Runtime.Node180,
  Runtime.Node160,
])]

const cakeDatabaseId =
  process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au'
const kidsDatabaseId =
  process.env.APPWRITE_KIDS_DATABASE_ID || process.env.VITE_APPWRITE_KIDS_DATABASE_ID || cakeDatabaseId
const runtimeVariables = {
  MARKET: process.env.MARKET || process.env.VITE_MARKET || 'AU',
  APPWRITE_CAKE_DATABASE_ID: cakeDatabaseId,
  APPWRITE_KIDS_DATABASE_ID: kidsDatabaseId,
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID:
    process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
    'reservations',
  APPWRITE_SETTINGS_TABLE_ID:
    process.env.APPWRITE_SETTINGS_TABLE_ID || process.env.VITE_APPWRITE_SETTINGS_TABLE_ID || 'settings',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID:
    process.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    process.env.VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
    'class_reservations',
  APPWRITE_KIDS_BOOKED_DATES_TABLE_ID:
    process.env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
    process.env.VITE_APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
    'class_booked_dates',
  APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID:
    process.env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
    process.env.VITE_APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
    'cake_pickup_openings',
  CALENDAR_VIEW_PIN: process.env.CALENDAR_VIEW_PIN,
  CALENDAR_TOKEN_SECRET: process.env.CALENDAR_TOKEN_SECRET,
}
const secretVariableKeys = new Set(['CALENDAR_VIEW_PIN', 'CALENDAR_TOKEN_SECRET'])

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  process.exit(1)
}
if (!/^\d{6}$/.test(runtimeVariables.CALENDAR_VIEW_PIN || '') || (runtimeVariables.CALENDAR_TOKEN_SECRET || '').length < 32) {
  console.error('CALENDAR_VIEW_PIN(6자리)과 CALENDAR_TOKEN_SECRET(32자 이상)가 필요합니다.')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const functions = new Functions(client)

try {
  const { previousDeploymentId, runtime } = await ensureFunction()
  console.log(`selected runtime ${runtime}`)
  await ensureVariables()
  try {
    const deployment = await deployFunction()
    await waitForDeployment(deployment.$id)
    await verifyHealth()
  } catch (deploymentError) {
    if (previousDeploymentId) {
      try {
        await functions.updateFunctionDeployment({ functionId, deploymentId: previousDeploymentId })
        console.error(`Health/build failed; restored previous deployment ${previousDeploymentId}.`)
      } catch (rollbackError) {
        console.error(`Automatic deployment rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    throw deploymentError
  }
  console.log('Reservation API deployment and read-only health check complete.')
  console.log('Database collection permissions were not changed.')
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
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function isMissing(error) {
  return error instanceof AppwriteException && error.code === 404
}

async function ensureFunction() {
  let lastError
  for (const runtime of runtimeCandidates) {
    try {
      const previousDeploymentId = await ensureFunctionRuntime(runtime)
      return { previousDeploymentId, runtime }
    } catch (error) {
      lastError = error
      if (!isRuntimeUnsupported(error)) throw error
      console.warn(`runtime ${runtime} is unsupported; trying the next compatible Node runtime`)
    }
  }
  throw lastError
}

async function ensureFunctionRuntime(runtime) {
  const functionConfig = {
    name: 'Reservation API',
    runtime,
    execute: [Role.any()],
    events: [],
    timeout: 20,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
    scopes: [
      Scopes.DatabasesRead,
      Scopes.DatabasesWrite,
      Scopes.DocumentsRead,
      Scopes.DocumentsWrite,
    ],
  }

  try {
    const current = await functions.get({ functionId })
    await functions.update({ functionId, ...functionConfig })
    console.log(`updated function ${functionId} (${runtime})`)
    return current.deploymentId || ''
  } catch (error) {
    if (!isMissing(error)) throw error
    await functions.create({ functionId, ...functionConfig })
    console.log(`created function ${functionId} (${runtime})`)
    return ''
  }
}

function isRuntimeUnsupported(error) {
  return error instanceof AppwriteException && error.type === 'function_runtime_unsupported'
}

async function ensureVariables() {
  const current = await functions.listVariables({ functionId })
  const variablesByKey = new Map(current.variables.map((variable) => [variable.key, variable]))

  for (const [key, value] of Object.entries(runtimeVariables)) {
    const existing = variablesByKey.get(key)
    if (existing) {
      await functions.updateVariable({
        functionId,
        variableId: existing.$id,
        key,
        value,
        secret: secretVariableKeys.has(key),
      })
      console.log(`updated variable ${key}`)
    } else {
      await functions.createVariable({ functionId, key, value, secret: secretVariableKeys.has(key) })
      console.log(`created variable ${key}`)
    }
  }
}

async function deployFunction() {
  const functionDir = resolve(process.cwd(), 'functions/reservation-api')
  const tempDir = await mkdtemp(join(tmpdir(), 'reservation-api-'))
  const archivePath = join(tempDir, 'code.tar.gz')

  try {
    await execFileAsync('tar', ['-czf', archivePath, '-C', functionDir, '.'])
    const archive = await readFile(archivePath)
    const deployment = await functions.createDeployment({
      functionId,
      code: new File([archive], 'code.tar.gz'),
      activate: true,
      entrypoint: 'src/main.js',
      commands: 'npm ci --omit=dev',
    })
    console.log(`created deployment ${deployment.$id}; waiting for build`)
    return deployment
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function waitForDeployment(deploymentId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await functions.getDeployment({ functionId, deploymentId })
    if (deployment.status === 'ready') {
      console.log(`deployment ${deploymentId} is ready`)
      return
    }
    if (deployment.status === 'failed') {
      throw new Error(`Reservation API build failed:\n${deployment.buildLogs || 'No build log was returned.'}`)
    }
    await sleep(2000)
  }
  throw new Error('Reservation API deployment did not become ready within 120 seconds.')
}

async function verifyHealth() {
  const browserClient = new BrowserClient().setEndpoint(endpoint).setProject(projectId)
  const browserFunctions = new BrowserFunctions(browserClient)
  const execution = await browserFunctions.createExecution({
    functionId,
    body: JSON.stringify({ action: 'health' }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  })
  let response
  try {
    response = JSON.parse(execution.responseBody || '{}')
  } catch {
    throw new Error(`Reservation API health check returned invalid JSON (HTTP ${execution.responseStatusCode}).`)
  }
  if (execution.responseStatusCode !== 200 || response.ok !== true || response.result?.database !== 'ok') {
    throw new Error(`Reservation API health check failed (HTTP ${execution.responseStatusCode}).`)
  }
  console.log('read-only health check passed')
}
