# AU Phase 1 design QA — 2026-09-22

## Visual truth and scope

Source: `/Users/nam9295/Desktop/john_2.0/code/au-cake-redesign-ui/design/au-site-redesign.pen`.
Pencil was read/exported only, never edited or saved. Source exports and browser
captures are in `/tmp/au-phase1-evidence.7l2v4J/` (temporary local evidence).

The approved scope preserves the existing Home checkpoint and real catalogue/
order behaviour. Pencil supplies Category/Detail visual structure, not authority
to invent prices, products, options or API capabilities. This is not a claim of
pixel-identical content or deployment approval.

| Surface | Source export (pixels) | Implementation capture (pixels) |
|---|---|---|
| Home | `reference/OUT4W.png` — 1440×5464 | `au-home-desktop-final.png` — 1440×5094 |
| Cakes | `reference/tdTeb.png` — 1440×1545 | `au-cakes-desktop-final.png` — 1440×1543 |
| Chocolates | `reference/PaIjR.png` — 1440×1259 | `au-chocolates-desktop-final.png` — 1440×1313 |
| Cake | `reference/w5Rrb.png` — 1440×2102 | `au-cake-desktop-final.png` — 1440×4122 |
| Cupcake | `reference/zc4Cp.png` — 1440×1412 | `au-cupcake-desktop-final.png` — 1440×3468 |
| Chocolate | `reference/XipLI.png` — 1440×1244 | `au-chocolate-desktop-final.png` — 1440×1677 |
| Custom | `reference/yfHvZ.png` — 1440×1566 | `au-custom-desktop-final.png` — 1440×4694 |
| Mobile Cakes | `reference/EWUnk.png` — 390×1359 | `au-cakes-mobile-final.png` — 390×1760 |
| Mobile Cake | `reference/UYySr.png` — 390×1360 | `au-cake-mobile-final.png` — 390×4950 |
| Mobile Cupcake | `reference/F7gL9a.png` — 390×1072 | `au-cupcake-mobile-final.png` — 390×4727 |

Viewport: desktop 1440×1000 CSS px; mobile 390×844. deviceScaleFactor 1 and
Pencil export scale 1. Equal-width content was compared, not scaled page heights.
No browser chrome. The local-demo notice adds 32px desktop/48px mobile and is
an environment difference. The pre-existing contact launcher remains.

## Comparison evidence and state

Full source/implementation pairs were opened together in the same comparison
input. Focused `au-{cake,cupcake}-{desktop,mobile}-{top,options}-final.png`
captures were checked against detail frames for readable type and controls.
Lazy images were scrolled into view and decoded before capture. Final galleries
reset horizontal thumbnail scroll, then return to the first photo/page top.

Default Cake: 6-inch, no extras, quantity 1. Default Cupcake: 12, Basic, no
individual packaging, quantity 1. Default-state cart is empty. All tested
visible images loaded successfully.

## Findings and comparison history

1. P2: inherited `main` width added a Category inset, with narrow rail and
   over-tall cards. Set AU Category width 100%, rail 232px/48px gap, compact
   card header/image rhythm and 480px feature photo. Re-captured and compared
   `au-cakes-desktop-final.png` with `tdTeb.png`.
2. P2: inherited definition styles right-aligned/bolded long ingredient text.
   Scoped left alignment/regular weight to AU specifications. Final Cake and
   Cupcake captures show readable left-aligned information.
3. P2: three Chocolate products used four tracks, leaving an empty column.
   Browser measured four 254px tracks. Set the AU chocolate category to three
   columns; re-measured three 344px tracks and re-compared the final capture
   with `PaIjR.png`. Mobile remains two 170px tracks with no page overflow.
4. Home release polish: removed `COPY TBD`, reused the existing public H1,
   made Best product links keyboard-operable, and added the collection hash
   target. No Pencil composition edit was made.

No actionable P0/P1/P2 issue remains within the constrained Phase 1 scope.

## Required fidelity surfaces

- Fonts/typography: existing font families/fallbacks retained; editorial
  hierarchy, weights and small control text checked in focused captures.
  Real catalogue names wrap differently from mock labels. No new font dependency.
- Spacing/layout: thin dividers, desktop rail, four-column Cakes/three-column
  Chocolates, horizontal mobile category navigation/two columns. Details are
  photo-first on mobile, with horizontal thumbnails and a desktop sticky
  configurator. Actual options, reviews and Custom form make pages longer.
- Colors/tokens: white, `#1F5A46`, `#352F31` and approved pink/berry variables
  are AU-scoped. New components introduce no shadow, gradient or glass.
  Pre-existing contact launcher and legacy routes retain their styles.
- Images: existing product photos and approved Pencil placeholders retained.
  No generated replacement marks, remote stock dependency or absolute local
  image URL. Chocolate reference photography is labelled and deferred for replacement.
- Copy/content: real catalogue/pricing override illustrative labels. Cakes has
  seven orderable products. Only Almond's confirmed 80g/AUD 12 is shown for
  chocolates; no fabricated purchase, 5+1, black-tub or Pavé/Eiffel price.
  Custom promises original interpretation, not copying; no new upload API,
  response-time or availability promise was added.

## Intentional differences and follow-up

- Home retains the approved `398093e` unified catalogue/filter composition and
  original tiger/background styling, rather than replacing it with Pencil's
  illustrative separate collections. Existing Home Coming Soon entries remain;
  the new orderable Category excludes unavailable entries.
- Existing sizes, pack counts, finish/packaging controls, notices, reviews and
  complete Custom form take more space than the abbreviated mock. The optional
  sticky-bottom CTA was not added; mobile purchase CTA is 52px high.
- Chocolate entries are preview-only and noindex. The isolated demo cannot
  submit Custom requests; live submission was intentionally not tested/changed.
- P3: replace approved placeholder photography in the later asset phase.
- Nonblocking test follow-up: full-App KR SSR coverage; current automated
  baseline tests cover pages and browser checks cover the full shell.

## Browser and interaction results

AU desktop: Home, Cakes, all seven real product routes, Custom, Chocolates and
all three unavailable chocolate details. 390px: Cakes, Cake and Cupcake.
No horizontal page overflow or broken visible images in these captures.
Mobile MENU opens; Escape closes it and returns focus to MENU.

- Cupcake: 6-pack Vanilla Fresh Cream AUD 35, packaging 6×AUD 0.50, quantity 2
  = AUD 76. Cart/reservation retain pack, finish, quantity and 12-piece/AUD 6
  packaging. Evidence: `au-cart-cupcake-mobile.png`,
  `au-reservation-cupcake-mobile.png`. No reservation was submitted.
- Cake: 8-inch AUD 109 ×2 plus existing per-order Pavé extra AUD 12 = AUD 230.
  Options/total survive cart navigation (`au-cart-cake-desktop.png`).
- Only this isolated browser's test cart lines were removed afterwards.
- KR Home/Cakes: zero AU shells/templates/matching AU CSS rules; original
  footer and announcement visible. KR's actual category link opens legacy
  `/cakes/custom-cake`, also with no AU shell/template and visible footer/
  announcement. Evidence: `kr-{home,cakes,custom}-desktop-final.png`.
- AU-only `/cakes/pave-chocolate-cake` remains not-found in KR; that capture
  is not counted as successful KR detail coverage.
- Console/page-error monitoring during all seven AU details and remaining
  chocolate previews reported zero errors; final console error query was empty.
- Local AU/KR servers used blank external backend settings and blocked external
  requests except fonts. No external order/form submission was performed.

final result: passed
