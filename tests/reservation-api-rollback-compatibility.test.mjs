import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AppwriteException } from 'node-appwrite'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCake, lookupCake } from '../appwrite-functions/reservation-api/src/main.js'
import { isReadyReservationRolloutHealth } from '../scripts/reservation-api-deploy-config.mjs'
import { createReservationApiArchive, runReservationApiRollout } from '../scripts/reservation-api-deploy-rollout.mjs'

const now = new Date('2099-07-01T00:00:00.000Z')
const runtimeConfig = {
  cakeDatabaseId: 'cake_db',
  cakeReservationsId: 'reservations',
  cakeCatalogMode: 'required',
  cakeCustomerEmailMode: 'required',
  reviewCouponHmacSecret: Buffer.alloc(32),
}
const customer = {
  customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'test@example.com',
  pickupDate: '2099-07-11', pickupTime: '12:00', privacyConsent: true, promoCode: '',
}
const smoreRequest = (requestId, quantity = 50) => ({
  ...customer, requestId, orderLines: [{ productId: 'smore-stick', quantity }],
})
const cakeRequest = (requestId) => ({
  ...customer, requestId, orderLines: [{ productId: 'pave-cake', cakeSize: '6in', quantity: 1 }],
})

function databaseDouble() {
  const documents = new Map()
  const calls = []
  const db = {
    documents,
    calls,
    async getDocument({ documentId }) {
      calls.push(['getDocument', documentId])
      if (!documents.has(documentId)) throw new AppwriteException('missing', 404)
      return documents.get(documentId)
    },
    async listDocuments({ queries = [] } = {}) {
      calls.push(['listDocuments'])
      const equal = queries.map(query => JSON.parse(String(query))).find(query => query.method === 'equal')
      const matches = equal
        ? [...documents.values()].filter(document => equal.values.includes(document[equal.attribute]))
        : [...documents.values()]
      return { documents: matches, total: matches.length }
    },
    async createDocument({ documentId, data }) {
      calls.push(['createDocument', documentId])
      if (documents.has(documentId)) throw new AppwriteException('conflict', 409)
      const document = { $id: documentId, ...data }
      documents.set(documentId, document)
      return document
    },
    async createTransaction() { calls.push(['createTransaction']); return { $id: 'tx' } },
    async updateDocument() { calls.push(['updateDocument']); throw new Error('coupon write not expected') },
    async updateTransaction() { calls.push(['updateTransaction']); throw new Error('transaction update not expected') },
    async deleteDocument() { calls.push(['deleteDocument']); throw new Error('delete not expected') },
  }
  return db
}

async function create(db, request, smoreWritesEnabled) {
  return createCake(db, request, { now, runtimeConfig, smoreWritesEnabled })
}

async function assertCompatibilityContract(db, existingRequest) {
  const stored = db.documents.get(existingRequest.requestId)
  const lookup = await lookupCake(db, {
    reservationNumber: stored.reservationNumber,
    phone: existingRequest.customerPhone,
  })
  assert.equal(lookup.quantity, 50)
  assert.equal((await create(db, existingRequest, false)).quantity, 50, 'same-request replay remains readable')

  await assert.rejects(
    create(db, smoreRequest('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), false),
    error => error?.code === 'SMORE_WRITES_DISABLED',
  )
  const mixedCouponRequest = {
    ...customer,
    requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    promoCode: 'FOXKIWI7Q2MK',
    orderLines: [
      { productId: 'pave-cake', cakeSize: '6in', quantity: 1 },
      { productId: 'smore-stick', quantity: 50 },
    ],
  }
  await assert.rejects(
    create(db, mixedCouponRequest, false),
    error => error?.code === 'SMORE_WRITES_DISABLED',
  )
  assert.equal((await create(db, cakeRequest('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), false)).productId, 'pave-cake')
}

test('rollout health proves reader compatibility and the exact immutable write phase', () => {
  const response = writes => ({
    ok: true,
    result: { status: 'ready', capabilities: { cakeOrderLines: 1, smoreStoredOrders: 1, smoreWrites: writes } },
  })
  assert.equal(isReadyReservationRolloutHealth(200, response(0), 'compatibility'), true)
  assert.equal(isReadyReservationRolloutHealth(200, response(1), 'full'), true)
  assert.equal(isReadyReservationRolloutHealth(200, response(1), 'compatibility'), false)
  assert.equal(isReadyReservationRolloutHealth(200, response(0), 'full'), false)
  assert.equal(isReadyReservationRolloutHealth(200, {
    ok: true, result: { status: 'ready', capabilities: { cakeOrderLines: 1, smoreWrites: 0 } },
  }, 'compatibility'), false)
})

test('compatibility and full archives execute their immutable deployment-local write policies', async () => {
  for (const [phase, expected] of [['compatibility', 'false'], ['full', 'true']]) {
    const archive = await createReservationApiArchive({ repositoryRoot: process.cwd(), phase })
    const extracted = await mkdtemp(join(tmpdir(), `reservation-api-${phase}-`))
    try {
      const policy = execFileSync('tar', ['-xOzf', archive.path, 'src/smore-write-policy.js'], { encoding: 'utf8' })
      assert.equal(policy, `export const SMORE_WRITES_ENABLED = ${expected}\n`)
      assert.equal(readFileSync('appwrite-functions/reservation-api/src/smore-write-policy.js', 'utf8'), 'export const SMORE_WRITES_ENABLED = true\n')

      execFileSync('tar', ['-xzf', archive.path, '-C', extracted])
      await symlink(resolve('node_modules'), join(extracted, 'node_modules'), 'dir')
      const deployed = await import(`${pathToFileURL(join(extracted, 'src/main.js')).href}?phase=${phase}`)
      const attempt = deployed.createCake(databaseDouble(), smoreRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), {
        now,
        runtimeConfig,
      })
      if (phase === 'compatibility') {
        await assert.rejects(attempt, error => error?.code === 'SMORE_WRITES_DISABLED')
      } else {
        assert.equal((await attempt).quantity, 50)
      }
    } finally {
      await archive.cleanup()
      await rm(extracted, { recursive: true, force: true })
    }
  }
})

test('compatibility deployment reads and replays stored Smore but blocks new Smore writes', async () => {
  const db = databaseDouble()
  const existingRequest = smoreRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  await create(db, existingRequest, true)
  await assertCompatibilityContract(db, existingRequest)
  assert.equal(db.calls.some(([name]) => name === 'deleteDocument'), false)
  assert.equal(db.calls.some(([name]) => name === 'createTransaction'), false)
})

test('full writer rollout activates compatibility checkpoint before full writer and keeps it on health success', async () => {
  const operations = []
  const db = databaseDouble()
  const request = smoreRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  const result = await runReservationApiRollout({
    previousDeploymentId: 'legacy-incompatible',
    createDeployment: async phase => { operations.push(['create', phase]); return { $id: `${phase}-id` } },
    waitForDeployment: async id => operations.push(['wait', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    verifyHealth: async phase => {
      operations.push(['health', phase])
      if (phase === 'full') {
        const created = await create(db, request, true)
        assert.equal(created.quantity, 50)
        const lookedUp = await lookupCake(db, { reservationNumber: created.reservationNumber, phone: request.customerPhone })
        assert.equal(lookedUp.quantity, 50)
      }
    },
  })
  assert.deepEqual(result, { compatibilityDeploymentId: 'compatibility-id', fullDeploymentId: 'full-id' })
  assert.deepEqual(operations, [
    ['create', 'compatibility'], ['wait', 'compatibility-id'], ['activate', 'compatibility-id'], ['health', 'compatibility'],
    ['create', 'full'], ['wait', 'full-id'], ['activate', 'full-id'], ['health', 'full'],
  ])
})

test('full writer health failure rolls back to compatibility and preserves read/replay while blocking new Smore', async () => {
  const db = databaseDouble()
  const request = smoreRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'legacy-incompatible',
    createDeployment: async phase => { operations.push(['create', phase]); return { $id: `${phase}-id` } },
    waitForDeployment: async id => operations.push(['wait', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    verifyHealth: async phase => {
      operations.push(['health', phase])
      if (phase === 'full') {
        await create(db, request, true)
        throw new Error('injected health failure')
      }
    },
  }), /injected health failure/)

  assert.deepEqual(operations.at(-1), ['activate', 'compatibility-id'])
  assert.equal(operations.some(operation => operation[0] === 'activate' && operation[1] === 'legacy-incompatible' && operations.indexOf(operation) > 3), false)
  await assertCompatibilityContract(db, request)
  assert.equal(db.calls.filter(([name, id]) => name === 'createDocument' && id === request.requestId).length, 1)
  assert.equal(db.calls.some(([name]) => name === 'deleteDocument' || name === 'updateDocument' || name === 'createTransaction'), false)
})

test('compatibility build failure restores the prior deployment without ever enabling Smore writes', async () => {
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'legacy-incompatible',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async id => {
      operations.push(['wait', id])
      if (id === 'compatibility-id') throw new Error('compatibility build failed')
    },
    activateDeployment: async id => operations.push(['activate', id]),
    verifyHealth: async () => operations.push(['health']),
  }), /compatibility build failed/)
  assert.deepEqual(operations, [['wait', 'compatibility-id'], ['activate', 'legacy-incompatible']])
})

test('full writer build failure keeps the confirmed compatibility checkpoint active', async () => {
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'legacy-incompatible',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async id => {
      operations.push(['wait', id])
      if (id === 'full-id') throw new Error('full build failed')
    },
    activateDeployment: async id => operations.push(['activate', id]),
    verifyHealth: async phase => operations.push(['health', phase]),
  }), /full build failed/)
  assert.deepEqual(operations, [
    ['wait', 'compatibility-id'], ['activate', 'compatibility-id'], ['health', 'compatibility'],
    ['wait', 'full-id'], ['activate', 'compatibility-id'],
  ])
})

test('compatibility failure may restore legacy because Smore writes were never enabled', async () => {
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'legacy-incompatible',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async () => {},
    activateDeployment: async id => operations.push(['activate', id]),
    verifyHealth: async phase => { if (phase === 'compatibility') throw new Error('compatibility health failed') },
  }), /compatibility health failed/)
  assert.deepEqual(operations, [['activate', 'compatibility-id'], ['activate', 'legacy-incompatible']])
})
