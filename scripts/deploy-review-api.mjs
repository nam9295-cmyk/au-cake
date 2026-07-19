import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCreateFunctionPayload,
  buildDryRunPlan,
  buildRuntimeCandidates,
  buildUpdateFunctionPayload,
  evaluateDeploymentStatus,
  isSecretFunctionVariable,
  maskValue,
  resolveDeployConfig,
} from './review-api-deploy-config.mjs'
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

if (process.argv.slice(2).includes('--dry-run')) {
  console.log(JSON.stringify(buildDryRunPlan(process.env), null, 2))
  process.exit(0)
}

loadDotEnvLocal()
const config = resolveDeployConfig(process.env)
const {
  AppwriteException,
  Client,
  Functions,
  Role,
  Runtime,
} = await import('node-appwrite')
const { createAndUploadArchive } = await import('./review-api-deploy-runtime.mjs')

const runtimeCandidates = buildRuntimeCandidates(config.runtime, Runtime)
const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey)
const functions = new Functions(client)

try {
  const runtime = await ensureFunction()
  console.log(`selected runtime ${runtime}`)
  await ensureVariables()
  const deployment = await deployFunction()
  await waitForDeployment(deployment.$id)
  console.log('Review API deployment is ready.')
  console.log('Database collection permissions were not changed.')
} catch (error) {
  if (error instanceof AppwriteException && error.type === 'general_unauthorized_scope') {
    console.error('The operator API key requires functions.read and functions.write scopes.')
  }
  throw error
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
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function isMissing(error) {
  return error instanceof AppwriteException && error.code === 404
}

function isRuntimeUnsupported(error) {
  return error instanceof AppwriteException && error.type === 'function_runtime_unsupported'
}

async function ensureFunction() {
  let lastError
  for (const runtime of runtimeCandidates) {
    try {
      await ensureFunctionRuntime(runtime)
      return runtime
    } catch (error) {
      lastError = error
      if (!isRuntimeUnsupported(error)) throw error
      console.warn(`runtime ${runtime} is unsupported; trying the next compatible Node runtime`)
    }
  }
  throw lastError
}

async function ensureFunctionRuntime(runtime) {
  try {
    const existing = await functions.get({ functionId: config.functionId })
    const functionConfig = buildUpdateFunctionPayload(existing, runtime, Role.any())
    await functions.update({ functionId: config.functionId, ...functionConfig })
    console.log(`updated function ${maskValue(config.functionId)} (${runtime})`)
  } catch (error) {
    if (!isMissing(error)) throw error
    const functionConfig = buildCreateFunctionPayload(runtime, Role.any())
    await functions.create({ functionId: config.functionId, ...functionConfig })
    console.log(`created function ${maskValue(config.functionId)} (${runtime})`)
  }
}

async function ensureVariables() {
  const current = await functions.listVariables({ functionId: config.functionId })
  const variablesByKey = new Map(current.variables.map((variable) => [variable.key, variable]))

  for (const [key, value] of Object.entries(config.runtimeVariables)) {
    const existing = variablesByKey.get(key)
    if (existing) {
      await functions.updateVariable({
        functionId: config.functionId,
        variableId: existing.$id,
        key,
        value,
        secret: isSecretFunctionVariable(key),
      })
      console.log(`updated variable ${key}`)
    } else {
      await functions.createVariable({
        functionId: config.functionId,
        key,
        value,
        secret: isSecretFunctionVariable(key),
      })
      console.log(`created variable ${key}`)
    }
  }
}

async function deployFunction() {
  const functionDir = resolve(process.cwd(), 'functions/review-api')
  const deployment = await createAndUploadArchive({ functionDir, functionId: config.functionId }, {
    upload: (payload) => functions.createDeployment(payload),
  })
  console.log(`created deployment ${maskValue(deployment.$id)}; waiting for build`)
  return deployment
}

async function waitForDeployment(deploymentId) {
  const maxAttempts = 60
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const deployment = await functions.getDeployment({
      functionId: config.functionId,
      deploymentId,
    })
    const sensitiveValues = [
      config.apiKey,
      config.endpoint,
      config.projectId,
      ...Object.values(config.runtimeVariables),
      ...config.adminUserIds,
    ]
    const status = evaluateDeploymentStatus(deployment, attempt, maxAttempts, sensitiveValues)
    if (status === 'ready') {
      console.log(`deployment ${maskValue(deploymentId)} is ready`)
      return
    }
    await sleep(2000)
  }
}
