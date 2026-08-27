import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildDryRunPlan, buildFunctionPayload, isSecretFunctionVariable, maskValue, resolveDeployConfig } from './booking-reminder-deploy-config.mjs'

if (process.argv.slice(2).includes('--dry-run')) {
  console.log(JSON.stringify(buildDryRunPlan(process.env), null, 2))
  process.exit(0)
}

loadDotEnvLocal()
const config = resolveDeployConfig(process.env)
const { AppwriteException, Client, Functions } = await import('node-appwrite')
const { File } = await import('node-fetch-native-with-agent')
const { createBookingReminderArchive } = await import('./booking-reminder-deploy-runtime.mjs')
const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey)
const functions = new Functions(client)

try {
  await ensureFunction()
  await ensureVariables()
  const deployment = await deployFunction()
  await waitForDeployment(deployment.$id)
  console.log('Booking reminder function deployment complete')
} catch (deploymentError) {
  if (deploymentError instanceof AppwriteException && deploymentError.type === 'general_unauthorized_scope') {
    console.error('The operator API key requires functions.read and functions.write scopes.')
  }
  throw deploymentError
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

async function ensureFunction() {
  const payload = buildFunctionPayload(config.runtime)
  try {
    await functions.get({ functionId: config.functionId })
    await functions.update({ functionId: config.functionId, ...payload })
    console.log(`updated function ${maskValue(config.functionId)}`)
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 404) throw error
    await functions.create({ functionId: config.functionId, ...payload })
    console.log(`created function ${maskValue(config.functionId)}`)
  }
}

async function ensureVariables() {
  const current = await functions.listVariables({ functionId: config.functionId })
  const variablesByKey = new Map(current.variables.map((variable) => [variable.key, variable]))
  for (const [key, value] of Object.entries(config.runtimeVariables)) {
    const existing = variablesByKey.get(key)
    if (existing) await functions.updateVariable({ functionId: config.functionId, variableId: existing.$id, key, value, secret: isSecretFunctionVariable(key) })
    else await functions.createVariable({ functionId: config.functionId, key, value, secret: isSecretFunctionVariable(key) })
    console.log(`${existing ? 'updated' : 'created'} variable ${key}`)
  }
}

async function deployFunction() {
  const archive = await createBookingReminderArchive({ repositoryRoot: process.cwd() })
  try {
    const deployment = await functions.createDeployment({
      functionId: config.functionId, code: new File([archive.archive], 'code.tar.gz'), activate: true,
      entrypoint: 'src/main.js', commands: 'npm ci --omit=dev',
    })
    console.log(`created deployment ${maskValue(deployment.$id)}; waiting for build`)
    return deployment
  } finally {
    await archive.cleanup()
  }
}

async function waitForDeployment(deploymentId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await functions.getDeployment({ functionId: config.functionId, deploymentId })
    if (deployment.status === 'ready') return
    if (deployment.status === 'failed') throw new Error('Booking reminder build failed. Check the Appwrite Function build logs.')
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 2000))
  }
  throw new Error('Booking reminder deployment did not become ready within 120 seconds.')
}
