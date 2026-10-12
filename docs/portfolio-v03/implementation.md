# AU Portfolio v0.3

Source: John's `Downloads/au-pf-001-v0.3-delivery` review draft, manifest and
rendered mockup. The current implementation request supersedes the draft's old
pending-approval note. Deployment is not authorized.

## Implementation

`/portfolio` has the new hero, sharing, favours, custom-cake entry, combined
café/consulting section and enquiry guide. Copy is in `au-portfolio-v03.json`.
Existing responsive photo assets are reused: hero 1, sharing 3, favours 1,
custom 3 and business 2. No original photos were edited or unused assets deleted.
Real catalogue/Instagram links replace mock interactions. Legacy wholesale and
consulting anchors remain. Shared header/footer/chat, Work Sans headings and SUIT
body remain; all controls have at least 44px touch targets.

No Custom Cake implementation, commerce, backend, pricing or KR code changes.

## Verification

- Regression first failed against the previous hero, then passed.
- Full npm test: 1,671 passed, one expected skip, zero failures. The subsequently
  added metadata/CSS isolation test passes in the final four-test portfolio suite.
- Lint, AU/KR builds and `git diff --check` pass.
- Browser widths 1440/834/390/360: ten images load, no overflow or page errors,
  actionable links unobstructed by chat, working quick and legacy anchors.
- Reduced-motion and normal reveal checked. Cakes, Chocolates and Custom Cake
  entry navigation works; no enquiry/order/upload/payment submitted.
- Desktop/mobile source comparison screenshots inspected. Shared chrome/SUIT and
  accessible controls deliberately differ from the standalone mockup.
- Built static `/portfolio`, `/portfolio/`, `/cakes/custom-cake`: HTTP 200.
  Entry/runtime JS and CSS: HTTP 200 with correct MIME types.
- Existing chunk-size/mixed-import build warnings remain non-blocking.

Evidence: `/tmp/au-portfolio-v03/`. Preview: `http://127.0.0.1:5184/portfolio`.
Local demo-store notice is expected without private environment settings.
No push, merge or deployment performed.
