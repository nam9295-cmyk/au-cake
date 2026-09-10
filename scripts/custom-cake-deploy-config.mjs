// Desired configuration only; no operational clients or writes.
export function customCakeDeployment(env, kind, legacyScopes) {
  if (env.CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED !== 'true') {
    if (env.CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED && env.CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED !== 'false') throw new Error('CUSTOM_CAKE_BACKEND_DEPLOY_ENABLED must be true or false.')
    return { runtimeVariables: {}, functionOptions: {} }
  }
  const required = key => { const value = env[key]; if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new Error(`${key} is required for custom backend deployment.`); return value }
  const runtimeKey = kind === 'api' ? 'APPWRITE_RESERVATION_API_RUNTIME' : 'APPWRITE_RESERVATION_NOTIFY_RUNTIME'
  if (env[runtimeKey] !== 'node-22') throw new Error(`${runtimeKey} must explicitly be node-22 for custom backend deployment.`)
  const scheduleKey = kind === 'api' ? 'APPWRITE_CUSTOM_CAKE_API_SCHEDULE' : 'APPWRITE_CUSTOM_CAKE_NOTIFICATION_SCHEDULE'
  const schedule = required(scheduleKey)
  if (!/^[\d*,/\-]+(?:\s+[\d*,/\-]+){4}$/.test(schedule)) throw new Error(`${scheduleKey} must be an explicit five-field schedule.`)
  const runtimeVariables = {}
  for (const key of ['CUSTOM_CAKE_PERSISTENCE_ENABLED', kind === 'api' ? 'CUSTOM_CAKE_RECOVERY_ENABLED' : 'CUSTOM_CAKE_NOTIFICATIONS_ENABLED']) { if (required(key) !== 'true') throw new Error(`${key} must explicitly be true.`); runtimeVariables[key] = 'true' }
  const database = required('APPWRITE_CUSTOM_CAKE_DATABASE_ID')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(database)) throw new Error('APPWRITE_CUSTOM_CAKE_DATABASE_ID is invalid.')
  runtimeVariables.APPWRITE_CUSTOM_CAKE_DATABASE_ID = database
  if (required('APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID') !== 'custom-cake-photos') throw new Error('APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID must use the fixed private bucket.')
  runtimeVariables.APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID = 'custom-cake-photos'
  for (const resource of ['claims', 'snapshots', 'sessions', 'photos', 'quotas', 'outbox', 'commits', 'chunks', 'histories', 'ratelimits']) {
    const key = `APPWRITE_CUSTOM_CAKE_${resource.toUpperCase()}_TABLE_ID`
    if (required(key) !== `custom_cake_${resource}`) throw new Error(`${key} must use its fixed private collection.`)
    runtimeVariables[key] = env[key]
  }
  if (kind === 'api') {
    for (const key of ['CUSTOM_CAKE_PROMOTION_STARTS_AT', 'CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET', 'CAKE_WIRE_LEGACY_NEW_SUBMISSIONS', 'REVIEW_ADMIN_USER_IDS']) runtimeVariables[key] = required(key)
    const start = runtimeVariables.CUSTOM_CAKE_PROMOTION_STARTS_AT
    if (!Number.isFinite(Date.parse(start)) || new Date(start).toISOString() !== start) throw new Error('CUSTOM_CAKE_PROMOTION_STARTS_AT must be a canonical timestamp.')
    const secret = runtimeVariables.CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET
    if (!/^[A-Za-z0-9_-]{43,}$/.test(secret) || Buffer.from(secret, 'base64url').toString('base64url') !== secret || secret === env.REVIEW_COUPON_HMAC_SECRET) throw new Error('CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET must be an independent canonical secret of at least 32 bytes.')
    if (!['compat', 'required'].includes(runtimeVariables.CAKE_WIRE_LEGACY_NEW_SUBMISSIONS)) throw new Error('CAKE_WIRE_LEGACY_NEW_SUBMISSIONS must explicitly be compat or required.')
  }
  const additional = ['functions.read', 'collections.read', 'buckets.read', ...(kind === 'api' ? ['files.read', 'files.write'] : [])]
  return { runtimeVariables, functionOptions: { schedule, timeout: 60, scopes: [...new Set([...legacyScopes, ...additional])] } }
}
