import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { normalizeReview } from '../scripts/import-customer-stories.mjs'

test('normalization preserves original English and photo-only reviews without inventing copy', () => {
  const row = {
    collection_id: 'CE0001',
    anonymous: 'aXX',
    date: '2026-10-01',
    rating: 4,
    text_original: '',
    text_en: '',
    original_language: null,
    is_translation: false,
    photos: [],
  }
  assert.equal(normalizeReview(row, 'coupang').english, '')
  assert.equal(normalizeReview(row, 'coupang').rating, 4)
  assert.equal(
    normalizeReview(
      {
        ...row,
        text_original: 'Nice cake',
        text_en: 'Nice cake',
        original_language: 'English',
      },
      'coupang',
    ).translated,
    false,
  )
})
test('selected archive counts and photo ownership are exact; home contains only three stories', async () => {
  const { reviews, counts } = JSON.parse(
    await readFile('public/customer-stories/korea.json'),
  )
  assert.deepEqual(counts, {
    reviews: 293,
    photoReviews: 215,
    photos: 255,
    baemin: 114,
    coupang: 179,
  })
  assert.equal(new Set(reviews.map((r) => r.id)).size, 293)
  const photos = reviews.flatMap((r) =>
    r.photos.map((p) => {
      assert.ok(p.id.startsWith(`${r.id}-p`))
      return p
    }),
  )
  assert.equal(new Set(photos.map((p) => p.id)).size, 255)
  await Promise.all(
    photos.flatMap((p) => [
      access(`public${p.src}`),
      access(`public${p.thumbnail}`),
    ]),
  )
  assert.ok(reviews.every((r, i) => !i || reviews[i - 1].date >= r.date))
  const home = JSON.parse(
    await readFile('src/content/customer-stories-featured.json'),
  )
  assert.deepEqual(
    home.map((r) => r.id),
    ['R0035', 'R0037', 'CE0035'],
  )
  assert.equal(home[0].photos[0].id, 'R0035-p03')
  for (const r of home)
    assert.equal(r.original, reviews.find((x) => x.id === r.id).original)
  for (const r of home) assert.ok(r.english.includes(r.mobileExcerpt))
  assert.deepEqual(
    reviews.filter((r) => /Daegu/i.test(r.english)).map((r) => r.id).sort(),
    ['CE0027', 'CE0062', 'CE0082', 'CE0148', 'CE0160'],
    'approved original customer quotations must not be silently rewritten',
  )
  for (const r of reviews)
    for (const p of r.products) assert.ok(r.original.includes(p.evidence))
})
