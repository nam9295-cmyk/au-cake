function validEndpoint(value, key) {
  let parsed
  try { parsed = new URL(value) } catch { throw new Error(`${key} must be a valid HTTP(S) URL without userinfo.`) }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${key} must be a valid HTTP(S) URL without userinfo.`)
  }
  return parsed
}

export function resolveAppwriteControlConfig(env, publicEndpoint) {
  validEndpoint(publicEndpoint, 'APPWRITE_ENDPOINT')
  const configured = String(env.APPWRITE_CONTROL_ENDPOINT ?? '').trim()
  const controlEndpoint = configured || publicEndpoint
  const parsed = validEndpoint(controlEndpoint, 'APPWRITE_CONTROL_ENDPOINT')
  const rawSelfSigned = String(env.APPWRITE_CONTROL_SELF_SIGNED ?? 'false').trim().toLowerCase()
  if (!['true', 'false'].includes(rawSelfSigned)) {
    throw new Error('APPWRITE_CONTROL_SELF_SIGNED must be true or false.')
  }
  const controlSelfSigned = rawSelfSigned === 'true'
  if (controlSelfSigned && !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('APPWRITE_CONTROL_SELF_SIGNED may only be enabled for a loopback control endpoint.')
  }
  return { controlEndpoint, controlSelfSigned }
}
