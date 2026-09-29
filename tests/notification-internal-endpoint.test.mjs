import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Client, Databases } from 'node-appwrite'
import { createRuntimeEmailDeliveryRepository, createRuntimeEmailDeliveryRetryClaimRepository, createRuntimeReservationRepository } from '../appwrite-functions/reservation-notification/src/main.js'
import { createCustomCakeNotificationRuntime } from '../appwrite-functions/reservation-notification/src/custom-cake-notification-runtime.js'

const req = { headers: { 'x-appwrite-key': 'synthetic-dynamic-key' } }
const envFor = (endpoint, internal) => ({
  APPWRITE_FUNCTION_API_ENDPOINT: endpoint, APPWRITE_FUNCTION_PROJECT_ID: 'project',
  APPWRITE_FUNCTION_ID: 'reservation-notification', APPWRITE_CAKE_DATABASE_ID: 'db',
  CUSTOM_CAKE_NOTIFICATIONS_ENABLED: 'true', RESEND_API_KEY: 'synthetic', RESEND_FROM_EMAIL: 'test@example.invalid',
  ...(internal === undefined ? {} : { APPWRITE_INTERNAL_API_ENDPOINT: internal }),
})
async function server(run) {
  const calls = []
  const http = createServer(async (req, res) => {
    for await (const chunk of req) void chunk
    calls.push({ method: req.method, url: req.url, headers: req.headers })
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ code: 503, type: 'general_server_error', message: 'synthetic failure' }))
  })
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${http.address().port}/v1`, calls) }
  finally { await new Promise(resolve => http.close(resolve)) }
}
for (const factory of [createRuntimeEmailDeliveryRepository, createRuntimeEmailDeliveryRetryClaimRepository, createRuntimeReservationRepository]) {
  test(`${factory.name} selects internal endpoint without changing authentication`, () => {
    for (const internal of [undefined, 'http://appwrite-internal-proxy/v1']) {
      let selected
      factory({ req, env: envFor('https://public.example/v1', internal), createDatabases: config => { selected = config; return new Databases(new Client()) } })
      assert.deepEqual(selected, { endpoint: internal ?? 'https://public.example/v1', projectId: 'project', apiKey: 'synthetic-dynamic-key' })
    }
  })
  test(`${factory.name} rejects malformed internal configuration before SDK creation`, () => {
    for (const internal of ['', 'invalid', 'http://user:secret@host/v1', 'https://host/v1?key=secret', 'http://host/other']) {
      assert.throws(() => factory({ req, env: envFor('https://public.example/v1', internal), createDatabases: () => { assert.fail('SDK must not be constructed') } }), error => !error.message.includes('secret') && !error.message.includes('SDK must'))
    }
  })
}
test('Custom Cake SDK uses internal only, preserves dynamic authentication, and never retries failed metadata GET', async () => {
  await server(async (publicEndpoint, publicCalls) => server(async (internal, calls) => {
    await assert.rejects(createCustomCakeNotificationRuntime({ req, env: envFor(publicEndpoint, internal) }), /CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE/)
    assert.equal(publicCalls.length, 0)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/v1/functions/reservation-notification')
    assert.equal(calls[0].headers['x-appwrite-key'], 'synthetic-dynamic-key')
    assert.equal(calls[0].headers['x-appwrite-project'], 'project')
  }))
})
test('Custom Cake retains public endpoint when internal setting is absent', async () => {
  await server(async (endpoint, calls) => {
    await assert.rejects(createCustomCakeNotificationRuntime({ req, env: envFor(endpoint) }), /CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE/)
    assert.equal(calls.length, 1)
  })
})
test('ordinary reservation SDK does not retry or fail over after internal failure', async () => {
  await server(async (endpoint, publicCalls) => server(async (internal, calls) => {
    const repository = createRuntimeReservationRepository({ req, env: envFor(endpoint, internal) })
    await assert.rejects(repository.getReservation('cake', 'synthetic'), error => error.code === 503)
    assert.equal(calls.length, 1)
    assert.equal(publicCalls.length, 0)
  }))
})
