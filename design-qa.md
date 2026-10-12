# HOME v0.2 design QA

final result: passed (local implementation; production deployment not performed)

Source: read-only `design/au-cake/au-site-redesign.pen`, frames t49AI/S2a0Z/uriw3/xFx4R.
Source captures: `/tmp/au-home-v02.ozxCWo/pencil/`.
Implementation: local AU site, `/tmp/au-home-v02.ozxCWo/home-{1440,1024,834,390,360}.png`.

## Comparison state and evidence

- Desktop: source 1440×5800, browser CSS viewport 1440×1000, capture 1440×5861, DPR 1.
- Mobile: source 390×5462, browser CSS viewport 390×1000, capture 390×5975, DPR 1.
- Additional actual captures: 1024×5792, 834×5838, 360×6109; all use a 1000px viewport height.
- Poster/reduced-motion state, English, Whole Cakes selected, both carousels at the start.
- Combined full views: `compare-desktop-full.png`, `compare-mobile-full.png`.
- Combined focused views: `compare-desktop-hero.png`, `compare-mobile-hero.png`,
  `compare-mobile-navigation.png`. Source left, browser right, matching pixel scale.
- Local demo notice is existing environment feedback, not design content; its height
  explains the initial vertical offset. Existing live Hero poster differs from the
  Pencil still on mobile, intentionally preserving the approved real media assets.

## Findings / iteration history

- P2: inherited high-specificity link color overrides the green Bag control's white
  text. Reproduced in computed style (`rgb(53,47,49)`) and focused menu capture.
  Fixed with AU-header-only Bag/wordmark specificity. Fresh captures and computed white
  text (`rgb(255,255,255)`) assertions pass at all five widths.
- P2: old Home `overflow-x:hidden` creates a scroll ancestor and breaks sticky header.
  Fixed using `overflow-x:clip` only for the v0.2 Home shell. Browser sticky-header and
  cross-page heading-visibility checks now pass at all requested widths.
- P2: rapid BEST arrow keys used stale state. Fixed by deriving navigation from current
  track scroll position. Browser reaches the third card without a blank tail.
- P2: independent review found the new Home heading/reset selectors affecting existing
  Customer Stories spacing and heading weight. Reproduced by a failing browser assertion;
  excluded the existing Stories section from those selectors. Fresh checks confirm its
  600 heading weight and 16px heading/eyebrow margins at all five widths.
- No remaining critical or important findings in the independent source review.

## Required fidelity surfaces

- Typography: Work Sans headings, SUIT body; hierarchy and thin editorial labels match.
  Real catalogue names/option descriptions wrap more than sample copy; no truncation.
- Spacing/layout: 48px desktop and 16px mobile gutters; 520/220px Hero; 500/240px craft;
  desktop sidebar/four-column collection, mobile horizontal tabs/two-column products.
- Color: forest green/pink/neutral palette, thin borders, no added gradients/shadows.
- Imagery: actual matching photographs and responsive consulting WebP; no fabricated images.
- Copy/content: neutral approved service claims; live catalogue prices/options override stale
  Pencil examples. Customer Stories intentionally retains deployed layout/data/font improvements.
- Responsive: no document overflow at 1440/1024/834/390/360. Mobile BEST one+peek is
  the explicit approved override; Business stacks and Our Story image precedes copy.

## Open questions / follow-up

Full and focused source/browser composites were inspected, including mobile navigation,
desktop full layout, mobile full layout, and 834/360 screenshots. No clipped controls,
broken images or document overflow remain. Approved differences are the mobile BEST
carousel, preserved Customer Stories presentation, actual Hero media, live catalogue
copy, and neutral operating claims instead of unconfirmed Pencil example claims.

Existing Hero autoplay/fallback tests and all 11 race/recovery checks pass against the
local production build. The legacy race harness's exact play-call-count assumptions
fail under development StrictMode's extra effect setup; the component is unchanged and
the production-build harness passes without a workaround. Safari/iOS autoplay remains
subject to browser policy; poster/manual fallback is preserved.

Local demo-store notice is expected because this checkout has no private environment
configuration. This is local visual/interaction verification, not production API QA.
No product/operating claims need new approval. John should review the screenshots
before separately authorizing deployment.
