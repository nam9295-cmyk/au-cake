# AU Whole Cake Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the current AU Whole Cake catalogue of four product contracts and four protected secondary products without changing historical reservations.

**Architecture:** A pure serving-profile module owns current Whole Cake labels and product profile mapping. `market.ts` remains the price authority. Product-aware current selection formatting is kept separate from raw stored-order formatting, preventing cm values from ever being interpreted with current profiles. Existing catalogue, compact detail, reservation, and SEO sources consume those domain helpers rather than duplicate prices or serving values.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, Appwrite reservation client, static JSON public content.

**Spec:** `docs/superpowers/specs/2026-08-28-au-whole-cake-design.md`

## Global Constraints

- Work only in `/home/john/worktrees/au-cake-whole-cake-frontend` on `feat/au-whole-cake-frontend`.
- Do not edit `/home/john/worktrees/au-cake-whole-cake-backend`, deploy, merge, push, or commit.
- Current Whole Cake IDs use only `6in`, `8in`, and `10in`; historical cm values retain their historical labels.
- `market.ts` product `sizePrices` is the frontend price authority.
- Strawberry images stay photo-pending; no generated, reused, missing, or SEO image URLs.
- Preserve Cupcake/Lemon packaging, Signature/Brownie options, pickup, customer-email, and class behavior.

---

### Task 1: Add the current Whole Cake size and serving domain boundary

**Files:**
- Create: `src/lib/cake-serving.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/market.ts`
- Modify: `src/lib/constants.ts`
- Test: `tests/cake-options.test.ts`

**Interfaces:**
- Produces `CakeServingProfile`, `CURRENT_WHOLE_CAKE_SIZES`, and profile-specific label lookup.
- Produces product-aware current formatting and raw stored-size formatting for all customer/admin consumers.

- [ ] **Step 1: Write the failing serving tests**

```ts
assert.deepEqual(CURRENT_WHOLE_CAKE_SIZES, ['6in', '8in', '10in'])
assert.equal(formatCurrentCakeSizeLabel('pave-cake', '8in'), '8" | serves approx. 14–18')
assert.equal(formatCurrentCakeSizeLabel('fresh-strawberry-vanilla-cream-cake', '8in'), '8" | serves approx. 10–14')
assert.equal(formatStoredCakeSizeLabel('pave-cake', '19cm'), '7.5" | serves 14')
assert.equal(formatStoredCakeSizeLabel('pave-cake', '22cm'), '9" | serves 22')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `VITE_MARKET=AU npx tsc tests/cake-options.test.ts --ignoreConfig --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --outDir /tmp/au-whole-cake-red-1 --skipLibCheck && VITE_MARKET=AU node --test /tmp/au-whole-cake-red-1/tests/cake-options.test.js`

Expected: FAIL because the new size values and formatters do not exist.

- [ ] **Step 3: Implement the smallest domain helpers**

```ts
export type CakeServingProfile = 'gateau' | 'genoise'
export const CURRENT_WHOLE_CAKE_SIZES = ['6in', '8in', '10in'] as const
export const CAKE_SERVING_LABELS = {
  gateau: { '6in': '6" | serves approx. 8–10', '8in': '8" | serves approx. 14–18', '10in': '10" | serves approx. 24–28' },
  genoise: { '6in': '6" | serves approx. 6–8', '8in': '8" | serves approx. 10–14', '10in': '10" | serves approx. 16–20' },
} as const
```

Extend `CakeSize` with `6in | 8in | 10in`; retain `15cm | 17cm | 19cm | 22cm`. Add `cakeServingProfile` only to active Whole Cake product configurations. Keep the existing AU cm label source for stored values and make stored normalization preserve those values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run the cake options suite**

Run: `npm run test:cake`

Expected: current size/profile assertions pass; unrelated pre-existing assertions either remain green or identify the next necessary test update.

### Task 2: Define the eight-product current catalogue and price contracts

**Files:**
- Modify: `src/lib/market.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/cake-catalog.ts`
- Modify: `src/lib/i18n.ts`
- Test: `tests/cake-catalog.test.ts`
- Test: `tests/cake-options.test.ts`

**Interfaces:**
- Produces `getAuCakeCatalog()` entries ordered Pave, Buttercream, Strawberry Vanilla, Strawberry Chocolate, Cupcakes, Signature, Lemon, Brownie.
- Produces group metadata `whole-cakes` and `more-cakes` without a second product list.

- [ ] **Step 1: Write the failing catalogue and price tests**

```ts
assert.deepEqual(getAuCakeCatalog().map((entry) => entry.defaultProductId), [
  'pave-cake', 'buttercream-cake', 'fresh-strawberry-vanilla-cream-cake',
  'fresh-strawberry-chocolate-cream-cake', 'cupcake-dozen', 'pound-cake',
  'fresh-lemon-cupcakes-12', 'brownie-cheesecake',
])
assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '10in' }), 159)
assert.equal(getReservationUnitPrice('buttercream-cake', { cakeSize: '8in' }), 99)
assert.equal(getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '6in' }), 69)
assert.equal(getReservationUnitPrice('fresh-strawberry-chocolate-cream-cake', { cakeSize: '10in' }), 135)
assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake'), null)
```

- [ ] **Step 2: Run the focused catalogue test and verify RED**

Run: `VITE_MARKET=AU npx tsc tests/cake-catalog.test.ts --ignoreConfig --allowJs --module NodeNext --moduleResolution NodeNext --target ES2022 --lib ES2022,DOM --types node --outDir /tmp/au-whole-cake-red-2 --skipLibCheck && VITE_MARKET=AU node --test /tmp/au-whole-cake-red-2/tests/cake-catalog.test.js`

Expected: FAIL because catalogue and product configurations still contain legacy Vanilla and cm pricing.

- [ ] **Step 3: Implement the product data once**

Add both Strawberry IDs to `ProductId`, set all four active Whole Cake `sizePrices` to `6in/8in/10in`, and use `cakeServingProfile: 'gateau'` for Pave/Buttercream and `'genoise'` for both Strawberry cakes. Retain old Vanilla product data outside current catalogue lookup. Add two photo-pending catalogue entries and group field values; use the market/i18n source for bilingual card copy and no card-local price literals.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command and the Task 1 focused test. Expected: PASS.

- [ ] **Step 5: Check the backend contract boundary without editing it**

Add a literal contract-table test that asserts current frontend IDs, active size keys, and `market.ts` prices against the agreed backend values. It must not import or alter the backend worktree; the later integration run will execute backend parity after its branch is merged.

### Task 3: Render groups, placeholders, compact details, and serving disclosure

**Files:**
- Modify: `src/CakesPage.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/CakeDetailPage.tsx`
- Modify: `src/lib/cake-detail.ts`
- Modify: `src/lib/cake-editorial.ts`
- Modify: `src/index.css`
- Test: `tests/cake-catalog-component.test.mjs`
- Test: `tests/cake-detail-component.test.mjs`
- Test: `tests/cake-detail.test.ts`

**Interfaces:**
- Consumes the catalogue group field and product-aware serving label.
- Produces native photo-pending views and compact Strawberry detail contracts without new components.

- [ ] **Step 1: Write failing component and detail tests**

```js
assert.match(cakesSource, /WHOLE CAKES/)
assert.match(cakesSource, /MORE CAKES/)
assert.match(detailSource, /Why do serving sizes vary\?/)
assert.match(detailSource, /Serving guides vary by cake style and portion size/)
assert.match(detailSource, /cake-detail-photo-coming/)
```

Add TypeScript detail assertions for two Strawberry slugs, empty galleries, compact editorial layout, and their three approved highlights.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/cake-catalog-component.test.mjs tests/cake-detail-component.test.mjs`

Expected: FAIL because groups, Strawberry details, and disclosure copy do not exist.

- [ ] **Step 3: Implement the existing renderer integration**

Render grouped cards from catalogue metadata in `CakesPage`. Remove the hardcoded old Vanilla hero slide; leave photos pending Strawberry products out of the hero. Give Strawberry detail entries empty galleries so existing detail and Quick View placeholder branches render without an image request. Add the bilingual serving disclosure beside the existing size fieldset. Add only compact editorial data: approved hero/highlight/detail/key-ingredient copy, no unverified allergen declaration, and existing reviews/related-products flow.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command plus the updated `cake-detail.test.ts` compile/run command. Expected: PASS.

- [ ] **Step 5: Check responsive style isolation**

Keep styles under current catalogue/detail classes, add group heading and disclosure rules, and verify the current mobile breakpoint contains no fixed width or image request requirement for photo-pending cards.

### Task 4: Project current payloads and preserve all stored order presentation

**Files:**
- Create: `src/lib/cake-order-payload.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/review-coupon-client.ts`
- Modify: `src/lib/repository.ts`
- Modify: `src/lib/order-lines.ts`
- Modify: `src/components/ProductDetailRows.tsx`
- Modify: `src/AdminReservationsPage.tsx`
- Modify: `src/CartPage.tsx`
- Modify: `src/pages/ReservePage.tsx`
- Test: `tests/cart.test.ts`
- Test: `tests/admin-order-lines.test.ts`
- Test: `tests/admin-reservation-edit.test.ts`
- Test: `tests/cake-options.test.ts`

**Interfaces:**
- Produces `projectCakeOrderPayload(selection)` with `productId`, `cakeSize`, `quantity`, and only relevant user-selected options.
- Produces stored-value formatting that preserves raw cm meanings.

- [ ] **Step 1: Write failing payload and historical-display tests**

```ts
assert.deepEqual(projectCakeOrderPayload(strawberryVanillaSelection), {
  productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', quantity: 1,
})
assert.deepEqual(projectCakeOrderPayload(strawberryChocolateSelection), {
  productId: 'fresh-strawberry-chocolate-cream-cake', cakeSize: '10in', quantity: 2,
})
assert.equal(formatOrderLineSummary({ ...historicalPave, cakeSize: '19cm' }), 'Pave Chocolate Cake · 7.5" | serves 14 · Dark chocolate · x1')
```

Add an explicit Buttercream payload assertion containing its selected `vanillaCakePointColor`; add cart/reserve request-body assertions that Strawberry lines omit sheet, flavour, point colour, packaging, and unrelated defaults.

- [ ] **Step 2: Run focused payload tests and verify RED**

Run: `npm run test:admin-reservation`

Expected: FAIL because existing request projection requires legacy/default fields and size formatting is global.

- [ ] **Step 3: Implement the narrow payload projection**

Use one non-React helper to project outgoing current product lines. Adapt request builders and response types so optional inactive fields are accepted for new products but existing products preserve their established fields. Use current product-aware formatters only for active user selections; use raw stored-value formatting in OrderDetailRows, lookup, admin, calendar, emails, and repository hydration. Ensure historical cm parsing uses a stored normalizer rather than the current selection normalizer.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:admin-reservation` and `npm run test:cake`.

Expected: PASS, including protected packaging, pickup, email, cart, and historical stored-order tests.

- [ ] **Step 5: Confirm no option regression**

Keep Pave dark-only behavior, Buttercream cake colour, Cupcake/Lemon packaging eligibility, Signature finishes, and Brownie finishes unchanged. Add narrow assertions only where the changed serialization can otherwise remove them.

### Task 5: Make public content and legacy Vanilla SEO mutually consistent

**Files:**
- Modify: `src/content/au-public-pages.json`
- Modify: `src/lib/public-content.ts`
- Modify: `src/lib/seo.ts`
- Modify: `scripts/generate-seo-pages.mjs`
- Modify: `scripts/render-au-llms.mjs`
- Test: `tests/cake-seo.test.ts`
- Test: `tests/public-content.test.ts`
- Test: `tests/cake-seo-generator.test.mjs`

**Interfaces:**
- Produces eight current `cakePages`, two new canonical paths, and legacy Vanilla as a noindex webpage-only route.

- [ ] **Step 1: Write failing SEO tests**

```ts
assert.equal(getSeoConfig('/cakes/fresh-strawberry-vanilla-cream-cake').canonical, SITE_URL + '/cakes/fresh-strawberry-vanilla-cream-cake')
assert.equal(productOffer('/cakes/fresh-strawberry-chocolate-cream-cake').price, 72)
assert.equal(getSeoConfig('/cakes/vanilla-fresh-cream-cake').noindex, true)
assert.deepEqual(structuredTypes('/cakes/vanilla-fresh-cream-cake'), ['WebPage', 'BreadcrumbList'])
