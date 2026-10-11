# AU Product Detail visual and functional QA — 2026-10-07

final result: passed

This is a local review candidate, not production deployment approval. John's requested visual-polish review remains the next step.

## Source, state and normalization

Read-only source: `/Users/nam9295/Desktop/john_2.0/code/au-cake-frontend-polish/design/au-site-redesign.pen`.
All 18 Desktop/Mobile frames were inspected through Pencil and exported to `/tmp/au-product-detail-pencil-source-20261007/`.
Implementation: `http://127.0.0.1:5184`, AU local demo store, no real API/order submission.
Viewports: 1440 × 1000, 834 × 1000, 390 × 1000 CSS pixels, Chromium, device scale 1. Source widths are 1440/390 physical pixels at export scale 1. Full-page heights vary with existing production copy/options.

The local demo banner and current production header/footer differ from the old Pencil chrome. Old Mobile photos, sample prices, unsupported claims and duplicate product placeholders are not visual acceptance targets: approved Desktop photos and current catalogue override those explicitly.

## Comparison evidence

Full-view side-by-side evidence (Pencil Desktop / Web Desktop / Pencil Mobile / Web Mobile):
- `/tmp/au-product-details-20261007/comparisons/group-1.png`: Pavé, Signature, Cupcakes.
- `/tmp/au-product-details-20261007/comparisons/group-2.png`: Lemon, Bento, Strawberry Vanilla.
- `/tmp/au-product-details-20261007/comparisons/group-3.png`: Brownie, Almond, S’more.

Every product also has full-page and first-viewport captures at 1440, 834 and 390 in the same screenshot root.

Focused source/web comparisons:
- `comparisons/signature-hero-comparison.png`: photographs, typography, current finish/extra controls.
- `comparisons/cupcake-inside-comparison.png`: actual rotated photo/crop.
- `comparisons/smore-packaging-comparison.png`: correct foreground packaging image.
- `comparisons/almond-mobile-purchase-comparison.png`: Desktop-updated photo, real three SKU buttons, quantity and mobile CTA.

Focused source sections and rendered sections are shown together at equal widths: Desktop 1440 scaled to 720 per side; Mobile 390 remains 390 per side. Signature uses the fully loaded full-page crop to avoid the lazy-thumbnail timing artifact seen in the first isolated-element capture.

## Findings and iteration history

- Fixed P1 image fidelity: initial Cupcake Inside omitted the Pencil affine rotation/crop. The generated raster now preserves it; source/web focused comparison and image-aspect regression pass.
- Fixed P1 asset validity during optimization: an intermediate SVG/WebP embedding produced blank rasters. Replaced embedded intermediates with supported PNG/JPEG. Every generated photograph passes decode/dimension/content-entropy checks; no blank output is retained.
- Fixed P1 image identity: S’more's packaging frame contains a visible S’more image over an old Lemon background. Mapping now uses the visible foreground `smore.png`; hidden background and duplicate support image are excluded.
- Fixed P2 composition: Almond edition photos use square containers instead of the generic wide crop.
- Fixed P2 mobile interaction: new purchasable pages lacked the master mobile order bar. Added a shared bar connected to existing totals/callbacks; all eight purchasable routes pass actual mobile cart handoff, including after-add controls without overflow. Bento stays non-purchasable.
- Fixed P2 related grouping: replaced generic recommendations with actual Desktop product order and catalogue-derived cards. Brownie's stale self-recommendation uses Pavé instead.
- Final full and focused comparisons were re-inspected after these changes. No remaining P0/P1/P2 issue identified within the approved current-commerce/updated-photo constraints.

## Required fidelity surfaces

- **Fonts/type:** actual browser computed font families are Work Sans for headings and SUIT Variable for descriptive text. Heading hierarchy, small control text, wrapping and option prices are readable at all three widths. Current production option labels are preserved.
- **Layout/spacing:** desktop split hero, inside/craft grids, alternating finish editions, packaging split and related grid share the Pavé visual system. Tablet stacks purchase areas. Mobile stacks content and retains supporting/related grids plus an accessible fixed CTA. No document horizontal overflow in 27 route/viewport cases.
- **Colors/tokens:** existing AU green, white, warm neutral backgrounds, restrained pink accents, thin dividers and selected borders. No new shadows/gradients or motion dependency.
- **Images:** correct product source/crop, responsive WebP, alpha preserved, explicit dimensions, hero priority and supporting lazy loading. All rendered images loaded without broken resources. Desktop/Mobile narrative image lists match.
- **Copy:** verified catalogue/editorial facts take priority over old sample claims. No new origin, couverture brand, free accessories, insulated shipping or allergen guarantee. Packaging references are identified; unavailable Bento remains clear. New video slots show photographs without developer labels.

## Interactions and regression evidence

- `tests/au-product-details.browser.mjs`: 27 cases (9 × 3 widths), zero overflow/broken images/page errors; related links, default prices, quantity/cart handoff, mobile CTA callback, reduced motion.
- `tests/au-detail-options.browser.mjs`: Desktop/390 real option interactions: Signature A$45/52/55; Cupcake 6/12 packs and three finishes, A$100+ free packaging; Lemon four packs and chocolate-finish count; Strawberry sizes; Brownie unified Basic A$85 / Vanilla Cream A$105 / Pavé Chocolate A$95 finish selector; S’more 5/6/12 quantities, discounts and cart SKU.
- `tests/au-chocolate-commerce.browser.mjs`: Desktop/390 Almond variants, exclusive selection, conditional six-pack note, 1–5 bounds, separate Single ×5 and 6-pack ×1 lines, Black Tub, standalone Pavé/Eiffel. Five-line subtotal A$199.
- Existing Pavé browser suite: three sizes, extra row-once charge, quantity bounds, gallery/swipe, related links, eight-second muted loop, viewport pause, reduced motion, cart.
- Market-boundary/image targeted suite: 17 passed, including KR byte-for-byte rendered-output comparison.
- Full `npm test`: 1,664 passed, zero failures/cancellations on the completed run. Missing existing Review API dependency was installed from its unchanged lockfile only under `/tmp/au-detail-review-deps.F9rsfT` and resolved by a temporary Node import hook for tests. No repository package/lock/backend change.
- Lint passed. AU and KR builds passed; existing bundle-size warnings remain. AU generated 35 static pages, KR 30. AU build was run last to restore the normal AU sitemap output.
- `git diff --check` passed. Fresh read-only code review found no important functional/KR-isolation defect.

## Expected differences / follow-up polish

- Real purchase controls and verified copy produce different hero/practical-section heights from sample Pencil values. They keep current options, validation and order meaning.
- New galleries use approved photographs of the same product from the Desktop story rather than stale cross-product thumbnail placeholders. Their exact thumbnail density can be polished after John's review.
- Desktop photo content replaces outdated Mobile assets, including Strawberry/Brownie/Almond. Bento only has the available approved hero and related products.
- New videos await John's files; poster sections are complete and do not advertise missing media. Pavé retains its supplied film.
- Browser QA used Chromium, not physical Safari/iOS. No real production request, payment or delivery was exercised.
- Minor title wrapping, caption lengths and vertical spacing remain suitable for John's final visual review. No deployment has been performed.

## Implementation checklist

- [x] Nine AU detail routes, shared presentation plus existing commerce.
- [x] Read-only source mapping and optimized production copies.
- [x] Desktop/Tablet/Mobile screenshots and source comparisons.
- [x] Purchase, cart, availability, reduced-motion and AU/KR regression.
- [x] Test/build/lint/diff validation.
- [ ] John visual approval and final video handoff.
- [ ] Deployment (explicitly outside this task).
