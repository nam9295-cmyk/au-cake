import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { ARCHIVE_SHARED_SOURCE_PATHS } from './reservation-notification-deploy-config.mjs'

const execFileAsync = promisify(execFile)

const PARSER_SOURCE_PATHS = Object.freeze([
  'appwrite-functions/reservation-api/src/business.js',
  'appwrite-functions/reservation-api/src/coupon-digest.js',
  'appwrite-functions/reservation-api/src/active-cake-products.js',
])

const FUNCTION_ARCHIVE_ENTRIES = Object.freeze([
  'package.json',
  'package-lock.json',
  'src',
  'shared',
])

export async function createNotificationArchive({ repositoryRoot = process.cwd() } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'reservation-notification-'))
  const stagingDir = join(tempDir, 'source')
  const archivePath = join(tempDir, 'code.tar.gz')
  const functionDir = resolve(repositoryRoot, 'appwrite-functions/reservation-notification')
  try {
    await mkdir(stagingDir, { recursive: true })
    for (const entry of FUNCTION_ARCHIVE_ENTRIES) {
      await cp(join(functionDir, entry), join(stagingDir, entry), { recursive: true })
    }
    const parserTargetDir = join(stagingDir, 'shared/reservation-api')
    await mkdir(parserTargetDir, { recursive: true })
    for (const sourcePath of PARSER_SOURCE_PATHS) {
      await cp(resolve(repositoryRoot, sourcePath), join(parserTargetDir, basename(sourcePath)))
    }
    const ledgerTargetDir = join(stagingDir, 'shared/email-delivery')
    await mkdir(ledgerTargetDir, { recursive: true })
    for (const sourcePath of ARCHIVE_SHARED_SOURCE_PATHS) {
      await cp(resolve(repositoryRoot, sourcePath), join(ledgerTargetDir, basename(sourcePath)))
    }
    await execFileAsync('tar', ['-czf', archivePath, '-C', stagingDir, '.'])
    return {
      path: archivePath,
      archive: await readFile(archivePath),
      cleanup: async () => rm(tempDir, { recursive: true, force: true }),
    }
  } catch (archiveError) {
    await rm(tempDir, { recursive: true, force: true })
    throw archiveError
  }
}
