import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ARCHIVE_SHARED_SOURCE_PATHS } from './booking-reminder-deploy-config.mjs'

const execFileAsync = promisify(execFile)
const FUNCTION_ARCHIVE_ENTRIES = Object.freeze(['package.json', 'package-lock.json', 'src', 'shared'])
const PARSER_SOURCE_PATHS = Object.freeze([
  'appwrite-functions/reservation-api/src/business.js',
  'appwrite-functions/reservation-api/src/coupon-digest.js',
  'appwrite-functions/reservation-api/src/active-cake-products.js',
])

export async function createBookingReminderArchive({ repositoryRoot = process.cwd() } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'booking-reminder-'))
  const stagingDir = join(tempDir, 'source')
  const archivePath = join(tempDir, 'code.tar.gz')
  const functionDir = resolve(repositoryRoot, 'appwrite-functions/booking-reminder')
  try {
    await mkdir(stagingDir, { recursive: true })
    for (const entry of FUNCTION_ARCHIVE_ENTRIES) await cp(join(functionDir, entry), join(stagingDir, entry), { recursive: true })
    const parserTarget = join(stagingDir, 'shared/reservation-api')
    await mkdir(parserTarget, { recursive: true })
    for (const sourcePath of PARSER_SOURCE_PATHS) {
      await cp(resolve(repositoryRoot, sourcePath), join(parserTarget, basename(sourcePath)))
    }
    const emailTarget = join(stagingDir, 'shared/email-delivery')
    await mkdir(emailTarget, { recursive: true })
    for (const sourcePath of ARCHIVE_SHARED_SOURCE_PATHS.slice(0, 4)) {
      await cp(resolve(repositoryRoot, sourcePath), join(emailTarget, basename(sourcePath)))
    }
    for (const sourcePath of ARCHIVE_SHARED_SOURCE_PATHS.slice(4)) {
      await cp(resolve(repositoryRoot, sourcePath), join(stagingDir, 'shared', basename(sourcePath)))
    }
    await execFileAsync('tar', ['-czf', archivePath, '-C', stagingDir, '.'])
    return { path: archivePath, archive: await readFile(archivePath), cleanup: async () => rm(tempDir, { recursive: true, force: true }) }
  } catch (archiveError) {
    await rm(tempDir, { recursive: true, force: true })
    throw archiveError
  }
}
