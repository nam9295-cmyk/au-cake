import { createHmac, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { cakeWireFail } from './custom-cake-workflow.js'

export async function resolveCustomCakeAdmin({ headers = {}, env, accountForJwt }) {
  const userId = headers['x-appwrite-user-id'], jwt = headers['x-appwrite-user-jwt']
  const admins = String(env.REVIEW_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
  if (typeof userId !== 'string' || !admins.includes(userId) || typeof jwt !== 'string' || !jwt) cakeWireFail('FORBIDDEN')
  try {
    const account = await accountForJwt(jwt).get()
    if (account.$id !== userId) cakeWireFail('FORBIDDEN')
    return { adminId: userId }
  } catch { cakeWireFail('FORBIDDEN') }
}

/** Fixed shared windows intentionally fail closed on contention or unavailable storage. */
export function createCustomCakeRateLimiter({ repository, key, now = () => new Date() }) {
  if (!Buffer.isBuffer(key) || key.length < 32) cakeWireFail('CAPABILITY_UNAVAILABLE')
  const digest = value => createHmac('sha256', key).update(`custom-cake-rate-v1\0${value}`).digest('hex').slice(0, 36)
  return {
    async allow(kind, target, headers = {}) {
      const ip = headers['x-appwrite-client-ip']
      if (!['session', 'lookup'].includes(kind) || typeof target !== 'string' || !target || typeof ip !== 'string' || !isIP(ip)) return false
      const duration = kind === 'session' ? 3600000 : 600000
      const at = now().getTime(), window = Math.floor(at / duration), resetAt = new Date((window + 1) * duration).toISOString()
      const limits = [[`${kind}/ip/${ip}`, kind === 'session' ? 10 : 60], [`${kind}/target/${target}`, kind === 'session' ? 5 : 20]]
      try {
        return await repository.atomic(`rate/${randomUUID()}`, async tx => {
          const records = []
          for (const [scope, limit] of limits) {
            const id = digest(scope), old = await tx.get('ratelimits', id)
            const used = old?.window === window ? old.used : 0
            if (!Number.isSafeInteger(used) || used < 0 || used >= limit) return false
            records.push({ id, old, next: { window, used: used + 1, state: 'rate-limit', dueAt: resetAt } })
          }
          for (const r of records) await tx[r.old ? 'replace' : 'create']('ratelimits', r.id, r.next)
          return true
        })
      } catch { return false }
    },
  }
}
