import test from 'node:test'
import assert from 'node:assert/strict'
import { service, config } from './custom-cake-persistence.test.mjs'
import { createCustomCakeRepository } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-security.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }

test('admin identity requires platform allowlist and independently verified matching JWT account', async () => {
  const m = await load(); assert.equal(typeof m.resolveCustomCakeAdmin, 'function')
  const env = { REVIEW_ADMIN_USER_IDS: 'admin-1,admin-2' }
  const account = { get: async () => ({ $id: 'admin-1' }) }
  for (const headers of [{}, { 'x-appwrite-user-id': 'other', 'x-appwrite-user-jwt': 'jwt' }, { 'x-appwrite-user-id': 'admin-1' }, { 'x-appwrite-user-id': 'admin-2', 'x-appwrite-user-jwt': 'jwt' }]) {
    await assert.rejects(m.resolveCustomCakeAdmin({ headers, env, accountForJwt: () => account }), { code: 'FORBIDDEN' })
  }
  assert.deepEqual(await m.resolveCustomCakeAdmin({ headers: { 'x-appwrite-user-id': 'admin-1', 'x-appwrite-user-jwt': 'jwt' }, env, accountForJwt: () => account }), { adminId: 'admin-1' })
  await assert.rejects(m.resolveCustomCakeAdmin({ headers: { 'x-appwrite-user-id': 'admin-1', 'x-appwrite-user-jwt': 'jwt' }, env, accountForJwt: () => ({ get: async () => { throw new Error('raw secret SDK error') } }) }), { code: 'FORBIDDEN' })
})

test('shared limiter enforces issue budget across instances and concurrent writes; missing platform IP fails closed', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRateLimiter, 'function')
  const sdk = service(), repository = createCustomCakeRepository(sdk, { ...config, ratelimits: 'new_ratelimits' })
  const make = () => m.createCustomCakeRateLimiter({ repository, key: Buffer.alloc(32, 5), now: () => new Date('2026-09-09T00:00:00.000Z') })
  const one = make(), two = make(), headers = { 'x-appwrite-client-ip': '192.0.2.1' }
  assert.equal(await one.allow('session', 'request-1', {}), false)
  assert.equal(await one.allow('session', 'request-1', { 'x-forwarded-for': '192.0.2.1' }), false)
  for (let i = 0; i < 5; i++) assert.equal(await (i % 2 ? one : two).allow('session', 'request-1', headers), true)
  assert.equal(await two.allow('session', 'request-1', headers), false)
  const results = await Promise.all(Array.from({ length: 15 }, (_, i) => make().allow('session', `request-${i + 2}`, headers)))
  assert.ok(results.filter(Boolean).length <= 5)
  const rows = await repository.list('ratelimits'); assert.ok(rows.length)
  assert.ok(!JSON.stringify(rows).includes('192.0.2.1'))
})
