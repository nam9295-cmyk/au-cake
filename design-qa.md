# Design QA · Option photo previews

## Evidence

- Source visual truth: Penpot file `dfb31d12-cc0a-8037-8008-8f880a08662a`, page `dfb31d12-cc0a-8037-8008-8f880a08662b`, board `18cd9072-a005-80d5-8008-8f890e607959` at `https://very-server.tailb0ea56.ts.net:8443/#/workspace?team-id=fed5d05c-d2ab-8130-8008-424548f7172e&file-id=dfb31d12-cc0a-8037-8008-8f880a08662a&page-id=dfb31d12-cc0a-8037-8008-8f880a08662b`
- Source screenshot: `/tmp/au-cake-option-preview-qa/source-penpot.png`
- Desktop implementation screenshot: `/tmp/au-cake-option-preview-qa/implementation-desktop.png`
- Mobile implementation screenshot: `/tmp/au-cake-option-preview-qa/implementation-mobile-390.png`
- Normalized focused comparison: `/tmp/au-cake-option-preview-qa/comparison-focused-final.png`
- Route: `http://127.0.0.1:4173/cakes/signature-gateau-au-chocolat`
- State: Vanilla cream finish and Eiffel Tower Chocolates selected. Basic and Extra chocolate finishes plus None, Pavé, and Chocolate Extra Set were also exercised.

## Viewport and normalization

- Source capture: 1440 × 693 px, Penpot canvas shown at 46%, browser density 1.
- Desktop implementation: 1440 × 749 px CSS viewport, browser density 1.
- Mobile implementation: 390 × 1000 px iframe CSS viewport at density 1; evidence cropped to the visible 390 × 693 px content region.
- Focused comparison places the source board, desktop purchase-panel region, and mobile content region in one browser-rendered image. Browser chrome and surrounding grey iframe stage were excluded from the focused crops.

## Fidelity review

- Fonts and typography: Existing Work Sans family, weights, uppercase labels, line heights, and hierarchy remain consistent with both the source guidance and the AU Cake UI.
- Spacing and layout rhythm: The desktop preview uses a 112 × 88 px image in the purchase fieldset; mobile uses 88 × 69 px. The selected-extra preview now has a 10 px separation from the final option button.
- Colors and tokens: Existing forest, canvas, border, muted-text, and cream-teal tokens are reused. No new gradient, radius, or shadow language was introduced.
- Image quality and fidelity: Only existing real product photography is used. Finish images are temporary swap targets while the final 112 × 88 assets are being prepared. Eiffel uses the existing correct product photograph. None, Pavé, and Combo remain text-only until accurate photographs are supplied.
- Copy and content: Selected labels and existing product descriptions are reused without changing pricing or option names. The main gallery remains unchanged.
- Responsiveness and accessibility: Fixed dimensions prevent layout shift; the image transition is 160 ms and disabled for reduced motion. Existing `aria-pressed` controls remain intact and preview images have language-aware alt text.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3 / expected follow-up: Replace the temporary finish images and add accurate Pavé and Combo photographs when the final 112 × 88 assets are delivered.

## Comparison history

1. Initial desktop comparison found a P2 spacing issue: the selected Chocolate Extra preview touched the final option button and read as part of that control.
2. Added `.cake-detail-options + .cake-detail-option-preview { margin-top: 10px; }` and a regression assertion.
3. Re-captured desktop and 390 px mobile states. The preview blocks now match the source separation and no P0/P1/P2 differences remain.

## Runtime checks

- Primary interactions tested: Basic finish, Extra chocolate finish, Vanilla cream finish, None, Eiffel Tower Chocolates, Pavé Chocolate, and Chocolate Extra Set.
- Extra chocolate correctly reveals `Choose chocolate`; Basic hides it.
- Missing-photo extras correctly retain text-only help instead of showing a misleading placeholder.
- Browser console checked: no application errors. Only unrelated Chrome-extension warnings were present.

## Implementation checklist

- [x] Keep the product gallery unchanged.
- [x] Add one selection-aware finish preview.
- [x] Add one selection-aware Chocolate Extra preview when an accurate image exists.
- [x] Preserve text-only fallback for missing images.
- [x] Verify desktop and 390 px mobile layouts.
- [ ] Swap in the final option-photo files when supplied.

final result: passed
