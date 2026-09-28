import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { createCake, lookupCake } from '../appwrite-functions/reservation-api/src/main.js'
import { AppwriteException } from './reservation-sdk.mjs'
import { createReservationApiArchive } from '../scripts/reservation-api-deploy-rollout.mjs'

const now = new Date('2099-07-01T00:00:00.000Z')
const runtimeConfig = {
  cakeDatabaseId: 'cakes', cakeReservationsId: 'reservations',
  cakeCatalogMode: 'required', cakeCustomerEmailMode: 'required',
  reviewCouponHmacSecret: Buffer.alloc(32, 7),
}
const customer = {
  customerName: 'Checkpoint Buyer', customerPhone: '0412345678',
  customerEmail: 'buyer@example.com', pickupDate: '2099-07-11',
  pickupTime: '12:00', privacyConsent: true, promoCode: '',
}
const chocolate = (requestId) => ({
  ...customer, requestId,
  orderLines: [{ productId: 'almond-chocoball-80g', quantity: 1 }],
})

function database() {
  const documents = new Map()
  const writes = []
  return {
    documents, writes,
    async getDocument({ documentId }) {
      if (!documents.has(documentId)) throw new AppwriteException('Not found', 404)
      return documents.get(documentId)
    },
    async listDocuments({ queries = [] } = {}) {
      const equal = queries.map(query => JSON.parse(String(query))).find(query => query.method === 'equal')
      const matches = equal
        ? [...documents.values()].filter(document => equal.values.includes(document[equal.attribute]))
        : [...documents.values()]
      return { documents: matches, total: matches.length }
    },
    async createDocument({ documentId, data }) {
      writes.push(documentId)
      const document = { $id: documentId, ...data }
      documents.set(documentId, document)
      return document
    },
  }
}

test('checkpoint artifact preserves S’more writes and disables only new Chocolate writes', async () => {
  for (const [phase, chocolateEnabled] of [['checkpoint', false], ['full', true]]) {
    const archive = await createReservationApiArchive({ phase })
    try {
      assert.equal(execFileSync('tar', ['-xOzf', archive.path, 'src/smore-write-policy.js'], { encoding: 'utf8' }),
        'export const SMORE_WRITES_ENABLED = true\n')
      assert.equal(execFileSync('tar', ['-xOzf', archive.path, 'src/chocolate-write-policy.js'], { encoding: 'utf8' }),
        `export const CHOCOLATE_WRITES_ENABLED = ${chocolateEnabled}\n`)
    } finally {
      await archive.cleanup()
    }
  }
})

test('checkpoint reads and replays a stored Chocolate order but blocks a new Chocolate or mixed order without writes', async () => {
  const db = database()
  const request = chocolate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  const full = await createCake(db, request, { now, runtimeConfig, chocolateWritesEnabled: true })
  assert.equal(full.totalPriceCents, 1200)
  assert.equal((await lookupCake(db, { reservationNumber: full.reservationNumber, phone: request.customerPhone })).orderLines[0].productId, 'almond-chocoball-80g')
  assert.deepEqual(await createCake(db, request, { now, runtimeConfig, chocolateWritesEnabled: false }), full)

  const writesBefore = db.writes.length
  await assert.rejects(createCake(db, chocolate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), {
    now, runtimeConfig, chocolateWritesEnabled: false,
  }), error => error?.code === 'CHOCOLATE_WRITES_DISABLED')
  await assert.rejects(createCake(db, {
    ...customer, requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    orderLines: [{ productId: 'pave-cake', cakeSize: '6in', quantity: 1 }, { productId: 'pave-chocolate-100g', quantity: 1 }],
  }, { now, runtimeConfig, chocolateWritesEnabled: false }), error => error?.code === 'CHOCOLATE_WRITES_DISABLED')
  assert.equal(db.writes.length, writesBefore)
})

test('checkpoint still accepts existing Cake and S’more orders', async () => {
  const db = database()
  const options = { now, runtimeConfig, chocolateWritesEnabled: false, smoreWritesEnabled: true }
  const cake = await createCake(db, {
    ...customer, requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    orderLines: [{ productId: 'pave-cake', cakeSize: '6in', quantity: 1 }],
  }, options)
  const smore = await createCake(db, {
    ...customer, requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    orderLines: [{ productId: 'smore-stick', quantity: 50 }],
  }, options)
  assert.equal(cake.productId, 'pave-cake')
  assert.equal(smore.productId, 'smore-stick')
  assert.equal(db.writes.length, 2)
})
