import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite'

loadDotEnvLocal()

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const classDatabaseId =
  process.env.APPWRITE_KIDS_DATABASE_ID ||
  process.env.VITE_APPWRITE_KIDS_DATABASE_ID ||
  process.env.APPWRITE_CAKE_DATABASE_ID ||
  process.env.VITE_APPWRITE_CAKE_DATABASE_ID ||
  'verygood_cake'
const classBookedSlotsId =
  process.env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
  process.env.VITE_APPWRITE_KIDS_BOOKED_DATES_TABLE_ID ||
  'class_booked_dates'

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const slots = process.argv.slice(2).map(parseSlotArg)
if (slots.length === 0) {
  console.error('사용법: node scripts/block-class-slots.mjs YYYY-MM-DD:HH:mm [YYYY-MM-DD:HH:mm ...]')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const databases = new Databases(client)

for (const slot of slots) {
  await blockSlot(slot)
}

async function blockSlot({ classDate, classTime }) {
  const existing = await databases.listDocuments({
    databaseId: classDatabaseId,
    collectionId: classBookedSlotsId,
    queries: [Query.equal('classDate', classDate), Query.equal('classTime', classTime), Query.limit(1)],
  })
  if (existing.total > 0) {
    console.log(`exists  blocked slot ${classDate} ${classTime}`)
    return
  }

  try {
    await databases.createDocument({
      databaseId: classDatabaseId,
      collectionId: classBookedSlotsId,
      documentId: ID.unique(),
      data: { classDate, classTime, createdAt: new Date().toISOString() },
    })
    console.log(`created blocked slot ${classDate} ${classTime}`)
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      console.log(`exists  blocked slot ${classDate} ${classTime}`)
      return
    }
    throw error
  }
}

function parseSlotArg(value) {
  const match = /^(\d{4}-\d{2}-\d{2})[: ](\d{2}:\d{2})$/.exec(value)
  if (!match) throw new Error(`잘못된 슬롯 형식: ${value}`)
  return { classDate: match[1], classTime: match[2] }
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
