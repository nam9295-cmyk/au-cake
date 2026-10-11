import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import content from '../src/content/au-business-services.json' with { type: 'json' }

if (!process.argv[2])
  throw Error('Provide the read-only Pencil design directory')
const sourceRoot = resolve(process.argv[2])
await mkdir('public/business', { recursive: true })
const output = {}
const manifest = []
for (const [id, asset] of Object.entries(content.assets)) {
  const input = await readFile(join(sourceRoot, asset.source))
  const metadata = await sharp(input).metadata()
  const variants = []
  for (const width of asset.wide ? [640, 1280, 1920] : [480, 960]) {
    const path = `/business/${id}-${width}.webp`
    const info = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 83 })
      .toFile(`public${path}`)
    variants.push({
      src: path,
      width: info.width,
      height: info.height,
      bytes: (await stat(`public${path}`)).size,
    })
  }
  output[id] = {
    alt: asset.alt,
    width: metadata.width,
    height: metadata.height,
    variants,
  }
  manifest.push({
    id,
    source: asset.source,
    sourceSha256: createHash('sha256').update(input).digest('hex'),
    sourceBytes: input.length,
    variants,
  })
}
await writeFile(
  'src/content/au-service-assets.json',
  JSON.stringify(output, null, 2) + '\n',
)
await mkdir('docs/services-stories', { recursive: true })
await writeFile(
  'docs/services-stories/service-asset-manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log(
  JSON.stringify({
    assets: manifest.length,
    sourceBytes: manifest.reduce((s, a) => s + a.sourceBytes, 0),
    optimizedBytes: manifest.reduce(
      (s, a) => s + a.variants.reduce((n, v) => n + v.bytes, 0),
      0,
    ),
  }),
)
