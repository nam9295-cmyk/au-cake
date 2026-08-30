# Design QA · Signature Gâteau desktop three-column layout

## Evidence

- Source visual truth: Penpot board `AU Cake · Desktop 3-column layout · 2026-08-30` (`b8f47740-b341-802f-8008-8f92673d4a95`) in file `dfb31d12-cc0a-8037-8008-8f880a08662a`.
- Source screenshot: `/tmp/au-cake-signature-three-column-qa/au-cake-penpot-three-column.png`.
- Desktop implementation screenshot: `/tmp/au-cake-signature-three-column-qa/au-cake-signature-intro-left-final.png`.
- Selected-state screenshot: `/tmp/au-cake-signature-three-column-qa/au-cake-signature-intro-left-selected-final.png`.
- Mobile screenshot: `/tmp/au-cake-signature-three-column-qa/au-cake-signature-intro-left-mobile-final.png`.
- Source/implementation comparison: `/tmp/au-cake-signature-three-column-qa/au-cake-intro-left-comparison.png`.
- Supplied option-photo comparison: `/tmp/au-cake-signature-three-column-qa/au-cake-option-assets-comparison.png`.
- Option-photo desktop states: `/tmp/au-cake-signature-three-column-qa/au-cake-option-assets-basic.png` and `/tmp/au-cake-signature-three-column-qa/au-cake-option-assets-combo.png`.
- Option-photo mobile state: `/tmp/au-cake-signature-three-column-qa/au-cake-option-assets-mobile.png`.
- Route: `http://127.0.0.1:4173/cakes/signature-gateau-au-chocolat` through the existing SSH tunnel.

## Viewport and normalization

- Penpot export: 1660 × 1250 px at density 1.
- Desktop implementation: 1440 × 1000 CSS px at device pixel ratio 2; screenshot normalized to 1440 × 1000 px by the browser capture API.
- Mobile implementation: 390 × 844 CSS px at device pixel ratio 2; screenshot normalized to 390 × 844 px by the browser capture API.
- The comparison scales the Penpot board and implementation to the same 1000 px height and aligns their top edges. Existing site chrome is present only in the implementation and is treated as a protected product constraint.

## State and interactions

- Initial state: Basic finish, no Chocolate Extra, quantity 1.
- Selected state: Vanilla cream and Eiffel Tower Chocolates · 6 pieces.
- Re-tested Vanilla cream and Eiffel selection after moving the product introduction; both preview images, selected buttons, price, and checkout summary updated together.
- Desktop layout metrics at 1440 px: hero tracks `518.492px 425.164px 321.461px`; vertical gallery rail `72px`; option preview `112 × 88px`; sticky checkout `top: 72px`; document width `1440px` with no horizontal overflow.
- Mobile layout metrics at 390 px: desktop intro `display: none`; standard intro `display: block`; no horizontal overflow.
- Supplied-photo pass: Basic, extra chocolate, vanilla cream, Eiffel 6, Pavé 100g, and Chocolate Extra Set each resolved to its dedicated WebP. Desktop previews measured `112 × 88px`; mobile previews measured `88 × 69px`.
- Shared-extra pass: the Pave detail reused the Chocolate Extra Set image. Fresh Strawberry Vanilla retained no Chocolate Extras heading or option buttons, matching the product eligibility contract.
- The local page displayed no application error surface during the tested flow. Direct console collection is not exposed by the connected browser API.

## Fidelity review

- Fonts and typography: Existing Work Sans regular/bold is preserved. The title remains a two-line hierarchy at 1440 px.
- Spacing and layout rhythm: Gallery, configurator, and checkout form three clear columns above 1200 px. The approved follow-up moves the eyebrow, title, description, and badges above the left gallery, so the centre column begins directly with `Choose a finish` and the previous empty space under the right-side introduction is removed. Vertical thumbnails remove the empty horizontal strip, and the checkout remains visible while the option column scrolls.
- Colors and visual tokens: Existing forest, cream, mint, border, and muted tokens are reused; no new gradient, radius system, or shadow language was introduced.
- Image quality and fidelity: The six supplied transparent WebPs are used without editing. Their subjects remain fully visible on the existing cream preview surface. The gallery content is unchanged, and the desktop finish/extra preview stays 112 × 88 px.
- Copy and content: Existing product, option, price, and ordering copy is retained. The desktop checkout summary exposes the selected finish and Chocolate Extra without duplicating the product title.
- Responsive behavior: The three-column selectors are scoped to `detail.id === 'signature-gateau'` and `@media (min-width: 1200px)`. Existing 980 px tablet and 760 px mobile rules remain intact. At 390 px, the desktop duplicate is hidden, the original introduction remains in the configurator flow, and the page has no horizontal overflow.
- Accessibility: Existing fieldsets, legends, `aria-pressed`, live regions, alt text, quantity labels, and add-to-order status remain present in the browser accessibility snapshot.

## Findings

- No actionable desktop or mobile P0, P1, or P2 findings remain in the combined comparison and responsive captures.
- No option-photo follow-up finding remains: the temporary finish crops and single Eiffel placeholder have been replaced by the six supplied assets.

## Comparison history

1. The first full comparison found a P2 title-wrap mismatch: the implementation used three lines while the Penpot source used two.
2. The first focused comparison found a P2 CTA-shape mismatch and redundant product title in the sticky checkout summary.
3. Reduced the Signature desktop title to `clamp(36px, 2.8vw, 40px)`, removed the redundant desktop product title, and scoped the CTA to a square corner.
4. Re-captured both initial and Vanilla/Eiffel states. The revised desktop comparison has no actionable P0/P1/P2 findings.
5. Following review, moved the complete product introduction above the left gallery for Signature desktop only. The centre now starts with finish selection, while tablet/mobile retain the original reading order.
6. Captured the updated 1440 px initial/selected states and a true 390 px mobile state. The responsive pass has no horizontal overflow or duplicate visible introduction.
7. Replaced every Gâteau finish and paid Chocolate Extra preview with supplied transparent WebPs, then compared the six originals beside the 1440 px selected state.
8. Confirmed all six mappings, Pave reuse, Strawberry exclusion, checkout pricing, 112 × 88 desktop previews, 88 × 69 mobile previews, and zero horizontal overflow.

## Automated verification

- `npm run test:cake`: 275 AU tests and 3 KR boundary tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite emitted the pre-existing large-chunk advisory only.
- `git diff --check`: passed before the final report update.

## Implementation checklist

- [x] Scope the layout to Signature Gâteau and desktop ≥ 1200 px.
- [x] Keep the gallery content unchanged and use vertical thumbnails.
- [x] Keep the 112 × 88 finish preview.
- [x] Render Chocolate Extras in a 2 × 2 desktop grid.
- [x] Keep quantity, selected options, CTA, and notice in a sticky checkout.
- [x] Preserve tablet/mobile rules and other cake detail layouts.
- [x] Verify desktop interactions and compare source/implementation together.
- [x] Capture the current implementation at a true 390 px browser viewport.

final result: passed
