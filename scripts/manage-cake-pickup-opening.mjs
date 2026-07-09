import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite'

const usage = [
  '사용법:',
  '  node scripts/manage-cake-pickup-opening.mjs open YYYY-MM-DD:HH:mm',
  '  node scripts/manage-cake-pickup-opening.mjs close YYYY-MM-DD:HH:mm',
].join('\n')

let command
try {
  command = parseArguments(process.argv.slice(2))
} catch (error) {
  console.error(`오류: ${error instanceof Error ? error.message : '잘못된 입력입니다.'}`)
  console.error(usage)
  process.exit(1)
}

loadDotEnvLocal()

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY
const databaseId =
  process.env.APPWRITE_CAKE_DATABASE_ID || process.env.VITE_APPWRITE_CAKE_DATABASE_ID || 'verygood_cake'
const cakePickupOpeningsId =
  process.env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
  process.env.VITE_APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID ||
  'cake_pickup_openings'

if (!endpoint || !projectId || !apiKey) {
  console.error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY 환경변수가 필요합니다.')
  console.error('.env.local에 값을 넣거나 명령 앞에 환경변수를 지정해 주세요.')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const databases = new Databases(client)

try {
  if (command.action === 'open') {
    await openPickupOpening(command)
  } else {
    await closePickupOpening(command)
  }
} catch (error) {
  if (error instanceof AppwriteException) {
    console.error(`Appwrite 작업 실패: ${error.message} (HTTP ${error.code})`)
  } else {
    console.error(`작업 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
  process.exitCode = 1
}

async function openPickupOpening({ pickupDate, pickupTime }) {
  const existing = await listExactOpenings({ pickupDate, pickupTime }, 1)
  if (existing.length > 0) {
    console.log(`exists  cake pickup opening ${pickupDate} ${pickupTime}`)
    return
  }

  try {
    await databases.createDocument({
      databaseId,
      collectionId: cakePickupOpeningsId,
      documentId: ID.unique(),
      data: { pickupDate, pickupTime, createdAt: new Date().toISOString() },
    })
    console.log(`opened  cake pickup opening ${pickupDate} ${pickupTime}`)
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      let existingAfterConflict
      try {
        existingAfterConflict = await listExactOpenings({ pickupDate, pickupTime }, 1)
      } catch {
        throw error
      }
      if (existingAfterConflict.length > 0) {
        console.log(`exists  cake pickup opening ${pickupDate} ${pickupTime}`)
        return
      }
    }
    throw error
  }
}

async function closePickupOpening({ pickupDate, pickupTime }) {
  const existing = await listExactOpenings({ pickupDate, pickupTime })
  if (existing.length === 0) {
    console.log(`not found  cake pickup opening ${pickupDate} ${pickupTime}`)
    return
  }

  let deletedCount = 0
  for (const document of existing) {
    try {
      await databases.deleteDocument({
        databaseId,
        collectionId: cakePickupOpeningsId,
        documentId: document.$id,
      })
      deletedCount += 1
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 404) continue
      throw error
    }
  }

  if (deletedCount === 0) {
    console.log(`not found  cake pickup opening ${pickupDate} ${pickupTime}`)
    return
  }
  console.log(`closed  cake pickup opening ${pickupDate} ${pickupTime} (${deletedCount} deleted)`)
}

async function listExactOpenings({ pickupDate, pickupTime }, maxResults) {
  const documents = []
  const pageSize = Math.min(maxResults || 100, 100)
  let offset = 0

  while (maxResults === undefined || documents.length < maxResults) {
    const page = await databases.listDocuments({
      databaseId,
      collectionId: cakePickupOpeningsId,
      queries: [
        Query.equal('pickupDate', pickupDate),
        Query.equal('pickupTime', pickupTime),
        Query.limit(pageSize),
        Query.offset(offset),
      ],
    })
    documents.push(...page.documents)

    if (page.documents.length === 0 || documents.length >= page.total) break
    offset += page.documents.length
  }

  return maxResults === undefined ? documents : documents.slice(0, maxResults)
}

function parseArguments(args) {
  if (args.length !== 2) {
    throw new Error('open 또는 close 명령과 슬롯 하나만 지정해야 합니다.')
  }

  const [action, slotValue] = args
  if (action !== 'open' && action !== 'close') {
    throw new Error(`지원하지 않는 명령입니다: ${action}`)
  }

  return { action, ...parseSlot(slotValue) }
}

function parseSlot(value) {
  const match = /^(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/.exec(value)
  if (!match) {
    throw new Error(`슬롯 형식은 YYYY-MM-DD:HH:mm 이어야 합니다: ${value}`)
  }

  const pickupDate = match[1]
  const pickupTime = match[2]
  if (!isValidGregorianDate(pickupDate)) {
    throw new Error(`존재하지 않는 Gregorian 날짜입니다: ${pickupDate}`)
  }
  if (!isValidPickupTime(pickupTime)) {
    throw new Error(`픽업 시간은 10:00~20:00 사이의 30분 단위여야 합니다: ${pickupTime}`)
  }

  return { pickupDate, pickupTime }
}

function isValidGregorianDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

function isValidPickupTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false

  const hour = Number(match[1])
  const minute = Number(match[2])
  const totalMinutes = hour * 60 + minute
  return (minute === 0 || minute === 30) && totalMinutes >= 10 * 60 && totalMinutes <= 20 * 60
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
