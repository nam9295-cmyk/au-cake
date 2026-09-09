import { CUSTOM_CAKE_RECORD_LIMIT, CUSTOM_CAKE_RESOURCE_KEYS } from './custom-cake-persistence.js'
const fail = () => { throw Object.assign(new Error('CAPABILITY_UNAVAILABLE'), { code: 'CAPABILITY_UNAVAILABLE' }) }
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

/** Shared fixed additive definitions; deploy artifacts package this module. */
export function customCakeSchemaTargets({ endpoint, projectId, databaseId } = {}) {
  if (!id.test(projectId || '') || !id.test(databaseId || '')) fail()
  let url
  try { url = new URL(endpoint) } catch { fail() }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) fail()
  const attributes = [
    { key: 'schemaVersion', type: 'integer', required: true, min: 1, max: 1 },
    { key: 'payloadJson', type: 'string', size: CUSTOM_CAKE_RECORD_LIMIT, required: true },
    { key: 'lookupKey', type: 'string', size: 64, required: true },
    { key: 'state', type: 'string', size: 32, required: true },
    { key: 'dueAt', type: 'string', size: 24, required: true },
  ]
  return {
    endpoint, projectId, databaseId,
    collections: CUSTOM_CAKE_RESOURCE_KEYS.map(kind => ({
      kind, collectionId: `custom_cake_${kind}`, name: `custom_cake_${kind}`, permissions: [], documentSecurity: false, enabled: true,
      attributes: structuredClone(attributes), indexes: [
        { key: 'lookup_key', type: kind === 'snapshots' ? 'unique' : 'key', attributes: ['lookupKey'], orders: ['ASC'] },
        { key: 'state_due', type: 'key', attributes: ['state', 'dueAt'], orders: ['ASC', 'ASC'] },
      ],
    })),
    bucket: { bucketId: 'custom-cake-photos', name: 'custom-cake-photos', permissions: [], fileSecurity: false, enabled: true, maximumFileSize: 10485760, allowedFileExtensions: ['webp'], compression: 'none', encryption: true, antivirus: true, transformations: false },
  }
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function privatePermissions(value) {
  const permissions = value.$permissions ?? value.permissions
  if (!Array.isArray(permissions) || permissions.length) fail()
}

export async function checkCustomCakeReadiness({ databases, storage, config }) {
  try {
    if (config.enabled !== true) fail()
    const targets = customCakeSchemaTargets({ endpoint: 'https://schema.invalid/v1', projectId: 'schema', databaseId: config.databaseId })
    if (targets.bucket.bucketId !== config.bucketId || targets.collections.some(c => config[c.kind] !== c.collectionId)) fail()
    const database = await databases.get({ databaseId: config.databaseId })
    if (database.$id !== config.databaseId || database.enabled !== true) fail()
    for (const expected of targets.collections) {
      const c = await databases.getCollection({ databaseId: config.databaseId, collectionId: expected.collectionId })
      privatePermissions(c)
      if (c.$id !== expected.collectionId || c.databaseId !== config.databaseId || c.name !== expected.name || c.enabled !== true || c.documentSecurity !== false) fail()
      for (const field of ['attributes', 'indexes']) {
        if (!Array.isArray(c[field]) || c[field].length !== expected[field].length || new Set(c[field].map(v => v.key)).size !== c[field].length) fail()
        for (const definition of expected[field]) {
          const actual = c[field].find(a => a.key === definition.key)
          if (!actual || actual.status !== 'available') fail()
          for (const [key, value] of Object.entries(definition)) if (!equal(actual[key], value)) fail()
          if (field === 'attributes' && ((actual.array ?? false) !== false || (actual.default ?? null) !== null || (definition.type === 'string' && ((actual.format ?? '') !== '' || (actual.encrypt ?? false) !== false)))) fail()
          if (field === 'indexes' && (!Array.isArray(actual.lengths) || actual.lengths.some(n => n !== 0))) fail()
        }
      }
    }
    const bucket = await storage.getBucket({ bucketId: config.bucketId })
    privatePermissions(bucket)
    if (bucket.$id !== config.bucketId) fail()
    for (const [key, value] of Object.entries(targets.bucket)) if (!['bucketId', 'permissions'].includes(key) && !equal(bucket[key], value)) fail()
    return true
  } catch { fail() }
}
