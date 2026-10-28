# Halloween Meringue Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Add the approved seasonal meringue packs to AU home, detail and existing checkout.
**Architecture:** Shared catalog prices, shared seasonal calendar and server pickup validation. Preserve historical readers and existing pricing; use separate seasonal card to avoid changing permanent merchandising.
**Tech Stack:** React/TypeScript, shared Node JavaScript, Vite, node:test.
**Spec:** docs/superpowers/specs/2026-10-28-halloween-meringue-design.md

## Global Constraints
3/$12, 6/$23, 12/$45, 24/$85. Sydney final pickup 2026-11-01; 24 hours minimum; current pickup hours. No deployment or live writes.

## Review Focus
- Exact 24-hour boundary and Sydney timezone.
- Mixed carts and configured closures.
- Expired cart cannot submit but remains removable.
- Historical snapshots remain readable after season.
- Direct product URLs and mobile rendering.

### Task 1: Order contract and calendar
Files: au-renewal.js, au-renewal-catalog.js/.d.ts, au-renewal-pickup.js; new tests/au-halloween-meringue.test.mjs.
Interfaces: HALLOWEEN_MERINGUE_CARD; halloweenMeringueAvailable(now); existing priceRenewalOrder/validateRenewalPickup.
- [x] RED: prices, cutoff, dates, mixed cart, real storage roundtrip.
- [x] Implement four cookie-family offers and seasonal card/calendar.
- [x] GREEN: focused tests and existing renewal regression.

### Task 2: Merchandising and checkout
Files: HomePage.tsx, AuRenewalShop.tsx, renewal-photos.ts; seasonal component/hook/CSS, local WebP assets; SEO module; UI tests.
- [x] RED: active/expired seasonal section/detail, EN/KO and pack prices.
- [x] Implement existing style layout, four options, pickup notice and expired-cart warning.
- [x] GREEN: UI, routes, build, TypeScript/lint; inspect local preview.

### Task 3: Verify and handoff
- [x] Run npm test, targeted seasonal tests, lint and AU build; document any failures.
- [x] Review diff for unintended product changes. Provide local preview; no deployment.

## Verification — 2026-10-28
- Initial backend RED: unknown new offers and missing seasonal cutoffs; 5 tests failed before implementation.
- Initial UI RED: pack per-unit prices, expired detail and seasonal collection missing; failed before implementation.
- Additional expired-cart notice and static route tests RED, then GREEN.
- `npm test`: 2,248 total / 2,247 PASS / 0 FAIL / 1 existing market-specific SKIP (KR production dist check while AU artifact is present).
- `npm run test:halloween`: 8 backend/metadata tests and 5 UI tests PASS (included in full suite).
- `npx tsc -b`, `npm run lint`, AU build: PASS. Existing bundle-size warning remains.
- Browser: desktop1440/mobile390, all4 pack prices,2 six-packs $46 and decrement $23, refresh persistence, Friday20:00/Sunday13:00, post-season dates disabled, exact live cutoff on already-open detail, expired cart retained/removable, other product retained, home/collection hidden after expiry. Zero backend requests, zero page errors in final run.
- Independent read-only review: no critical/important implementation defects; identified compatible-reader deployment requirement below.
- Early full-suite attempts failed due sandbox loopback EPERM, then git-tracked-only artifact builders omitting newly untracked files. Corrected execution permissions and registered new sources; final full suite passed without changing/weakening existing tests.

## Release handoff — not executed
This local branch remains based on cd19aa3. Reconcile the latest main at release time; do not overwrite newer remote changes or deploy this checkout wholesale without checking them.
1. Review/approve preview and production release separately. Existing products, prices, flags, admin UIDs, credentials and ACLs must be preserved.
2. Package/deploy compatible `reservation-notification` and `booking-reminder` readers before accepting seasonal writes: both embed au-renewal.js and au-renewal-reader.js via their existing deployment builders. Old readers reject new offer IDs. No review-api-specific deploy is needed.
3. Deploy the reservation-api additive catalog/pickup validation, then the AU frontend. No schema migration is needed for this feature.
4. Close selling automatically at 2026-10-31 13:00 Sydney; last pickup 2026-11-01 13:00. Keep product definitions/readers permanently so old orders remain valid.
5. Rollback must preserve compatible readers once any meringue order exists. Hiding the seasonal section is safe; reverting to a reader unable to parse seasonal orders is not. Do not delete orders/cart data.

## Decisions made during implementation
- Kept seasonal merchandising separate from permanent RENEWAL_CARDS; permanent Home Best/collection counts and unrelated prices remain unchanged.
- Used cookie-family coupon exclusion already in the original pricing code; meringue-only coupons are rejected, eligible cakes in mixed carts retain their original discount.
- Static product URL includes explicit2026 dates and price offer validity; no permanent static homepage promotion was added. Client section/list close without a redeploy; server clock enforces new-order rejection.
- No ingredients, shelf-life, wrapping options or design-selection promises invented. Existing enquiry guidance remains.
