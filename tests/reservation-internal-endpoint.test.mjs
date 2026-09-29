import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cakeServicesForRequest } from '../appwrite-functions/reservation-api/src/custom-cake-runtime.js'
import { createReservationHandler } from '../appwrite-functions/reservation-api/src/main.js'

async function endpointServer(run) {
  const calls = []
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk
    calls.push({ method: req.method, url: req.url, headers: req.headers, body })
    const failed = req.url.includes('unavailable')
    res.writeHead(failed ? 503 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(failed ? { code: 503, type: 'general_server_error', message: 'Unavailable' } : { $id: 'db' }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}/v1`, calls) }
  finally { await new Promise(resolve => server.close(resolve)) }
}

const req = { headers: { 'x-appwrite-key': 'synthetic-dynamic-key' } }
const envFor = (publicEndpoint, internalEndpoint) => ({
  APPWRITE_FUNCTION_API_ENDPOINT: publicEndpoint,
  APPWRITE_FUNCTION_PROJECT_ID: 'synthetic-project',
  ...(internalEndpoint === undefined ? {} : { APPWRITE_INTERNAL_API_ENDPOINT: internalEndpoint }),
})

test('Custom Cake uses internal endpoint with the original dynamic key and project', async () => {
  await endpointServer(async (publicEndpoint, publicCalls) => endpointServer(async (internalEndpoint, internalCalls) => {
    const services = cakeServicesForRequest(req, envFor(publicEndpoint, internalEndpoint))
    assert.equal((await services.databases.get({ databaseId: 'db' })).$id, 'db')
    assert.equal(publicCalls.length, 0)
    assert.equal(internalCalls.length, 1)
    assert.equal(internalCalls[0].url, '/v1/databases/db')
    assert.equal(internalCalls[0].headers['x-appwrite-key'], 'synthetic-dynamic-key')
    assert.equal(internalCalls[0].headers['x-appwrite-project'], 'synthetic-project')
    await services.accountForJwt('synthetic-admin-jwt').get()
    assert.equal(internalCalls[1].url, '/v1/account')
    assert.equal(internalCalls[1].headers['x-appwrite-jwt'], 'synthetic-admin-jwt')
    assert.equal(internalCalls[1].headers['x-appwrite-key'], undefined)
  }))
})

test('absent internal setting retains the existing public endpoint', async () => {
  await endpointServer(async (endpoint, calls) => {
    await cakeServicesForRequest(req, envFor(endpoint)).databases.get({ databaseId: 'db' })
    assert.equal(calls.length, 1)
  })
})

test('ordinary Reservation API health also uses only the internal SDK endpoint', async () => {
  await endpointServer(async (publicEndpoint, publicCalls) => endpointServer(async (internalEndpoint, internalCalls) => {
    const env = { ...envFor(publicEndpoint, internalEndpoint), REVIEW_COUPON_HMAC_SECRET: Buffer.alloc(32, 7).toString('base64url') }
    const handler = createReservationHandler({ env })
    await handler({ req: { ...req, bodyJson: { action: 'health' }, bodyText: '{"action":"health"}' }, res: { json: (body, status) => ({ body, status }) }, log() {}, error() {} })
    // Synthetic schema is incomplete, but real SDK metadata requests must go
    // to the selected internal server, never the public one.
    assert.ok(internalCalls.length > 0)
    assert.equal(publicCalls.length, 0)
    assert.ok(internalCalls.every(c => c.headers['x-appwrite-key'] === 'synthetic-dynamic-key'))
  }))
})

test('internal GET and write failures are not retried or sent to the public endpoint', async () => {
  await endpointServer(async (publicEndpoint, publicCalls) => endpointServer(async (internalEndpoint, internalCalls) => {
    const { databases } = cakeServicesForRequest(req, envFor(publicEndpoint, internalEndpoint))
    await assert.rejects(databases.get({ databaseId: 'unavailable' }), e => e.code === 503)
    await assert.rejects(databases.createDocument({ databaseId: 'unavailable', collectionId: 'rows', documentId: 'id', data: { note: 'unchanged' } }), e => e.code === 503)
    assert.equal(internalCalls.length, 2)
    assert.deepEqual(internalCalls.map(c => c.method), ['GET', 'POST'])
    assert.equal(publicCalls.length, 0)
    assert.equal(JSON.parse(internalCalls[1].body).data.note, 'unchanged')
  }))
})

test('invalid configured internal endpoint fails closed without disclosing it', async () => {
  for (const endpoint of ['', 'not-a-url', 'file:///v1', 'http://user:secret@example.test/v1', 'http://example.test/v1?key=secret', 'http://example.test/v1#fragment', 'http://example.test/other']) {
    assert.throws(() => cakeServicesForRequest(req, envFor('https://public.example/v1', endpoint)), error => {
      assert.equal(error.message.includes('secret'), false)
      return error.code === 'FUNCTION_CONFIGURATION_ERROR'
    })
  }
})
