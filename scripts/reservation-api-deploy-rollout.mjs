import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const PHASES = new Set(['checkpoint', 'full'])

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
      'export const SMORE_WRITES_ENABLED = true\n',
    )
    await writeFile(
      join(stagingDir, 'src/chocolate-write-policy.js'),
      `export const CHOCOLATE_WRITES_ENABLED = ${phase === 'full'}\n`,
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

async function confirmHealthyDeployment(waitForActivation, verifyHealth, deploymentId, phase) {
  await waitForActivation(deploymentId)
  await verifyHealth(phase)
  await waitForActivation(deploymentId)
}

async function restore({ activateDeployment, waitForActivation, verifyHealth }, deploymentId, phase, originalError) {
  if (!deploymentId) throw originalError
  try {
    await activateDeployment(deploymentId)
    await confirmHealthyDeployment(waitForActivation, verifyHealth, deploymentId, phase)
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
  waitForActivation,
  verifyHealth,
}) {
  const rollback = { activateDeployment, waitForActivation, verifyHealth }
  let checkpoint
  try {
    checkpoint = await createDeployment('checkpoint')
    await waitForDeployment(checkpoint.$id)
    await activateDeployment(checkpoint.$id)
    await confirmHealthyDeployment(waitForActivation, verifyHealth, checkpoint.$id, 'checkpoint')
  } catch (error) {
    return restore(rollback, previousDeploymentId, 'previous', error)
  }

  let full
  try {
    full = await createDeployment('full')
    await waitForDeployment(full.$id)
    await activateDeployment(full.$id)
    await confirmHealthyDeployment(waitForActivation, verifyHealth, full.$id, 'full')
  } catch (error) {
    return restore(rollback, checkpoint.$id, 'checkpoint', error)
  }

  return {
    checkpointDeploymentId: checkpoint.$id,
    fullDeploymentId: full.$id,
  }
}
