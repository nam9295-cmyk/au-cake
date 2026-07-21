import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  ManualCouponConfigError,
  buildManualCouponDocument,
  buildManualCouponDryRunPlan,
  hashManualCouponCode,
  maskIdentifier,
  resolveManualCouponApplyConfig,
} from './manual-coupon-config.mjs'

function parseArguments(args) {
  if (args.length === 0) return { apply: false }
  if (args.length === 1 && args[0] === '--apply') return { apply: true }
  throw new ManualCouponConfigError('Use no arguments for dry-run, or use only --apply to issue the coupon.')
}

export async function runManualCouponCli({
  args = [],
  writeLine = (line) => process.stdout.write(line),
  apply = () => executeManualCouponApply(),
} = {}) {
  const parsed = parseArguments(args)
  if (!parsed.apply) {
    writeLine(`${JSON.stringify(buildManualCouponDryRunPlan(), null, 2)}\n`)
    return 0
  }

  const result = await apply()
  writeLine(`${JSON.stringify(result, null, 2)}\n`)
  return 0
}

function validGeneratedDocumentId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(value)
}

function duplicateResult(config, existing) {
  return {
    status: 'duplicate',
    codeLast4: config.code.slice(-4),
    couponId: maskIdentifier(existing?.$id || existing?.id),
  }
}

export async function issueManualCoupon({
  config,
  repository,
  now = new Date(),
  makeId = randomUUID,
}) {
  const codeHash = hashManualCouponCode(config.code, config.hmacSecret)
  const existing = await repository.findByCodeHash(codeHash)
  if (existing) return duplicateResult(config, existing)

  const documentId = makeId()
  if (!validGeneratedDocumentId(documentId)) {
    throw new ManualCouponConfigError('Generated manual coupon identifier was invalid.')
  }
  const data = buildManualCouponDocument({ config, now })

  let created
  try {
    created = await repository.create({ documentId, data })
  } catch (error) {
    if (!repository.isConflict?.(error)) throw error
    const racedDuplicate = await repository.findByCodeHash(codeHash)
    if (!racedDuplicate) throw error
    return duplicateResult(config, racedDuplicate)
  }

  return {
    status: 'created',
    codeLast4: data.codeLast4,
    couponId: maskIdentifier(created?.$id || created?.id || documentId),
  }
}

function loadDotEnvLocal(targetEnv = process.env) {
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
    if (!(key in targetEnv)) targetEnv[key] = value
  }
}

export async function executeManualCouponApply({
  env = process.env,
  loadDotEnv = loadDotEnvLocal,
  loadSdk = () => import('node-appwrite'),
  now = () => new Date(),
  makeId = randomUUID,
} = {}) {
  loadDotEnv(env)
  const config = resolveManualCouponApplyConfig(env)

  const { Client, Databases, Query } = await loadSdk()
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey)
  const databases = new Databases(client)
  const repository = {
    async findByCodeHash(codeHash) {
      const result = await databases.listDocuments({
        databaseId: config.databaseId,
        collectionId: config.collectionId,
        queries: [Query.equal('codeHash', codeHash), Query.limit(2)],
        total: false,
      })
      return Array.isArray(result?.documents) && result.documents.length > 0
        ? result.documents[0]
        : null
    },
    create({ documentId, data }) {
      return databases.createDocument({
        databaseId: config.databaseId,
        collectionId: config.collectionId,
        documentId,
        data,
      })
    },
    isConflict(error) {
      return error?.code === 409 || /unique|duplicate|already exists/i.test(String(error?.message || ''))
    },
  }

  return issueManualCoupon({ config, repository, now: now(), makeId })
}

function safeCliErrorMessage(error) {
  if (error instanceof ManualCouponConfigError) return error.message
  return 'Manual coupon issuance failed safely. No raw coupon value was logged.'
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  runManualCouponCli({ args: process.argv.slice(2) }).catch((error) => {
    process.stderr.write(`${safeCliErrorMessage(error)}\n`)
    process.exitCode = 1
  })
}
