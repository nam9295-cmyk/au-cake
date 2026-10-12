# AU Home v0.2 — local implementation

## Scope and source

- Base: `1979a911e0ed99d91feb6da94b2b692633bd17fe` (`origin/main`).
- Existing single checkout, branch `feat/au-home-v02`; no new worktree.
- Read-only Pencil: `/Users/nam9295/Desktop/john_2.0/design/au-cake/au-site-redesign.pen`.
- Final frames: Desktop `t49AI`, Mobile `S2a0Z`, navigation Desktop `uriw3`, Mobile `xFx4R`.
- The explicit approved mobile BEST one-card-plus-peek carousel supersedes the vertical Pencil list.
- No Git push, main integration, Cloudflare deployment, server change or production data submission.

## Structure

`HomePage` selects the AU v0.2 presentation; KR still renders the unchanged `LegacyHomePage`.
`AuNavigation` is shared by AU Home, `AuRedesignHeader`, and public AU `SiteHeader`.
Admin login and KR keep legacy chrome. The native mobile dialog supports focus wrapping,
Escape, close button, backdrop dismissal, link dismissal and focus restoration.

`au-home.ts` contains only Home display membership, adapting existing cake/chocolate
catalogue helpers. No new price source, ProductId or order model is introduced.

| Home group | Existing catalogue IDs, in order |
| --- | --- |
| Whole Cakes (default) | pave; signature-gateau; fresh-strawberry-vanilla-cream; brownie-cheesecake |
| Sharing / Celebration | cupcake; fresh-lemon-cupcakes; bento-cake |
| Chocolates | almond-chocoball; pave-chocolate; eiffel-tower-chocolate; smore-stick |

Bento remains Coming Soon and has no order/detail link on Home. S’more retains
`/cakes/smore-stick`. BEST links to Signature, Pavé and Brownie, in that order.
Current catalogue names/prices/options take precedence over old Pencil sample values.

Sections: Hero video and copy → BEST → existing Customer Stories → craft photo →
selected collection → Custom Cake entry → three Business entries → Our Story → footer.
Primary navigation points to `/#story`, `/#au-collection`, `/cakes/custom-cake`, `/#business`.
Home headings use Work Sans; body/captions use SUIT Variable.

## Asset mapping

| Section | Existing source / production asset |
| --- | --- |
| Hero | Unchanged AuHeroVideo desktop/mobile MP4 and first-frame posters |
| BEST and collection | Existing cake/chocolate catalogue image paths |
| Customer Stories | Existing featured JSON and customer photographs, unchanged |
| Craft | `/redesign/3906.jpg`, as selected in Pencil |
| Custom Cake entry | `/products/custom-cake.webp` |
| Events | `au-service-assets.json` → `events-hero` |
| Café | `au-service-assets.json` → `sharing` (Pavé eight-piece photograph) |
| Consulting | Pencil asset `au-site-redesign-assets/packaging-gift-box.jpg` → `/home/consulting-gift-box-{480,960}.webp` |
| Our Story | `au-service-assets.json` → `worktable` |

Only the consulting photograph needed new production copies. Original 1536×1024 JPEG:
454,924 bytes; optimized 480×320 WebP: 18,396 bytes; 960×640 WebP: 65,240 bytes,
quality 83. Responsive srcset/sizes; lazy decoding. Original is unchanged.
Original SHA-256: `0bdd1bb3e034e7b9b19a04367f7e194182f0f5691d159564c28e0582c3597185`.

## Protected behaviour

- AuHeroVideo source and its autoplay/recovery/manual controls remain unchanged.
- Customer Stories source, CSS, 293-review archive and 255 photographs remain unchanged.
- Custom Cake source, dedicated CSS, upload/quote logic and contracts remain unchanged.
  Browser comparison excludes only the explicitly approved shared header; content DOM
  and element dimensions/fonts/colors match the before-change capture at 1440 and 390.
- Product Detail, pricing, cart calculation, reservation APIs and Appwrite Functions unchanged.
- Class campaign policy unchanged: existing Sydney-time cutoff is 2026-10-12;
  after that cutoff new booking dates remain unavailable. Only navigation/footer copy
  states Temporarily Paused, with next-school-holiday dates not yet confirmed.
- AU Home visible copy and static/runtime SEO use `au-home-v02.json`. KR metadata and
  static fallback match the pre-change build after excluding changed bundle tags/whitespace;
  KR SSR Home remains exactly equal in the existing market-boundary test.

## Verification record

New Home regressions were run RED before implementation, then GREEN. Old tests that
asserted the previous Home's hidden legacy quick-view markup now test preserved
`LegacyHomePage`; new AU SSR/browser tests assert the replacement's actual behaviour.
The direct-load Chocolate regression now checks the Home Chocolate-tab catalogue
mapping rather than falsely expecting all products in the default Whole Cakes panel.

Browser evidence and command logs: `/tmp/au-home-v02.ozxCWo/`.
1440/1024/834/390/360 checks include 4/3/4 category membership, images decoded,
two-column mobile products, BEST keyboard/swipe/end alignment, unchanged two-card
Stories swipe/font size, dialog focus/ESC/backdrop, language and cross-page anchors.
Custom content DOM/metrics comparison passed; JavaScript page errors: zero.

Final verification on 2026-10-13:

- Full `npm test`: 1,671 passed, 0 failed, 1 expected market-specific skip (1,672 total).
- `npm run lint`: passed.
- AU and KR production builds: passed. Existing large-chunk and mixed static/dynamic
  Appwrite import warnings remain; no dependency or lockfile change.
- KR Home SSR exactly matches the pre-redesign baseline; KR static Home HTML matches
  the baseline after excluding bundle tags/whitespace. KR direct-access regression passed.
- Local static HTTP server, without SPA fallback: all 14 representative Home, product,
  Custom Cake, cart/reserve, review, class, portfolio and service/archive routes return
  HTML 200; entry/runtime CSS/JS return their proper types. Bento remains 404.
- All five browser widths: images decoded, no horizontal overflow, no page errors,
  catalogue 4/3/4, mobile two-column products, carousel/menu/language/anchor checks passed.
- Custom Cake before/after body DOM and style/dimension snapshots are identical at
  1440 and 390, excluding the intentionally shared navigation replacement.
- Existing Hero production-build autoplay and 11 race/recovery cases passed, including
  blocked fallback, manual pause, visibility, single retry and stale promise protection.
- Browser-only commerce: Home BEST → Pavé → 8in × 2 → A$218 → cart → reservation entry.
  Persisted fields remain `productId=pave-cake`, `cakeSize=8in`, `quantity=2`,
  `chocolateExtra=none`. Removed the test cart; no submission performed.
- Independent review's Customer Stories CSS leakage was reproduced and fixed. Fresh
  browser assertions cover original heading weight/spacing and header Bag contrast.

Final screenshots: `home-1440.png`, `home-1024.png`, `home-834.png`, `home-390.png`,
`home-360.png`, `menu-390.png`, `best-swiped-390.png` in the evidence directory above.
`design-qa.md` records the visual comparison and intentional deviations.

The local checkout has no private `.env.local`, so it intentionally shows the existing
demo-store notice. No credentials were added or server configuration copied. UI,
browser-local cart and automated contracts can be tested; this is not an end-to-end
production Appwrite delivery verification. No real order/quote/payment/coupon is sent.

Production deployment remains a separate, explicitly approved task. Before deployment,
review the local screenshots and run the existing custom-domain asset/version checks;
`au-stage` is not an independent safe preview environment.
