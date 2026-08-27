import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  createResendTransport,
  ResendTransportError,
} from '../appwrite-functions/shared/resend-transport.js'

const message = {
  from: 'Verygood <hello@example.com>',
  to: ['jenny@example.com'],
  subject: 'Review request',
  text: 'Text',
  html: '<p>Text</p>',
  idempotencyKey: 'verygood:test-event',
}

test('shared Resend transport preserves deterministic idempotency and fail-closed provider classification', async () => {
  let request
  const transport = createResendTransport({
    apiKey: 'test-resend-key',
    post: async (url, body, headers) => {
      request = { url, body, headers }
      return { id: 'resend-message-1' }
    },
  })
  assert.deepEqual(await transport.send(message), { kind: 'accepted', providerMessageId: 'resend-message-1' })
  assert.equal(request.headers['Idempotency-Key'], 'verygood:test-event')

  for (const [failure, expectedKind, expectedCode] of [
    [{ statusCode: 409, code: 'invalid_idempotent_request' }, 'failed', 'resend_invalid_idempotent_request'],
    [{ statusCode: 409, error: 'concurrent_idempotent_requests' }, 'uncertain', 'resend_concurrent_idempotent_requests'],
    [{ statusCode: 400, name: 'invalid_idempotency_key' }, 'failed', 'resend_invalid_idempotency_key'],
    [{ statusCode: 400, name: 'validation_error' }, 'failed', 'resend_validation_error_400'],
    [{ statusCode: 422, name: 'invalid_from_address' }, 'failed', 'resend_invalid_from_address'],
    [{ statusCode: 422, name: 'missing_required_field' }, 'failed', 'resend_missing_required_field'],
    [{ statusCode: 401, name: 'missing_api_key' }, 'failed', 'resend_missing_api_key'],
    [{ statusCode: 401, name: 'invalid_api_key' }, 'failed', 'resend_invalid_api_key'],
    [{ statusCode: 403, name: 'validation_error' }, 'failed', 'resend_validation_error_403'],
    [{ statusCode: 429, name: 'rate_limit_exceeded' }, 'failed', 'resend_rate_limit_exceeded'],
    [new ResendTransportError('uncertain', 'resend_timeout'), 'uncertain', 'resend_timeout'],
    [{ statusCode: 503 }, 'uncertain', 'resend_http_503'],
  ]) {
    const failing = createResendTransport({ apiKey: 'test-resend-key', post: async () => { throw failure } })
    await assert.rejects(
      () => failing.send(message),
      (error) => error instanceof ResendTransportError && error.kind === expectedKind && error.code === expectedCode,
    )
  }
})
