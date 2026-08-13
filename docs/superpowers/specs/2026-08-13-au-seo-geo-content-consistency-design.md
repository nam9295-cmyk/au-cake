# AU SEO/GEO Content Consistency Design

**Date:** 2026-08-13

**Status:** Approved design, awaiting written-spec review

**Scope:** Public AU SEO/GEO content and its generated metadata only

## Objective

Make every public, indexable AU page describe the same business, products, prices, images, and pickup model in the initial HTML and after React hydration. Prevent future drift by deriving public SEO metadata, JSON-LD, fallback HTML, and `llms.txt` from one canonical content source.

The official display name is exactly `verygood chocolate` in lowercase.

## In Scope

- Correct the Pave Chocolate Cake option from “dark or milk chocolate” to dark chocolate only.
- Correct Vanilla Fresh Cream Cake information to state that the cake sheet is chocolate, retain the two existing flavour choices, and state that a real product photo is available.
- Connect the existing Vanilla product image to the `/cakes` catalogue card.
- Represent the class base-price range as AUD 99–254.60. Optional 30-minute extensions remain separately described add-ons and are not included in that base range.
- Make static and hydrated title, description, canonical, Open Graph, Twitter, and JSON-LD values agree.
- Generate `llms.txt` product facts from the same canonical product data used for public pages.
- Add an ordinary crawlable `<a href="/reviews">` link from the public site shell.
- Keep English as the only indexable language. When a visitor uses the Korean UI toggle, update the document language for accessibility without creating Korean URLs or Korean SEO metadata.
- Retain `Organization` schema and consistent copy that this is pre-arranged Melrose Park pickup, not a walk-in shop.

## Out of Scope

- Reservation logic, Appwrite configuration or permissions, administrative pages, and API security.
- Cloudflare bot/WAF policy changes or external Search Console/Bing Webmaster configuration.
- Korean indexable URLs, `hreflang`, or Korean sitemap entries.
- Build-time fetching or static rendering of live customer reviews.
- `LocalBusiness` schema or a Google Business Profile based on the Pulse pickup landmark.
- New business facts that are not already supported by repository content, such as an unverified phone number, social account, ingredient claim, allergen guarantee, lead time, or creator biography.
- Performance and asset optimization.

## Canonical Content Model

`src/content/au-public-pages.json` remains the checked-in canonical source for public AU facts. It will own:

- Site identity: URL, lowercase brand name, language, pickup area, and pickup model.
- Indexable route metadata: title, description, heading, and public summary for home, catalogue, classes, and reviews.
- Product facts: name, descriptive copy, starting price, price summary, option summary, image path, image dimensions, and schema mode.
- Class public facts: course description, minimum base price, maximum base price, package explanation, and extension explanation.

Operational calculations remain in their existing business modules. A regression test will compare the canonical public class range and product options with those modules so public content cannot silently diverge from bookable behavior.

The canonical product statements are:

- Pave Chocolate Cake: `Choose a size · dark chocolate only`.
- Vanilla Fresh Cream Cake: chocolate cake sheet only; Triple berry or Nutella chocolate chip flavour; `/products/vanilla-cake-sydney.webp` is the available public image.
- Class base range: AUD 99–254.60; optional 30-minute extension is AUD 20 per participant, per class.

## Consumers and Data Flow

```text
src/content/au-public-pages.json
  ├─ src/lib/public-content.ts
  │    ├─ src/lib/seo.ts → hydrated metadata and JSON-LD
  │    └─ public React pages → matching visible copy and image references
  └─ scripts/generate-seo-pages.mjs
       ├─ dist route HTML → initial metadata, JSON-LD, fallback content
       ├─ dist/sitemap.xml
       └─ dist/llms.txt
```

The generator and runtime may format the shared values differently for HTML, but they must not independently redefine facts, route titles, descriptions, entity names, product options, images, or class price limits.

## Metadata and Structured Data

- All public title suffixes, entity names, product brands, sellers, WebSite names, ItemList names, visible logo alternatives, and public review descriptions use `verygood chocolate` exactly.
- Canonical URLs remain the existing clean English AU URLs.
- Product schema continues to use the current safe `Product`/`Offer` strategy for products with one confirmed starting price. The combined pound-cake/cupcake page remains WebPage-only because it describes two distinct purchasable products.
- Product `description` uses actual descriptive product copy rather than only repeating the price summary.
- Course JSON-LD uses an `AggregateOffer` with `lowPrice: 99` and `highPrice: 254.60` for base course/package prices. Visible copy separately states the extension charge.
- Runtime navigation updates `og:image:type`, `og:image:width`, and `og:image:height` together with the image URL, preventing stale default-image attributes.
- Initial and hydrated canonical values must be identical, in line with the existing clean-URL deployment model.

## Language Behavior

- Default and crawlable content remains `en-AU`.
- No `/ko` routes, Korean sitemap entries, or `hreflang` tags are introduced.
- Selecting Korean updates `document.documentElement.lang` to `ko`; selecting English restores `en-AU`.
- Route title, description, canonical, and structured data remain the English indexable version for both UI states.

## Reviews and Local Entity Signals

- Add a normal anchor to `/reviews` in the public footer or equivalent always-rendered public navigation.
- Do not add self-serving aggregate rating markup.
- Do not expose or fabricate review text during the build.
- Keep the entity typed as `Organization`.
- Pickup language must remain consistent: made to order, pre-arranged pickup in Melrose Park, no delivery, and no walk-in shop.
- The Pulse location remains a pickup landmark and is not promoted as the business address in `LocalBusiness` schema.

## Generated `llms.txt`

The deployed `dist/llms.txt` is rendered during `npm run build` from canonical site, product, class, and ordering facts. It must not contain hand-maintained product-option or photo-status sentences.

Google currently ignores `llms.txt` for Search ranking, so this file is treated as a consistency surface for other consumers, not as a ranking mechanism.

## Failure Handling and Validation

The build or focused SEO test must fail when any of these conditions occurs:

- A catalogue product marked as having a photo has an empty or missing image path.
- Pave public content mentions milk chocolate while the AU selectable option set is dark-only.
- Vanilla public content offers a vanilla cake sheet or claims the photo is pending.
- The public class price range differs from the base prices produced by the class pricing function.
- Static and runtime public metadata use different brand strings, titles, descriptions, or canonical URLs.
- Generated JSON-LD is invalid JSON or carries a different entity/product fact from visible fallback content.
- Generated `llms.txt` differs from the canonical public facts.

External crawler access and indexing are not build-time failures because Cloudflare and search-engine account state are outside this repository.

## Test Strategy

Implementation follows red-green-refactor:

1. Add focused failing regression assertions for each confirmed inconsistency before changing production data.
2. Verify each new assertion fails for the intended current behavior.
3. Make the smallest canonical-data and consumer changes that satisfy the assertions.
4. Run the focused cake/SEO generator tests after each behavior is corrected.
5. Run `npm run lint`, `npm test`, and `VITE_MARKET=AU npm run build`.
6. Parse every generated HTML JSON-LD block, verify the nine indexable canonicals are unique, and compare representative initial metadata with runtime SEO configurations.
7. Confirm the deployed-source worktree contains no unrelated reservation or administrative changes.

## Acceptance Criteria

- Every indexable page and its hydrated state use `verygood chocolate` exactly.
- Pave, Vanilla, and class facts match the selectable/bookable behavior.
- `/cakes` displays the existing Vanilla image through a non-empty URL.
- `dist/llms.txt` is generated from canonical data and contains no stale Vanilla claims.
- Static and runtime public metadata, schema, and social-image attributes agree.
- English remains the only indexable language; the Korean toggle updates only the document language and visible UI.
- `/reviews` has at least one always-present crawlable internal anchor.
- No `LocalBusiness` schema, false public address, unverified contact detail, or invented business fact is added.
- Focused tests, the complete test suite, lint, and the AU production build pass.
- Reservation, Appwrite, admin, and API behavior remains unchanged.
