# AU Chocolate Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task. Keep changes uncommitted until the final verified checkpoint requested by John.

**Goal:** Add five approved AU standalone chocolate sale units without changing existing cake/KR contracts.

**Architecture:** A pure shared domain owns chocolate prices, sale-unit labels and coupon eligibility. Existing create-cake and version-1 orderLinesJson carry normalized chocolate lines; historical readers receive additive support only. AU UI reuses existing cart/reservation and chocolate routes, and fails closed when the server lacks chocolate capability.

**Tech Stack:** React/TypeScript, Node ESM Appwrite Functions, existing Node test runners.

**Spec:** John's approved Chocolate Commerce contract in this conversation, 2026-09-26; exact requirements below supersede the older undecided entries in redesign design.md/plan.md.

## Global Constraints

- Work only in feat/au-redesign-ui. No integration merge, push, production deploy, Appwrite migration, PayPal or Login.
- Preserve existing create-cake / orderLinesJson v1, stored cake orders, KR products/prices/catalogue, AU pickup/preparation and quantity 1–5 sale units.
- SKU prices in cents: almond-chocoball-80g 1200; almond-chocoball-6pack 6000; almond-chocoball-black-tub-2x80g 2500; pave-chocolate-100g 1200; eiffel-tower-chocolate-6 1000.
- Sale units: 80g; 80g × 6; 80g × 2; 100g; 6 pieces, respectively.
- Six-pack UI: BUY 5, GET 1 FREE — 6 PACK / AUD 60. Single quantity 5 stays five bags; never auto-promote.
- Chocolate Extras remain Pavé 100g AUD12, Eiffel 6pcs AUD10, Combo AUD20 (AUD2 saving), charged once per row.
- All standalone chocolates coupon eligible except almond-chocoball-6pack. Mixed orders discount eligible lines only. Existing cake coupon behavior unchanged. Eligibility belongs to domain policy, not scattered ID checks.
- No fake Cake Size on chocolate in cart, checkout, stored/admin/lookup, CSV, SMS, email, reminder or calendar.
- Preserve pre-existing approved frontend/photo/hero edits. Do not alter or stage design/au-site-redesign.pen. John explicitly permits package.json test-command changes needed to copy shared modules into temporary test folders; dependencies and lock files must remain unchanged. Existing outside-repo test dependency hook is available.

## Review Focus

- Old server: chocolate checkout must fail closed, including single-line submission (Task 3).
- Historical orders and malformed stored money: additive IDs must not weaken old validation or reprice history (Tasks 1–2).
- Repeated SKU lines / altered prices/options: normalization enforces merged quantity max 5 and rejects tampered payloads (Task 1).
- Mixed six-pack/cake/extra coupons: discount basis excludes six-pack only, preserves once-per-row extra charging (Tasks 1,3).
- New module in packaged notification/reminder artifacts and TS test runners must be resolvable offline (Tasks 2–3).

### Task 1: Shared domain and server order contract

**Files:** Create appwrite-functions/reservation-api/src/chocolate-products.js and declaration if needed; modify cake-order-catalog.js, cake-order-input.js, cake-order-pricing.js, stored-order-policy.js/reader.js, reservation-health.js and closely related API contracts only as necessary. Add tests/chocolate-commerce.test.mjs; extend reservation API/core tests where behavior requires.

**Interfaces:** Export CHOCOLATE_PRODUCTS keyed by SKU, each {id, name, saleUnit, unitPriceCents, couponEligible, family}; getChocolateProduct(productId) returns definition or undefined; isChocolateProductId(productId); isProductCouponEligible(productId) preserves existing smore exclusion and all existing cake eligibility; CHOCOLATE_EXTRA_PRICES_CENTS retains none/eiffel-6/pave-100g/combo. Definitions for new stored orders must be immutable/versioned so historical prices are not recalculated by future current prices. Add health capability chocolateOrderLines: 1; do not accidentally enable chocolate in cake-order.v2.

- [x] Write failing behavioral tests against current normalize/price/storage functions: five prices; single5=6000 vs sixpack1=6000; sixpack2=12000; all five qty1 subtotal11900, eligible basis5900, 10% discount590; cake79+combo20+all five subtotal21800, discount1580 at10%; combo charged once at cake qty2.
- [x] Run RED test and capture expected INVALID_PRODUCT/current behavior failure.
- [x] Implement common immutable domain and additive normalized v1 order/storage support; use canonical inert options and reject unsupported chocolate options/price tampering. Existing schema strings suffice; no schema edits.
- [x] Test qty0/fraction/6/merged6, unknown SKU, coupon-only sixpack, idempotency and v2 rejection; run core/golden/API/stored contract tests. Preserve frozen cake fixtures unchanged.
- [x] Self-review and report files/test evidence; no commit yet.

### Task 2: Stored frontend and operational consumers

**Files:** src/lib/stored-order-policy.ts, stored-order-reader.ts, stored-order-catalog.ts, order-lines.ts, utils.ts and src/components/ProductDetailRows.tsx as needed (the latter is shared by lookup, confirmation and admin); appwrite-functions/reservation-notification/src/main.js; booking-reminder/src/reminder-business.js; reservation-api/src/calendar-access.js; scripts/reservation-notification-deploy-runtime.mjs and booking-reminder-deploy-runtime.mjs only for offline archive dependency inclusion. Test stored-order-compatibility, admin-order-lines, notification, reminder, calendar, artifact suites. May extend src/lib/types.ts ProductId union for the five SKUs (later task consumes it).

**Interfaces:** Consume Task 1 chocolate domain, never duplicate current price tables; add AU-only product-name/sale-unit summaries and retain all prior cake/KR outputs. Readers accept new valid lines without weakening old price/canonical validation. Historical stored policy must pin new approved prices as immutable snapshot or versioned definition.

- [x] Write and run RED behavioral tests round-tripping chocolate and mixed stored orders through frontend/admin/CSV/SMS and actual notification/reminder/calendar renderers.
- [x] Implement additive readers and accurate names/sale units, no Cake Size; preserve KR configuration and historical cake pricing.
- [x] Extend offline archive module manifests for shared domain. Do not invoke deploy or Appwrite.
- [x] Run focused reader/admin/notification/reminder/calendar and artifact tests, report evidence; no commit.

### Task 3: AU catalog, cart, checkout and public UI

**Files:** src/lib/types.ts, market.ts, chocolate-extras.ts, cart.ts, cake-detail.ts where transport reuse requires, repository.ts and reservation request/capability/coupon adapters; src/lib/au-chocolate-preview.ts (or focused catalogue replacement), src/pages/AuChocolatePage.tsx, AuCategoryPage.tsx, HomePage.tsx, ReservePage.tsx; src/CartPage.tsx, src/CartProvider.tsx, src/App.tsx/capability provider as necessary. Reuse src/lib/au-chocolate-assets.ts and existing images. SEO generator/metadata/sitemap may be updated for supported public products; no deployment. Extend existing cart/coupon/boundary tests and add tests/chocolate-commerce-client.test.ts, tests/au-chocolate-commerce.browser.mjs. Minimal AU-scoped CSS only if existing template needs controls.

**Interfaces:** Consume Task 1 shared domain and chocolateOrderLines:1 capability. No fake cake catalogue entries to bypass cart guards; explicit chocolate normalization/price branch using existing transport defaults is acceptable. Cart v1 compatibility and cake behavior stay intact. AU three family routes expose Almond's three variants and other single SKU each; existing shared price source drives UI and extras.

Integration details: AuChocolatePage should use the existing CakeDetailPage callback pattern (`onAddToOrder`, `onViewOrder`) supplied by src/App.tsx; current SSR boundary test props already provide those callbacks. Single chocolate API payloads must omit cacaoPercent per strict server contract. ReservePage's selected-product image must use chocolate family photography instead of its current fallback cake photo. Capability enforcement must also precede any local/demo save path; do not create fake chocolate confirmations. Review-coupon estimates and strict API result parsing must use the shared eligible-line basis, including chocolate extras once per row, not the entire mixed order subtotal. Test-script-only package.json updates are approved; make the new chocolate suites part of normal npm test coverage and resolve temporary JS runtime copying for all affected TS commands.

- [x] Write and run RED tests for AU variants/cart identity/quantities/serialization, coupon basis5900, mixed cake+chocolate, KR rejection and old backend capability rejection for both single and multi submit.
- [x] Implement SKU selection, quantity and add-to-cart using existing cart/reserve flow; domain policy excludes sixpack only. Use current image with honest reference caption when not a photograph of selected pack.
- [x] Keep /chocolates and three existing detail routes, Home inline filter/rail/mobile navigation; remove preview-only presentation only where actual local contract now exists. No fake remote backend support; fail closed at checkout.
- [x] Run lint, AU/KR builds, focused cart/coupon/capability/market tests, test:cake. Resolve JS-module inclusion in existing TS test harness without unrelated package changes.
- [x] Self-review and report evidence; no commit.

### Task 4: End-to-end verification and checkpoint

**Files:** Only covering tests and this implementation record unless review finds a scoped defect.

- [x] Run full npm test with existing outside-repo dependency hook, all new suites, lint, AU/KR builds, git diff --check.
- [x] Browser smoke AU desktop/mobile chocolates and all three details, variants/cart/mixed coupon behavior with local fixtures only; KR home/cake unaffected. No external order submission. Save evidence outside repo.
- [x] Review complete implementation diff with independent reviewer; fix important issues and reverify relevant suites.
- [x] Confirm Pencil hash unchanged, protected worktrees unchanged, no schema/dependency/lock/deployment writes. Stage explicit implementation/approved frontend dependency files only, exclude Pencil. Create one checkpoint commit and stop; report status and test evidence, no merge/deploy.
