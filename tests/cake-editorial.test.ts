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

test('all seven current cakes return editorial detail while unknown slugs keep the existing layout', () => {
  assert.ok(getCakeEditorialBySlug('pave-chocolate-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'ko'))
  assert.ok(getCakeEditorialBySlug('buttercream-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('buttercream-cake', 'ko'))
  assert.ok(getCakeEditorialBySlug('chocolate-cupcakes', 'en'))
  assert.ok(getCakeEditorialBySlug('chocolate-cupcakes', 'ko'))
  assert.ok(getCakeEditorialBySlug('lemon-cake', 'en'))
  assert.ok(getCakeEditorialBySlug('lemon-cake', 'ko'))
  assert.ok(getCakeEditorialBySlug('signature-gateau-au-chocolat' as string, 'en'))
  assert.ok(getCakeEditorialBySlug('signature-gateau-au-chocolat' as string, 'ko'))
  assert.ok(getCakeEditorialBySlug('brownie-cheesecake', 'en'))
  assert.ok(getCakeEditorialBySlug('brownie-cheesecake', 'ko'))

  for (const slug of currentCakeSlugs) {
    assert.ok(getCakeEditorialBySlug(slug, 'en'), slug)
    assert.ok(getCakeEditorialBySlug(slug, 'ko'), slug)
  }
  assert.equal(getCakeEditorialBySlug('not-a-cake', 'en'), null)
})

test('Brownie Cheesecake compact editorial exposes only its verified two-layer, finish, ingredient, and allergen content', () => {
  const english = getCakeEditorialBySlug('brownie-cheesecake', 'en')
  const korean = getCakeEditorialBySlug('brownie-cheesecake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string; body?: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    storageAndServing?: unknown
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((highlight) => highlight.title), [
    'DARK CHOCOLATE BROWNIE BASE',
    'BASQUE CHEESECAKE ON TOP',
    'TWO DESSERTS IN ONE',
  ])
  assert.deepEqual(compactKorean.highlights?.map((highlight) => highlight.title), [
    '다크초콜릿 브라우니 베이스',
    '위에는 바스크 치즈케이크',
    '두 가지 디저트를 한 번에',
  ])
  assert.deepEqual(compactEnglish.details?.items, [
    'Dark chocolate brownie — The lower layer is baked with dark chocolate, butter and cocoa for a rich chocolate base.',
    'Basque-style cheesecake — The upper layer is made with cream cheese, fresh cream and eggs, with a small amount of fresh lemon and vanilla.',
    'Two-layer bake — The brownie and cheesecake are baked together to create two distinct layers in every slice.',
    'Basic — Enjoy the brownie and cheesecake layers in their classic form.',
    'Pave chocolate on top — Finished with smooth pave chocolate on top for a richer chocolate finish.',
    'Full pave finish — Fully finished with pave chocolate and topped with one Eiffel Tower chocolate.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'The brownie base is made with dark chocolate, butter, eggs, cocoa and wheat flour. The cheesecake layer is made with cream cheese, fresh cream and eggs, with fresh lemon and vanilla.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(compactEnglish.storageAndServing, undefined)
  assert.equal(compactKorean.storageAndServing, undefined)
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'pave-chocolate-cake,signature-gateau-au-chocolat')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.match(approvedCopy, /dark chocolate brownie|다크초콜릿 브라우니/i)
  assert.match(approvedCopy, /Basque-style cheesecake|바스크 스타일 치즈케이크/)
  assert.match(approvedCopy, /cream cheese|크림치즈/)
  assert.match(approvedCopy, /fresh cream|생크림/)
  assert.doesNotMatch(approvedCopy, /(?:122g|153g|126g|117g|18g|363g|108g|121\.2g|202\.8g|7\.2g|1\.8g|18cm|190°C|30 min|10 min|24-hour)/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|peanuts?|sesame|calories|kilojoules|nutrition)\b|may contain|gluten-free|nut-free/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|땅콩|참깨|칼로리|영양|글루텐 프리|너트 프리/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(55|65|70)(\D|$)/)
})

test('Signature Gâteau au Chocolat compact editorial exposes only its verified cake, finish, ingredient, and allergen content', () => {
  const english = getCakeEditorialBySlug('signature-gateau-au-chocolat' as string, 'en')
  const korean = getCakeEditorialBySlug('signature-gateau-au-chocolat' as string, 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string; body?: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    storageAndServing?: unknown
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((highlight) => highlight.title), [
    'SIGNATURE CHOCOLATE CAKE',
    'CHOOSE YOUR FINISH',
    'MADE TO ORDER',
  ])
  assert.deepEqual(compactKorean.highlights?.map((highlight) => highlight.title), [
    '시그니처 갸또 쇼콜라',
    '원하는 마감 선택',
    '주문 후 제작',
  ])
  assert.deepEqual(compactEnglish.details?.items, [
    'Signature Gâteau au Chocolat — A rich chocolate cake made with butter, eggs, milk, cocoa and wheat flour.',
    'Basic finish — Enjoy the Signature Gâteau au Chocolat in its classic form.',
    'Extra chocolate — Finished with melted chocolate poured over the cake.',
    'Vanilla fresh cream — Finished with the same real-vanilla fresh cream used in our Vanilla Fresh Cream Cake.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'Our Signature Gâteau au Chocolat is made with butter, eggs, milk, cocoa and wheat flour. Finish ingredients vary with the option selected. Vanilla Fresh Cream is made with real vanilla bean; the Extra Chocolate finish uses melted chocolate.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(compactEnglish.storageAndServing, undefined)
  assert.equal(compactKorean.storageAndServing, undefined)
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'pave-chocolate-cake,fresh-strawberry-vanilla-cream-cake')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.match(approvedCopy, /Signature Gâteau au Chocolat|시그니처 갸또 쇼콜라/)
  assert.match(approvedCopy, /melted chocolate|녹인 초콜릿/)
  assert.match(approvedCopy, /Vanilla Fresh Cream|바닐라 생크림/)
  assert.match(approvedCopy, /real vanilla bean|실제 바닐라빈/)
  assert.doesNotMatch(approvedCopy, /750(?:-|–)?760g|750(?:-|–)?760g|\b750g\b|\b760g\b|corn syrup|honey/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|peanuts?|sesame|calories|kilojoules|nutrition)\b|may contain|gluten-free|nut-free/i)
  assert.doesNotMatch(approvedCopy, /100% milk butter|Australian butter|Aussi|organic cocoa|fresh milk buttercream|couverture chocolate buttercream/i)
  assert.doesNotMatch(approvedCopy, /\b(?:45|52|55)\b/)
})

test('Lemon compact editorial exposes only the verified fresh lemon, syrup, glaze, ingredient, and allergen content', () => {
  const english = getCakeEditorialBySlug('lemon-cake', 'en')
  const korean = getCakeEditorialBySlug('lemon-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string; body?: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    storageAndServing?: unknown
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((highlight) => highlight.title), [
    'FRESHLY SQUEEZED LEMON JUICE',
    'FRESH LEMON ZEST',
    'LEMON SYRUP & GLAZE',
  ])
  assert.deepEqual(compactKorean.highlights?.map((highlight) => highlight.title), [
    '신선한 레몬즙을 직접 짜서 제조',
    '신선한 레몬 제스트',
    '레몬 시럽과 글레이즈',
  ])
  assert.deepEqual(compactEnglish.details?.items, [
    'Fresh lemon cake — Made with freshly squeezed lemon juice and fresh lemon zest.',
    'Lemon syrup — Fresh lemon juice and zest are used to make the lemon syrup.',
    'Fresh lemon glaze — Finished with an icing sugar glaze made with freshly squeezed lemon juice.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'Made with freshly squeezed lemon juice, fresh lemon zest, butter, eggs and wheat flour, with a lemon syrup and fresh lemon glaze.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(compactEnglish.storageAndServing, undefined)
  assert.equal(compactKorean.storageAndServing, undefined)
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'chocolate-cupcakes,fresh-strawberry-vanilla-cream-cake')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(approvedCopy, /fresh lemon cream|레몬 크림/i)
  assert.doesNotMatch(approvedCopy, /(?:250g|240g|\b3 large eggs\b|1⅓ cups|¼ cup|¾ cup|1½ cups|3–5 tbsp|12 Lemon Cakes)/i)
  assert.doesNotMatch(approvedCopy, /sour cream\s+OR\s+Greek yogurt|vanilla extract\s+OR\s+vanilla paste/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|peanuts?|sesame|calories|kilojoules|nutrition)\b|may contain|gluten-free|nut-free/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|땅콩|참깨|칼로리|영양|글루텐 프리|너트 프리/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(36|45|65|85)(\D|$)/)
})

test('Cupcakes compact editorial exposes only the approved finish, ingredient, packaging, and allergen content', () => {
  const english = getCakeEditorialBySlug('chocolate-cupcakes', 'en')
  const korean = getCakeEditorialBySlug('chocolate-cupcakes', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((fact) => fact.title), [
    'Signature chocolate cake',
    'Three finishes',
    'Half dozen or dozen',
  ])
  assert.deepEqual(compactKorean.highlights?.map((fact) => fact.title), [
    '시그니처 초콜릿 케이크',
    '3가지 마감',
    '6개 또는 12개 구성',
  ])
  assert.equal(compactEnglish.details?.title, 'CHOOSE YOUR FINISH')
  assert.equal(compactKorean.details?.title, '원하는 마감을 선택하세요')
  assert.deepEqual(compactEnglish.details?.items, [
    'Basic — Choose the current Basic finish for the whole box.',
    'Vanilla Fresh Cream — Vanilla fresh cream made with 100% fresh milk and real vanilla bean.',
    'Chocolate Buttercream — Italian meringue chocolate buttercream made with real butter and cocoa powder.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'Our signature chocolate cupcakes are made with butter, eggs, milk, cocoa and wheat flour. Vanilla Fresh Cream is made with 100% fresh milk and real vanilla bean. Chocolate Buttercream is Italian meringue buttercream made with real butter and cocoa powder.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.match(compactEnglish.details?.items.join(' '), /Basic|Vanilla Fresh Cream|Chocolate Buttercream/)
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'lemon-cake,buttercream-cake')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(approvedCopy, /(?:750(?:-|–)?760g|75(?:-|–)?76g|\b75g\b|\b76g\b|\b10 cupcakes?\b|\b10개\b)/i)
  assert.doesNotMatch(approvedCopy, /corn syrup|honey/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|peanuts?|sesame|calories|kilojoules|nutrition)\b|may contain|gluten-free|nut-free/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|땅콩|참깨|칼로리|영양|글루텐 프리|너트 프리/)
  assert.doesNotMatch(approvedCopy, /AUD 0\.50|100\+/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(31|36|41|55|64|73)(\D|$)/)
})

test('Pave exposes the approved compact bilingual detail contract', () => {
  const english = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const korean = getCakeEditorialBySlug('pave-chocolate-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string }[]
    orderingNotice?: { title: string; body: string }
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: {
      title: string
      ingredientsLabel: string
      ingredients: string
      allergenLabel: string
      allergens: string
      contact: string
    }
    storageAndServing?: unknown
    pickupAndConfirmation?: { title: string }
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((highlight) => highlight.title), [
    'Four chocolate layers',
    'Smooth pavé ganache',
    '57.9% dark couverture chocolate',
  ])
  assert.deepEqual(compactKorean.highlights?.map((highlight) => highlight.title), [
    '초콜릿 케이크 4단',
    '부드러운 파베 가나슈',
    '57.9% 다크 커버춰 초콜릿',
  ])
  assert.equal(compactEnglish.highlights?.length, 3)
  assert.equal(compactKorean.highlights?.length, 3)
  assert.equal(compactEnglish.orderingNotice?.title, 'Made to order · Melrose Park pick-up')
  assert.equal(
    compactEnglish.orderingNotice?.body,
    'No payment is taken now. Our team confirms availability before sending payment details.',
  )
  assert.equal(compactKorean.orderingNotice?.title, '주문 후 제작 · Melrose Park 픽업')
  assert.equal(
    compactKorean.orderingNotice?.body,
    '지금 결제되지 않습니다. 베리굿 팀이 제작 가능 여부를 확인한 뒤 결제 정보를 안내합니다.',
  )
  assert.equal(compactEnglish.details?.title, 'Cake details')
  assert.deepEqual(compactEnglish.details?.items, [
    'Four chocolate cake layers',
    'Smooth pavé ganache between each layer',
    'Pavé ganache around the entire cake',
    'A rich, chocolate-forward cake with moist chocolate layers and silky ganache.',
  ])
  assert.equal(compactKorean.details?.title, '케이크 상세')
  assert.equal(compactEnglish.ingredientsAndAllergens?.title, 'Ingredients & allergens')
  assert.equal(compactEnglish.ingredientsAndAllergens?.ingredientsLabel, 'Key ingredients')
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergenLabel, 'Allergen note')
  assert.equal(compactEnglish.pickupAndConfirmation?.title, 'Pick-up & order confirmation')
  assert.equal(compactKorean.pickupAndConfirmation?.title, '픽업 및 주문 확정')
  assert.equal(compactEnglish.storageAndServing, undefined)
  assert.equal(compactKorean.storageAndServing, undefined)

  const compactCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(compactCopy, /Celebration Story|Made for moments|Eiffel Tower|Final CTA|Medium sweetness|dense finish/i)
})

test('Vanilla compact editorial preserves the approved cake, cream, allergen, and related-product content', () => {
  const english = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en')
  const korean = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((fact) => fact.title), [
    'Signature Gâteau layers',
    'Vanilla fresh cream',
    'Real vanilla bean',
  ])
  assert.deepEqual(compactKorean.highlights?.map((fact) => fact.title), [
    '시그니처 갸또 쇼콜라 시트',
    '바닐라 생크림',
    '실제 바닐라빈',
  ])
  assert.deepEqual(compactEnglish.details?.items, [
    'Signature chocolate cake — Our Signature Gâteau au Chocolat cake layers form the chocolate base.',
    'Vanilla fresh cream — Made with real vanilla bean.',
    'Real vanilla bean — Natural vanilla bean specks remain visible throughout the cream.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'Made with our Signature Gâteau au Chocolat cake layers—prepared with butter, eggs, milk, cocoa and wheat flour—and vanilla fresh cream with real vanilla bean.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'pave-chocolate-cake,buttercream-cake')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(approvedCopy, /Plain fresh cream|No added fruit or flavour|No flavour|Chocolate cake sheets/i)
  assert.doesNotMatch(approvedCopy, /100% fresh milk|100% 신선한 우유/)
  assert.doesNotMatch(approvedCopy, /담백한 생크림|과일이나 추가 flavour 없음|초콜릿 케이크 시트/)
  assert.doesNotMatch(approvedCopy, /(?:135g|203\.3g|140g|26\.7g|750(?:-|–)?760g)/)
  assert.doesNotMatch(approvedCopy, /corn syrup|honey/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|sesame|calories|kilojoules|nutrition)\b|may contain/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|참깨|칼로리|영양/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(69|89|119)(\D|$)/)
})

test('Buttercream compact editorial preserves the approved Italian meringue, butter, cocoa, allergen, and colour content', () => {
  const english = getCakeEditorialBySlug('buttercream-cake', 'en')
  const korean = getCakeEditorialBySlug('buttercream-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    layout?: string
    highlights?: readonly { title: string }[]
    details?: { title: string; items: readonly string[] }
    ingredientsAndAllergens?: { ingredients: string; allergens: string; contact: string }
    relatedProductSlugs: readonly string[]
  }
  const compactKorean = korean as unknown as typeof compactEnglish

  assert.equal(compactEnglish.layout, 'compact')
  assert.equal(compactKorean.layout, 'compact')
  assert.deepEqual(compactEnglish.highlights?.map((fact) => fact.title), [
    'Italian meringue',
    'Real butter',
    'Cocoa powder',
  ])
  assert.deepEqual(compactKorean.highlights?.map((fact) => fact.title), [
    '이탈리안 머랭',
    '버터 사용',
    '코코아 파우더',
  ])
  assert.deepEqual(compactEnglish.details?.items, [
    'Signature chocolate cake — Our Signature Gâteau au Chocolat cake layers form the chocolate base.',
    'Italian meringue buttercream — Egg whites and sugar are whipped into an Italian meringue before the butter is blended in.',
    'Chocolate buttercream — Cocoa powder is blended into the finished buttercream for its chocolate finish.',
  ])
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.ingredients,
    'Made with our Signature Gâteau au Chocolat cake layers and Italian meringue chocolate buttercream prepared with butter, egg whites, sugar, vanilla extract and cocoa powder.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens?.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens?.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.equal(compactEnglish.relatedProductSlugs.join(','), 'pave-chocolate-cake,fresh-strawberry-vanilla-cream-cake')

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(approvedCopy, /100% milk butter|100% Australian butter|Australian dairy butter|Aussi butter|Aussi milk butter|Cacao 100%|100% cacao|organic cocoa|fresh milk buttercream|couverture chocolate buttercream/i)
  assert.doesNotMatch(approvedCopy, /luxury|premium ingredients|finest|best|100% pure|Australian made butter/i)
  assert.doesNotMatch(approvedCopy, /organic|fresh milk|chocolatier-grade couverture chocolate|not added chocolate flavouring/i)
  assert.doesNotMatch(approvedCopy, /(?:900g|280g|100g|6g|300g|10g)/)
  assert.doesNotMatch(approvedCopy, /syrup temperature|mixing procedure|recipe ratios/i)
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|peanuts?|sesame|calories|kilojoules|nutrition)\b|may contain|gluten-free|nut-free/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|땅콩|참깨|칼로리|영양|글루텐 프리|너트 프리/)
  assert.doesNotMatch(approvedCopy, /(^|\D)(74|94|128)(\D|$)/)
})

test('Pave compact ingredients contain only the approved verified ingredient and allergen claims', () => {
  const english = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const korean = getCakeEditorialBySlug('pave-chocolate-cake', 'ko')
  assert.ok(english)
  assert.ok(korean)

  const compactEnglish = english as unknown as {
    ingredientsAndAllergens: {
      ingredients: string
      allergens: string
      contact: string
    }
  }
  const compactKorean = korean as unknown as {
    ingredientsAndAllergens: { ingredients: string }
  }

  assert.equal(
    compactEnglish.ingredientsAndAllergens.ingredients,
    'Made with 57.9% dark couverture chocolate, fresh cream, cocoa powder, butter, eggs, milk and wheat flour.',
  )
  assert.equal(compactEnglish.ingredientsAndAllergens.allergens, 'Contains milk, egg and wheat (gluten).')
  assert.equal(
    compactEnglish.ingredientsAndAllergens.contact,
    'Please contact us before ordering for someone with a food allergy.',
  )
  assert.match(compactKorean.ingredientsAndAllergens.ingredients, /57\.9% 다크 커버춰 초콜릿/)

  const approvedCopy = JSON.stringify({ compactEnglish, compactKorean })
  assert.doesNotMatch(approvedCopy, /\b(?:soy|nuts?|sesame|calories|kilojoules|nutrition)\b|may contain|1:1 ganache/i)
  assert.doesNotMatch(approvedCopy, /대두|견과|참깨|칼로리|영양|1:1 가나슈/)
})

test('compact editorial data does not duplicate live product prices or expose unused image slots', () => {
  const pave = getCakeEditorialBySlug('pave-chocolate-cake', 'en')
  const vanilla = getCakeEditorialBySlug('vanilla-fresh-cream-cake', 'en')
  const buttercream = getCakeEditorialBySlug('buttercream-cake', 'en')
  const cupcakes = getCakeEditorialBySlug('chocolate-cupcakes', 'en')
  const lemon = getCakeEditorialBySlug('lemon-cake', 'en')
  const brownie = getCakeEditorialBySlug('brownie-cheesecake', 'en')
  assert.ok(pave)
  assert.ok(vanilla)
  assert.ok(buttercream)
  assert.ok(cupcakes)
  assert.ok(lemon)
  assert.ok(brownie)

  assert.doesNotMatch(JSON.stringify(pave), /(^|\D)(79|99|137)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(vanilla), /(^|\D)(69|89|119)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(buttercream), /(^|\D)(74|94|128)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(cupcakes), /(^|\D)(31|36|41|55|64|73)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(lemon), /(^|\D)(36|45|65|85)(\D|$)/)
  assert.doesNotMatch(JSON.stringify(brownie), /(^|\D)(55|65|70)(\D|$)/)
  for (const editorial of [pave, vanilla, buttercream, cupcakes, lemon, brownie]) {
    assert.equal(editorial.layout, 'compact')
    assert.equal(editorial.storageAndServing, undefined)
    assert.doesNotMatch(JSON.stringify(editorial), /lifestyleImage|imageKeys/)
  }
})

test('all compact editorial related product preferences resolve through the current AU catalogue', () => {
  const catalogueSlugs = new Set(getAuCakeCatalogCards('en').map((card) => card.slug))

  for (const cakeSlug of ['pave-chocolate-cake', 'buttercream-cake', 'fresh-strawberry-vanilla-cream-cake', 'fresh-strawberry-chocolate-cream-cake', 'chocolate-cupcakes', 'lemon-cake', 'signature-gateau-au-chocolat', 'brownie-cheesecake']) {
    const editorial = getCakeEditorialBySlug(cakeSlug, 'en')
    assert.ok(editorial)
    assert.equal(editorial.relatedProductSlugs.length, 2)
    for (const relatedSlug of editorial.relatedProductSlugs) {
      assert.notEqual(relatedSlug, cakeSlug)
      assert.equal(catalogueSlugs.has(relatedSlug), true, relatedSlug)
    }
  }
})
