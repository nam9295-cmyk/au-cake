import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import { Databases, Functions } from 'appwrite'

const root = resolve(new URL('..', import.meta.url).pathname)
const outputDirectory = mkdtempSync(join(tmpdir(), 'au-cake-repository-capability-'))
let importSequence = 0

after(() => rmSync(outputDirectory, { recursive: true, force: true }))

function bundleRepository(reservationApiMode) {
  const outputFile = join(outputDirectory, `repository-${reservationApiMode}.mjs`)
  execFileSync('npx', ['--no-install', 'esbuild',
    'src/lib/repository.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--packages=external',
    '--target=node22',
    `--define:import.meta.env=${JSON.stringify({
      VITE_MARKET: 'AU',
      VITE_APPWRITE_ENDPOINT: 'https://appwrite.example.test/v1',
      VITE_APPWRITE_PROJECT_ID: 'project-test',
      VITE_APPWRITE_CAKE_DATABASE_ID: 'cake-test',
      VITE_APPWRITE_KIDS_DATABASE_ID: 'kids-test',
      VITE_RESERVATION_API_MODE: reservationApiMode,
      VITE_RESERVATION_API_FUNCTION_ID: 'reservation-api-test',
    })}`,
    `--outfile=${outputFile}`,
  ], { cwd: root, stdio: 'pipe' })
  return pathToFileURL(outputFile).href
}

const repositoryBundles = {
  all: bundleRepository('all'),
  off: bundleRepository('off'),
}

async function loadRepository(mode = 'all') {
  return import(`${repositoryBundles[mode]}?case=${importSequence += 1}`)
}

function completed(result) {
  return {
    responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result }),
  }
}

function readyHealth() {
  return completed({ status: 'ready', capabilities: { cakeOrderLines: 1 } })
}

function replaceMethod(t, prototype, name, replacement) {
  const original = prototype[name]
  prototype[name] = replacement
  t.after(() => { prototype[name] = original })
}

function cakeOrderInput() {
  return {
    customerName: 'Customer',
    customerPhone: '0412345678',
    customerEmail: 'customer@example.com',
    pickupDate: '2099-07-11',
    pickupTime: '10:00',
    requestNote: '',
    promoCode: '',
    privacyConsent: true,
    website: '',
    requestId: '11111111-1111-4111-8111-111111111111',
    orderLines: [
      {
        productId: 'pave-cake',
        cakeSize: '15cm',
        chocolateType: 'dark',
        poundAddon: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0,
        vanillaCreamCount: 0,
        partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla',
        vanillaCakeFlavor: 'triple-berry',
        individualPackaging: false,
        quantity: 1,
      },
      {
        productId: 'brownie-cheesecake',
        cakeSize: '15cm',
        chocolateType: 'dark',
        poundAddon: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0,
        vanillaCreamCount: 0,
        partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla',
        vanillaCakeFlavor: 'triple-berry',
        individualPackaging: false,
        quantity: 1,
      },
    ],
  }
}

test('first health failure is not cached forever and a later successful health result is cached', async (t) => {
  let healthCalls = 0
  replaceMethod(t, Functions.prototype, 'createExecution', async () => {
    healthCalls += 1
    if (healthCalls === 1) throw new Error('network unavailable')
    return readyHealth()
  })

  const repository = await loadRepository()
  assert.equal(await repository.supportsCakeOrderLines(), false)
  assert.equal(await repository.supportsCakeOrderLines(), true)
  assert.equal(await repository.supportsCakeOrderLines(), true)
  assert.equal(healthCalls, 2)
})

test('concurrent callers share one in-flight health request', async (t) => {
  let healthCalls = 0
  let resolveHealth
  const health = new Promise((resolve) => { resolveHealth = resolve })
  replaceMethod(t, Functions.prototype, 'createExecution', async () => {
    healthCalls += 1
    return health
  })

  const repository = await loadRepository()
  const first = repository.supportsCakeOrderLines()
  const second = repository.supportsCakeOrderLines()
  assert.equal(healthCalls, 1)
  resolveHealth(readyHealth())
  assert.deepEqual(await Promise.all([first, second]), [true, true])
})

test('concurrent callers share a failure and the next invocation checks health again', async (t) => {
  let healthCalls = 0
  let rejectHealth
  const health = new Promise((_, reject) => { rejectHealth = reject })
  replaceMethod(t, Functions.prototype, 'createExecution', async () => {
    healthCalls += 1
    if (healthCalls === 1) return health
    return readyHealth()
  })

  const repository = await loadRepository()
  const first = repository.supportsCakeOrderLines()
  const second = repository.supportsCakeOrderLines()
  assert.equal(healthCalls, 1)
  rejectHealth(new Error('network unavailable'))
  assert.deepEqual(await Promise.all([first, second]), [false, false])
  assert.equal(await repository.supportsCakeOrderLines(), true)
  assert.equal(healthCalls, 2)
})

test('a malformed health response is retryable on the next invocation', async (t) => {
  let healthCalls = 0
  replaceMethod(t, Functions.prototype, 'createExecution', async () => {
    healthCalls += 1
    return healthCalls === 1
      ? completed({ status: 'ready', capabilities: { cakeOrderLines: '1' } })
      : readyHealth()
  })

  const repository = await loadRepository()
  assert.equal(await repository.supportsCakeOrderLines(), false)
  assert.equal(await repository.supportsCakeOrderLines(), true)
  assert.equal(healthCalls, 2)
})

test('all-mode disabled returns false without a health execution', async (t) => {
  let healthCalls = 0
  replaceMethod(t, Functions.prototype, 'createExecution', async () => {
    healthCalls += 1
    return readyHealth()
  })

  const repository = await loadRepository('off')
  assert.equal(await repository.supportsCakeOrderLines(), false)
  assert.equal(healthCalls, 0)
})

test('createCakeOrder stays unavailable for a failed capability check and proceeds after the next health success', async (t) => {
  const actions = []
  let healthCalls = 0
  replaceMethod(t, Functions.prototype, 'createExecution', async (input) => {
    const action = JSON.parse(input.body).action
    actions.push(action)
    if (action === 'health') {
      healthCalls += 1
      if (healthCalls === 1) throw new Error('network unavailable')
      return readyHealth()
    }
    throw new Error('CREATE_CAKE_REACHED')
  })
  replaceMethod(t, Databases.prototype, 'listDocuments', async () => ({ documents: [] }))

  const repository = await loadRepository()
  await assert.rejects(repository.createCakeOrder(cakeOrderInput()), /CAKE_ORDER_LINES_UNAVAILABLE/)
  await assert.rejects(repository.createCakeOrder(cakeOrderInput()), /CREATE_CAKE_REACHED/)
  assert.deepEqual(actions, ['health', 'health', 'create-cake'])
})
