import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { InputFile } from 'node-appwrite/file'
import { ARCHIVE_SHARED_SOURCE_PATHS, ARCHIVE_SOURCE_ENTRIES } from './review-api-deploy-config.mjs'

const execFileAsync = promisify(execFile)

export function buildDeploymentPayload(functionId, archiveBuffer) {
  return {
    functionId,
    code: InputFile.fromBuffer(archiveBuffer, 'code.tar.gz'),
    activate: true,
    entrypoint: 'src/main.js',
    commands: 'npm ci --omit=dev',
  }
}

async function createTarArchive(archivePath, functionDir, entries) {
  await execFileAsync('tar', ['-czf', archivePath, '-C', functionDir, ...entries])
}

const FUNCTION_ARCHIVE_ENTRIES = Object.freeze([...ARCHIVE_SOURCE_ENTRIES, 'shared'])

export async function createReviewApiArchive({ repositoryRoot = process.cwd(), functionDir } = {}) {
  const root = resolve(repositoryRoot)
  const sourceDirectory = resolve(functionDir || join(root, 'appwrite-functions/review-api'))
  const tempDirectory = await mkdtemp(join(tmpdir(), 'review-api-'))
  const stagingDirectory = join(tempDirectory, 'source')
  const archivePath = join(tempDirectory, 'code.tar.gz')
  try {
    await mkdir(stagingDirectory, { recursive: true })
    for (const entry of FUNCTION_ARCHIVE_ENTRIES) {
      await cp(join(sourceDirectory, entry), join(stagingDirectory, entry), { recursive: true })
    }
    const sharedTargetDirectory = join(stagingDirectory, 'shared/email-delivery')
    await mkdir(sharedTargetDirectory, { recursive: true })
    for (const sourcePath of ARCHIVE_SHARED_SOURCE_PATHS) {
      const targetDirectory = basename(sourcePath) === 'sydney-calendar.js'
        ? join(stagingDirectory, 'shared')
        : sharedTargetDirectory
      await cp(resolve(root, sourcePath), join(targetDirectory, basename(sourcePath)))
    }
    await execFileAsync('tar', ['-czf', archivePath, '-C', stagingDirectory, '.'])
    return {
      path: archivePath,
      archive: await readFile(archivePath),
      cleanup: async () => rm(tempDirectory, { recursive: true, force: true }),
    }
  } catch (archiveError) {
    await rm(tempDirectory, { recursive: true, force: true })
    throw archiveError
  }
}

export async function createAndUploadArchive({ functionDir, functionId }, dependencies) {
  const {
    mkdtemp: makeTempDirectory = mkdtemp,
    createArchive = createTarArchive,
    readFile: readArchive = readFile,
    upload,
    cleanup = (path) => rm(path, { recursive: true, force: true }),
  } = dependencies
  if (!dependencies.createArchive) {
    const archive = await createReviewApiArchive({
      functionDir,
      repositoryRoot: resolve(functionDir, '../..'),
    })
    try {
      return await upload(buildDeploymentPayload(functionId, archive.archive))
    } finally {
      await archive.cleanup()
    }
  }

  const tempDirectory = await makeTempDirectory(join(tmpdir(), 'review-api-'))
  const archivePath = join(tempDirectory, 'code.tar.gz')

  try {
    await createArchive(archivePath, functionDir, [...ARCHIVE_SOURCE_ENTRIES])
    const archive = await readArchive(archivePath)
    return await upload(buildDeploymentPayload(functionId, archive))
  } finally {
    await cleanup(tempDirectory)
  }
}
