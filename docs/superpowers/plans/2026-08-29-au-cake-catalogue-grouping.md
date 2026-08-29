# AU Cake Catalogue Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the existing eight AU cake products as four ordered, bilingual two-product catalogue groups on Home and `/cakes`, with a compact two-column mobile layout.

**Architecture:** `src/lib/cake-catalog.ts` remains the frontend catalogue authority and gains one ordered group definition plus a localized resolver. Home and `/cakes` consume that same resolver; existing product, pricing, image, SEO, Quick View, and reservation contracts remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, CSS.

**Spec:** User-provided AU catalogue grouping specification dated 2026-08-29.

## Constraints

- Work only on `fix/au-signature-brownie-photos`; preserve commits `c2f4695` and `99243e3`.
- Frontend catalogue presentation only. Do not change Appwrite functions, reservation APIs, pricing, product IDs, payloads, SEO URLs, or detail/order flows.
- Keep all current product photography and the Strawberry Quick View close-ups.
- The current catalogue remains exactly eight unique products; historical Vanilla and Eiffel Brownie remain excluded from current sale groups.

### Task 1: Lock the shared four-group contract

**Files:**
- Modify: `tests/cake-catalog.test.ts`
- Modify: `tests/cake-catalog-component.test.mjs`
- Modify: `tests/vanilla-fresh-cream-cake-component.test.mjs`

- [x] Add assertions for four groups, two cards per group, eight unique IDs, exact group and product order, bilingual copy, and historical exclusions.
- [x] Add component-source assertions that Home and `/cakes` both call the same group resolver and do not carry local AU product arrays.
- [x] Run `npm run test:cake` and confirm the new contract fails because the resolver and grouped markup do not exist.

### Task 2: Add the shared catalogue group resolver

**Files:**
- Modify: `src/lib/cake-catalog.ts`

- [x] Add a typed four-group definition containing id, number, bilingual title/description, and catalogue IDs.
- [x] Resolve localized group view models from the existing catalogue cards, failing if an ID is missing.
- [x] Preserve the underlying SEO catalogue order while the group source owns the requested presentation order.
- [x] Run `npm run test:cake` and confirm the domain assertions pass.

### Task 3: Render Home and `/cakes` from the same groups

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/CakesPage.tsx`

- [x] Render the AU Home catalogue as four semantic group sections with two existing compact Quick View cards each.
- [x] Render `/cakes` as the same four groups, preserving image/name/detail links and global 01–08 product numbering.
- [x] Keep the Korean legacy-market fallback and all detail/Quick View behavior intact.

### Task 4: Implement and verify responsive presentation

**Files:**
- Modify: `src/index.css`
- Test: `tests/cake-catalog-component.test.mjs`

- [x] Add restrained group headings/descriptions using the current forest, ivory, pink, and Work Sans system.
- [x] Use two flexible columns inside every group at desktop, tablet, and 390px mobile widths.
- [x] Compact only the mobile catalogue presentation by hiding long `/cakes` descriptions and option notes while retaining full public source copy.
- [x] Verify 1440, 768, and 390 layouts, including two columns, undistorted images, readable full names/prices, click targets, and no horizontal overflow.

### Task 5: Fresh verification, commit, and push

- [x] Run `npm run test:cake`.
- [x] Run `VITE_MARKET=AU npm run build`.
- [x] Run `npx eslint . --ignore-pattern '.worktrees/**'`.
- [x] Run `npm test` if practical.
- [x] Run `git diff --check` and confirm no backend/Appwrite paths changed.
- [ ] Commit as `feat(au): group cake catalogue by occasion` without amending prior commits.
- [ ] Push only `fix/au-signature-brownie-photos`; do not merge main or deploy.
