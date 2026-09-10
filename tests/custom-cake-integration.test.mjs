import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { rolldown } from 'rolldown'
const root = process.cwd()
const fixture = JSON.parse(readFileSync(`${root}/tests/fixtures/custom-cake-contract/custom-v1.json`, 'utf8'))
const modulePath = `${root}/src/lib/custom-cake-submission.ts`
const submission = existsSync(modulePath) ? await import(modulePath) : {}
function intent() {
  assert.equal(typeof submission.createSubmissionIntent, 'function', 'a secure immutable submission intent must exist')
  return submission.createSubmissionIntent()
}
const draft = () => {
  const data = structuredClone(fixture.request)
  delete data.requestId
  data.lines.forEach(line => { if (line.kind === 'custom-cake') line.photoRefs = [] })
  return data
}
async function boundary(handler) {
  const { createCakeWireRepository } = await import(`${root}/src/lib/custom-cake-repository.ts`)
  return createCakeWireRepository(async (action, data, context) => {
    const value = await handler(action, structuredClone(data), structuredClone(context))
    return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: value }) }
  })
}
const photoWires = JSON.parse(readFileSync(`${root}/tests/fixtures/custom-cake-contract/photo.json`, 'utf8')).wires
const photo = { session: photoWires.find(w => w.type === 'P.PhotoSessionResponse').value, uploaded: photoWires.find(w => w.type === 'P.PhotoUploadResponse').value }

test('production bundle does not contain the mock/localStorage custom cake service', async () => {
  const bundle = await rolldown({ input: ['src/App.tsx'], platform: 'browser', transform: { define: { 'import.meta.env': '{"VITE_MARKET":"AU"}' } }, plugins: [{ name: 'inspect-graph-assets', load(id) { if (/\.(png|jpg|webp|svg)$/.test(id)) return 'export default "image"' } }] })
  const result = await bundle.generate({ format: 'esm' })
  await bundle.close()
  const code = result.output.map(file => file.code || '').join('\n')
  assert.doesNotMatch(code, /customCakeService|INITIAL_FIXTURE_RECORDS|PHOTO_SESSION_STORAGE_KEY/)
  assert.ok(result.output.some(chunk => Object.keys(chunk.modules || {}).some(path => path.endsWith('custom-cake-repository.ts'))), 'real repository must be in the executable graph')
})

test('secure UUIDs fail closed and fallback entropy yields lowercase RFC4122 v4', () => {
  assert.equal(typeof submission.secureIntentId, 'function')
  assert.throws(() => submission.secureIntentId({}), /SECURE_RANDOM_UNAVAILABLE/)
  assert.match(submission.secureIntentId({ getRandomValues(bytes) { bytes.fill(255); return bytes } }), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('timeout replays identical frozen contact, line IDs and payload through actual parser/repository', async () => {
  const item = intent(), sent = [], data = draft()
  const repo = await boundary((action, value) => {
    assert.equal(action, 'create-custom-cake-request'); sent.push(value)
    if (sent.length === 1) throw new Error('timeout after commit')
    return { ...fixture.created, requestId: value.requestId }
  })
  await assert.rejects(() => item.submit(repo, data), /CAKE_WIRE_UNAVAILABLE/)
  data.customer.customerName = 'Changed after send'
  data.lines[0].quantity = 5
  const created = await item.submit(repo, data)
  assert.deepEqual(sent[1], sent[0])
  assert.match(sent[0].requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(created.quote.knownTotalCents, fixture.created.quote.knownTotalCents)
  assert.equal(item.locked, true)
})

test('local photo removal performs zero network calls and preserves other selected file IDs/bytes', () => {
  const item = intent()
  const a = item.selectPhoto({ mimeType: 'image/png', base64: 'AQID', name: 'a.png' })
  const b = item.selectPhoto({ mimeType: 'image/png', base64: 'BAUG', name: 'b.png' })
  item.removePhoto(a.uploadId)
  assert.deepEqual(item.photos, [b])
  assert.match(b.uploadId, /^[0-9a-f-]{36}$/)
})

test('uploaded bytes and credential survive ambiguous create and expired-session replay', async () => {
  const item = intent(), data = draft(), calls = []
  item.selectPhoto({ mimeType: 'image/png', base64: 'AQID', name: 'a.png' })
  let now = Date.now(), creates = 0
  const repo = await boundary((action, value, context) => {
    calls.push({ action, value, context })
    if (action === 'create-custom-cake-photo-session') return { ...photo.session, requestId: item.requestId, expiresAt: new Date(now + 1800000).toISOString() }
    if (action === 'upload-custom-cake-photo') return { ...photo.uploaded, requestId: item.requestId }
    if (++creates === 1) throw new Error('timeout')
    return { ...fixture.created, requestId: item.requestId }
  })
  await assert.rejects(() => item.submit(repo, data, () => now), /CAKE_WIRE_UNAVAILABLE/)
  now += 1800001
  await item.submit(repo, data, () => now)
  assert.deepEqual(calls.map(c => c.action), ['create-custom-cake-photo-session', 'upload-custom-cake-photo', 'create-custom-cake-request', 'create-custom-cake-request'])
  assert.deepEqual(calls[2], calls[3])
  assert.deepEqual(calls[1].context.credential, calls[2].context.credential)
  assert.equal(JSON.stringify(calls[2].value).includes(photo.session.uploadToken), false)
})

test('expiry before create renews session and reuploads the same selected bytes and upload ID', async () => {
  const item = intent(), uploads = [], credentials = [], data = draft()
  let now = Date.now(), issues = 0
  item.selectPhoto({ mimeType: 'image/png', base64: 'AQID', name: 'a.png' })
  const repo = await boundary((action, value, context) => {
    if (action === 'create-custom-cake-photo-session') return { ...photo.session, requestId: item.requestId, uploadSessionId: `session_${++issues}`, uploadToken: `${photo.session.uploadToken}_${issues}`, expiresAt: new Date(now + 1800000).toISOString() }
    if (action === 'upload-custom-cake-photo') {
      uploads.push(value); credentials.push(context.credential)
      if (issues === 1) now += 1800001
      return { ...photo.uploaded, requestId: item.requestId, photoRef: `photo_${issues}` }
    }
    assert.equal(issues, 2)
    assert.deepEqual(context.credential, credentials[1])
    assert.deepEqual(value.lines[0].photoRefs, ['photo_2'])
    return { ...fixture.created, requestId: item.requestId }
  })
  await item.submit(repo, data, () => now)
  assert.deepEqual(uploads[0], uploads[1])
  assert.notDeepEqual(credentials[0], credentials[1])
})

test('ambiguous upload retries stable ID and bytes in the same valid session', async () => {
  const item = intent(), uploads = [], credentials = []
  let issues = 0
  item.selectPhoto({ mimeType: 'image/png', base64: 'AQID', name: 'a.png' })
  const repo = await boundary((action, value, context) => {
    if (action === 'create-custom-cake-photo-session') { issues++; return { ...photo.session, requestId: item.requestId, expiresAt: new Date(Date.now() + 1800000).toISOString() } }
    if (action === 'upload-custom-cake-photo') {
      uploads.push(value); credentials.push(context.credential)
      if (uploads.length === 1) throw new Error('timeout')
      return { ...photo.uploaded, requestId: item.requestId }
    }
    return { ...fixture.created, requestId: item.requestId }
  })
  await assert.rejects(() => item.submit(repo, draft()))
  await item.submit(repo, draft())
  assert.equal(issues, 1)
  assert.deepEqual(uploads[1], uploads[0])
  assert.deepEqual(credentials[1], credentials[0])
  assert.throws(() => item.removePhoto(item.photos[0].uploadId), /INTENT_LOCKED/)
})

for (const code of ['QUOTE_VERSION_CONFLICT', 'QUOTE_STATE_CONFLICT']) {
  for (const action of ['updateCustomCakeQuote', 'recordCustomCakeAcceptance', 'confirmCustomCakeRequest', 'completeCustomCakeRequest', 'cancelCustomCakeRequest']) {
    test(`${action}: ${code} refetches original successful search proof`, async () => {
      const path = `${root}/src/lib/custom-cake-admin.ts`
      const admin = existsSync(path) ? await import(path) : {}
      assert.equal(typeof admin.createAdminRequestSession, 'function')
      const calls = []
      const { createCakeWireRepository } = await import(`${root}/src/lib/custom-cake-repository.ts`)
      const repo = createCakeWireRepository(async (wireAction, value, context) => {
        calls.push({ wireAction, value, context })
        if (wireAction === 'get-custom-cake-request') return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: fixture.lookup }) }
        assert.equal(context.admin, true)
        return { responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, contractVersion: 'custom-cake.v1', code }) }
      })
      const session = admin.createAdminRequestSession()
      const proof = { contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1', customerPhone: '0412345678' }
      await session.search(repo, proof)
      proof.customerPhone = '0499999999'
      const outcome = await session.mutate(repo, r => r[action]({ contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1' }))
      assert.equal(outcome.error, code)
      assert.deepEqual(outcome.snapshot, fixture.lookup)
      assert.deepEqual(calls[2].value, { contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1', customerPhone: '0412345678' })
    })
  }
}

test('admin session discards an earlier search and mutation result after a new search', async () => {
  const { createAdminRequestSession } = await import(`${root}/src/lib/custom-cake-admin.ts`)
  const session = createAdminRequestSession()
  let finishOld
  const slow = { getCustomCakeRequest: () => new Promise(resolve => { finishOld = resolve }) }
  const repo = await boundary(() => fixture.lookup)
  const proof = { contractVersion: 'custom-cake.v1', requestNumber: 'CUSTOM-EXAMPLE-1', customerPhone: '0412345678' }
  const old = session.search(slow, proof)
  await session.search(repo, proof)
  finishOld(fixture.lookup)
  assert.equal(await old, null)
  const mutation = session.mutate(repo, () => new Promise(resolve => { finishOld = resolve }))
  await session.search(repo, proof)
  finishOld(fixture.lookup)
  assert.equal(await mutation, null)
})

test('renewal quota conflict fails safely without creating an order or deleting staged photos', async () => {
  const item = intent(), calls = []
  let now = Date.now(), issues = 0
  item.selectPhoto({ name: 'a.png', mimeType: 'image/png', base64: 'AQID' })
  const { createCakeWireRepository } = await import(`${root}/src/lib/custom-cake-repository.ts`)
  const repo = createCakeWireRepository(async (action) => {
    calls.push(action)
    if (action === 'create-custom-cake-photo-session') {
      issues++
      return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: { ...photo.session, requestId: item.requestId, expiresAt: new Date(now + 1800000).toISOString() } }) }
    }
    if (issues === 2) return { responseStatusCode: 409, responseBody: JSON.stringify({ ok: false, contractVersion: 'custom-cake-photo.v1', code: 'PHOTO_LIMIT_EXCEEDED' }) }
    now += 1800001
    return { responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: { ...photo.uploaded, requestId: item.requestId } }) }
  })
  await assert.rejects(() => item.submit(repo, draft(), () => now), /PHOTO_LIMIT_EXCEEDED/)
  assert.deepEqual(calls, ['create-custom-cake-photo-session', 'upload-custom-cake-photo', 'create-custom-cake-photo-session', 'upload-custom-cake-photo'])
  assert.equal(item.locked, true)
})

test('concurrent submits share one in-flight session, upload and create operation', async () => {
  const item = intent(), calls = []
  let release
  item.selectPhoto({ name: 'a.png', mimeType: 'image/png', base64: 'AQID' })
  const repo = await boundary(async (action) => {
    calls.push(action)
    if (action === 'create-custom-cake-photo-session') {
      await new Promise(resolve => { release = resolve })
      return { ...photo.session, requestId: item.requestId, expiresAt: new Date(Date.now() + 1800000).toISOString() }
    }
    if (action === 'upload-custom-cake-photo') return { ...photo.uploaded, requestId: item.requestId }
    return { ...fixture.created, requestId: item.requestId }
  })
  const first = item.submit(repo, draft()), second = item.submit(repo, draft())
  assert.equal(first, second)
  release()
  await Promise.all([first, second])
  assert.deepEqual(calls, ['create-custom-cake-photo-session', 'upload-custom-cake-photo', 'create-custom-cake-request'])
})
