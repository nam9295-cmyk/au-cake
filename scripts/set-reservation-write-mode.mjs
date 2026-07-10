import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AppwriteException,
  Client,
  Databases,
  Permission,
  Role,
} from 'node-appwrite'
import { Client as BrowserClient, ExecutionMethod, Functions as BrowserFunctions } from 'appwrite'

loadDotEnvLocal()

const args = process.argv.slice(2)
const mode = args.find((argument) => !argument.startsWith('--'))
const apply = args.includes('--apply')

if (mode !== 'direct' && mode !== 'function') {
  console.error('사용법: node scripts/set-reservation-write-mode.mjs <direct|function> [--apply]')
  console.error('기본은 dry-run입니다. 실제 변경에는 --apply가 필요합니다.')
  process.exit(1)
}

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const functionId = process.env.APPWRITE_RESERVATION_API_FUNCTION_ID || 'reservation-api'
const cakeDatabaseId =
  process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au'
const kidsDatabaseId =
  process.env.APPWRITE_KIDS_DATABASE_ID || process.env.VITE_APPWRITE_KIDS_DATABASE_ID || cakeDatabaseId
const cakeReservationsId =
  process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
  process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID ||
  'reservations'
const classReservationsId =
  process.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
  process.env.VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
  'class_reservations'
const classBookedDatesId =
  process.env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
  process.env.VITE_APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
  'class_booked_dates'
const adminUserIds = (process.env.APPWRITE_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  process.exit(1)
}
if (adminUserIds.length === 0) {
  console.error('APPWRITE_ADMIN_USER_IDS가 비어 있습니다. 권한 오설정을 막기 위해 중단합니다.')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const databases = new Databases(client)
const adminRoles = adminUserIds.map((id) => Role.user(id))

const adminCrudPermissions = [
  ...adminRoles.map((role) => Permission.create(role)),
  ...adminRoles.map((role) => Permission.read(role)),
  ...adminRoles.map((role) => Permission.update(role)),
  ...adminRoles.map((role) => Permission.delete(role)),
]
const reservationPermissions = mode === 'direct'
  ? [Permission.create(Role.any()), ...adminCrudPermissions.filter((permission) => !permission.startsWith('create'))]
  : adminCrudPermissions
const bookedSlotPermissions = mode === 'direct'
  ? [
      Permission.read(Role.any()),
      Permission.create(Role.any()),
      ...adminCrudPermissions.filter((permission) => permission.startsWith('update') || permission.startsWith('delete')),
    ]
  : [Permission.read(Role.any()), ...adminCrudPermissions]

const targets = [
  { databaseId: cakeDatabaseId, collectionId: cakeReservationsId, permissions: reservationPermissions },
  { databaseId: kidsDatabaseId, collectionId: classReservationsId, permissions: reservationPermissions },
  { databaseId: kidsDatabaseId, collectionId: classBookedDatesId, permissions: bookedSlotPermissions },
]

try {
  console.log(`Reservation write mode: ${mode}`)
  console.log(apply ? 'APPLY mode: collection permissions will be updated.' : 'DRY-RUN: no collection will be changed.')

  const plans = []
  for (const target of targets) {
    const collection = await databases.getCollection({
      databaseId: target.databaseId,
      collectionId: target.collectionId,
    })
    plans.push({ ...target, collection })
    console.log(`\n${target.databaseId}/${target.collectionId}`)
    console.log(`current: ${JSON.stringify(collection.$permissions)}`)
    console.log(`next:    ${JSON.stringify(target.permissions)}`)
  }

  if (!apply) {
    console.log('\n변경하려면 같은 명령 끝에 --apply를 붙이세요.')
    process.exit(0)
  }

  if (mode === 'function') await verifyReservationApiHealth()

  const changedPlans = []
  try {
    for (const plan of plans) {
      changedPlans.push(plan)
      await updateCollectionPermissions(plan, plan.permissions)
      const verified = await databases.getCollection({
        databaseId: plan.databaseId,
        collectionId: plan.collectionId,
      })
      if (!samePermissions(verified.$permissions, plan.permissions)) {
        throw new Error(`권한 검증 실패: ${plan.databaseId}/${plan.collectionId}`)
      }
      console.log(`verified ${plan.databaseId}/${plan.collectionId}`)
    }
  } catch (mutationError) {
    console.error('Permission update failed; attempting to restore every collection already touched.')
    for (const plan of changedPlans.reverse()) {
      try {
        await updateCollectionPermissions(plan, plan.collection.$permissions)
        console.error(`restored ${plan.databaseId}/${plan.collectionId}`)
      } catch (rollbackError) {
        console.error(`restore failed ${plan.databaseId}/${plan.collectionId}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
    }
    throw mutationError
  }

  if (mode === 'function') {
    console.log('\nPublic create permissions are closed. Keep VITE_RESERVATION_API_MODE=all while this mode is active.')
  } else {
    console.log('\nPublic create permissions are restored. This is the rollback-safe direct mode.')
  }
} catch (error) {
  if (error instanceof AppwriteException && error.type === 'general_unauthorized_scope') {
    console.error('Appwrite API key에 databases.read/databases.write 스코프가 필요합니다.')
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

function samePermissions(current = [], expected = []) {
  if (current.length !== expected.length) return false
  const currentSet = new Set(current)
  return expected.every((permission) => currentSet.has(permission))
}

async function updateCollectionPermissions(plan, permissions) {
  await databases.updateCollection({
    databaseId: plan.databaseId,
    collectionId: plan.collectionId,
    name: plan.collection.name,
    permissions,
    documentSecurity: plan.collection.documentSecurity,
    enabled: plan.collection.enabled,
  })
}

async function verifyReservationApiHealth() {
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
    throw new Error(`Reservation API health check failed (HTTP ${execution.responseStatusCode}). Permissions were not changed.`)
  }
  console.log('reservation-api health check passed before permission change')
}
