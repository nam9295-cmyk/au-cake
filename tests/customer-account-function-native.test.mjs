import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
// Break caught: a vulnerable dependency or broken decoder must stop packaging.
test('reservation artifact executes patched codecs and rejects unsupported input', () => {
 const r=spawnSync(process.execPath,['appwrite-functions/reservation-api/scripts/native-smoke.mjs'],{encoding:'utf8'})
 assert.equal(r.status,0,r.stderr)
 const result=JSON.parse(r.stdout)
 assert.equal(result.sharp,'0.35.5')
 assert.deepEqual(result.formats,['jpeg','png','webp'])
 assert.equal(result.rejectedSvg,true)
 assert.equal(result.rejectedTruncated,true)
})
test('Linux Node22 native gate refuses a Mac or non-Node22 build', {skip:process.platform==='linux'&&process.versions.node.startsWith('22.')}, () => {
 const r=spawnSync(process.execPath,['appwrite-functions/reservation-api/scripts/native-smoke.mjs','--linux-node22'],{encoding:'utf8'})
 assert.notEqual(r.status,0)
 assert.match(r.stderr,/NATIVE_PLATFORM_MISMATCH/)
})
