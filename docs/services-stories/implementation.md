# AU service pages and Customer Stories

Baseline: `a20fe810307e1e8468a7d1ed88d0f2a1c33e8892` (fetched 2026-10-11).
Branch: `feat/au-services-customer-stories`.
Only implementation worktree: `/Users/nam9295/Desktop/john_2.0/code/au-cake-service-stories`.

## Design references

Protected Pencil: `au-cake-frontend-polish/design/au-site-redesign.pen`, read only.

| Page | Desktop | Mobile |
| --- | --- | --- |
| Corporate & Events | B5nkf | oc8pJ |
| Café Supply | WBMIw | w76iZ |
| Consulting | dpaRC | LxFe9 |
| Home Customer Stories | P9pFE | TS3Iv |
| Korea archive | VXzjm | TKsm9 |

Read annotation Fv6B2 and service asset maps bvRvZ, l2Cud, KcMXq. Asset-map labels are older than actual Desktop image fills; the current Desktop images take precedence. Mobile uses those same assets in the Desktop narrative order, retaining single-column service cards and the events 2-column supporting-product grid. Custom Cake frames ba2on / xfETd were not inspected or used.

## Customer data and consent

Sources: the two user-supplied `review/` folders (Baemin and Coupang Eats, 2026-07-07 to 2026-10-07). Their README and verification files remain unchanged. On 2026-10-11 John explicitly confirmed permission for external reuse of the selected review text and customer photos. This is the user's confirmation, not an independent rights audit. Source README records saying permission had not yet been checked are retained in the originals.

293 selected reviews: Baemin 114, Coupang Eats 179. 215 reviews have photos; 255 distinct photos. These are a positive five-star selection, not all collected reviews and not an overall store rating. Incentive status is not independently verified; mentions of extra items and promotions remain verbatim.

`scripts/import-customer-stories.mjs` normalizes the two schemas. Original text, supplied translations, original language, actual rating, date, anonymous nickname/ID and photo relationships are preserved. Five originally English Coupang reviews retain `translated: false`. Photo-only reviews retain empty review text. Product filters derive only from explicit original-text mentions and retain the matching text as evidence; they are not verified purchase-product claims.

Home imports only R0035, R0037, CE0035 and their image metadata. R0035 uses photo p03 as specified in Pencil. Archive fetches `/customer-stories/korea.json` on entry, shows 12 rows initially and loads 12 more at a time. Thumbnails are lazy; full-resolution photos load only when opened. Native dialog supports focus containment, Escape, close and returning focus to the opener. No new review DB, invitation or coupon integration.

Customer photos are re-encoded without crop, recolouring, compositing, AI generation or retouching. Existing redacted pixels remain in the image. 480px and up-to-1200px WebP copies strip metadata. `customer-photo-manifest.json` records original hashes, exact review/photo mapping and sizes. Original supplied JPEGs total 50,876,448 bytes; both optimized variants total 31,918,470 bytes.

## Services and routing

`au-business-services.json` supplies section content, ordered photos and links to one shared presentation component. `au-service-assets.json` contains responsive images; `service-asset-manifest.json` records each Pencil source filename and original hash. 21 photos: originals 73,547,939 bytes, responsive WebP variants 3,673,262 bytes. No claim is made that illustrative occasion photographs document completed client engagements.

Routes: `/business/events`, `/business/cafe-supply`, `/business/consulting`, `/customer-stories/korea`. The shared route metadata feeds runtime SEO and the existing static generator. Directory HTML and extensionless `.html` aliases use the existing renderPage pipeline. The four routes are AU-only and join the AU sitemap. Existing KR static routes are preserved.

Enquiry CTAs use the existing configured Instagram profile `verygood_syd`. No unconfirmed email address, fake form, booking, payment, wholesale portal or quote backend is added. Café supply remains Coming Soon / enquiries. Consulting scope is by enquiry, not a purchasable or confirmed engagement.

## Protected behavior

Custom Cake source, CSS, aliases, completion routes, pricing, upload, quotation, notifications and API are untouched. In the approved navigation follow-up, the shared AU header now consistently links Events & Business to `/business/events` and Kids Classes to `/classes`, including on Custom Cake and Product Detail. This is a header navigation update only. Service/stories CSS selectors are limited to `.au-business`, `.au-stories`, `.au-story-*` and descendants; they cannot match Custom Cake or KR markup. No Appwrite, backend, pricing, order, coupon or product data changes.

No main merge, push or deployment is part of this implementation.

## Local verification (2026-10-11)

`npm test`, `npm run lint`, `VITE_MARKET=AU npm run build`, `VITE_MARKET=KR npm run build`, the new data/route/static tests and `git diff --check` passed. Both build modes retain the existing chunk-size advisory. New route tests were run separately under both markets; browser suites are invoked using `playwright-cli run-code --filename tests/services-stories.browser.mjs` and `tests/services-custom-regression.browser.mjs` against the documented local ports.

Evidence lives in `/tmp/au-services-qa/` and the project-root `design-qa.md`. All three services, home stories and archive were checked at 1440/834/390/360. No actual customer order, quote or backend write was submitted. Existing `/reviews` UI renders, but its live API is not usable in the unauthenticated local environment (401); existing review tests pass. Live production review retrieval and final service-copy approval remain pre-publication checks.

User confirmed that the five customer quotations containing “Daegu” must retain their exact wording and supplied translations. Site region labels remain Korea; see the approved exception in `CONTENT_APPROVAL_REQUIRED.md`.

## AU language control restoration (2026-10-11)

The redesign headers had omitted the existing English/Korean control. The restored control shares App's existing language state and `au-cake-language` storage through a small React context; it does not introduce a second language setting. Desktop shows `EN / 한국어` before Cart. At tablet widths it becomes a compact switch; on mobile it sits before MENU without requiring the drawer, with a 44×44px touch target. All language CSS is scoped to AU wrappers.

Home body/actions, category introductions, the three new services and Customer Stories UI now follow this preference. Service Korean text is a copy-only dictionary: source photos, links, facts and enquiry conditions are shared unchanged. Korean story cards use preserved original text; dialogs retain the supplied English translation. English-original and photo-only records are not retranslated or invented. Full archive loading remains route-only. Brand navigation/product titles and existing product-detail editorial/portfolio English copy are not comprehensively translated by this task.

`tests/au-language.test.ts` covers real rendered headers, localized service copy with identical asset/link destinations, stories and categories. Missing Korean rendering was first observed in three failing tests; the baseline browser also fails the restored-control assertion. `tests/au-language.browser.mjs` checks eight header widths (1440/1024/834/769/768/767/390/360), both languages, saved preference/reload, mobile touch targets, Korean service/archive UI, bilingual search and the review dialog. It also verifies that switching language retains an 8in Pavé selection, quantity 2 and AUD 218 cart handoff; no reservation is submitted. `tests/au-language-kr.browser.mjs` compares both languages on KR Home/Cakes/Pavé/Custom Cake at 1440/390 against an exported main baseline. Independent origins' analytics consent state is normalized for that comparison.

Verification: full `npm test`, lint, both market builds, story data/route tests, AU/KR static direct-access tests and diff check pass. The existing English service/stories browser suite also passes with zero page errors. AU Custom Cake's body DOM and measured controls remain identical to baseline; only its approved shared header gains the language control. No actual order/quote submitted, no backend or source-photo change, no push/merge/deploy.
