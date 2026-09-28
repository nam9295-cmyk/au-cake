export async function waitForActiveFunctionDeployment({
  functions, functionId, deploymentId,
  sleep = (ms) => new Promise(resolveSleep => setTimeout(resolveSleep, ms)),
  maxAttempts = 60,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await functions.get({ functionId })
    if (current.deploymentId === deploymentId) return
    if (attempt + 1 < maxAttempts) await sleep(2000)
  }
  throw new Error(`Function ${functionId} did not confirm active deployment ${deploymentId}.`)
}
