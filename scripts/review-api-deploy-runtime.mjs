import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { InputFile } from 'node-appwrite/file'
import { ARCHIVE_SOURCE_ENTRIES } from './review-api-deploy-config.mjs'

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

export async function createAndUploadArchive({ functionDir, functionId }, dependencies) {
  const {
    mkdtemp: makeTempDirectory = mkdtemp,
    createArchive = createTarArchive,
    readFile: readArchive = readFile,
    upload,
    cleanup = (path) => rm(path, { recursive: true, force: true }),
  } = dependencies
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
