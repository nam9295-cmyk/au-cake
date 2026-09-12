# Custom Cake September Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Custom Cake ordering with the approved base prices and the `VERYGOOD CUSTOM` September pre-order policy while retaining `custom-cake.v1`.

**Architecture:** Keep the Custom Cake catalog, canonical wire normalizer, server-side pricing builder, workflow, and page as the existing system boundaries. The wire normalizer will make `promoCode` optional-compatible and canonical; pricing alone will validate its meaning using the server receipt instant and pickup date. The browser will only collect and submit the code.

**Tech Stack:** Node.js ESM reservation API, React/TypeScript, Appwrite Function wire client, Node test runner.

**Spec:** User request supplied in this conversation on 2026-09-12.

## Global Constraints

- Work only on `fix/custom-cake-september-promo`; never modify or merge `main`.
- Retain `custom-cake.v1`; do not add an API version, migration, schema change, or pricing compatibility layer.
- Do not change ordinary Cake, review/manual coupons, paid S'more pricing, dependencies, lockfiles, or remote branches.
- Use the server receipt time in Sydney local date terms; browser input supplies only `promoCode`.
- Do not delete Appwrite data. Query existing Custom Cake records read-only only when credentials/configuration permit.
- Run Custom Cake targeted tests, then `npm test`, `npm run build`, and `npm run lint` before reporting.

---

### Task 1: Encode the new Custom Cake request and pricing policy

**Files:**
- Modify: `appwrite-functions/reservation-api/src/cake-order-catalog.js`
- Modify: `appwrite-functions/reservation-api/src/cake-order-input.js`
- Modify: `appwrite-functions/reservation-api/src/cake-order-pricing.js`
- Modify: `appwrite-functions/reservation-api/src/cake-order-data.js`
- Modify: `appwrite-functions/reservation-api/src/custom-cake-workflow.js`
- Modify: `appwrite-functions/reservation-api/src/custom-cake-runtime.js`
- Modify: `src/lib/custom-cake-contract.ts`
- Test: `tests/custom-cake-order-core.test.mjs`
- Test: `tests/custom-cake-workflow.test.mjs`

**Interfaces:**
- Consumes: `CustomCakeCreateRequest` with an optional `promoCode` string.
- Produces: normalized custom requests containing `promoCode: ''` or `promoCode: 'VERYGOOD CUSTOM'`; quote snapshots with updated prices, a 10% base-only discount only when eligible, and `giftSmoreQuantity: 0`.

- [ ] **Step 1: Write failing pricing and idempotency tests**

Add literal assertions for all six approved cents amounts, omitted/empty/trimmed/case-insensitive promo code handling, invalid-code rejection, Sydney receipt-date boundaries, pickup-date boundaries, extras and paid S'more exclusion, no gifts, and canonical/fingerprint distinction when only the code changes.

- [ ] **Step 2: Run the focused test file to verify it fails**

Run: `node --test tests/custom-cake-order-core.test.mjs tests/custom-cake-workflow.test.mjs`

Expected: failures because the catalog still contains the former prices, custom requests reject `promoCode`, and pricing applies the 5%/gift policy.

- [ ] **Step 3: Implement the minimal server-authoritative policy**

Set the six catalog entries to `15900`, `21900`, `31900`, `23900`, `33900`, and `45900`. Normalize absent `promoCode` to `''`; normalize accepted code spelling to `VERYGOOD CUSTOM`; include it in the canonical request and fingerprint. Apply 10% only to the Custom Cake base subtotal when the server receipt's Sydney date is 2026-09-13 through 2026-09-30 and pickup is 2026-09-13 through 2026-11-30. Return `PROMO_CODE_INVALID` only for a supplied unrecognized code, and always store zero gifts.

- [ ] **Step 4: Run the focused test file to verify it passes**

Run: `node --test tests/custom-cake-order-core.test.mjs tests/custom-cake-workflow.test.mjs`

Expected: PASS with new-policy behavior and existing lifecycle/replay coverage.

### Task 2: Present and submit the new policy from CustomCakePage

**Files:**
- Modify: `src/lib/custom-cake-ui.ts`
- Modify: `src/pages/CustomCakePage.tsx`
- Modify: `tests/helpers/custom-cake-mock.ts`
- Test: `tests/custom-cake-frontend.test.ts`
- Test: `tests/custom-cake-ui.test.mjs`

**Interfaces:**
- Consumes: the optional `promoCode` field from page state.
- Produces: a `custom-cake.v1` request with the user-entered code; English/Korean September pre-order copy; six visible final regular prices.

- [ ] **Step 1: Write failing UI and browser-request tests**

Add assertions that the server-facing page request includes `promoCode`, all displayed prices use the approved regular amounts with `From AUD $159`, and only the new bilingual promo text/code is rendered.

- [ ] **Step 2: Run the focused browser/UI tests to verify they fail**

Run: `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/custom-cake-frontend.test.ts && VITE_MARKET=AU node --test tests/custom-cake-ui.test.mjs`

Expected: failures because the page has no promo input and still renders the opening-offer 5%/gift wording and prior prices.

- [ ] **Step 3: Implement the smallest page and test-double changes**

Add a simple labelled promo input within the existing request form, send its text unchanged for server normalization, replace all old Custom Cake offer copy, and update the local test mock to model the new policy without using it in production.

- [ ] **Step 4: Run the focused browser/UI tests to verify they pass**

Run: `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/custom-cake-frontend.test.ts && VITE_MARKET=AU node --test tests/custom-cake-ui.test.mjs`

Expected: PASS; page sends a code but never calculates or advertises a discounted price.

### Task 3: Update contract fixtures and execute release verification

**Files:**
- Modify: `tests/fixtures/custom-cake-contract/custom-v1.json`
- Modify: `tests/fixtures/custom-cake-contract/lifecycle.json`
- Modify: `tests/fixtures/custom-cake-contract/lifecycle-supplement.json`
- Modify: only Custom Cake test fixtures/snapshots demonstrated to require the new policy.

**Interfaces:**
- Consumes: current `custom-cake.v1` fixture schemas.
- Produces: fixture snapshots that use the updated price policy while retaining the existing API contract version and lifecycle shapes.

- [ ] **Step 1: Update only policy-derived fixture values after inspecting their failing assertions**

Replace old 5%/gift-derived quote values and requests with values justified by the new static policy. Keep ordinary Cake and review-coupon fixtures unchanged.

- [ ] **Step 2: Run the Custom Cake targeted suite**

Run: `npm run test:custom-cake-contract && npm run test:custom-cake-order-core && npm run test:custom-cake-persistence && npm run test:custom-cake-photos && npm run test:custom-cake-actions && npm run test:custom-cake-adapters-notifications && npm run test:custom-cake-frontend && npm run test:custom-cake-integration`

Expected: PASS.

- [ ] **Step 3: Run release verification**

Run: `npm test && npm run build && npm run lint`

Expected: PASS with no package or lockfile changes.

- [ ] **Step 4: Commit the bounded change on the feature branch**

Run: `git add <only verified Custom Cake files> && git commit -m "fix: update custom cake September promo"`

Expected: one feature-branch commit; `main` remains at `a0bd68066053fdf329121f58b5a9dd40da3339c7`.
