# AU frontend Phase 1

## Authority and starting state

John's Phase 1 implementation request (2026-09-22) is the approved scope.
Branch: `feat/au-redesign-ui`; starting HEAD: `398093eab6474e94200ab33121916780e7450b9b`.
Working tree and official Pencil/assets were clean. The committed Pencil contains
the Cakes/Chocolates desktop/mobile and four detail-template pairs. No separate
design checkpoint was needed. The integration branch is not a target of this work.

## Implementation plan

1. Add rendering regressions for AU category/detail/custom templates, exact KR
   baseline rendering, chocolate route isolation, and unavailable services.
2. Add AU-only category and chocolate-preview components. Derive purchasable
   cakes from the existing catalogue; do not create another product/price source.
3. Retain the shared cake configurator's selection, price and cart functions.
   Gate the new presentation and editorial sections with `marketConfig.market === 'AU'`.
4. Put the approved Custom Cake introduction/process before the existing
   configurator and request form. Preserve submission, capability, locking,
   photo-sharing and API behaviour.
5. Use AU-only shell/classes for editorial chrome and responsive styles.
   Make unavailable Home services non-links with a visible Coming Soon state.
6. Run lint, AU/KR builds, cake/cart/market/custom tests, full test suite and
   diff checks. Smoke-test the requested desktop/mobile routes and cart options.
7. Commit the verified frontend implementation only. No integration merge,
   remote push, deployment, backend/schema/package changes or HOGIRL changes.

## Deliberate differences from Pencil

- Catalogue availability, prices, sizes, finishes and packaging fees come from
  existing product/order functions, not the illustrative Pencil labels.
- Almond Chocoball, Pavé Chocolate and Eiffel Tower Chocolate have no independent
  `ProductId` or active cake-order contract. They are catalogue previews only;
  no cart controls or inferred pricing. Only Almond Chocoball's confirmed
  80g / AUD 12 is displayed. Existing cake chocolate extras remain unchanged.
- No new upload, inquiry API or service subsystem. Custom reference images are
  shared after receipt, as in the current form. No new response-time guarantees.
- Current repository photographs and approved placeholders are reused. No remote
  stock dependency or local absolute image URL. Existing typography is retained.

## Verification record

### Implemented routes

- `/`: retained editorial Home with real catalogue values, accessible product
  links, release copy and Coming Soon service states.
- `/cakes`: seven orderable catalogue products.
- `/cakes/pave-chocolate-cake`, `/cakes/signature-gateau-au-chocolat`,
  `/cakes/fresh-strawberry-vanilla-cream-cake`, `/cakes/brownie-cheesecake`:
  AU Cake template, unchanged order selection/pricing functions.
- `/cakes/chocolate-cupcakes`, `/cakes/lemon-cake`, `/cakes/smore-stick`:
  AU Cupcake/Party template with applicable existing controls.
- `/cakes/custom-cake`: AU Custom introduction/process and existing request form.
- `/chocolates`, `/chocolates/almond-chocoball`, `/chocolates/pave-chocolate`,
  `/chocolates/eiffel-tower-chocolate`: unavailable previews, no order contract.

### Changed files

- Shell/routing: `src/App.tsx`, `src/index.css`, `src/lib/app-routes.ts`,
  `src/lib/seo.ts`.
- Existing pages: `src/CakesPage.tsx`, `src/CakeDetailPage.tsx`,
  `src/pages/HomePage.tsx`, `src/pages/CustomCakePage.tsx`.
- AU components/pages: `src/components/AuRedesignChrome.tsx`,
  `src/components/AuProductStory.tsx`, `src/components/AuCustomCakeIntro.tsx`,
  `src/pages/AuCategoryPage.tsx`, `src/pages/AuChocolatePage.tsx`.
- AU presentation data/styles: `src/lib/au-catalog.ts`,
  `src/lib/au-chocolate-preview.ts`, `src/styles/au-phase1.css`.
- Tests: `tests/phase1-market-boundary.test.mjs`, `tests/market-boundary.test.ts`,
  `tests/cart-ui-contract.test.mjs`, `tests/au-footer-brand-layout.test.mjs`,
  `tests/admin-review-reward-client.test.ts` (approved clock-only repair).
- Evidence: `docs/redesign/phase1-implementation.md`, `design-qa.md`,
  `docs/redesign/qa-signature-2026-08-30.md` (preserved prior QA report).

### Commands and browser results

- `npm run lint`: passed.
- `VITE_MARKET=AU npm run build` and `VITE_MARKET=KR npm run build`: passed.
  Existing large-chunk and mixed static/dynamic Appwrite import advisories remain.
- Full `npm test`: passed with the temporary dependency resolver below, including
  `test:cake`, custom-cake frontend/integration/contracts, cart/detail, existing
  KR boundary and the new ten-case AU/KR Phase 1 rendering suite.
- `git diff --check`: passed before handoff.
- Browser: AU desktop Home/Cakes/all seven cake or party details/Custom/Chocolates;
  AU 390px Cakes/Cake/Cupcake; KR Home/Cakes/legacy Custom detail. Cart options,
  quantity, packaging, totals and reservation handoff verified without submission.
- Browser/source comparison: project-root `design-qa.md`. Screenshots:
  `/tmp/au-phase1-evidence.7l2v4J/`. No integration merge, push or deployment.
- Read-only code review found no critical/important issue. Full-App KR SSR
  coverage is a nonblocking future improvement; current browser checks cover it.

### Approved test-environment repairs

1. The existing admin-review active coupon fixture expires on 2026-09-17.
   On 2026-09-22 its parser test failed. With John's explicit approval, only that
   test's `Date.now` is fixed at 2026-07-18T02:00Z. The test context restores it
   automatically. Production expiry validation/backend are unchanged.
2. Full tests then failed loading missing `libheif-js` in three review-api files.
   With separate approval, copied the existing review-api package and lock
   byte-for-byte to `/tmp/au-phase1-review-deps.o2eXgC/` and ran
   `npm ci --ignore-scripts --no-audit --no-fund` there. Source/copy hashes match.
   A test-only Node resolver maps only `libheif-js` imports to that install;
   it does not mock the implementation or write repo node_modules.

Reproduction while that temporary folder exists:

```sh
NODE_OPTIONS=--import=/tmp/au-phase1-review-deps.o2eXgC/test-dependency-hook.mjs npm test
```

Logs: `/tmp/au-phase1-final-tests.log`, `/tmp/au-phase1-final-lint.log`,
`/tmp/au-phase1-final-build-au.log`, `/tmp/au-phase1-final-build-kr.log`.
Local Node is 24.12.0; existing review-api declares Node 22 and emits an engine
advisory at install. No production-runtime/deployment claim is made. Bare
`npm test` still needs its missing dependency; repo manifests were not changed.

### Baseline-document lag

The v1.0 `plan.md` P00/P14 still describes preparation at `b527515` and no
Pencil/implementation. This is historical, not current frontend state. John's
later explicit Phase 1 approval and starting HEAD `398093e` govern this checkpoint.
The two original baseline documents were not silently rewritten. This file
records observed Phase 1 results without changing product-policy, deployment
or HOGIRL approvals.
