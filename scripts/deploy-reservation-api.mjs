import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FUNCTION_SCOPES,
  buildDryRunPlan,
  buildHealthFailureDiagnostic,
  buildRuntimeCandidates,
  isReadyReservationRolloutHealth,
  isSecretFunctionVariable,
  redactReservationDeploymentDiagnostic,
  resolveDeployConfig,
} from './reservation-api-deploy-config.mjs'
import {
  createReservationApiArchive,
  runReservationApiRollout,
} from './reservation-api-deploy-rollout.mjs'

if (process.argv.includes('--dry-run')) {
  process.stdout.write(`${JSON.stringify(buildDryRunPlan(process.env), null, 2)}\n`)
  process.exit(0)
}

loadDotEnvLocal()

const [browserSdk, serverSdk, fileSdk] = await Promise.all([
  import('appwrite'),
  import('node-appwrite'),
  import('node-appwrite/file'),
])
const { Client: BrowserClient, ExecutionMethod, Functions: BrowserFunctions } = browserSdk
const { AppwriteException, Client, Functions, Role, Runtime } = serverSdk
const { InputFile } = fileSdk

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const deployConfig = resolveDeployConfig(process.env)
const {
  endpoint,
  projectId,
  apiKey,
  functionId,
  runtime: requestedRuntime,
  runtimeVariables,
} = deployConfig
const runtimeCandidates = buildRuntimeCandidates(requestedRuntime, Runtime)

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const functions = new Functions(client)

try {
  const { previousDeploymentId, runtime } = await ensureFunction()
  console.log(`selected runtime ${runtime}`)
  await ensureVariables()
  const rollout = await runReservationApiRollout({
    previousDeploymentId,
    createDeployment: deployFunction,
    waitForDeployment,
    activateDeployment,
    verifyHealth,
  })
  console.log(`compatibility rollback checkpoint ${rollout.compatibilityDeploymentId}`)
  console.log(`active full writer deployment ${rollout.fullDeploymentId}`)
  console.log('Reservation API two-phase deployment and read-only health checks complete.')
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
    scopes: [...FUNCTION_SCOPES],
    ...(deployConfig.customCakeFunctionOptions || {}),
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
        secret: isSecretFunctionVariable(key),
      })
      console.log(`updated variable ${key}`)
    } else {
      await functions.createVariable({ functionId, key, value, secret: isSecretFunctionVariable(key) })
      console.log(`created variable ${key}`)
    }
  }
}

async function deployFunction(phase) {
  const artifact = await createReservationApiArchive({ phase })
  try {
    const deployment = await functions.createDeployment({
      functionId,
      code: InputFile.fromBuffer(artifact.archive, 'code.tar.gz'),
      activate: false,
      entrypoint: 'src/main.js',
      commands: 'npm ci --omit=dev',
    })
    console.log(`created ${phase} deployment ${deployment.$id}; waiting for build`)
    return deployment
  } finally {
    await artifact.cleanup()
  }
}

async function activateDeployment(deploymentId) {
  await functions.updateFunctionDeployment({ functionId, deploymentId })
  console.log(`activated deployment ${deploymentId}`)
}

async function waitForDeployment(deploymentId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await functions.getDeployment({ functionId, deploymentId })
    if (deployment.status === 'ready') {
      console.log(`deployment ${deploymentId} is ready`)
      return
    }
    if (deployment.status === 'failed') {
      throw new Error(`Reservation API build failed:\n${redactReservationDeploymentDiagnostic(
        deployment.buildLogs || 'No build log was returned.',
        [apiKey, ...Object.entries(runtimeVariables).filter(([key]) => isSecretFunctionVariable(key)).map(([, value]) => value)],
      )}`)
    }
    await sleep(2000)
  }
  throw new Error('Reservation API deployment did not become ready within 120 seconds.')
}

async function verifyHealth(phase) {
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
  if (!isReadyReservationRolloutHealth(execution.responseStatusCode, response, phase)) {
    const secrets = [
      apiKey,
      ...Object.entries(runtimeVariables)
        .filter(([key]) => isSecretFunctionVariable(key))
        .map(([, value]) => value),
    ]
    throw new Error(`Reservation API health check failed:\n${buildHealthFailureDiagnostic(execution, secrets)}`)
  }
  console.log(`${phase} read-only health check passed`)
}
