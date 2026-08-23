import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getAuCakeCatalogCards } from '../src/lib/cake-catalog.js'
import { getCakeEditorialBySlug } from '../src/lib/cake-editorial.js'

const currentCakeSlugs = [
  'pave-chocolate-cake',
  'vanilla-fresh-cream-cake',
  'buttercream-cake',
  'chocolate-cupcakes',
  'signature-gateau-au-chocolat',
  'lemon-cake',
  'brownie-cheesecake',
] as const

test('only Pave returns the editorial detail while the other current cakes keep their existing layout', () => {
  assert.ok(getCakeEditorialBySlug('pave-chocolate-cake', 'en'))
  for (const slug of currentCakeSlugs.slice(1)) {
    assert.equal(getCakeEditorialBySlug(slug, 'en'), null, slug)
    assert.equal(getCakeEditorialBySlug(slug, 'ko'), null, slug)
  }
  assert.equal(getCakeEditorialBySlug('not-a-cake', 'en'), null)
})

test('Pave editorial exposes complete English and Korean section content', () => {
  const english = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const korean = getCakeEditorialBySlug('pave-chocolate-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  assert.equal(english.quickFacts[0]?.title, 'Four layers')
  assert.equal(korean.quickFacts[0]?.title, '초콜릿 케이크 4단')
  assert.deepEqual(english.moments.map((moment) => moment.title), [
    'Birthday centrepiece',
    'Anniversary moment',
    'Thoughtful chocolate gift',
  ])
  assert.deepEqual(korean.moments.map((moment) => moment.title), [
    '생일을 위한 메인 케이크',
    '기념일을 위한 초콜릿 케이크',
    '마음을 전하는 초콜릿 선물',
  ])
  assert.deepEqual(english.insideCake.items, [
    'Four chocolate cake layers',
    'Smooth pavé ganache between each layer',
    'Pavé ganache around the entire cake',
  ])
  assert.deepEqual(korean.tasteProfile.items, [
    '진한 초콜릿 풍미',
    '중간 정도의 단맛',
    '촉촉한 케이크 · 부드러운 가나슈 · 묵직한 마무리',
  ])
})

test('Pave ingredients contain only the approved verified ingredient and allergen claims', () => {
  const english = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const korean = getCakeEditorialBySlug('pave-chocolate-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  assert.equal(
    english.ingredients.ingredients,
    'Made with 57.9% dark couverture chocolate, fresh cream, cocoa powder, butter, eggs, milk and wheat flour.',
  )
  assert.equal(english.ingredients.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    english.ingredients.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.match(korean.ingredients.ingredients, /57\.9% 다크 커버춰 초콜릿/)

  const approvedCopy = JSON.stringify({ english, korean })
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|sesame|calories|kilojoules|nutrition)\b|may contain|1:1 ganache/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|참깨|칼로리|영양|1:1 가나슈/)
})

test('editorial data does not duplicate live product prices and leaves the missing lifestyle image optional', () => {
  const english = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  assert.ok(english)
  const serialized = JSON.stringify(english)
  assert.doesNotMatch(serialized, /(^|\D)(79|99|137)(\D|$)/)
  assert.equal(english.lifestyle.lifestyleImage, undefined)
})

test('Pave related product preferences resolve through the current AU catalogue', () => {
  const editorial = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  assert.ok(editorial)
  const catalogueSlugs = new Set(getAuCakeCatalogCards('en').map((card) => card.slug))

  assert.equal(editorial.relatedProductSlugs.length, 2)
  for (const slug of editorial.relatedProductSlugs) {
    assert.notEqual(slug, 'pave-chocolate-cake')
    assert.equal(catalogueSlugs.has(slug), true, slug)
  }
})
