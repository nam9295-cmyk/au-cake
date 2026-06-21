import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AppwriteException,
  Client,
  Databases,
  ID,
  Permission,
  Role,
} from 'node-appwrite'

loadDotEnvLocal()

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || 'verygood_cake'
const reservationsId =
  process.env.APPWRITE_RESERVATIONS_TABLE_ID || process.env.VITE_APPWRITE_RESERVATIONS_TABLE_ID || 'reservations'
const settingsId = process.env.APPWRITE_SETTINGS_TABLE_ID || process.env.VITE_APPWRITE_SETTINGS_TABLE_ID || 'settings'
const market = String(process.env.VITE_MARKET || process.env.MARKET || 'KR').toUpperCase() === 'AU' ? 'AU' : 'KR'
const adminUserIds = (process.env.APPWRITE_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  console.error('.env.local에 값을 넣거나 명령 앞에 환경변수를 지정해 주세요.')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const databases = new Databases(client)

const adminReadRoles = adminUserIds.length > 0 ? adminUserIds.map((id) => Role.user(id)) : [Role.users()]
const adminWriteRoles = adminUserIds.length > 0 ? adminUserIds.map((id) => Role.user(id)) : [Role.users()]

if (adminUserIds.length === 0) {
  console.warn('WARNING: APPWRITE_ADMIN_USER_IDS is empty. Authenticated users will receive broad reservation read/update/delete permissions.')
  console.warn('Set APPWRITE_ADMIN_USER_IDS in production before running this script.')
}

const reservationPermissions = [
  Permission.create(Role.any()),
  ...adminReadRoles.map((role) => Permission.read(role)),
  ...adminWriteRoles.map((role) => Permission.update(role)),
  ...adminWriteRoles.map((role) => Permission.delete(role)),
]

const settingsPermissions = [
  Permission.read(Role.any()),
  ...adminWriteRoles.map((role) => Permission.create(role)),
  ...adminWriteRoles.map((role) => Permission.update(role)),
  ...adminWriteRoles.map((role) => Permission.delete(role)),
]

const defaultSettingsByMarket = {
  KR: {
    price: 38000,
    bankName: '신한은행',
    bankAccount: '110-583-680821',
    accountHolder: '베리굿초콜릿컴퍼니(VCC))',
    weekdayOpen: '07:00',
    weekdayClose: '21:00',
    weekendOpen: '09:00',
    weekendClose: '22:00',
    dailyLimitText: '하루 5개 한정 제작',
    reservationNotice: '예약 신청 후 매장 확인 문자를 보내드립니다. 입금 확인 후 예약이 최종 확정됩니다.',
    pickupNotice: '운영시간 외 픽업을 원하시면 요청사항에 남겨주세요. 확인 후 연락드리겠습니다.',
    storeAddress: '대구 수성구 상록로11길 13 1층 베리굿초콜릿',
    storePhone: '070-7840-0717',
  },
  AU: {
    price: 58,
    bankName: 'Payment details TBC',
    bankAccount: 'Confirm with Jenny',
    accountHolder: 'Verygood Chocolate',
    weekdayOpen: '10:00',
    weekdayClose: '17:00',
    weekendOpen: '10:00',
    weekendClose: '16:00',
    dailyLimitText: 'Small-batch cakes, limited daily availability',
    reservationNotice: 'We will confirm availability after your request. Payment details and final confirmation follow by message.',
    pickupNotice: 'For pickup outside listed hours, leave a note and we will confirm what is possible.',
    storeAddress: 'Sydney pickup address TBC',
    storePhone: '+61 phone number TBC',
  },
}

const defaultSettings = defaultSettingsByMarket[market]

const reservationAttributes = [
  { key: 'reservationNumber', type: 'string', size: 40, required: true },
  { key: 'customerName', type: 'string', size: 80, required: true },
  { key: 'customerPhone', type: 'string', size: 40, required: true },
  { key: 'productId', type: 'string', size: 40, required: false },
  { key: 'cakeSize', type: 'string', size: 20, required: false },
  { key: 'quantity', type: 'integer', required: false, min: 1, max: 5 },
  { key: 'pickupDate', type: 'string', size: 20, required: true },
  { key: 'pickupTime', type: 'string', size: 10, required: true },
  { key: 'cacaoPercent', type: 'string', size: 10, required: true },
  { key: 'requestNote', type: 'string', size: 1000, required: false },
  { key: 'adminMemo', type: 'string', size: 1000, required: false },
  { key: 'createdAt', type: 'string', size: 40, required: true },
  { key: 'updatedAt', type: 'string', size: 40, required: false },
  {
    key: 'status',
    type: 'enum',
    required: true,
    elements: ['예약신청', '예약확정', '픽업완료', '취소'],
  },
  {
    key: 'paymentStatus',
    type: 'enum',
    required: true,
    elements: ['입금대기', '입금확인', '현장결제', '환불필요'],
  },
  { key: 'totalPrice', type: 'integer', required: true, min: 0 },
]

const settingsAttributes = [
  { key: 'price', type: 'integer', required: true, min: 0 },
  ...Object.keys(defaultSettings)
    .filter((key) => key !== 'price')
    .map((key) => ({
      key,
      type: 'string',
      size: key.includes('Notice') ? 1000 : 200,
      required: true,
    })),
]

const reservationIndexes = [
  { key: 'reservationNumber_idx', attributes: ['reservationNumber'] },
  { key: 'pickupDate_idx', attributes: ['pickupDate'] },
  { key: 'status_idx', attributes: ['status'] },
  { key: 'paymentStatus_idx', attributes: ['paymentStatus'] },
  { key: 'cacaoPercent_idx', attributes: ['cacaoPercent'] },
  { key: 'createdAt_idx', attributes: ['createdAt'] },
]

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

function isConflict(error) {
  return error instanceof AppwriteException && error.code === 409
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function ensureDatabase() {
  try {
    await databases.get({ databaseId })
    console.log(`exists  database ${databaseId}`)
  } catch (error) {
    if (!isMissing(error)) throw error
    await databases.create({
      databaseId,
      name: `Verygood Cake Reservation ${market}`,
    })
    console.log(`created database ${databaseId}`)
  }

  await databases.update({
    databaseId,
    name: `Verygood Cake Reservation ${market}`,
    enabled: true,
  })
  console.log(`updated database ${databaseId}`)
}

async function ensureCollection(collectionId, name, permissions) {
  try {
    await databases.getCollection({ databaseId, collectionId })
    console.log(`exists  collection ${collectionId}`)
  } catch (error) {
    if (!isMissing(error)) throw error
    await databases.createCollection({
      databaseId,
      collectionId,
      name,
      permissions,
      documentSecurity: false,
      enabled: true,
    })
    console.log(`created collection ${collectionId}`)
  }

  await databases.updateCollection({
    databaseId,
    collectionId,
    name,
    permissions,
    documentSecurity: false,
    enabled: true,
    purge: true,
  })
  console.log(`updated collection ${collectionId} permissions`)
}

async function ensureAttribute(collectionId, attribute) {
  try {
    await databases.getAttribute({
      databaseId,
      collectionId,
      key: attribute.key,
    })
    console.log(`exists  attribute ${collectionId}.${attribute.key}`)
    return
  } catch (error) {
    if (!isMissing(error)) throw error
  }

  try {
    if (attribute.type === 'string') {
      await databases.createStringAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        size: attribute.size,
        required: attribute.required,
      })
    } else if (attribute.type === 'enum') {
      await databases.createEnumAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        elements: attribute.elements,
        required: attribute.required,
        ...(attribute.xdefault ? { xdefault: attribute.xdefault } : {}),
      })
    } else if (attribute.type === 'integer') {
      await databases.createIntegerAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        required: attribute.required,
        min: attribute.min,
        ...(attribute.max ? { max: attribute.max } : {}),
      })
    }
    console.log(`created attribute ${collectionId}.${attribute.key}`)
    await waitForAttribute(collectionId, attribute.key)
  } catch (error) {
    if (isConflict(error)) {
      console.log(`exists  attribute ${collectionId}.${attribute.key}`)
      return
    }
    throw error
  }
}

async function waitForAttribute(collectionId, key) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const attribute = await databases.getAttribute({ databaseId, collectionId, key })
    if (attribute.status === 'available') return
    if (attribute.status === 'failed') throw new Error(`attribute ${collectionId}.${key} creation failed`)
    await sleep(1000)
  }
  throw new Error(`attribute ${collectionId}.${key} was not available in time`)
}

async function ensureAttributesReady(collectionId, attributes) {
  for (const attribute of attributes) {
    await waitForAttribute(collectionId, attribute.key)
  }
}

async function ensureIndex(collectionId, index) {
  try {
    await databases.getIndex({
      databaseId,
      collectionId,
      key: index.key,
    })
    console.log(`exists  index ${collectionId}.${index.key}`)
    return
  } catch (error) {
    if (!isMissing(error)) throw error
  }

  try {
    await databases.createIndex({
      databaseId,
      collectionId,
      key: index.key,
      type: 'key',
      attributes: index.attributes,
    })
    console.log(`created index ${collectionId}.${index.key}`)
  } catch (error) {
    if (isConflict(error)) {
      console.log(`exists  index ${collectionId}.${index.key}`)
      return
    }
    throw error
  }
}

async function seedSettings() {
  const current = await databases.listDocuments({
    databaseId,
    collectionId: settingsId,
  })

  if (current.total > 0) {
    console.log('exists  settings seed')
    return
  }

  await databases.createDocument({
    databaseId,
    collectionId: settingsId,
    documentId: ID.unique(),
    data: defaultSettings,
  })
  console.log('created settings seed')
}

await ensureDatabase()
await ensureCollection(reservationsId, 'reservations', reservationPermissions)
await ensureCollection(settingsId, 'settings', settingsPermissions)

for (const attribute of reservationAttributes) {
  await ensureAttribute(reservationsId, attribute)
}

for (const attribute of settingsAttributes) {
  await ensureAttribute(settingsId, attribute)
}

await ensureAttributesReady(reservationsId, reservationAttributes)
await ensureAttributesReady(settingsId, settingsAttributes)

for (const index of reservationIndexes) {
  await ensureIndex(reservationsId, index)
}

await seedSettings()

console.log('Appwrite setup complete')
