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
const databaseId = process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake'
const classDatabaseId =
  process.env.APPWRITE_KIDS_DATABASE_ID || process.env.VITE_APPWRITE_KIDS_DATABASE_ID || databaseId
const reservationsId =
  process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || process.env.VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations'
const settingsId = process.env.APPWRITE_SETTINGS_TABLE_ID || process.env.VITE_APPWRITE_SETTINGS_TABLE_ID || 'settings'
const classReservationsId =
  process.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
  process.env.VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID ||
  'class_reservations'
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
    price: 45,
    bankName: 'BSB 012263',
    bankAccount: 'Account 324999682',
    accountHolder: 'Verygood Chocolate',
    weekdayOpen: '10:00',
    weekdayClose: '20:00',
    weekendOpen: '10:00',
    weekendClose: '20:00',
    dailyLimitText: 'Small-batch cakes, limited daily availability',
    reservationNotice: 'We will confirm availability after your request. Payment details and final confirmation will follow by message.',
    pickupNotice: 'Street pick-up near 1 Bundil Blvd, Melrose Park. There is a small playground and seating nearby. Parking can be limited, so Jenny will bring the cake down to you.',
    storeAddress: 'Street pick-up near 1 Bundil Blvd, Melrose Park. Small playground/seating nearby; Jenny will bring the cake down to you.',
    storePhone: '+61 mobile number TBC',
  },
}

const defaultSettings = defaultSettingsByMarket[market]

const reservationAttributes = [
  { key: 'reservationNumber', type: 'string', size: 40, required: true },
  { key: 'customerName', type: 'string', size: 80, required: true },
  { key: 'customerPhone', type: 'string', size: 40, required: true },
  { key: 'productId', type: 'string', size: 40, required: false },
  { key: 'cakeSize', type: 'string', size: 20, required: false },
  { key: 'chocolateType', type: 'string', size: 20, required: false },
  { key: 'poundAddon', type: 'string', size: 40, required: false },
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
  { key: 'totalPriceCents', type: 'integer', required: false, min: 0 },
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

const classReservationAttributes = [
  { key: 'reservationNumber', type: 'string', size: 48, required: true },
  { key: 'classType', type: 'string', size: 80, required: true },
  { key: 'classDate', type: 'string', size: 20, required: true },
  { key: 'classTime', type: 'string', size: 20, required: true },
  { key: 'bookingType', type: 'enum', required: true, elements: ['year-1-2', '1-child', '2-friends'] },
  { key: 'parentName', type: 'string', size: 80, required: true },
  { key: 'parentPhone', type: 'string', size: 40, required: true },
  { key: 'parentEmail', type: 'string', size: 120, required: true },
  { key: 'childName', type: 'string', size: 80, required: true },
  { key: 'childAge', type: 'integer', required: true, min: 3, max: 18 },
  { key: 'schoolYear', type: 'string', size: 40, required: true },
  { key: 'secondChildName', type: 'string', size: 80, required: false },
  { key: 'secondChildAge', type: 'integer', required: false, min: 3, max: 18 },
  { key: 'secondChildSchoolYear', type: 'string', size: 40, required: false },
  { key: 'allergyNote', type: 'string', size: 1000, required: false },
  { key: 'emergencyContact', type: 'string', size: 120, required: true },
  { key: 'pickupPerson', type: 'string', size: 80, required: true },
  { key: 'parentConsent', type: 'boolean', required: true },
  { key: 'cancellationAgreement', type: 'boolean', required: true },
  { key: 'photoConsent', type: 'boolean', required: true },
  { key: 'status', type: 'enum', required: true, elements: ['Requested', 'Confirmed', 'Completed', 'Cancelled'] },
  {
    key: 'paymentStatus',
    type: 'enum',
    required: true,
    elements: ['Payment pending', 'Fully paid', 'Refund required', 'Pending deposit', 'Deposit paid'],
  },
  { key: 'totalPrice', type: 'integer', required: true, min: 0 },
  { key: 'depositAmount', type: 'integer', required: true, min: 0 },
  { key: 'adminMemo', type: 'string', size: 1000, required: false },
  { key: 'createdAt', type: 'string', size: 40, required: true },
  { key: 'updatedAt', type: 'string', size: 40, required: false },
]

const reservationIndexes = [
  { key: 'reservationNumber_idx', attributes: ['reservationNumber'] },
  { key: 'pickupDate_idx', attributes: ['pickupDate'] },
  { key: 'status_idx', attributes: ['status'] },
  { key: 'paymentStatus_idx', attributes: ['paymentStatus'] },
  { key: 'cacaoPercent_idx', attributes: ['cacaoPercent'] },
  { key: 'createdAt_idx', attributes: ['createdAt'] },
]

const classReservationIndexes = [
  { key: 'reservationNumber_idx', attributes: ['reservationNumber'] },
  { key: 'classDate_idx', attributes: ['classDate'] },
  { key: 'status_idx', attributes: ['status'] },
  { key: 'paymentStatus_idx', attributes: ['paymentStatus'] },
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

async function ensureDatabase(targetDatabaseId = databaseId, name = `Verygood Cake Reservation ${market}`) {
  try {
    await databases.get({ databaseId: targetDatabaseId })
    console.log(`exists  database ${targetDatabaseId}`)
  } catch (error) {
    if (!isMissing(error)) throw error
    await databases.create({
      databaseId: targetDatabaseId,
      name,
    })
    console.log(`created database ${targetDatabaseId}`)
  }

  await databases.update({
    databaseId: targetDatabaseId,
    name,
    enabled: true,
  })
  console.log(`updated database ${targetDatabaseId}`)
}

async function ensureCollection(targetDatabaseId, collectionId, name, permissions) {
  try {
    await databases.getCollection({ databaseId: targetDatabaseId, collectionId })
    console.log(`exists  collection ${collectionId}`)
  } catch (error) {
    if (!isMissing(error)) throw error
    await databases.createCollection({
      databaseId: targetDatabaseId,
      collectionId,
      name,
      permissions,
      documentSecurity: false,
      enabled: true,
    })
    console.log(`created collection ${collectionId}`)
  }

  await databases.updateCollection({
    databaseId: targetDatabaseId,
    collectionId,
    name,
    permissions,
    documentSecurity: false,
    enabled: true,
    purge: true,
  })
  console.log(`updated collection ${collectionId} permissions`)
}

async function ensureAttribute(targetDatabaseId, collectionId, attribute) {
  try {
    await databases.getAttribute({
      databaseId: targetDatabaseId,
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
        databaseId: targetDatabaseId,
        collectionId,
        key: attribute.key,
        size: attribute.size,
        required: attribute.required,
      })
    } else if (attribute.type === 'enum') {
      await databases.createEnumAttribute({
        databaseId: targetDatabaseId,
        collectionId,
        key: attribute.key,
        elements: attribute.elements,
        required: attribute.required,
        ...(attribute.xdefault ? { xdefault: attribute.xdefault } : {}),
      })
    } else if (attribute.type === 'integer') {
      await databases.createIntegerAttribute({
        databaseId: targetDatabaseId,
        collectionId,
        key: attribute.key,
        required: attribute.required,
        min: attribute.min,
        ...(attribute.max ? { max: attribute.max } : {}),
      })
    } else if (attribute.type === 'boolean') {
      await databases.createBooleanAttribute({
        databaseId: targetDatabaseId,
        collectionId,
        key: attribute.key,
        required: attribute.required,
      })
    }
    console.log(`created attribute ${collectionId}.${attribute.key}`)
    await waitForAttribute(targetDatabaseId, collectionId, attribute.key)
  } catch (error) {
    if (isConflict(error)) {
      console.log(`exists  attribute ${collectionId}.${attribute.key}`)
      return
    }
    throw error
  }
}

async function waitForAttribute(targetDatabaseId, collectionId, key) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const attribute = await databases.getAttribute({ databaseId: targetDatabaseId, collectionId, key })
    if (attribute.status === 'available') return
    if (attribute.status === 'failed') throw new Error(`attribute ${collectionId}.${key} creation failed`)
    await sleep(1000)
  }
  throw new Error(`attribute ${collectionId}.${key} was not available in time`)
}

async function ensureAttributesReady(targetDatabaseId, collectionId, attributes) {
  for (const attribute of attributes) {
    await waitForAttribute(targetDatabaseId, collectionId, attribute.key)
  }
}

async function ensureIndex(targetDatabaseId, collectionId, index) {
  try {
    await databases.getIndex({
      databaseId: targetDatabaseId,
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
      databaseId: targetDatabaseId,
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

async function seedSettings(targetDatabaseId = databaseId) {
  const current = await databases.listDocuments({
    databaseId: targetDatabaseId,
    collectionId: settingsId,
  })

  if (current.total > 0) {
    console.log('exists  settings seed')
    return
  }

  await databases.createDocument({
    databaseId: targetDatabaseId,
    collectionId: settingsId,
    documentId: ID.unique(),
    data: defaultSettings,
  })
  console.log('created settings seed')
}

await ensureDatabase(databaseId, `Verygood Cake Reservation ${market}`)
if (classDatabaseId !== databaseId) {
  await ensureDatabase(classDatabaseId, 'Verygood Kids Classes')
}

await ensureCollection(databaseId, reservationsId, 'reservations', reservationPermissions)
await ensureCollection(databaseId, settingsId, 'settings', settingsPermissions)
await ensureCollection(classDatabaseId, classReservationsId, 'class_reservations', reservationPermissions)

for (const attribute of reservationAttributes) {
  await ensureAttribute(databaseId, reservationsId, attribute)
}

for (const attribute of settingsAttributes) {
  await ensureAttribute(databaseId, settingsId, attribute)
}

for (const attribute of classReservationAttributes) {
  await ensureAttribute(classDatabaseId, classReservationsId, attribute)
}

await ensureAttributesReady(databaseId, reservationsId, reservationAttributes)
await ensureAttributesReady(databaseId, settingsId, settingsAttributes)
await ensureAttributesReady(classDatabaseId, classReservationsId, classReservationAttributes)

for (const index of reservationIndexes) {
  await ensureIndex(databaseId, reservationsId, index)
}

for (const index of classReservationIndexes) {
  await ensureIndex(classDatabaseId, classReservationsId, index)
}

await seedSettings(databaseId)

console.log('Appwrite setup complete')
