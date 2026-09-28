import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const PHASES = new Set(['compatibility', 'full'])

function assertPhase(phase) {
  if (!PHASES.has(phase)) throw new Error('Unknown Reservation API deployment phase')
}

export async function createReservationApiArchive({ repositoryRoot = process.cwd(), phase }) {
  assertPhase(phase)
  const tempDir = await mkdtemp(join(tmpdir(), 'reservation-api-'))
  const stagingDir = join(tempDir, 'source')
  const archivePath = join(tempDir, 'code.tar.gz')
  const functionDir = resolve(repositoryRoot, 'appwrite-functions/reservation-api')
  try {
    await cp(functionDir, stagingDir, { recursive: true })
    await writeFile(
      join(stagingDir, 'src/smore-write-policy.js'),
      `export const SMORE_WRITES_ENABLED = ${phase === 'full'}\n`,
    )
    await execFileAsync('tar', ['-czf', archivePath, '-C', stagingDir, 'package.json', 'package-lock.json', 'src'])
    return {
      path: archivePath,
      archive: await readFile(archivePath),
      cleanup: async () => rm(tempDir, { recursive: true, force: true }),
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw error
  }
}

async function restore(activateDeployment, deploymentId, originalError) {
  if (!deploymentId) throw originalError
  try {
    await activateDeployment(deploymentId)
  } catch (rollbackError) {
    throw new AggregateError([originalError, rollbackError], `Reservation API rollout failed and deployment ${deploymentId} could not be restored`)
  }
  throw originalError
}

export async function runReservationApiRollout({
  previousDeploymentId,
  createDeployment,
  waitForDeployment,
  activateDeployment,
  verifyHealth,
}) {
  let compatibility
  try {
    compatibility = await createDeployment('compatibility')
    await waitForDeployment(compatibility.$id)
    await activateDeployment(compatibility.$id)
    await verifyHealth('compatibility')
  } catch (error) {
    return restore(activateDeployment, previousDeploymentId, error)
  }

  let full
  try {
    full = await createDeployment('full')
    await waitForDeployment(full.$id)
    await activateDeployment(full.$id)
    await verifyHealth('full')
  } catch (error) {
    return restore(activateDeployment, compatibility.$id, error)
  }

  return {
    compatibilityDeploymentId: compatibility.$id,
    fullDeploymentId: full.$id,
  }
}
