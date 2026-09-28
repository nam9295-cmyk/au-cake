import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AppwriteException, loadReservationSdk } from './reservation-sdk.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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

function databaseDouble(Exception = AppwriteException) {
  const documents = new Map()
  const calls = []
  const db = {
    documents,
    calls,
    async getDocument({ documentId }) {
      calls.push(['getDocument', documentId])
      if (!documents.has(documentId)) throw new Exception('missing', 404)
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
      if (documents.has(documentId)) throw new Exception('conflict', 409)
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

const chocolateRequest = (requestId) => ({
  ...customer, requestId, orderLines: [{ productId: 'almond-chocoball-80g', quantity: 1 }],
})

test('rollout health requires S’more writes in both phases and Chocolate writes only in full', () => {
  const response = chocolate => ({
    ok: true,
    result: { status: 'ready', capabilities: {
      cakeOrderLines: 1, smoreStoredOrders: 1, smoreWrites: 1,
      ...(chocolate ? { chocolateOrderLines: 1 } : {}),
    } },
  })
  assert.equal(isReadyReservationRolloutHealth(200, response(false), 'checkpoint'), true)
  assert.equal(isReadyReservationRolloutHealth(200, response(true), 'full'), true)
  assert.equal(isReadyReservationRolloutHealth(200, response(true), 'checkpoint'), false)
  assert.equal(isReadyReservationRolloutHealth(200, response(false), 'full'), false)
  assert.equal(isReadyReservationRolloutHealth(200, {
    ok: true, result: { status: 'ready', capabilities: { cakeOrderLines: 1, smoreStoredOrders: 1, smoreWrites: 0 } },
  }, 'checkpoint'), false)
})

test('checkpoint and full archives execute their immutable Chocolate write policies without disabling S’more', async () => {
  for (const [phase, enabled] of [['checkpoint', false], ['full', true]]) {
    const archive = await createReservationApiArchive({ repositoryRoot: process.cwd(), phase })
    const extracted = await mkdtemp(join(tmpdir(), `reservation-api-${phase}-`))
    try {
      const policy = execFileSync('tar', ['-xOzf', archive.path, 'src/smore-write-policy.js'], { encoding: 'utf8' })
      assert.equal(policy, 'export const SMORE_WRITES_ENABLED = true\n')
      assert.equal(execFileSync('tar', ['-xOzf', archive.path, 'src/chocolate-write-policy.js'], { encoding: 'utf8' }),
        `export const CHOCOLATE_WRITES_ENABLED = ${enabled}\n`)
      assert.equal(readFileSync('appwrite-functions/reservation-api/src/smore-write-policy.js', 'utf8'), 'export const SMORE_WRITES_ENABLED = true\n')

      execFileSync('tar', ['-xzf', archive.path, '-C', extracted])
      await symlink(resolve('node_modules'), join(extracted, 'node_modules'), 'dir')
      const deployed = await import(`${pathToFileURL(join(extracted, 'src/main.js')).href}?phase=${phase}`)
      const sdk = await loadReservationSdk(pathToFileURL(join(extracted, 'package.json')))
      const db = databaseDouble(sdk.AppwriteException)
      assert.equal((await deployed.createCake(db, smoreRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), { now, runtimeConfig })).quantity, 50)
      if (phase === 'checkpoint') {
        const storedRequest = chocolateRequest('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
        const stored = await deployed.createCake(db, storedRequest, { now, runtimeConfig, chocolateWritesEnabled: true })
        const lookup = await deployed.lookupCake(db, { reservationNumber: stored.reservationNumber, phone: storedRequest.customerPhone })
        assert.equal(lookup.orderLines[0].productId, 'almond-chocoball-80g')
        assert.deepEqual(await deployed.createCake(db, storedRequest, { now, runtimeConfig }), stored)
      }
      const attempt = deployed.createCake(db, chocolateRequest('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), { now, runtimeConfig })
      if (enabled) assert.equal((await attempt).totalPriceCents, 1200)
      else await assert.rejects(attempt, error => error?.code === 'CHOCOLATE_WRITES_DISABLED')
    } finally {
      await archive.cleanup()
      await rm(extracted, { recursive: true, force: true })
    }
  }
})

test('Chocolate rollout manually activates checkpoint then full only after ready and confirms active ID around health', async () => {
  const operations = []
  const result = await runReservationApiRollout({
    previousDeploymentId: 'previous-id',
    createDeployment: async phase => { operations.push(['create', phase]); return { $id: `${phase}-id` } },
    waitForDeployment: async id => operations.push(['ready', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    waitForActivation: async id => operations.push(['active', id]),
    verifyHealth: async phase => operations.push(['health', phase]),
  })
  assert.deepEqual(result, { checkpointDeploymentId: 'checkpoint-id', fullDeploymentId: 'full-id' })
  assert.deepEqual(operations, [
    ['create', 'checkpoint'], ['ready', 'checkpoint-id'], ['activate', 'checkpoint-id'],
    ['active', 'checkpoint-id'], ['health', 'checkpoint'], ['active', 'checkpoint-id'],
    ['create', 'full'], ['ready', 'full-id'], ['activate', 'full-id'],
    ['active', 'full-id'], ['health', 'full'], ['active', 'full-id'],
  ])
})

test('checkpoint activation not confirmed prevents health and restores confirmed previous deployment', async () => {
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'previous-id',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async id => operations.push(['ready', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    waitForActivation: async id => {
      operations.push(['active', id])
      if (id === 'checkpoint-id') throw new Error('activation not confirmed')
    },
    verifyHealth: async phase => operations.push(['health', phase]),
  }), /activation not confirmed/)
  assert.deepEqual(operations, [
    ['ready', 'checkpoint-id'], ['activate', 'checkpoint-id'], ['active', 'checkpoint-id'],
    ['activate', 'previous-id'], ['active', 'previous-id'], ['health', 'previous'], ['active', 'previous-id'],
  ])
})

test('full health failure restores Chocolate-readable checkpoint and confirms its health', async () => {
  const operations = []
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'previous-id',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async id => operations.push(['ready', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    waitForActivation: async id => operations.push(['active', id]),
    verifyHealth: async phase => {
      operations.push(['health', phase])
      if (phase === 'full') throw new Error('full health failed')
    },
  }), /full health failed/)
  assert.deepEqual(operations.slice(-4), [
    ['activate', 'checkpoint-id'], ['active', 'checkpoint-id'], ['health', 'checkpoint'], ['active', 'checkpoint-id'],
  ])
  assert.equal(operations.some(([kind, id]) => kind === 'activate' && id === 'previous-id'), false)
})

test('full active ID drift after health restores the verified checkpoint', async () => {
  const operations = []
  let fullConfirmationCount = 0
  await assert.rejects(runReservationApiRollout({
    previousDeploymentId: 'previous-id',
    createDeployment: async phase => ({ $id: `${phase}-id` }),
    waitForDeployment: async id => operations.push(['ready', id]),
    activateDeployment: async id => operations.push(['activate', id]),
    waitForActivation: async id => {
      operations.push(['active', id])
      if (id === 'full-id' && ++fullConfirmationCount === 2) throw new Error('active deployment drifted')
    },
    verifyHealth: async phase => operations.push(['health', phase]),
  }), /active deployment drifted/)
  assert.deepEqual(operations.slice(-4), [
    ['activate', 'checkpoint-id'], ['active', 'checkpoint-id'], ['health', 'checkpoint'], ['active', 'checkpoint-id'],
  ])
  assert.equal(operations.some(([kind, id]) => kind === 'activate' && id === 'previous-id'), false)
})
