# AU Pound Cake Options Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Keep the two existing AU cake products (`pave-cake`, `pound-cake`) and add richer pound-cake configuration: size choices, chocolate type choices, and paid add-on choices.

**Architecture:** The current app stores product configuration in `src/lib/market.ts`, computes reservation prices in `src/lib/constants.ts`, stores reservations through `src/lib/repository.ts`, and renders all customer/admin screens in `src/App.tsx`. This change should extend the reservation model instead of replacing the two existing product IDs, so old product identity stays stable.

**Tech Stack:** React 19, Vite, TypeScript, Appwrite client SDK, Node test runner.

---

## Current Findings

- Project path: `/home/john/workspace/au-cake`
- Current product IDs are fixed in `src/lib/types.ts`:
  - `pave-cake`
  - `pound-cake`
- Current AU product configuration lives in `src/lib/market.ts` under `MARKET_CONFIG.AU`.
- Current price calculation lives in `src/lib/constants.ts`:
  - `getReservationUnitPrice(productId, cacaoPercent, cakeSize)`
  - `getReservationPrice(productId, cacaoPercent, quantity, cakeSize)`
- Current reservation payload stores:
  - `productId`
  - `cakeSize`
  - `quantity`
  - `cacaoPercent`
  - `totalPrice`
- Appwrite schema currently has no dedicated columns for pound-cake add-ons or chocolate type.
- There are currently no tests for cake/product reservation pricing; only kids class tests exist.

## Important Product Decision Notes

1. Keep only two product IDs.
   - Do not add new product IDs for “pound + chocolate” or “pound + cream”.
   - Use `pound-cake` plus option fields.

2. Add pound-only options.
   - Base option: no add-on.
   - Chocolate add-on: paid.
   - Vanilla cream add-on: paid.
   - Recommended internal values:
     - `none`
     - `extra-chocolate`
     - `vanilla-cream`

3. Add pound-only sizes.
   - Requested sizes: 15cm, 17cm, 19cm, 22cm.
   - AU display recommendation: show both local-friendly inch and exact cm, for example:
     - `6 inch / 15cm`
     - `6.7 inch / 17cm`
     - `7.5 inch / 19cm`
     - `8.7 inch / 22cm`
   - If John wants pure cm labels only, use `15cm`, `17cm`, `19cm`, `22cm`.

4. Add chocolate type.
   - Requested types: dark, milk.
   - Recommended internal values:
     - `dark`
     - `milk`
   - Display labels:
     - `Dark chocolate`
     - `Milk chocolate`

5. Pave cake should remain as-is unless John says otherwise.
   - Current `pave-cake` uses size and cacao options.
   - Current `pound-cake` does not use size/cacao options in code.
   - This plan adds a separate pound-cake option layer instead of disturbing the pave-cake cacao setup.

## Recommended Data Model

Modify `src/lib/types.ts`:

```ts
export type PoundCakeSize = '15cm' | '17cm' | '19cm' | '22cm'
export type PoundChocolateType = 'dark' | 'milk'
export type PoundAddon = 'none' | 'extra-chocolate' | 'vanilla-cream'
```

Extend `Reservation` and `ReservationInput`:

```ts
poundCakeSize: PoundCakeSize
poundChocolateType: PoundChocolateType
poundAddon: PoundAddon
```

Compatibility default for old reservations:

```ts
poundCakeSize: document.poundCakeSize || '15cm'
poundChocolateType: document.poundChocolateType || 'dark'
poundAddon: document.poundAddon || 'none'
```

## Recommended Config Shape

Add these to `src/lib/market.ts` market config, probably as top-level market fields:

```ts
poundCakeSizeOptions: Array<{
  value: PoundCakeSize
  label: string
  description: string
  price: number
}>

poundChocolateOptions: Array<{
  value: PoundChocolateType
  label: string
  description: string
  extraPrice: number
}>

poundAddonOptions: Array<{
  value: PoundAddon
  label: string
  description: string
  extraPrice: number
}>
```

Why this is better than reusing `cakeSizeOptions`:
- Pave cake and pound cake will have different size systems.
- Pave still has cacao profile options.
- Pound needs chocolate type and add-ons.
- Reusing the existing `cakeSize` field would force one shared size list and make the UI confusing.

## Appwrite Schema Plan

Add optional attributes to reservations collection:

- `poundCakeSize`: string, size 20, required false
- `poundChocolateType`: string, size 20, required false
- `poundAddon`: string, size 40, required false

Do not make them required because old reservations do not have these fields.

Update files:
- `/home/john/workspace/au-cake/scripts/setup-appwrite.mjs`
- `/home/john/workspace/au-cake/src/lib/repository.ts`
- `/home/john/workspace/au-cake/src/lib/appwrite.ts` does not need changes unless env names change.

## Implementation Tasks

### Task 1: Add reservation option types

**Objective:** Add TypeScript types for pound-cake-specific options.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/lib/types.ts`

**Steps:**
1. Add `PoundCakeSize`, `PoundChocolateType`, `PoundAddon` types.
2. Extend `Reservation` and `ReservationInput` with new fields.
3. Run `npm run lint`.
4. Expected: TypeScript/ESLint errors reveal every place that needs migration.

### Task 2: Add product option configuration

**Objective:** Put AU pound-cake sizes, chocolate types, and add-ons into market config.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/lib/market.ts`

**Steps:**
1. Extend `MarketConfig` type with the three option arrays.
2. Add AU values.
3. Add KR fallback values only to satisfy TypeScript, or keep them neutral if KR is not using this UI.
4. Keep `pave-cake` and `pound-cake` product IDs unchanged.

**Pending business values needed from John:**
- Base price for 15cm/17cm/19cm/22cm.
- Extra price for chocolate add-on.
- Extra price for vanilla cream add-on.
- Whether milk/dark has same price or one has extra price.

### Task 3: Update pricing helpers and tests

**Objective:** Make total price include pound size, chocolate type, and add-on.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/lib/constants.ts`
- Create: `/home/john/workspace/au-cake/tests/cake-options.test.ts`
- Modify: `/home/john/workspace/au-cake/package.json` if adding a test script is needed.

**Steps:**
1. Add helper functions:
   - `getPoundCakeSizeOption()`
   - `getPoundChocolateOption()`
   - `getPoundAddonOption()`
   - format label helpers.
2. Update `getReservationUnitPrice()` to accept an options object instead of growing positional parameters too far.
3. Keep backwards compatibility by defaulting missing pound options.
4. Add tests for:
   - Pave price unchanged.
   - Pound 15cm + dark + no add-on returns base 15cm price.
   - Pound 17cm + extra chocolate adds correct extra.
   - Pound 22cm + vanilla cream adds correct extra.
5. Run the new test and `npm run lint`.

### Task 4: Update repository normalization and Appwrite mapping

**Objective:** Store and load the new fields without breaking old reservations.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/lib/repository.ts`

**Steps:**
1. Extend `AppwriteReservationDocument` with optional new fields.
2. Add normalization defaults for localStorage and Appwrite documents.
3. Include fields in `createReservation()` data.
4. Make old reservations display safe defaults.

### Task 5: Update Appwrite setup script

**Objective:** Ensure production DB can accept the new fields.

**Files:**
- Modify: `/home/john/workspace/au-cake/scripts/setup-appwrite.mjs`

**Steps:**
1. Add three optional string attributes to `reservationAttributes`.
2. Keep `required: false`.
3. Do not change existing enum fields unless absolutely necessary.
4. Before running this script in production, verify `APPWRITE_ADMIN_USER_IDS` is set to avoid broad authenticated-user access.

### Task 6: Update reservation form UI

**Objective:** Show pound-only choices when `pound-cake` is selected.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/App.tsx`

**Steps:**
1. Add new fields to `ReservePage` form state:
   - `poundCakeSize`
   - `poundChocolateType`
   - `poundAddon`
2. When selected product is `pound-cake`, render:
   - size choices: 15cm/17cm/19cm/22cm
   - chocolate choices: dark/milk
   - add-on choices: basic / extra chocolate / vanilla cream
3. When selected product is `pave-cake`, keep existing size + cacao UI.
4. Update summary panel to display pound options instead of cacao/old size where relevant.
5. Keep mobile layout readable at 320px/360px.

### Task 7: Update completion, lookup, admin, CSV, and SMS display

**Objective:** Make every customer/admin output show the new pound configuration.

**Files:**
- Modify: `/home/john/workspace/au-cake/src/App.tsx`
- Modify: `/home/john/workspace/au-cake/src/lib/utils.ts`

**Steps:**
1. Update `ProductDetailRows()` to show:
   - Product
   - Pound size
   - Chocolate type
   - Add-on
   when product is `pound-cake`.
2. Update admin reservation table columns or detail drawer.
3. Update CSV export headers/rows to include new fields.
4. Update SMS copy message to include new fields.
5. Keep old reservations safe by showing defaults or `-` if appropriate.

### Task 8: Verify locally

**Objective:** Verify no regression before deployment.

**Commands:**

```bash
cd /home/john/workspace/au-cake
npm run lint
npm run build
```

If test script is added:

```bash
npm run test:class
npm run test:cake
```

Manual browser checks:
- `/` home page product cards still show two products.
- `/reserve` from Pave card shows existing pave options.
- `/reserve` from Pound card shows new pound options.
- 320px and 360px mobile widths do not clip option cards/buttons.
- Completion page shows pound size/chocolate/add-on.
- Admin list/detail shows pound options.

### Task 9: Production DB migration/deploy checklist

**Objective:** Avoid production reservation failures after UI deploy.

**Steps:**
1. Confirm `.env.local` or deployment env uses AU market:
   - `VITE_MARKET=AU`
2. Confirm Appwrite reservation database/collection IDs are AU-specific.
3. Confirm `APPWRITE_ADMIN_USER_IDS` is set before running setup.
4. Run:

```bash
cd /home/john/workspace/au-cake
npm run setup:appwrite
```

5. Build/deploy the frontend after schema accepts the new fields.
6. Submit one test reservation in AU staging/production only after John approves.

## Recommended First Implementation Choice

Use the safe extension approach:

- Keep `ProductId` unchanged.
- Add pound-specific fields as optional reservation attributes.
- Add pound-specific config arrays instead of overloading existing cacao/size options.
- Do not change Pave logic except where shared display components need to branch.

## Open Questions Before Coding

1. Prices:
   - 15cm base price?
   - 17cm base price?
   - 19cm base price?
   - 22cm base price?
   - Extra chocolate add-on price?
   - Vanilla cream add-on price?
   - Dark and milk same price?

2. Labels:
   - Should AU show pure cm (`15cm`) or inch + cm (`6 inch / 15cm`)?

3. Add-on selection:
   - Can customers choose both extra chocolate and vanilla cream together?
   - Or exactly one of: basic / extra chocolate / vanilla cream?
   - Current user wording sounds like exactly one; this plan assumes exactly one.

4. Pave cake:
   - Leave current mini/No.1 + cacao options unchanged?
   - This plan assumes yes.

## Rollback

If changes cause issues before production schema migration:

```bash
cd /home/john/workspace/au-cake
git diff
# then revert only the option-change files, after confirming scope
```

If Appwrite attributes were added, leaving optional attributes in place is safe and usually does not need rollback.
