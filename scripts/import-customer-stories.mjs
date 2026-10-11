import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

export const sources = { baemin: 'baemin-korean-reviews-with-photos_2026-07-07_2026-10-07', coupang: 'coupang-reviews_2026-07-07_2026-10-07' }
const products = [
  ['pave', 'Pavé chocolate / cake', /파베|pav[eé]/iu],
  ['cheesecake', 'Cheesecake', /치즈\s*케[이익]크|치케|바스크|cheesecake|basque/iu],
  ['gateau', 'Gâteau', /갸또|가토|g[âa]teau/iu],
  ['cupcake', 'Cupcakes', /컵\s*케[이익]크|cupcake/iu],
  ['cookie', 'Cookies', /쿠키|두쫀쿠|cookie/iu],
  ['tiramisu', 'Tiramisu', /티라미수|tiramisu/iu],
  ['chocolate', 'Chocolate', /초콜릿|초코|chocolate/iu],
]
export function normalizeReview(row, platform) {
  const id = row.id ?? row.collection_id
  const original = row.text_original_ko ?? row.text_original
  const photos = row.photos.map((p) => ({ id: p.photo_key ?? p.key, sourceFile: p.file ?? p.path, width: p.width, height: p.height, privacyMasked: p.privacy_redacted === true || /mask|redact|cover/i.test(p.privacy_action || ''), src: `/customer-stories/photos/${p.photo_key ?? p.key}-1200.webp`, thumbnail: `/customer-stories/photos/${p.photo_key ?? p.key}-480.webp` }))
  return { id, platform, nickname: row.nickname ?? row.anonymous, date: row.date, rating: row.rating, original, english: row.text_en, originalLanguage: platform === 'baemin' ? 'Korean' : row.original_language, translated: platform === 'baemin' ? true : row.is_translation, promotionMentioned: row.extra_item_or_promotion_mentioned ?? row.promotion_or_extra_item_mentioned, photos, products: products.filter(([, , pattern]) => pattern.test(original)).map(([id, label, pattern]) => ({ id, label, evidence: original.match(pattern)[0] })) }
}
export async function importStories(root) {
  const { default: sharp } = await import('sharp')
  const reviews = []
  const audit = []
  await mkdir('public/customer-stories/photos', { recursive: true })
  await mkdir('src/content', { recursive: true })
  for (const [platform, folder] of Object.entries(sources)) {
    const raw = JSON.parse(await readFile(join(root, folder, 'reviews.json'), 'utf8'))
    for (const row of raw.reviews) {
      const review = normalizeReview(row, platform)
      for (const photo of review.photos) {
        if (!/^photos\/[A-Za-z0-9-]+\.jpg$/.test(photo.sourceFile) || !photo.id.startsWith(`${review.id}-p`)) throw new Error(`Invalid photo association ${review.id}`)
        const source = join(root, folder, photo.sourceFile)
        const bytes = await readFile(source)
        let optimizedBytes = 0
        for (const width of [480, 1200]) {
          const output = `public/customer-stories/photos/${photo.id}-${width}.webp`
          await sharp(bytes).resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(output)
          optimizedBytes += (await stat(output)).size
        }
        audit.push({ reviewId: review.id, platform, photoId: photo.id, source: `${folder}/${photo.sourceFile}`, sourceSha256: createHash('sha256').update(bytes).digest('hex'), sourceBytes: bytes.length, optimizedBytes })
      }
      reviews.push(review)
    }
  }
  reviews.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  const counts = { reviews: reviews.length, photoReviews: reviews.filter(r => r.photos.length).length, photos: audit.length, baemin: reviews.filter(r => r.platform === 'baemin').length, coupang: reviews.filter(r => r.platform === 'coupang').length }
  if (JSON.stringify(counts) !== JSON.stringify({ reviews: 293, photoReviews: 215, photos: 255, baemin: 114, coupang: 179 })) throw new Error(`Source counts differ ${JSON.stringify(counts)}`)
  const featured = [['R0035', 'R0035-p03', 'Pavé Chocolate Cake'], ['R0037', 'R0037-p01', 'Signature Gâteau au Chocolat'], ['CE0035', 'CE0035-p01', 'Brownie Basque Cheesecake']].map(([id, photoId, title]) => {
    const review = reviews.find(r => r.id === id)
    if (!review?.photos.some(p => p.id === photoId)) throw new Error(`Missing featured association ${id}`)
    return { ...review, title, photos: [...review.photos].sort((a, b) => Number(b.id === photoId) - Number(a.id === photoId)) }
  })
  await writeFile('public/customer-stories/korea.json', JSON.stringify({ counts, reviews }))
  await writeFile('src/content/customer-stories-featured.json', JSON.stringify(featured, null, 2) + '\n')
  await mkdir('docs/services-stories', { recursive: true })
  await writeFile('docs/services-stories/customer-photo-manifest.json', JSON.stringify({ counts, photos: audit }, null, 2) + '\n')
  console.log(JSON.stringify({ counts, sourceBytes: audit.reduce((s,p)=>s+p.sourceBytes,0), optimizedBytes: audit.reduce((s,p)=>s+p.optimizedBytes,0) }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/import-customer-stories.mjs SOURCE_REVIEW_DIRECTORY')
  await importStories(resolve(process.argv[2]))
}
