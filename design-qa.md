# Services and Customer Stories design QA

Source: read-only `/Users/nam9295/Desktop/john_2.0/code/au-cake-frontend-polish/design/au-site-redesign.pen`. Exported references: `/tmp/au-services-pencil-reference/`. Implementation: `http://127.0.0.1:5184`, screenshots `/tmp/au-services-qa/`.

## Evidence and normalization

| Target | Desktop reference pixels | Mobile reference pixels | Comparison basename |
| --- | --- | --- | --- |
| Events | B5nkf 1440×5699 | oc8pJ 390×6085 | events |
| Café | WBMIw 1440×4154 | w76iZ 390×3703 | cafe-supply |
| Consulting | dpaRC 1440×3495 | LxFe9 390×3334 | consulting |
| Home stories | P9pFE 1440×970 | TS3Iv 390×692 | home-stories |
| Archive | VXzjm 1440×3909 | TKsm9 390×4080 | archive |

Browser CSS widths: 1440, 834, 390, 360; viewport height 1000, device scale 1. Full screenshots use the actual rendered page height rather than stretching to the mock height. Side-by-side `compare-{basename}-{1440,390}.png` places source left, implementation right: both desktop columns uniformly reduced to 480px; mobile columns retain 390px. Focused browser hero captures are `{basename}-{width}-hero.png`; home section and review modal have dedicated captures. Native brand header/footer and contact launcher are retained from production rather than replaced with the Pencil's sample chrome.

State: light theme, consent dismissed, reduced motion; services default state, archive actual newest-first 12 records. Mobile Pencil photos are obsolete by user instruction; final Desktop photo selection/order is intentionally used at every width. The archive mock's curated order, nine desktop/six mobile examples and inline expanded review are not the runtime default: the requested real latest-first dataset, twelve initial records and accessible modal take precedence.

## Comparison history and fixes

- P1: inherited global `main` width/padding narrowed the new pages. Scoped new-page wrappers now occupy full width. Existing pages were not changed.
- P2: body font referenced `SUIT`, not the repository's `SUIT Variable`. Corrected new styles; headings remain Work Sans.
- P2: mobile home excerpts and photos made the cards too tall. Added exact-substring mobile excerpts and reduced photo height from 190 to 140px. Full text remains available in the dialog.
- P2: Events portrait crop cut off the face. Adjusted the editorial photo's object position to 12%, preserving original bytes and showing the cake and face.
- P2: mobile service headline scale and action widths diverged. Set headline 28px, section heading 24px and full-width stacked actions.
- P2: process cards were open white rows rather than the mock's compact tinted cards. Restored tinted bordered cards and compact mobile padding/number spacing.
- P1 interaction: keyboard traversal could leave the native review dialog. Added an explicit Tab/Shift-Tab containment guard, Escape and opener restoration tests.

Re-captured all four browser widths after fixes. Final side-by-side comparisons and focused regions were inspected, not inferred from code alone.

## Required fidelity surfaces

- **Typography:** Work Sans headings, SUIT Variable body; mobile wrapping remains readable at 360/390. Exact original review text is preserved; short home excerpts are never presented as full reviews.
- **Layout:** editorial centered heroes, three-column desktop cards, mobile stacks, events supporting 2-column grid; home two-card scroll-snap window. No horizontal page overflow at any tested width. Longer neutral copy and additional provenance disclosures intentionally alter page height.
- **Colors:** existing green `#1F5A46`, dark text, soft neutral cards, thin dividers and restrained pink/berry accents. No gradients or shadows added.
- **Images:** final Desktop asset subjects and order verified at all widths; responsive WebP copies, no source mutation, no generated customer imagery. Archive photo ownership is checked programmatically. Full photos remain uncropped in the modal; card crops are presentation only.
- **Content:** unsupported operating claims replaced with neutral enquiries/photo descriptions; exceptions and original claims documented in `docs/services-stories/CONTENT_APPROVAL_REQUIRED.md`. No false Australian/verified-order attribution. John approved preserving five customer quotations mentioning Daegu while site labels remain Korea.

## Functional and regression evidence

- Four widths: all service images decode, ordered image lists match, links/enquiry targets work; home carousel, full-review dialog, photo navigation and Escape; archive search, combined filters, empty results and Load More.
- Browser page errors: zero in the service/stories suite.
- Existing `/reviews` renders its page, but its live API request returns 401 in this credential-free local preview. Existing review unit/integration tests pass; production review retrieval is not claimed to have been verified. The console's other repeated messages are development React DevTools notices.
- Production build: Home makes zero archive JSON requests; archive makes exactly one; only six customer-image requests including Home during the initial mobile test, not 255 eager requests.
- Static HTTP server without SPA fallback: four new extensionless routes return 200 in AU, 404 in KR. Existing representative paths retain 200.
- Custom Cake baseline/current: normalized DOM, measured geometry/styles and selected flavour identical at 1440/390. Final screenshot comparison: zero different pixels at both widths. No live request submitted.
- KR baseline/current: Home, Cakes, Pavé detail, Custom Cake text and measured layout/styles identical at 1440/390.
- Full npm test and lint pass; AU/KR builds pass. Existing bundle-size warnings remain. Backend/Custom Cake/Product Detail/package sources unchanged.

## Remaining review before publication

John should approve service copy and the existing Instagram enquiry destination, and inspect the local pages. Full production submission/email/quote operations were deliberately not exercised; local regression tests cover those existing contracts. No deployment was performed.

P3: the mock's abbreviated source labels, pill shapes and sample navigation are not copied exactly where they conflict with real catalogue names, existing AU chrome or truthful disclosures. These are intentional product constraints, not new functionality.

Implementation checklist: all ten target frames implemented; Desktop assets applied to Mobile; original text/photos preserved; AU isolation and protected pages verified; no automatic deployment.

final result: passed

## Approved navigation and Home photo follow-up

John approved replacing the lower Home story photo with `cakes-party-hero.jpg` and unifying AU header navigation, including the shared header on Custom Cake. The uploaded source SHA-256 matches the recorded Events hero source exactly, so existing 640/1280/1920 WebP variants are reused through the asset manifest. No source photograph was edited.

Events & Business now consistently opens `/business/events`; the separate Kids Classes item opens the existing `/classes`. Home Desktop and Mobile use their established SPA navigation; shared AU headers use ordinary anchors. Custom Cake's page source, options and submit behavior remain unchanged; its header navigation is the approved exception to the initial screenshot baseline above.

Focused evidence: `/tmp/au-services-qa/home-story-new-{1440,390}.png` and `nav-{home,cakes,custom}-{1440,1024,834,769,390,360}.png`. A 769px screenshot exposed a clipped Cart that a scroll-width-only check missed. The Home tablet navigation gap and font size were reduced; regression checks now also assert each header item's bounds fit the viewport. This change is scoped to `.au-home-shell` header selectors.

The navigation browser regression is `tests/au-service-navigation.browser.mjs`. Related AU/KR routing, Cake and Custom Cake frontend tests, lint, both market builds and static route tests were run for the follow-up. The preview remains local; no push, merge or deployment.

## Language control follow-up

Restored the omitted AU language control without changing the approved navigation destinations or Home story photograph. Desktop uses an understated `EN / 한국어` group before Cart, with an underline indicating the current language. Tablet/mobile uses a compact other-language switch; mobile remains outside MENU and provides a 44px touch target. Shared App state and existing storage preserve the preference on navigation/reload.

Screenshots inspected: `language-home-{en,ko}-{1440,390,360}.png`, `language-cakes-{en,ko}-{1440,390,360}.png`, and `language-{events,cafe-supply,consulting,korea}-ko-{1440,390,360}.png` in `/tmp/au-services-qa/`. Eight-width header checks (including the 767/768/769px breakpoint edges) show no clipping, overlap or page overflow in either language. Korean service layouts retain the same photos and enquiry constraints. Review originals/translations remain unchanged; Korean originals become the primary displayed text in Korean mode.

Custom Cake content/controls remain baseline-identical, excluding the approved shared header. KR content and measured typography/layout match the main baseline in both languages on four routes at 1440/390. The first KR comparison discrepancy was differing consent-banner browser storage, not a product change; normalized consent state removes it. Existing English service/stories interaction QA also passes. Full test, lint, AU/KR builds, new rendered-language/data tests and static direct-access tests pass. No publication performed.
