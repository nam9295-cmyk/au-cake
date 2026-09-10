import test from 'node:test'
import assert from 'node:assert/strict'
const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-readiness.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }

test('packaged readiness verifies exact private definitions and fails closed for missing insecure pending resources', async () => {
  const m = await load(); assert.equal(typeof m.checkCustomCakeReadiness, 'function')
  const targets = m.customCakeSchemaTargets({ endpoint: 'https://synthetic.invalid/v1', projectId: 'test-project', databaseId: 'test-db' })
  const config = { enabled: true, databaseId: 'test-db', bucketId: targets.bucket.bucketId, ...Object.fromEntries(targets.collections.map(c => [c.kind, c.collectionId])) }
  const make = () => ({
    get: async () => ({ $id: 'test-db', enabled: true }),
    getCollection: async ({ collectionId }) => {
      const c = targets.collections.find(c => c.collectionId === collectionId)
      return { ...structuredClone(c), $id: c.collectionId, databaseId: 'test-db', $permissions: [], attributes: c.attributes.map(a => ({ ...a, status: 'available', array: false, default: null, ...(a.type === 'string' ? { format: '', encrypt: false } : {}) })), indexes: c.indexes.map(i => ({ ...i, status: 'available', lengths: [] })) }
    },
  })
  const storage = { getBucket: async () => ({ ...targets.bucket, $id: targets.bucket.bucketId, $permissions: [] }) }
  assert.equal(await m.checkCustomCakeReadiness({ databases: make(), storage, config }), true)
  for (const mutate of [
    c => { c.$permissions = ['read("any")'] }, c => { delete c.$permissions; delete c.permissions },
    c => { c.documentSecurity = true }, c => { c.attributes[0].status = 'processing' },
    c => { c.attributes[1].size = 65534 }, c => { c.attributes[1].encrypt = true },
    c => { c.indexes[0].type = 'fulltext' }, c => { c.indexes[0].lengths = [10] },
    c => { c.indexes.push({ key: 'extra' }) }, c => { c.attributes.push({ key: 'extra' }) },
  ]) {
    const db = make(), get = db.getCollection; db.getCollection = async p => { const c = await get(p); mutate(c); return c }
    await assert.rejects(m.checkCustomCakeReadiness({ databases: db, storage, config }), { code: 'CAPABILITY_UNAVAILABLE' })
  }
  for (const change of [{ fileSecurity: true }, { $permissions: ['read("any")'] }, { allowedFileExtensions: ['jpeg', 'webp'] }, { maximumFileSize: 20000000 }, { antivirus: false }]) {
    await assert.rejects(m.checkCustomCakeReadiness({ databases: make(), storage: { getBucket: async () => ({ ...await storage.getBucket(), ...change }) }, config }), { code: 'CAPABILITY_UNAVAILABLE' })
  }
  await assert.rejects(m.checkCustomCakeReadiness({ databases: make(), storage, config: { ...config, ratelimits: 'unapproved' } }), { code: 'CAPABILITY_UNAVAILABLE' })
})
