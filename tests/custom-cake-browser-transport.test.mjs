import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { Functions } from 'appwrite'
test('actual browser factory uses configured Appwrite SDK and preserves off/lookup/all separation', async () => {
  const root = resolve(new URL('..', import.meta.url).pathname)
  const directory = await mkdtemp(join(root, '.custom-cake-transport-'))
  const original = Functions.prototype.createExecution
  const fixture = JSON.parse(await readFile(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url), 'utf8'))
  const calls = []
  Functions.prototype.createExecution = async input => {
    calls.push(input)
    const { action } = JSON.parse(input.body)
    const result = action === 'get-custom-cake-request' ? fixture.lookup : fixture.created
    return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result }) }
  }
  try {
    for (const mode of ['off', 'lookup', 'all']) {
      const file = join(directory, `${mode}.mjs`)
      execFileSync('npx', ['--no-install', 'esbuild', 'src/lib/custom-cake-repository.ts', '--bundle', '--platform=node', '--format=esm', '--packages=external', '--target=node22', `--define:import.meta.env=${JSON.stringify({ VITE_APPWRITE_ENDPOINT: 'https://synthetic.invalid/v1', VITE_APPWRITE_PROJECT_ID: 'project', VITE_APPWRITE_CAKE_DATABASE_ID: 'cake', VITE_RESERVATION_API_MODE: mode, VITE_RESERVATION_API_FUNCTION_ID: 'configured-function' })}`, `--outfile=${file}`], { cwd: root, stdio: 'pipe' })
      const module = await import(pathToFileURL(file).href)
      if (mode === 'off') { await assert.rejects(module.getCakeWireRepository(), /CAKE_WIRE_UNAVAILABLE/); continue }
      const repository = await module.getCakeWireRepository()
      assert.deepEqual(await repository.getCustomCakeRequest({ contractVersion: 'custom-cake.v1', requestNumber: fixture.lookup.requestNumber, customerPhone: fixture.lookup.customer.customerPhone }), fixture.lookup)
      assert.equal(calls.at(-1).functionId, 'configured-function')
      if (mode === 'lookup') {
        const count = calls.length
        await assert.rejects(repository.createCustomCakeRequest(fixture.request), /CAKE_WIRE_UNAVAILABLE/)
        assert.equal(calls.length, count)
      } else assert.deepEqual(await repository.createCustomCakeRequest(fixture.request), fixture.created)
    }
  } finally { Functions.prototype.createExecution = original; await rm(directory, { recursive: true, force: true }) }
})
