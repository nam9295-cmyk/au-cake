import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { rolldown } from 'rolldown'

const tests = process.argv.slice(2)
if (tests.length === 0) throw new Error('Provide at least one test file')

const directory = await mkdtemp(join(tmpdir(), 'au-cake-bundled-tests-'))
try {
  const entries = []
  for (const [index, file] of tests.entries()) {
    if (!file.endsWith('.ts')) {
      entries.push(resolve(file))
      continue
    }
    const output = join(directory, `${index}-${basename(file, '.ts')}.mjs`)
    // Node ESM needs createRequire for bundled CommonJS SDK dependencies.
    // Rolldown's node platform supplies it; bare esbuild ESM does not.
    const bundle = await rolldown({
      input: resolve(file),
      platform: 'node',
      transform: { define: { 'import.meta.env': '{}' } },
    })
    try {
      await bundle.write({ file: output, format: 'esm', codeSplitting: false })
    } finally {
      await bundle.close()
    }
    entries.push(output)
  }
  const result = spawnSync(process.execPath, ['--test', ...entries], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
