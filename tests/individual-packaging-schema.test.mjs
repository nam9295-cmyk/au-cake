import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INDIVIDUAL_PACKAGING_ATTRIBUTES, ensureIndividualPackagingAttributes } from '../scripts/ensure-individual-packaging-attributes.mjs'

const availableAttribute = (definition) => ({ ...definition, status: 'available' })

test('individual packaging migration defines optional non-negative integer attributes', () => {
  assert.deepEqual(INDIVIDUAL_PACKAGING_ATTRIBUTES, [
    { key: 'individualPackagingPieces', type: 'integer', required: false, min: 0 },
    { key: 'individualPackagingFeeCents', type: 'integer', required: false, min: 0 },
  ])
})

test('individual packaging migration is idempotent for compatible attributes', async () => {
  const createCalls = []
  const databases = {
    async getAttribute({ key }) { return availableAttribute(INDIVIDUAL_PACKAGING_ATTRIBUTES.find((attribute) => attribute.key === key)) },
    async createIntegerAttribute(input) { createCalls.push(input) },
  }
  const results = await ensureIndividualPackagingAttributes({ databases, databaseId: 'db', collectionId: 'reservations', sleep: async () => {} })
  assert.deepEqual(results.map(({ key, created }) => ({ key, created })), [
    { key: 'individualPackagingPieces', created: false },
    { key: 'individualPackagingFeeCents', created: false },
  ])
  assert.deepEqual(createCalls, [])
})

test('individual packaging migration creates missing attributes', async () => {
  const stored = new Map()
  const databases = {
    async getAttribute({ key }) {
      if (!stored.has(key)) throw Object.assign(new Error('missing'), { code: 404 })
      return stored.get(key)
    },
    async createIntegerAttribute({ key, required, min }) {
      const definition = INDIVIDUAL_PACKAGING_ATTRIBUTES.find((attribute) => attribute.key === key)
      stored.set(key, availableAttribute({ ...definition, required, min }))
    },
  }
  const results = await ensureIndividualPackagingAttributes({ databases, databaseId: 'db', collectionId: 'reservations', sleep: async () => {} })
  assert.deepEqual(results.map(({ key, created }) => ({ key, created })), [
    { key: 'individualPackagingPieces', created: true },
    { key: 'individualPackagingFeeCents', created: true },
  ])
})

test('individual packaging migration rejects an incompatible existing attribute', async () => {
  const databases = { async getAttribute({ key }) { return { key, type: 'integer', required: true, min: 0, status: 'available' } } }
  await assert.rejects(
    ensureIndividualPackagingAttributes({ databases, databaseId: 'db', collectionId: 'reservations' }),
    /incompatible/,
  )
})
