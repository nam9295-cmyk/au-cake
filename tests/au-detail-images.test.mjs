import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { detailImageSources } from '../scripts/au-detail-image-sources.mjs'

test('generated detail pictures resolve to valid responsive WebP images without local source paths', async () => {
  const manifestPath = 'src/lib/au-detail-image-manifest.json'
  assert.ok(existsSync(manifestPath), 'optimized image manifest must be generated')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.smore.packaging.source, 'pencil/au-site-redesign-assets/smore.png', 'S’more packaging uses the visible foreground photo, not the hidden Lemon background fill')
  assert.equal(manifest.cupcakes.inside.width / manifest.cupcakes.inside.height, 786 / 491, 'Cupcake inside photograph retains the approved Desktop crop')
  assert.equal(manifest['signature-gateau'].inside.pencilCrop.rotation, 90, 'Signature Gâteau inside photograph retains the 90° Pencil frame rotation')
  assert.equal(manifest['signature-gateau'].inside.width / manifest['signature-gateau'].inside.height, 788 / 458, 'Signature Gâteau inside photograph remains landscape after rotation')
  for (const [product, sources] of Object.entries(detailImageSources)) {
    for (const role of Object.keys(sources)) {
      const image = manifest[product][role]
      assert.ok(image.width > 0 && image.height > 0)
      assert.ok(image.variants.length >= 1)
      assert.doesNotMatch(image.src, /\/Users\/|drive\/|pencil\//)
      for (const variant of image.variants) {
        const metadata = await sharp(`public${variant.src}`).metadata()
        assert.equal(metadata.format, 'webp')
        assert.equal(metadata.width, variant.width)
        assert.ok(variant.bytes > 0)
        const stats = await sharp(`public${variant.src}`).stats()
        assert.ok(stats.entropy > 1, `${product}/${role}: photograph must contain visible image content`)
      }
    }
  }
})
