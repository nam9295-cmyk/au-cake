import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'
import { getHogirlResponsiveWidths } from '../src/stories/hogirl/media-contract.mjs'

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || !value) throw new Error(`Invalid argument near ${flag || 'end of input'}`)
    values.set(flag, value)
  }
  const input = values.get('--input')
  const output = values.get('--output')
  const keyPrefix = values.get('--key-prefix')
  if (!input || !output || !keyPrefix) {
    throw new Error('Usage: node scripts/hogirl-media.mjs --input DIR --output DIR --key-prefix hogirl/v1/...')
  }
  return { input: resolve(input), output: resolve(output), keyPrefix: keyPrefix.replace(/^\/+|\/+$/g, '') }
}

function stemFor(filename) {
  return basename(filename, '.webp')
}
async function convertOne(source, targetDirectory) {
  const image = sharp(source)
  const metadata = await image.metadata()
  if (!metadata.width) throw new Error(`Unable to read image width: ${source}`)

  const stem = stemFor(source)
  const widths = getHogirlResponsiveWidths(metadata.width)
  if (widths.length === 0) {
    await copyFile(source, join(targetDirectory, `${stem}.webp`))
    return
  }

  for (const width of widths) {
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(targetDirectory, `${stem}-${width}.webp`))
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 50 })
      .toFile(join(targetDirectory, `${stem}-${width}.avif`))
  }
}

async function main() {
  const { input, output, keyPrefix } = parseArgs(process.argv.slice(2))
  const targetDirectory = join(output, ...keyPrefix.split('/'))
  await mkdir(targetDirectory, { recursive: true })
  await writeFile(join(output, '_headers'), '/hogirl/v1/*\n  Cache-Control: public, max-age=31536000, immutable\n')
  const files = (await readdir(input))
    .filter((filename) => /^\d+\.webp$/i.test(filename))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
  if (files.length === 0) throw new Error(`No numbered WebP masters found in ${input}`)

  for (const filename of files) {
    await convertOne(join(input, filename), targetDirectory)
  }
  console.log(`Generated ${files.length} HOGIRL master set(s) in ${targetDirectory}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
