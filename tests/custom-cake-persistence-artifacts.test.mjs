import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createReservationApiArchive } from '../scripts/reservation-api-deploy-rollout.mjs'

for (const phase of ['compatibility', 'full']) test(`${phase} extracted archive independently imports private persistence and roundtrips stored fixtures`, async () => {
  const archive = await createReservationApiArchive({ phase }), extracted = await mkdtemp(join(tmpdir(), 'custom-persistence-artifact-'))
  try {
    execFileSync('tar', ['-xzf', archive.path, '-C', extracted])
    await symlink(resolve('node_modules'), join(extracted, 'node_modules'), 'dir')
    const script = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import { encodeCustomCakeRecord, decodeCustomCakeRecord, resolveCustomCakePersistenceConfig, createCustomCakeRepository } from './src/custom-cake-persistence.js';
      assert.equal(typeof createCustomCakeRepository, 'function');
      assert.deepEqual(resolveCustomCakePersistenceConfig({}), {enabled:false});
      for (const f of JSON.parse(fs.readFileSync(0, 'utf8'))) {
        const saved = {request:f.request, creationResponse:f.created, lookupResponse:f.lookup, quoteHistory:[], transitionAudit:[]};
        assert.deepEqual(decodeCustomCakeRecord('snapshots', encodeCustomCakeRecord('snapshots', saved)), saved);
      }
    `
    const fixtures = ['custom-v1', 'cake-order-v2'].map(name => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${name}.json`, import.meta.url))))
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: extracted, input: JSON.stringify(fixtures), encoding: 'utf8', env: { PATH: process.env.PATH } })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  } finally { await archive.cleanup(); await rm(extracted, { recursive: true, force: true }) }
})
