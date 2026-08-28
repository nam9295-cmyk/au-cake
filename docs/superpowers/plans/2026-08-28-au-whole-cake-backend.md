# AU Whole Cake Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely support the current four-product AU Whole Cake catalog with a temporary server-side legacy submission mode.

**Architecture:** Reservation API separates current submission, compat submission, and stored-order IDs and prices. Rendering consumes stored IDs through explicit names and size labels; existing email delivery and Appwrite schema stay unchanged.

**Tech Stack:** Node.js Appwrite Functions, TypeScript frontend contract readers, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-08-28-au-whole-cake-backend-design.md`

## Global Constraints

- Do not deploy, migrate Appwrite, merge, push, or commit.
- Default and invalid `CAKE_CATALOG_MODE` values must resolve to `required`.
- Apply catalog-mode restriction only to Whole Cake submissions; preserve secondary active submission behavior.
- Preserve stored historical IDs, centimetre sizes, and approved prices.
- Do not modify customer-email mode, ledger behavior, reminder scheduling, pickup schedule, discounts, or packaging.

---

### Task 1: Define catalog and pricing partitions

**Files:**
- Modify: `appwrite-functions/reservation-api/src/active-cake-products.js`
- Modify: `appwrite-functions/reservation-api/src/business.js`
- Test: `tests/reservation-api.test.mjs`

**Interfaces:**
- Produces `resolveCakeCatalogMode(value)` and mode-aware submission validation for `buildCakeReservation` and `normalizeCakeOrderLines`.
- Produces current and legacy Whole Cake price lookups used by stored parsing.

- [x] **Step 1: Write failing Reservation API tests** for new Strawberry IDs, current inch prices, invalid inch keys, compat legacy prices, required legacy rejection, historical reads, and option/price tampering.
- [x] **Step 2: Run `npm run test:reservation-api`** and confirm the tests fail because new IDs, prices, and catalog mode are absent.
- [x] **Step 3: Add mode-aware ID/size validation and split price tables** while preserving existing secondary catalog entries and historical-price exceptions.
- [x] **Step 4: Run `npm run test:reservation-api`** and confirm new and existing cases pass.

### Task 2: Wire the server-only deploy variable

**Files:**
- Modify: `appwrite-functions/reservation-api/src/main.js`
- Modify: `scripts/reservation-api-deploy-config.mjs`
- Test: `tests/reservation-api-customer-email-cutover.test.mjs`
- Test: `tests/reservation-api-deploy.test.mjs`

**Interfaces:**
- Produces `cakeCatalogMode` in Reservation API runtime config.
- Produces `CAKE_CATALOG_MODE` in the Reservation API deploy variable set only.

- [x] **Step 1: Write failing tests** proving server-only exact-value resolution, default required behavior, and deploy-plan variable wiring.
- [x] **Step 2: Run the focused test files** and confirm the new assertions fail.
- [x] **Step 3: Pass `cakeCatalogMode` from environment resolution through request canonicalization and reservation building; add it to deploy config.**
- [x] **Step 4: Re-run focused tests** and confirm they pass.

### Task 3: Render and consume the new stored contract

**Files:**
- Modify: `appwrite-functions/reservation-notification/src/main.js`
- Modify: `appwrite-functions/booking-reminder/src/reminder-business.js`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/repository.ts`
- Test: `tests/reservation-notification-cake.test.mjs`
- Test: `tests/booking-reminder.test.mjs`
- Test: `tests/admin-order-lines.test.ts`

**Interfaces:**
- New Strawberry product IDs and inch values remain readable by email, reminder, lookup, and admin hydration.

- [x] **Step 1: Write failing rendering and hydration tests** for Strawberry names, inch labels, historical Vanilla, and existing delivery invariants.
- [x] **Step 2: Run focused notification, reminder, and admin tests** and confirm new assertions fail.
- [x] **Step 3: Add explicit names and labels and extend shared types/read validation without changing delivery/schedule code.**
- [x] **Step 4: Re-run focused tests** and confirm they pass.

### Task 4: Verify the complete contract

**Files:**
- Test: `tests/cart.test.ts`
- Test: `tests/cake-options.test.ts`

- [x] **Step 1: Add any required contract-reader assertions for current IDs and historical compatibility.**
- [x] **Step 2: Run the mandatory targeted suites, build, ESLint excluding `.worktrees/**`, `npm test`, and `git diff --check`.**
- [x] **Step 3: Inspect the final diff against `origin/main` and report the deferred compat-to-required rollout.**
