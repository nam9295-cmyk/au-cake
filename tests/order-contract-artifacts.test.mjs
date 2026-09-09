import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createReservationApiArchive } from '../scripts/reservation-api-deploy-rollout.mjs'
import { createNotificationArchive } from '../scripts/reservation-notification-deploy-runtime.mjs'
import { createBookingReminderArchive } from '../scripts/booking-reminder-deploy-runtime.mjs'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/order-core-golden.json', import.meta.url)))
const newCanonical = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/canonical.json', import.meta.url)))
const customWire = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url)))
const ordinaryWire = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/cake-order-v2.json', import.meta.url)))
const artifacts = [
  ['reservation-compatibility', () => createReservationApiArchive({ phase: 'compatibility' }), 'src/business.js', true],
  ['reservation-full', () => createReservationApiArchive({ phase: 'full' }), 'src/business.js', true],
  ['notification', () => createNotificationArchive(), 'shared/reservation-api/business.js', false],
  ['reminder', () => createBookingReminderArchive(), 'shared/reservation-api/business.js', false],
]

for (const [name, createArchive, parserPath, hasCreateResponse] of artifacts) {
  test(`${name}: extracted artifact imports and matches new/stored/response goldens`, async () => {
    const archive = await createArchive()
    const extracted = await mkdtemp(join(tmpdir(), 'order-contract-artifact-'))
    try {
      execFileSync('tar', ['-xzf', archive.path, '-C', extracted])
      // Only installed third-party packages are supplied; application source must
      // resolve inside this extracted archive, never via repository wrappers.
      await symlink(resolve('node_modules'), join(extracted, 'node_modules'), 'dir')
      const script = `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import path from 'node:path';
        import { pathToFileURL } from 'node:url';
        const seen = new Set();
        function verify(file) {
          file = path.resolve(file);
          assert.ok(file.startsWith(process.cwd() + path.sep));
          if (seen.has(file)) return;
          seen.add(file);
          const source = fs.readFileSync(file, 'utf8');
          for (const match of source.matchAll(/(?:from\\s*|import\\s*)['\"](\\.[^'\"]+)['\"]/g)) {
            verify(path.resolve(path.dirname(file), match[1]));
          }
        }
        verify('src/main.js');
        verify(${JSON.stringify(parserPath)});
        const entry = await import(pathToFileURL(path.resolve('src/main.js')));
        const business = await import(pathToFileURL(path.resolve(${JSON.stringify(parserPath)})));
        const { digestCakeRequestPayload } = await import(pathToFileURL(path.resolve(path.dirname(${JSON.stringify(parserPath)}), 'coupon-digest.js')));
        const capture = fn => { try { return {value:JSON.parse(JSON.stringify(fn()))} } catch(e) { return JSON.parse(JSON.stringify({error:{name:e.name,message:e.message,code:e.code,status:e.status}})) } };
        const fixtures = JSON.parse(fs.readFileSync(0, 'utf8'));
        for (const fixture of fixtures.cases) {
          if (fixture.input) {
            const canonical = capture(() => business.canonicalCakeRequestPayload(fixture.input));
            assert.deepEqual(canonical, fixture.expected.canonical, fixture.name + ': canonical');
            assert.equal(canonical.value ? JSON.stringify(canonical.value) : null, fixture.expected.canonicalJson, fixture.name + ': canonical bytes');
            assert.equal(canonical.value ? digestCakeRequestPayload(canonical.value, Buffer.alloc(32, 7)) : null, fixture.expected.requestFingerprint, fixture.name + ': fingerprint');
            assert.deepEqual(capture(() => business.buildCakeReservation(fixture.input, { ...fixture.options, now: new Date(fixture.options.now) })), fixture.expected.built, fixture.name + ': new order');
          }
          const document = fixture.document || fixture.expected.built?.value;
          if (!document) continue;
          assert.deepEqual(capture(() => business.parseStoredOrderLines(document)), fixture.expected.parsedStored, fixture.name);
          assert.deepEqual(capture(() => business.publicCakeReservation(document)), fixture.expected.lookupResponse, fixture.name);
          if (${hasCreateResponse}) assert.deepEqual(capture(() => entry.cakeReservationResponse(document)), fixture.expected.createdResponse, fixture.name);
        }
        const wireInput = await import(pathToFileURL(path.resolve(path.dirname(${JSON.stringify(parserPath)}), 'cake-order-input.js')));
        for (const fixture of fixtures.newCanonical.cases) {
          const custom = fixture.name === 'custom-cake.v1';
          const canonicalize = custom ? wireInput.canonicalCustomCakeV1Request : wireInput.canonicalCakeOrderV2Request;
          const digest = custom ? wireInput.fingerprintCustomCakeV1Request : wireInput.fingerprintCakeOrderV2Request;
          assert.equal(canonicalize(fixture.request), fixture.canonicalJson);
          assert.equal(digest(fixture.permuted, Buffer.alloc(32, 7)), fixture.fingerprint);
        }
        const wireData = await import(pathToFileURL(path.resolve(path.dirname(${JSON.stringify(parserPath)}), 'cake-order-data.js')));
        const custom = fixtures.customWire;
        const customData = wireData.buildCustomCakeV1Data(custom.request, { now: new Date(custom.created.quote.promotionEligibilityAt), requestNumber: custom.created.requestNumber, promotionStartsAt: '2026-09-01T00:00:00.000Z' });
        assert.deepEqual(customData.creationResponse, custom.created);
        assert.deepEqual(customData.lookupResponse, custom.lookup);
        const ordinary = fixtures.ordinaryWire;
        const ordinaryData = wireData.buildCakeOrderV2Data(ordinary.request, { now: new Date(ordinary.created.pricing.pricedAt), reservationNumber: ordinary.created.reservationNumber });
        assert.deepEqual(ordinaryData.creationResponse, ordinary.created);
        assert.deepEqual(ordinaryData.lookupResponse, ordinary.lookup);
      `
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: extracted, input: JSON.stringify({ ...baseline, newCanonical, customWire, ordinaryWire }), encoding: 'utf8',
        env: { PATH: process.env.PATH },
      })
      assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
      await archive.cleanup()
      await rm(extracted, { recursive: true, force: true })
    }
  })
}
