# AU SEO/GEO Content Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every English-indexable AU page and its hydrated state use the exact brand name “verygood chocolate” and the same grounded product, class, image, pickup, and social metadata facts.

**Architecture:** Keep src/content/au-public-pages.json as the checked-in source of public facts. The TypeScript adapter feeds React and runtime SEO, while the Node build generator feeds initial HTML, JSON-LD, sitemap.xml, and llms.txt. Contract tests compare both consumers with the canonical JSON and compare public class prices with the authoritative pricing function.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Node test runner, Node ESM build scripts, JSON-LD/schema.org.

## Global Constraints

- Work only on public AU SEO/GEO content and its tests. Do not change reservation, Appwrite, API, admin, review-fetching, or payment behavior.
- Use the exact lowercase display name “verygood chocolate” on every indexable route, public structured-data entity, and public shell brand label.
- Keep English as the only indexable language. Do not add /ko routes, Korean sitemap URLs, hreflang, or Korean SEO metadata.
- The Korean UI toggle changes only visible UI state and document.documentElement.lang.
- Keep Organization schema. Do not add LocalBusiness, a Pulse street address, a phone number, social profiles, ratings, delivery, walk-in sales, or any other unverified fact.
- Class AggregateOffer describes base course/package prices only: AUD 99–254.60. The AUD 20 per-participant, per-class extension remains separately stated.
- Product Offer behavior remains unchanged: one starting-price Offer for the four single product pages, and WebPage-only for the combined pound cake/cupcake page.
- Follow red-green-refactor within every task: add the assertion, run it and observe the intended failure, make the smallest implementation, rerun until green, then commit.
- Run AU-focused commands with VITE_MARKET=AU where the package script does not already set it.
- Preserve unrelated user changes if the worktree is no longer clean.

## Canonical Field Contract

The implementation must add these public fields to src/content/au-public-pages.json and consume them rather than restating their values:

| Owner | Required fields |
| --- | --- |
| site | url, brand, language, pickupArea, organizationDescription, defaultSocialImage.path/type/width/height |
| home | title, h1, description, hero, pickup, orderingSteps, faq |
| catalogue | title, h1, description, intro, collectionName |
| classes | title, h1, description, intro, courseName, courseDescription, educationalLevel, baseLowPrice, baseHighPrice, packageSummary, extensionPricePerParticipant, extensionSummary |
| reviews | title, h1, description, intro |
| each cakePages entry | title, name, description, schema, startingPrice, priceSummary, optionSummary, cardOptionLabel, imagePath, imageAlt, imageType, imageWidth, imageHeight |

Use these exact canonical values:

- site.brand: verygood chocolate; remove the redundant brandDisplay field
- site.organizationDescription: Small-batch, made-to-order cakes for pre-arranged pickup in Melrose Park, Sydney.
- default social image: /og-image.jpg, image/jpeg, 1200 × 630
- catalogue title: Made-to-Order Cakes Sydney | verygood chocolate
- home title: Chocolate Cakes Sydney | Melrose Park Pickup | verygood chocolate
- catalogue h1: Choose Your Cake
- catalogue collectionName: Made-to-Order Cakes Sydney
- classes title: Kids Cake Decorating Classes Sydney | verygood chocolate
- classes h1: Kids Cake Decorating Classes Sydney
- reviews title: Customer Reviews | verygood chocolate Sydney
- reviews h1: Verified Customer Reviews
- classes.baseLowPrice: 99
- classes.baseHighPrice: 254.6
- classes.extensionPricePerParticipant: 20
- classes.packageSummary: A Basic + Advanced package covers two separate weekend sessions and receives 5% off the base class fees.
- Pave optionSummary: Choose a size · dark chocolate only
- Pave cardOptionLabel: Choose a size · dark chocolate only
- Vanilla description: Made with a chocolate cake sheet and vanilla fresh cream, then Triple berry or Nutella chocolate chip flavour.
- Vanilla optionSummary: Choose size and flavour · Chocolate cake sheet included
- Vanilla cardOptionLabel: Choose size and flavour · Chocolate cake sheet included
- Pound/cupcake cardOptionLabel: Choose pound or cupcakes, then a finish
- Basque cardOptionLabel: Three finishing options
- Lemon cardOptionLabel: Choose a pack size
- every product social image: image/webp, 1080 × 1012

The other four cake descriptions must reuse the existing English catalogue copy verbatim:

- Chocolate Pound Cake & Cupcakes: Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.
- Pave Chocolate Cake: A round chocolate cake layered with soft pave ganache and chocolate sponge. Dense, smooth and made for serious chocolate flavour.
- Chocolatier's Basque Cheesecake: Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.
- Lemon Cake: Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.

---

## Task 1: Put Product Facts and Catalogue Images Behind the Canonical Adapter

**Files:**

- Modify: tests/cake-catalog.test.ts
- Modify: tests/cake-catalog-component.test.mjs
- Modify: tests/vanilla-fresh-cream-cake-component.test.mjs
- Modify: tests/cake-seo-generator.test.mjs
- Modify: src/content/au-public-pages.json
- Modify: src/lib/cake-catalog.ts
- Modify: src/pages/HomePage.tsx
- Modify: src/CakesPage.tsx
- Modify: scripts/generate-seo-pages.mjs

**Interfaces:**

- Consumes: getPublicCakePage(slug) from src/lib/public-content.ts
- Produces: CakeCatalogCard.imagePath: string
- Preserves: CakeCatalogCard.imageKey for the separate Quick View image map

- [ ] **Step 1: Add failing canonical-image and product-fact tests**

In tests/cake-catalog.test.ts, add:

~~~ts
import {
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_SHEET_OPTIONS,
} from '../src/lib/constants.js'
import { marketConfig } from '../src/lib/market.js'
import { getPublicCakePage } from '../src/lib/public-content.js'

test('AU catalogue cards use the canonical public image for every available photo', () => {
  for (const card of getAuCakeCatalogCards('en')) {
    const page = getPublicCakePage(card.slug)
    assert.ok(page, card.slug)
    assert.equal(card.imagePath, page.imagePath, card.slug)
    assert.equal(card.optionLabel, page.cardOptionLabel, card.slug)
    if (!card.isPhotoComingSoon) assert.notEqual(card.imagePath, '', card.slug)
  }
})

test('canonical Pave and Vanilla statements match the selectable AU products', () => {
  const pave = getPublicCakePage('pave-chocolate-cake')
  const vanilla = getPublicCakePage('vanilla-fresh-cream-cake')
  assert.equal(pave?.optionSummary, 'Choose a size · dark chocolate only')
  assert.doesNotMatch(pave?.optionSummary || '', /milk/i)
  assert.deepEqual(
    marketConfig.chocolateTypeOptions.map((option) => option.value),
    ['dark'],
  )
  assert.match(vanilla?.description || '', /chocolate cake sheet/)
  assert.match(vanilla?.description || '', /Triple berry or Nutella chocolate chip/)
  assert.deepEqual(
    VANILLA_CAKE_SHEET_OPTIONS.map((option) => option.value),
    ['chocolate'],
  )
  assert.deepEqual(
    VANILLA_CAKE_FLAVOR_OPTIONS.map((option) => option.value),
    ['triple-berry', 'nutella-chocolate-chip'],
  )
  assert.equal(vanilla?.imagePath, '/products/vanilla-cake-sydney.webp')
})
~~~

In tests/cake-catalog-component.test.mjs, read both HomePage.tsx and CakesPage.tsx, then replace the old catalogue-image assertion with:

~~~js
assert.match(homeSource, /src=\{card\.imagePath\}/)
assert.match(cakesSource, /src=\{card\.imagePath\}/)
assert.doesNotMatch(cakesSource, /cakeListImages/)
~~~

Update the Vanilla component contract so the hero is expected to obtain the Vanilla path through getPublicCakePage rather than through a hard-coded public-image map.

In tests/cake-seo-generator.test.mjs, add a regression assertion after reading the generated Pave and Vanilla pages:

~~~js
assert.match(paveHtml, /Choose a size · dark chocolate only/)
assert.doesNotMatch(paveHtml, /milk chocolate/i)
assert.match(vanillaHtml, /chocolate cake sheet/)
assert.match(vanillaHtml, /products\/vanilla-cake-sydney\.webp/)
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run:

~~~bash
npm run test:cake
~~~

Expected: failure because CakeCatalogCard has no imagePath, CakesPage still renders an empty Vanilla src through cakeListImages, and generated Pave fallback still mentions milk chocolate.

- [ ] **Step 3: Correct and complete the canonical cake records**

In src/content/au-public-pages.json:

- Add title, description, imageType, imageWidth, and imageHeight to all five cake records.
- Use each existing English catalogue description listed in the Canonical Field Contract.
- Change Pave optionSummary to the exact dark-only text.
- Keep Vanilla imagePath as /products/vanilla-cake-sydney.webp and make its description name both existing flavours and the chocolate sheet.
- Use explicit titles of the form “[existing cake name] Sydney | verygood chocolate”.

- [ ] **Step 4: Derive public card images and English public copy**

In src/lib/cake-catalog.ts:

~~~ts
import { getPublicCakePage } from './public-content.js'

export type CakeCatalogCard = LocalizedCatalogCopy & {
  id: CakeCatalogId
  slug: string
  productId: ProductId
  imageKey: CakeCatalogImageKey
  imagePath: string
  isPhotoComingSoon: boolean
  priceLabel: string
}
~~~

Inside getCakeCatalogCard, resolve the public page once. Use its name, description, and cardOptionLabel for English, while retaining the current Korean copy and feature arrays. The regression test above separately proves that the canonical option facts match the selectable values:

~~~ts
const publicPage = getPublicCakePage(entry.slug)
const localizedCopy = entry.copy?.[language] || {
  name: productText.name,
  description: productText.description,
  features: getProductFeatures(entry.defaultProductId, language),
  optionLabel: productText.priceNote,
}
const copy = language === 'en' && publicPage
  ? {
      ...localizedCopy,
      name: publicPage.name,
      description: publicPage.description,
      optionLabel: publicPage.cardOptionLabel,
    }
  : localizedCopy
const imagePath = publicPage?.imagePath || ''

if (!entry.isPhotoComingSoon && !imagePath) {
  throw new Error('Missing public cake image: ' + entry.slug)
}
~~~

Return imagePath with the existing card fields. Add imagePath values to the legacy KR fallback card literals in HomePage.tsx so the required type remains satisfied without changing the KR market boundary.

- [ ] **Step 5: Remove duplicated catalogue-image selection**

- In HomePage.tsx, render catalogue cards with src={card.imagePath}.
- Resolve the Lemon and Vanilla hero images with getPublicCakePage('lemon-cake')?.imagePath and getPublicCakePage('vanilla-fresh-cream-cake')?.imagePath.
- Keep quickViewImages unchanged because those are different detail-shot assets.
- In CakesPage.tsx, remove cakeListImages and CakeCatalogImageKey, then render src={card.imagePath}.
- In scripts/generate-seo-pages.mjs, include cake.description in the static cake fallback before the price guide. Keep the broader metadata/schema refactor in Task 2; this small bridge lets Task 1's generated product-fact regression turn GREEN as soon as the canonical record is corrected.

- [ ] **Step 6: Run GREEN and commit**

Run:

~~~bash
npm run test:cake
~~~

Expected: all cake tests pass, including a non-empty canonical Vanilla image and dark-only Pave fallback.

Commit:

~~~bash
git add src/content/au-public-pages.json src/lib/cake-catalog.ts src/pages/HomePage.tsx src/CakesPage.tsx scripts/generate-seo-pages.mjs tests/cake-catalog.test.ts tests/cake-catalog-component.test.mjs tests/vanilla-fresh-cream-cake-component.test.mjs tests/cake-seo-generator.test.mjs
git commit -m "fix: align AU cake facts and catalogue images"
~~~

---

## Task 2: Unify Runtime and Generated Public Metadata, JSON-LD, and Social Images

**Files:**

- Modify: tests/cake-seo.test.ts
- Modify: tests/cake-seo-generator.test.mjs
- Modify: tests/cake-catalog-component.test.mjs
- Modify: tests/class-utils.test.ts
- Modify: tests/class-component-contract.test.mjs
- Modify: tests/public-reviews-component.test.mjs
- Modify: src/content/au-public-pages.json
- Modify: src/lib/public-content.ts
- Modify: src/lib/seo.ts
- Modify: src/CakesPage.tsx
- Modify: src/pages/ClassesPage.tsx
- Modify: src/ReviewsArchive.tsx
- Modify: scripts/generate-seo-pages.mjs

**Interfaces:**

- Consumes: canonical site, route, class, and cake records
- Verifies against: calculateClassPricing and CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS from src/lib/class-utils.ts
- Produces: identical public title, description, canonical, JSON-LD facts, and Open Graph image attributes before and after hydration

- [ ] **Step 1: Add failing runtime metadata and pricing contracts**

In tests/cake-seo.test.ts, import getAuPublicContent and getPublicRoutePage. Add:

~~~ts
const publicContent = getAuPublicContent()

test('all indexable runtime SEO uses the canonical lowercase brand', () => {
  for (const path of [
    '/',
    '/cakes',
    '/classes',
    '/reviews',
    ...Object.keys(publicContent.cakePages).map((slug) => '/cakes/' + slug),
  ]) {
    const serialized = JSON.stringify(getSeoConfig(path))
    assert.match(getSeoConfig(path).title, /verygood chocolate/)
    assert.doesNotMatch(serialized, /Very Good Chocolate|Verygood Chocolate/)
  }
})

test('runtime route metadata comes from the typed public-content adapter', () => {
  for (const path of ['/', '/cakes', '/classes', '/reviews'] as const) {
    const page = getPublicRoutePage(path)
    assert.ok(page)
    assert.equal(getSeoConfig(path).title, page.title)
    assert.equal(getSeoConfig(path).description, page.description)
  }
})

test('Course AggregateOffer uses the canonical base range and excludes extensions', () => {
  const course = getSeoConfig('/classes').structuredData
    ?.find((entry) => entry['@type'] === 'Course')
  assert.ok(course)
  const offers = course.offers as Record<string, unknown>
  assert.equal(offers.lowPrice, publicContent.classes.baseLowPrice)
  assert.equal(offers.highPrice, publicContent.classes.baseHighPrice)
})

test('product runtime metadata carries descriptive copy and complete image attributes', () => {
  for (const [slug, page] of Object.entries(publicContent.cakePages)) {
    const config = getSeoConfig('/cakes/' + slug)
    assert.equal(config.title, page.title)
    assert.equal(config.description, page.description)
    assert.equal(config.imageType, page.imageType)
    assert.equal(config.imageWidth, page.imageWidth)
    assert.equal(config.imageHeight, page.imageHeight)
    const entity = config.structuredData?.[0]
    assert.equal(entity?.description, page.description)
  }
})
~~~

In tests/class-utils.test.ts, import getAuPublicContent and add `CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS` to the existing class-utils import, then add the authoritative pricing comparison at the pricing-module boundary:

~~~ts
test('canonical public class prices match valid base bookings and keep extensions separate', () => {
  const classes = getAuPublicContent().classes
  const low = calculateClassPricing({
    coursePlan: 'basic',
    bookingType: 'year-1-2',
  }).totalPriceCents / 100
  const high = calculateClassPricing({
    coursePlan: 'basic-advanced-package',
    bookingType: '1-child',
  }).totalPriceCents / 100

  assert.equal(classes.baseLowPrice, low)
  assert.equal(classes.baseHighPrice, high)
  assert.equal(
    classes.extensionPricePerParticipant,
    CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS / 100,
  )
  assert.equal(classes.baseLowPrice, 99)
  assert.equal(classes.baseHighPrice, 254.6)
})
~~~

Do not calculate a maximum from invalid package + two-friends combinations; the booking UI restricts Advanced and package plans to one child.

Update the existing homepage title expectation to:

~~~ts
assert.equal(config.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | verygood chocolate')
~~~

- [ ] **Step 2: Add failing generated-HTML parity contracts**

Import the canonical JSON into tests/cake-seo-generator.test.mjs and add this helper:

~~~js
import auPublicPages from '../src/content/au-public-pages.json' with { type: 'json' }

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
~~~

Replace the existing hard-coded homepage title assertion with canonical artifact parity:

~~~js
assert.match(
  home,
  new RegExp('<title>' + escapeRegExp(auPublicPages.home.title) + '</title>'),
)
~~~

Extend the generated-page checks to assert:

~~~js
const page = auPublicPages.cakePages[slug]
assert.match(html, new RegExp('<title>' + escapeRegExp(page.title) + '</title>'))
assert.equal(product?.description, page.description)
assert.match(html, new RegExp(escapeRegExp(page.description)))
assert.match(html, new RegExp('<meta property="og:image:type" content="' + page.imageType + '"'))
assert.match(html, new RegExp('<meta property="og:image:width" content="' + page.imageWidth + '"'))
assert.match(html, new RegExp('<meta property="og:image:height" content="' + page.imageHeight + '"'))
~~~

Add one test that iterates the nine indexable outputs and verifies:

- exactly one self-canonical per output;
- no “Very Good Chocolate” or “Verygood Chocolate” in title, description, visible fallback, or JSON-LD;
- every JSON-LD script parses;
- no entity has @type LocalBusiness;
- no JSON-LD contains PostalAddress, streetAddress, aggregateRating, or embedded review data;
- no hreflang is emitted.
- sitemap.xml contains no /ko URL.

Parse classes.html and assert the Course offer is lowPrice 99 and highPrice 254.6, while the fallback includes the canonical extensionSummary.

Read src/lib/seo.ts in the generator contract test and assert applySeo sets og:image, og:image:type, og:image:width, and og:image:height. This source-level assertion complements the typed product-config assertions and prevents a future URL-only update.

In tests/class-component-contract.test.mjs, parse src/content/au-public-pages.json and replace the existing “kids class SEO distinguishes…” test with this canonical-data version:

~~~js
const publicContent = JSON.parse(
  readFileSync(new URL('../src/content/au-public-pages.json', import.meta.url), 'utf8'),
)

test('kids class public content stays canonical while writes remain server-authoritative', () => {
  const classes = publicContent.classes
  assert.match(classes.description, /weekend/i)
  assert.match(classes.description, /Kindy/)
  assert.match(classes.description, /Years 2[–-]6/)
  assert.equal(classes.baseLowPrice, 99)
  assert.equal(classes.baseHighPrice, 254.6)
  assert.match(landing, /publicClassContent\.baseLowPrice/)
  assert.match(landing, /publicClassContent\.baseHighPrice/)
  assert.match(landing, /publicClassContent\.packageSummary/)
  assert.match(landing, /publicClassContent\.extensionSummary/)
  assert.match(repository, /export async function createClassReservation[\s\S]*if \(isAppwriteConfigured\)[\s\S]*executeReservationApi<ClassReservation>\('create-class'/)
  assert.match(setup, /APPWRITE_RESERVATION_WRITE_MODE === 'direct' \? 'direct' : 'function'/)
  assert.match(repository, /Query\.equal\('advancedClassDate', filters\.classDate\)/)
  assert.match(repository, /documentGroups\.flat\(\)\.map[\s\S]*document\.\$id/)
})
~~~

Remove the now-unused `generatedSeo` source read from this contract test. Generated `classes.html` parity is already verified above; keep source contracts only for React wiring and the existing server-authoritative booking boundary.

Add source-contract assertions for all three other English route consumers:

~~~js
// tests/cake-catalog-component.test.mjs
assert.match(cakesSource, /getPublicRoutePage\('\/cakes'\)/)
assert.match(cakesSource, /publicPage\.h1/)
assert.match(cakesSource, /publicPage\.intro/)

// tests/class-component-contract.test.mjs
assert.match(landing, /getPublicRoutePage\('\/classes'\)/)
assert.match(landing, /publicPage\.h1/)
assert.match(landing, /publicPage\.intro/)

// tests/public-reviews-component.test.mjs
const archive = read('src/ReviewsArchive.tsx')
assert.match(archive, /getPublicRoutePage\('\/reviews'\)/)
assert.match(archive, /publicPage\.h1/)
assert.match(archive, /publicPage\.intro/)
~~~

- [ ] **Step 3: Run the focused test and verify RED**

Run:

~~~bash
npm run test:cake
npm run test:class
npm run test:reviews
~~~

Expected: failures show the current mixed brand spellings, missing canonical route/class records, Course highPrice 198, price-only Product descriptions, missing runtime image type/dimensions, and a class landing page that does not consume the canonical range.

- [ ] **Step 4: Add route, organization, class, and social-image facts to canonical JSON**

Add the site, catalogue, classes, and reviews fields from the Canonical Field Contract. Use these existing grounded route sentences:

~~~text
catalogue.description = Browse five small-batch cakes and request confirmed pickup in Melrose Park, Sydney.
catalogue.intro = Browse five made-to-order cakes for pre-arranged pickup in Melrose Park, Sydney.
classes.description = Private weekend cake decorating classes in Melrose Park, Sydney: Basic from Kindy to Year 6 and Advanced for Years 2–6.
classes.intro = Private, hands-on cake classes held in Melrose Park, Sydney on Saturdays and Sundays. Basic welcomes children from Kindy to Year 6; Advanced starts from Year 2.
classes.courseName = Kids Professional Chocolate Cake Course
classes.courseDescription = Private weekend cake courses with Basic classes from Kindy to Year 6 and Advanced 2-Tier classes for Years 2–6.
classes.educationalLevel = Basic: Kindy–Year 6; Advanced: Years 2–6
classes.packageSummary = A Basic + Advanced package covers two separate weekend sessions and receives 5% off the base class fees.
classes.extensionSummary = A 30-minute extension is AUD 20 per participant, per class and is not discounted.
reviews.description = Read verified customer reviews from verygood chocolate cake orders and kids cake class bookings in Sydney.
reviews.intro = Read reviews shared with permission after verified verygood chocolate cake orders and kids cake class bookings in Sydney.
~~~

Change home.title and site.brand to the exact lowercase brand, and delete site.brandDisplay.

- [ ] **Step 5: Add the typed public-content route adapter**

In src/lib/public-content.ts add:

~~~ts
export type IndexablePublicPath = '/' | '/cakes' | '/classes' | '/reviews'

export type PublicRoutePage = {
  title: string
  h1: string
  description: string
  intro?: string
}

const PUBLIC_ROUTE_PAGES: Record<IndexablePublicPath, PublicRoutePage> = {
  '/': AU_PUBLIC_CONTENT.home,
  '/cakes': AU_PUBLIC_CONTENT.catalogue,
  '/classes': AU_PUBLIC_CONTENT.classes,
  '/reviews': AU_PUBLIC_CONTENT.reviews,
}

export function getPublicRoutePage(path: string): PublicRoutePage | undefined {
  return Object.hasOwn(PUBLIC_ROUTE_PAGES, path)
    ? PUBLIC_ROUTE_PAGES[path as IndexablePublicPath]
    : undefined
}
~~~

Keep getPublicCakePage as the typed cake-slug adapter. Runtime React/SEO consumers use this module; the build generator continues importing the JSON directly.

- [ ] **Step 6: Refactor runtime SEO to consume canonical fields**

In src/lib/seo.ts:

- Resolve one content constant near the top: const publicContent = getAuPublicContent().
- Build Organization, WebSite, ItemList, CollectionPage, Course, Product, Offer, and seller names from publicContent.site.brand.
- Remove the legacy alternateName rather than publishing an unapproved variant.
- Build /, /cakes, /classes, and /reviews title/description values through getPublicRoutePage; use the canonical class fields for the remainder of Course schema.
- Use page.title and page.description for every cake page and schema entity.
- Extend SeoConfig:

~~~ts
imageType?: string
imageWidth?: number
imageHeight?: number
~~~

- For product pages, copy imageType, imageWidth, and imageHeight from the cake record whenever imagePath exists.
- For applySeo, resolve the default social-image record and update all four Open Graph image attributes together:

~~~ts
const defaultImage = publicContent.site.defaultSocialImage
const image = config.image || SITE_URL + defaultImage.path
const imageType = config.imageType || defaultImage.type
const imageWidth = config.imageWidth || defaultImage.width
const imageHeight = config.imageHeight || defaultImage.height

setMeta('meta[property="og:image"]', 'content', image)
setMeta('meta[property="og:image:type"]', 'content', imageType)
setMeta('meta[property="og:image:width"]', 'content', String(imageWidth))
setMeta('meta[property="og:image:height"]', 'content', String(imageHeight))
setMeta('meta[name="twitter:image"]', 'content', image)
~~~

Do not make the SEO effect depend on the UI language. English metadata remains stable while only the visible language state changes.

- [ ] **Step 7: Connect visible English route copy and class prices**

In CakesPage.tsx, ClassesPage.tsx, and ReviewsArchive.tsx, import getPublicRoutePage and resolve the matching route once:

~~~ts
const publicPage = getPublicRoutePage('/cakes')!
const publicPage = getPublicRoutePage('/classes')!
const publicPage = getPublicRoutePage('/reviews')!
~~~

Use publicPage.h1 and publicPage.intro in the English output. Preserve the explicit Korean strings in CakesPage and ReviewsArchive and preserve all route/loading behavior. ClassesPage is currently English-only, so replace its existing English h1/hero sentence directly. This makes the canonical JSON feed the hydrated catalogue, class, and reviews headings rather than SEO alone.

In src/pages/ClassesPage.tsx, also resolve const publicClassContent = getAuPublicContent().classes. In the Price Guide, add a visible base course/package range using baseLowPrice and baseHighPrice, and render packageSummary and extensionSummary directly. Keep the existing individual Basic/Advanced price lines and booking logic unchanged.

~~~tsx
<p className="kids-price-line">
  Base course/package range · AUD {publicClassContent.baseLowPrice}–
  {publicClassContent.baseHighPrice.toFixed(2)}
</p>
<p className="kids-price-line">{publicClassContent.packageSummary}</p>
<p className="kids-small-note">{publicClassContent.extensionSummary}</p>
~~~

- [ ] **Step 8: Refactor the static generator to the same records**

In scripts/generate-seo-pages.mjs:

- Resolve brand, organizationDescription, and defaultSocialImage from auPublicPages.site.
- Build public route metadata and fallback headings/copy from home, catalogue, classes, reviews, and cake records.
- Use cake.title and cake.description for meta, WebPage/Product descriptions, and fallback prose.
- Use cake.imageType/imageWidth/imageHeight rather than inferring all image attributes independently.
- Use classes.baseLowPrice and classes.baseHighPrice in Course.AggregateOffer.
- Render classes.intro, courseDescription, the formatted base range, packageSummary, and extensionSummary in the class fallback. Remove the independently hard-coded class price paragraph.
- Keep existing canonical URL, sitemap route list, private noindex behavior, and Product/WebPage schema modes.

- [ ] **Step 9: Run GREEN and commit**

Run:

~~~bash
npm run test:cake
npm run test:class
npm run test:reviews
~~~

Expected: runtime and static public SEO tests pass with the lowercase brand, descriptive Product schema, 99–254.60 Course range, and matching image MIME/dimensions.

Commit:

~~~bash
git add src/content/au-public-pages.json src/lib/public-content.ts src/lib/seo.ts src/CakesPage.tsx src/pages/ClassesPage.tsx src/ReviewsArchive.tsx scripts/generate-seo-pages.mjs tests/cake-seo.test.ts tests/cake-seo-generator.test.mjs tests/cake-catalog-component.test.mjs tests/class-utils.test.ts tests/class-component-contract.test.mjs tests/public-reviews-component.test.mjs
git commit -m "fix: unify AU public SEO metadata and schema"
~~~

---

## Task 3: Generate llms.txt From Canonical Public Facts

**Files:**

- Create: scripts/render-au-llms.mjs
- Modify: scripts/generate-seo-pages.mjs
- Modify: public/llms.txt
- Modify: tests/cake-seo-generator.test.mjs

**Interfaces:**

- Produces: renderAuLlms(auPublicPages): string
- Writes: dist/llms.txt during every SEO build
- Mirrors: public/llms.txt for the Vite development server; this file is generated output, not an independent source

- [ ] **Step 1: Change the llms test to require generated output**

Do not import the not-yet-created renderer during the RED phase. Update the existing llms test so it calls generate(), reads dist/llms.txt, and checks the canonical generated artifact:

~~~js
const { dist } = await generate()
const llms = await readFile(join(dist, 'llms.txt'), 'utf8')
const checkedInLlms = await readFile(llmsPath, 'utf8')
assert.equal(llms, checkedInLlms)
assert.match(llms, /^# verygood chocolate Sydney/m)
assert.match(llms, /Choose a size · dark chocolate only/)
assert.doesNotMatch(llms, /dark or milk|milk chocolate/i)
assert.match(llms, /Made with a chocolate cake sheet and vanilla fresh cream/)
assert.match(llms, /Triple berry or Nutella chocolate chip/)
assert.doesNotMatch(llms, /vanilla or chocolate cake sheet|photo is coming soon/i)
assert.match(llms, /AUD 99–254\.60/)
assert.match(llms, /AUD 20 per participant, per class/)
assert.doesNotMatch(llms, /\/admin|customer name|mobile number/i)
~~~

- [ ] **Step 2: Run the generator test and verify RED**

Run:

~~~bash
node --test tests/cake-seo-generator.test.mjs
~~~

Expected: the read of dist/llms.txt fails because the generator does not create the artifact yet. This is the intended behavioral RED, not a missing-module failure.

- [ ] **Step 3: Add the pure renderer**

Create scripts/render-au-llms.mjs with one exported pure function. It must:

- derive the header, origin, service area, pickup, and ordering steps from site/home;
- iterate cakePages in checked-in order;
- include name, description, priceSummary, optionSummary, and canonical cake URL for each product;
- derive the class base range and extension statement from classes;
- append a final newline;
- emit no operational or private fields.

Once the module exists, import `renderAuLlms` in the generator test and add pure-renderer parity assertions before completing GREEN:

~~~js
assert.equal(checkedInLlms, renderAuLlms(auPublicPages))
assert.equal(llms, renderAuLlms(auPublicPages))
~~~

This makes checked-in public/llms.txt, generated dist/llms.txt, and the canonical renderer byte-identical without turning the initial RED into `ERR_MODULE_NOT_FOUND`.

Use this implementation shape:

~~~js
function formatAud(value) {
  return Number.isInteger(value) ? 'AUD ' + value : 'AUD ' + value.toFixed(2)
}

export function renderAuLlms(content) {
  const { site, home, classes, cakePages } = content
  const cakes = Object.entries(cakePages).map(([slug, cake]) =>
    '- ' + cake.name + ': ' + cake.description + ' ' + cake.priceSummary + ' '
      + cake.optionSummary + ' ' + site.url + '/cakes/' + slug,
  )

  return [
    '# ' + site.brand + ' Sydney',
    '',
    '> ' + home.hero + ' ' + home.pickup,
    '',
    'Official AU website: ' + site.url,
    'Primary service area: ' + site.pickupArea,
    '',
    '## Ordering',
    ...home.orderingSteps.map((step) => '- ' + step),
    '',
    '## Cakes',
    ...cakes,
    '',
    '## Kids cake classes',
    '- ' + classes.intro,
    '- Base course/package prices: ' + formatAud(classes.baseLowPrice)
      + '–' + formatAud(classes.baseHighPrice).replace('AUD ', '') + '.',
    '- ' + classes.packageSummary,
    '- ' + classes.extensionSummary,
    '- ' + site.url + '/classes',
    '',
  ].join('\n')
}
~~~

- [ ] **Step 4: Wire both generated copies**

Import renderAuLlms into scripts/generate-seo-pages.mjs. After writing sitemap.xml:

~~~js
const llms = renderAuLlms(auPublicPages)
await writeFile(join(distDir, 'llms.txt'), llms)
try {
  await writeFile(join(process.cwd(), 'public', 'llms.txt'), llms)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
~~~

Replace public/llms.txt with the renderer's exact output. Do not add separate prose by hand.

- [ ] **Step 5: Run GREEN and commit**

Run:

~~~bash
node --test tests/cake-seo-generator.test.mjs
npm run test:cake
~~~

Expected: generated and checked-in llms files are identical and contain only canonical facts.

Commit:

~~~bash
git add scripts/render-au-llms.mjs scripts/generate-seo-pages.mjs public/llms.txt tests/cake-seo-generator.test.mjs
git commit -m "fix: generate AU llms facts from canonical content"
~~~

---

## Task 4: Add Crawlable Reviews Navigation and Language-Only DOM Updates

**Files:**

- Modify: tests/au-brand-mark-header.test.mjs
- Modify: tests/au-footer-brand-layout.test.mjs
- Modify: tests/app-navigation-contract.test.mjs
- Modify: tests/cake-detail-component.test.mjs
- Modify: src/components/SiteChrome.tsx
- Modify: src/pages/HomePage.tsx
- Modify: src/CakeDetailPage.tsx
- Modify: src/App.tsx
- Modify: index.html
- Modify: public/404.html

**Interfaces:**

- Produces: an always-rendered <a href="/reviews"> in the public footer
- Produces: document.documentElement.lang = ko or en-AU on UI-language changes
- Preserves: the current pathname, canonical, sitemap, and English SEO configuration

- [ ] **Step 1: Add failing shell and language tests**

Update the header expectation to the exact alt text:

~~~js
assert.match(header, /alt="verygood chocolate"/)
~~~

Read index.html and public/404.html in the same test and assert both contain verygood chocolate and neither contains the legacy “Very Good Chocolate” or “Verygood Chocolate” spelling.

In tests/cake-detail-component.test.mjs, assert the English trust-section aria-label is “verygood chocolate service notes” and does not contain the legacy “Verygood service notes”.

In tests/au-footer-brand-layout.test.mjs add:

~~~js
assert.match(footer, /<a href="\/reviews"[\s\S]*navigate\('reviews'\)/)
assert.match(footer, /© \{new Date\(\)\.getFullYear\(\)\} verygood chocolate/)
~~~

In tests/app-navigation-contract.test.mjs add:

~~~js
test('the UI language toggle updates only the document language', () => {
  assert.match(
    appSource,
    /if \(page === 'review'\) return[\s\S]*document\.documentElement\.lang = language\s*===\s*'ko'\s*\?\s*'ko'\s*:\s*getAuPublicContent\(\)\.site\.language/,
  )
  assert.match(appSource, /\}, \[language, page\]\)/)
  assert.doesNotMatch(appSource, /hreflang|\/ko\//)
})
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run:

~~~bash
npm run test:cake
~~~

Expected: the current logo alt/copyright variants fail, the footer has no reviews anchor, and App has no general language-to-html synchronization.

- [ ] **Step 3: Update the public shell**

In src/components/SiteChrome.tsx:

- Change the header logo alt and footer heart-logo alt to verygood chocolate.
- Add reviews labels to both footer copy objects: 후기 for Korean and Reviews for English.
- Add this ordinary anchor to the existing footer navigation:

~~~tsx
<a
  href="/reviews"
  onClick={(event) => {
    event.preventDefault()
    navigate('reviews')
  }}
>
  {copy.reviews}
</a>
~~~

- Change the copyright brand to verygood chocolate.

In HomePage.tsx, change the two hard-coded visible “Very Good Chocolate” fallbacks to verygood chocolate. Do not change Korean routing or SEO.

In CakeDetailPage.tsx, change the English trust-section aria-label to verygood chocolate service notes. Leave its Korean label unchanged.

In index.html, update the default title, Open Graph title, and Twitter title to the canonical home title. In public/404.html, update the noindex title and return-link label to verygood chocolate. These are template/fallback branding changes only.

- [ ] **Step 4: Synchronize document language without creating indexable Korean URLs**

In src/App.tsx, import getAuPublicContent and add this independent effect after the language setter:

~~~ts
useEffect(() => {
  if (page === 'review') return
  document.documentElement.lang = language === 'ko'
    ? 'ko'
    : getAuPublicContent().site.language
}, [language, page])
~~~

The page guard preserves the existing private ReviewPage ko-KR/en-AU effect. Do not add language to the applySeo effect dependency array. Do not modify pathname, history, canonical, JSON-LD, sitemap, or route configuration.

- [ ] **Step 5: Run GREEN and commit**

Run:

~~~bash
npm run test:cake
~~~

Expected: the footer exposes a crawlable /reviews link, public brand labels are exact, and the document language follows the toggle without any Korean SEO route.

Commit:

~~~bash
git add src/components/SiteChrome.tsx src/pages/HomePage.tsx src/CakeDetailPage.tsx src/App.tsx index.html public/404.html tests/au-brand-mark-header.test.mjs tests/au-footer-brand-layout.test.mjs tests/app-navigation-contract.test.mjs tests/cake-detail-component.test.mjs
git commit -m "fix: strengthen AU review discovery and language semantics"
~~~

---

## Task 5: Complete Repository and Generated-Artifact Verification

**Files:**

- Verify only; modify a failing SEO/GEO file only if the failure is caused by Tasks 1–4
- Do not touch the deferred technical-audit areas

- [ ] **Step 1: Run focused tests**

~~~bash
npm run test:cake
~~~

Expected: exit 0.

- [ ] **Step 2: Run lint and the complete test suite**

~~~bash
npm run lint
npm test
~~~

Expected: both exit 0; the full suite retains its existing reservation, class, review, API, and deployment coverage.

- [ ] **Step 3: Build the AU production output**

~~~bash
VITE_MARKET=AU npm run build
~~~

Expected: exit 0; nine indexable sitemap URLs and route-specific HTML are generated. Existing asset/chunk-size warnings are allowed because performance is out of scope.

- [ ] **Step 4: Inspect generated invariants**

Run:

~~~bash
node --test tests/cake-seo-generator.test.mjs
! rg -n "Very Good Chocolate|Verygood Chocolate|dark or milk|photo is coming soon|highPrice.:198" dist/index.html dist/cakes.html dist/cakes/*.html dist/classes.html dist/reviews.html dist/llms.txt
rg -n "verygood chocolate|highPrice.:254.6|og:image:type|og:image:width|og:image:height" dist/index.html dist/cakes.html dist/cakes/*.html dist/classes.html dist/reviews.html dist/llms.txt
~~~

Expected: the negated first rg succeeds only when it finds no stale matches; the second prints the canonical lowercase brand, corrected Course price, and complete social-image attributes. Review every JSON-LD parse assertion from the generator test.

- [ ] **Step 5: Confirm scope and clean integration state**

Run:

~~~bash
git status --short
git diff 3325aa9 -- src/content/au-public-pages.json src/lib/public-content.ts src/lib/cake-catalog.ts src/lib/seo.ts src/pages/HomePage.tsx src/pages/ClassesPage.tsx src/CakesPage.tsx src/ReviewsArchive.tsx src/CakeDetailPage.tsx src/components/SiteChrome.tsx src/App.tsx index.html public/404.html scripts/generate-seo-pages.mjs scripts/render-au-llms.mjs public/llms.txt tests
git diff 3325aa9 -- src/lib/repository.ts src/lib/appwrite.ts appwrite-functions scripts/setup-appwrite.mjs
~~~

Expected: only the planned SEO/GEO files and tests changed; the final deferred-area diff is empty.

- [ ] **Step 6: Record final evidence**

If verification required a small corrective edit, rerun the smallest failing test first, then rerun Steps 1–3. Commit only verified corrections:

Stage each corrected SEO/GEO file explicitly after checking git status, then commit:

~~~bash
git status --short
git add src/content/au-public-pages.json src/lib/public-content.ts src/lib/cake-catalog.ts src/lib/seo.ts src/pages/HomePage.tsx src/pages/ClassesPage.tsx src/CakesPage.tsx src/ReviewsArchive.tsx src/CakeDetailPage.tsx src/components/SiteChrome.tsx src/App.tsx index.html public/404.html scripts/generate-seo-pages.mjs scripts/render-au-llms.mjs public/llms.txt tests/cake-catalog.test.ts tests/cake-catalog-component.test.mjs tests/vanilla-fresh-cream-cake-component.test.mjs tests/cake-seo.test.ts tests/cake-seo-generator.test.mjs tests/class-utils.test.ts tests/class-component-contract.test.mjs tests/public-reviews-component.test.mjs tests/au-brand-mark-header.test.mjs tests/au-footer-brand-layout.test.mjs tests/app-navigation-contract.test.mjs tests/cake-detail-component.test.mjs
git commit -m "test: complete AU SEO GEO verification"
~~~

Omit every path that did not actually change.

Do not create this final commit when there is no additional change.
