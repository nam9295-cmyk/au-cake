import { ReservationApiError } from './business.js'

// Selection happens once, before any SDK request. A network failure never
// changes the endpoint and never retries a potentially committed write.
export function resolveReservationAppwriteEndpoint(env = process.env) {
  if (env.APPWRITE_INTERNAL_API_ENDPOINT === undefined) return env.APPWRITE_FUNCTION_API_ENDPOINT
  try {
    const endpoint = new URL(env.APPWRITE_INTERNAL_API_ENDPOINT.trim())
    if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.hostname
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || !/^\/v1\/?$/.test(endpoint.pathname)) throw new Error('invalid')
    return endpoint.href.replace(/\/$/, '')
  } catch {
    // Never echo the configured URL: malformed configuration may contain secrets.
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
}
