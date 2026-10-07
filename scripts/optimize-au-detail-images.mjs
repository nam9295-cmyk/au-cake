import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { detailImageSources } from './au-detail-image-sources.mjs'
import crops from './au-detail-image-crops.json' with { type: 'json' }

// Explicit source roots; originals are only ever read. Not a production build dependency.
const sourceRoots = {
  drive: process.env.AU_DETAIL_DRIVE_ROOT,
  pencil: process.env.AU_DETAIL_PENCIL_ROOT,
}
if (!sourceRoots.drive || !sourceRoots.pencil) throw new Error('Set AU_DETAIL_DRIVE_ROOT and AU_DETAIL_PENCIL_ROOT to read-only source folders')
const selectedProduct = process.env.AU_DETAIL_PRODUCT
const selectedRole = process.env.AU_DETAIL_ROLE
if (Boolean(selectedProduct) !== Boolean(selectedRole)) throw new Error('Set both AU_DETAIL_PRODUCT and AU_DETAIL_ROLE to regenerate one image')
const manifestPath = resolve('src/lib/au-detail-image-manifest.json')
const manifest = selectedProduct ? JSON.parse(await readFile(manifestPath, 'utf8')) : {}
let originalBytes = 0
let generatedBytes = 0
const countedSources = new Set()
for (const [product, images] of Object.entries(detailImageSources)) {
  if (selectedProduct && product !== selectedProduct) continue
  manifest[product] ||= {}
  await mkdir(resolve('public/products/details', product), { recursive: true })
  const generated = new Map()
  for (const [role, source] of Object.entries(images)) {
    if (selectedRole && role !== selectedRole) continue
    const [root, ...relative] = source.split('/')
    const bytes = await readFile(join(sourceRoots[root], ...relative))
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const crop = crops[product]?.[role]
    const imageKey = `${sha256}:${JSON.stringify(crop || null)}`
    if (generated.has(imageKey)) {
      manifest[product][role] = { ...generated.get(imageKey), source }
      continue
    }
    let input = sharp(bytes).rotate()
    const metadata = await input.metadata()
    let width = metadata.autoOrient?.width || metadata.width
    let height = metadata.autoOrient?.height || metadata.height
    if (crop) {
      // Pencil's normalized affine fill, baked into a generated raster copy.
      // This keeps the exact approved crop (including Cupcake's rotation)
      // without fragile viewport-dependent CSS transforms or modifying originals.
      const outputWidth = Math.round(crop.width * 2)
      const outputHeight = Math.round(crop.height * 2)
      const [a, b, c, d, e, f] = crop.transform
      const matrix = [a * outputWidth / width, b * outputHeight / width, c * outputWidth / height, d * outputHeight / height, e * outputWidth, f * outputHeight]
      // librsvg embeds PNG/JPEG, not WebP. Bound oversized intermediate copies
      // below libxml's 10MB data-URI limit while retaining alpha and originals.
      const useOriginal = ['png', 'jpeg'].includes(metadata.format) && bytes.length < 6_500_000 && !metadata.orientation
      const embedded = useOriginal ? bytes : await sharp(bytes).rotate().resize({ width: Math.min(width, 1600), withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
      const mime = useOriginal && metadata.format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outputWidth}" height="${outputHeight}"><image width="${width}" height="${height}" transform="matrix(${matrix.join(' ')})" xlink:href="data:${mime};base64,${embedded.toString('base64')}"/></svg>`
      // Pencil rotates the filled frame counter-clockwise after applying its crop.
      input = sharp(Buffer.from(svg)).rotate((360 - (crop.rotation || 0)) % 360)
      const quarterTurn = Math.abs(crop.rotation || 0) % 180 === 90
      width = quarterTurn ? outputHeight : outputWidth
      height = quarterTurn ? outputWidth : outputHeight
    }
    const maxWidth = role === 'hero' || role === 'inside' || role === 'video-poster' ? 1440 : 960
    const widths = [...new Set([Math.min(480, width), Math.min(maxWidth, width)])]
    const variants = []
    if (!countedSources.has(sha256)) { originalBytes += bytes.length; countedSources.add(sha256) }
    for (const outputWidth of widths) {
      const src = `/products/details/${product}/${role}-${outputWidth}.webp`
      const output = await input.clone().resize({ width: outputWidth, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer()
      await writeFile(resolve(`public${src}`), output)
      variants.push({ src, width: outputWidth, bytes: output.length })
      generatedBytes += output.length
    }
    const image = { source, sha256, originalBytes: bytes.length, ...(crop ? { pencilCrop: crop } : {}), width, height, src: variants.at(-1).src, variants }
    manifest[product][role] = image
    generated.set(imageKey, image)
  }
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ originalBytes, generatedBytes, products: Object.keys(manifest).length }))
