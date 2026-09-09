import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createReservationApiArchive } from '../scripts/reservation-api-deploy-rollout.mjs'

for (const phase of ['compatibility', 'full']) test(`${phase} photo archive installs its own locked dependencies and decodes actual bytes`, async () => {
  const archive = await createReservationApiArchive({ phase }), extracted = await mkdtemp(join(tmpdir(), 'custom-photo-artifact-'))
  try {
    execFileSync('tar', ['-xzf', archive.path, '-C', extracted])
    const installed = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: extracted, encoding: 'utf8', env: { PATH: process.env.PATH } })
    assert.equal(installed.status, 0, installed.stderr || installed.stdout)
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import sharp from 'sharp';
      import { normalizeCustomCakePhoto } from './src/custom-cake-photo-codec.js';
      import { createCustomCakePhotoService } from './src/custom-cake-photo-service.js';
      import { createCustomCakePhotoStorage } from './src/custom-cake-photo-storage.js';
      assert.throws(() => createCustomCakePhotoService(), {code:'CAPABILITY_UNAVAILABLE'});
      assert.throws(() => createCustomCakePhotoStorage(), {code:'CAPABILITY_UNAVAILABLE'});
      const bytes = await sharp({create:{width:4,height:3,channels:3,background:'red'}}).png().toBuffer();
      const output = await normalizeCustomCakePhoto(bytes, 'image/png');
      assert.equal(output.width,4); assert.equal(output.height,3);
      assert.equal((await sharp(output.bytes).metadata()).format,'webp');
    `], { cwd: extracted, encoding: 'utf8', env: { PATH: process.env.PATH } })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  } finally { await archive.cleanup(); await rm(extracted, { recursive: true, force: true }) }
})
