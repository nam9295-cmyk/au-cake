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

test('Pave and Vanilla return editorial detail while the other current cakes keep their existing layout', () => {
  assert.ok(getCakeEditorialBySlug('pave-chocolate-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'ko'))

  for (const slug of currentCakeSlugs.slice(2)) {
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

test('Vanilla editorial exposes the approved bilingual cake, cream, allergen, and related-product content', () => {
  const english = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en')
  const korean = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  assert.deepEqual(english.quickFacts.map((fact) => fact.title), [
    'Signature Gâteau layers',
    'Vanilla fresh cream',
    'Real vanilla bean',
    'Made to order',
  ])
  assert.deepEqual(korean.quickFacts.map((fact) => fact.title), [
    '시그니처 갸또 쇼콜라 시트',
    '바닐라 생크림',
    '실제 바닐라빈',
    '주문 후 제작',
  ])
  assert.deepEqual(english.insideCake.items, [
    'Signature chocolate cake — Our Signature Gâteau au Chocolat cake layers form the chocolate base.',
    'Vanilla fresh cream — Made with real vanilla bean.',
    'Real vanilla bean — Natural vanilla bean specks remain visible throughout the cream.',
  ])
  assert.deepEqual(korean.tasteProfile.items, [
    '시그니처 갸또 쇼콜라 시트',
    '실제 바닐라빈을 넣은 바닐라 생크림',
    '크림에 보이는 실제 바닐라빈',
  ])
  assert.equal(
    english.ingredients.ingredients,
    'Made with our Signature Gâteau au Chocolat cake layers—prepared with butter, eggs, milk, cocoa and wheat flour—and vanilla fresh cream with real vanilla bean.',
  )
  assert.equal(english.ingredients.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    english.ingredients.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(english.relatedProductSlugs.join(','), 'pave-chocolate-cake,buttercream-cake')

  const approvedCopy = JSON.stringify({ english, korean })
  assert.doesNotMatch(approvedCopy, /Plain fresh cream|No added fruit or flavour|No flavour|Chocolate cake sheets/i)
  assert.doesNotMatch(approvedCopy, /100% fresh milk|100% 신선한 우유/)
  assert.doesNotMatch(approvedCopy, /담백한 생크림|과일이나 추가 flavour 없음|초콜릿 케이크 시트/)
  assert.doesNotMatch(approvedCopy, /(?:135g|203\.3g|140g|26\.7g|750(?:-|–)?760g)/)
  assert.doesNotMatch(approvedCopy, /corn syrup|honey/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|sesame|calories|kilojoules|nutrition)\b|may contain/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|참깨|칼로리|영양/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(69|89|119)(\D|$)/)
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

test('editorial data does not duplicate live product prices and leaves missing lifestyle images optional', () => {
  const pave = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const vanilla = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en')
  assert.ok(pave)
  assert.ok(vanilla)

  assert.doesNotMatch(JSON.stringify(pave), /(^|\D)(79|99|137)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(vanilla), /(^|\D)(69|89|119)(\D|$)/)
  assert.equal(pave.lifestyle.lifestyleImage, undefined)
  assert.equal(vanilla.lifestyle.lifestyleImage, undefined)
  assert.deepEqual(vanilla.giftPresentation.imageKeys, [])
})

test('Pave and Vanilla related product preferences resolve through the current AU catalogue', () => {
  const catalogueSlugs = new Set(getAuCakeCatalogCards('en').map((card) => card.slug))

  for (const cakeSlug of ['pave-chocolate-cake', 'vanilla-fresh-cream-cake']) {
    const editorial = getCakeEditorialBySlug(cakeSlug, 'en')
    assert.ok(editorial)
    assert.equal(editorial.relatedProductSlugs.length, 2)
    for (const relatedSlug of editorial.relatedProductSlugs) {
      assert.notEqual(relatedSlug, cakeSlug)
      assert.equal(catalogueSlugs.has(relatedSlug), true, relatedSlug)
    }
  }
})
