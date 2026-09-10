import { rolldown } from 'rolldown'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const directory = await mkdtemp(join(tmpdir(), 'custom-cake-ui-'))
try {
  const bundle = await rolldown({
    input: 'tests/custom-cake-ui.test.mjs', platform: 'node',
    transform: { define: { 'import.meta.env': JSON.stringify({ VITE_MARKET: 'AU', VITE_APPWRITE_ENDPOINT: 'https://example.invalid/v1', VITE_APPWRITE_PROJECT_ID: 'test-project', VITE_APPWRITE_CAKE_DATABASE_ID: 'test-database', VITE_RESERVATION_API_MODE: 'all' }) } },
    plugins: [{ name: 'test-assets', load(id) { if (/\.(png|jpg|webp|svg)$/.test(id)) return 'export default "test-image"' } }],
  })
  const file = join(directory, 'ui.test.mjs')
  await bundle.write({ file, format: 'esm', codeSplitting: false })
  await bundle.close()
  const result = spawnSync(process.execPath, ['--test', file], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally { await rm(directory, { recursive: true, force: true }) }
