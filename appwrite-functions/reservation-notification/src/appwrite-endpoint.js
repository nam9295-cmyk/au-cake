// Select once before SDK construction. Request failures must never switch
// endpoints or retry potentially committed writes.
export function resolveNotificationAppwriteEndpoint(env = process.env) {
  if (env.APPWRITE_INTERNAL_API_ENDPOINT === undefined) return env.APPWRITE_FUNCTION_API_ENDPOINT
  try {
    const endpoint = new URL(env.APPWRITE_INTERNAL_API_ENDPOINT.trim())
    if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.hostname
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || !/^\/v1\/?$/.test(endpoint.pathname)) throw new Error('invalid')
    return endpoint.href.replace(/\/$/, '')
  } catch {
    // Do not disclose malformed configuration, which may contain credentials.
    throw new Error('NOTIFICATION_APPWRITE_ENDPOINT_INVALID')
  }
}
