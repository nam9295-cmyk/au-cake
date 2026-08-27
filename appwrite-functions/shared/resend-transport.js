import https from 'node:https'

export class ResendTransportError extends Error {
  constructor(kind, code) {
    super(code)
    this.name = 'ResendTransportError'
    this.kind = kind
    this.code = code
  }
}

function safeResendErrorCode(statusCode) {
  return Number.isInteger(statusCode) ? `resend_http_${statusCode}` : 'resend_network_uncertain'
}

const RESEND_PROVIDER_ERROR_CODES = Object.freeze(new Set([
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'invalid_idempotency_key',
  'validation_error',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_access',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
  'not_found',
  'method_not_allowed',
  'security_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
]))

function resendProviderErrorCode(value) {
  if (!value || typeof value !== 'object') return null
  for (const key of ['error', 'name', 'code']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && RESEND_PROVIDER_ERROR_CODES.has(candidate)) return candidate
  }
  return null
}

function isClearlyRejectedResendStatus(statusCode) {
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500 && ![408, 409].includes(statusCode)
}

export function resendErrorForStatus(statusCode, providerErrorCode = null) {
  if (statusCode === 409 && providerErrorCode === 'invalid_idempotent_request') {
    return new ResendTransportError('failed', 'resend_invalid_idempotent_request')
  }
  if (statusCode === 409 && providerErrorCode === 'concurrent_idempotent_requests') {
    return new ResendTransportError('uncertain', 'resend_concurrent_idempotent_requests')
  }
  if (statusCode === 400 && providerErrorCode === 'invalid_idempotency_key') {
    return new ResendTransportError('failed', 'resend_invalid_idempotency_key')
  }
  if (providerErrorCode === 'concurrent_idempotent_requests') {
    return new ResendTransportError('uncertain', 'resend_concurrent_idempotent_requests')
  }
  if (providerErrorCode === 'validation_error') {
    return new ResendTransportError('failed', `resend_validation_error_${Number.isInteger(statusCode) ? statusCode : 'unknown'}`)
  }
  if (providerErrorCode) {
    return new ResendTransportError('failed', `resend_${providerErrorCode}`)
  }
  return new ResendTransportError(
    isClearlyRejectedResendStatus(statusCode) ? 'failed' : 'uncertain',
    safeResendErrorCode(statusCode),
  )
}

function resendProviderErrorCodeFromJson(responseBody) {
  try {
    return resendProviderErrorCode(JSON.parse(responseBody))
  } catch {
    return null
  }
}

export function classifyResendError(error) {
  if (error instanceof ResendTransportError) return error
  const statusCode = Number(error?.statusCode)
  return resendErrorForStatus(
    Number.isInteger(statusCode) ? statusCode : undefined,
    resendProviderErrorCode(error),
  )
}

async function postJson(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          if (responseBody.length + chunk.length > 65_536) {
            request.destroy(new Error('Resend API response was too large.'))
            return
          }
          responseBody += chunk
        })
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody))
            } catch {
              resolve({})
            }
            return
          }
          reject(resendErrorForStatus(response.statusCode, resendProviderErrorCodeFromJson(responseBody)))
        })
      },
    )
    request.setTimeout(10_000, () => request.destroy(new ResendTransportError('uncertain', 'resend_timeout')))
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

export function createResendTransport({ apiKey, post = postJson, userAgent = 'verygood-email-delivery/1.0' } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || typeof post !== 'function') {
    throw new Error('INVALID_RESEND_TRANSPORT_CONFIGURATION')
  }
  return {
    async send(message) {
      try {
        const result = await post(
          'https://api.resend.com/emails',
          {
            from: message.from,
            to: message.to,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            subject: message.subject,
            text: message.text,
            html: message.html,
          },
          {
            Authorization: `Bearer ${apiKey}`,
            'Idempotency-Key': message.idempotencyKey,
            'User-Agent': userAgent,
          },
        )
        if (typeof result?.id !== 'string' || !result.id.trim() || result.id.length > 128) {
          throw new ResendTransportError('uncertain', 'resend_invalid_success_response')
        }
        return { kind: 'accepted', providerMessageId: result.id.trim() }
      } catch (sendError) {
        throw classifyResendError(sendError)
      }
    },
  }
}
