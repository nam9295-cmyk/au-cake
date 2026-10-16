# AU SEO/GEO local correction — 2026-10-17

Scope: SEO-01–08 in the audit brief. Started from clean `codex/au-renewal-20261014`, HEAD6155ddc. No reset, push, merge, production deployment, Appwrite mutation, test order or notification. The supplied private audit document remains local; this report contains only public development information.

## Reproduction and changes

| Item | Before | Local correction |
|---|---|---|
| SEO-01 | renewal robots undefined; retired noindex absent from first HTML | shared robots resolver, explicit renewal indexability; all generated HTML tested |
| SEO-02 | generic fallback, no product photo/flavour details | current public catalogue photos, names, configurations and prices; Mochi packing,24h and approved safety text; responsive images even with scripts blocked |
| SEO-03 | WebPage only | Product + named AUD Offers for confirmed selections, actual menu BreadcrumbList; blocked Cookie/Brownie Cupcake remain informational WebPage without offers |
| SEO-04 | two retired pages lacked initial noindex; slash aliases rendered404 after JS | explicit noindex and canonical; AU cake alias normalization preserves retirement view; unknown products stay404 |
| SEO-05 | generic descriptions, old S’more tiers, manual-opening boilerplate | product-specific summaries and catalogue-generated llms; S’more6/AUD25 and12/AUD45; only unapproved products retain approval notices |
| SEO-06 | WebP described as JPEG1200×630; old Brownie hero; missing home/category image | actual dimensions/MIME/alt verified by decoding assets; latest catalogue image mapping; existing brand OG image for hubs; client metadata/canonical upsert |
| SEO-07 | ended Spring campaign still offered as a Course | AU archive/enquiries page in EN/KO and initial HTML, no Course pricing; Basic1-tier/Advanced2-tier enquiry links; no change to booking IDs/history/policy or KR classes |
| SEO-08 | shared Brownie URL described Whole only | one canonical describing Whole and Loaf, all base prices and both form links; direct loaf entry still selects Loaf |

Prices come from RENEWAL_OFFERS/MOCHI_FLAVOURS, not earlier research notes. No price or validation source was changed. Mochi offers are explicitly one piece, not an AUD8 gift box. Gift box combinations are explained as a sum, not enumerated into invented SKUs or URLs. ProductGroup taste/shape attributes, ratings, GTIN, stock, delivery and returns policies are not invented. Existing5+1 packs use their actual total units/prices; cake-linked extras are not listed as general retail offers.

The schema approach was checked against Google's current [Product snippet](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) and [Product variants](https://developers.google.com/search/docs/appearance/structured-data/product-variants) documentation. Rich Results Test and Search Console were not run; eligibility or ranking is not guaranteed.

## Validation evidence

- Eight initial SEO defect tests failed before implementation; additional alias/image overflow regressions reproduced before their fixes.
- Read-only live GETs reconfirmed undefined robots on Mochi/Lemon/Brownie and old Course schema on Classes. Production has not been changed by this task.
- Browser390px:22 routes compared using the built AU artifact, first with `Content-Security-Policy: script-src 'none'` and then with JavaScript. Title, description, canonical, robots, images and JSON-LD match. Brownie initial H1 covers both forms; rendered H1 reflects selected Loaf. All tested views have no horizontal overflow.
- Korean Mochi keeps banana, prices, refrigeration and three-day guidance; Korean Classes shows archive and enquiries. English indexing remains intentional; no /ko or hreflang invented.
- Real-browser DOM harness passed: empty-head meta creation, image removal/recreation, MIME/dimensions, canonical creation, retired noindex and schema replacement. No order was submitted.
- Screenshot/evidence files are local/ignored under `output/playwright/seo/`.
- Regression expectation updates: old blanket no-Offer assertions and old Course prices replaced with current sale/closed-class assertions. One pre-existing home test still expected the pre6155ddc mobile poster filename; only its expectation was updated to the current8-second video poster, without modifying the video.

Final verification (2026-10-17): `npm run test:seo`, `npm run test:renewal`, full `npm test`, `npm run lint`, KR production build, AU production build (last), and `git diff --check` all passed. Build output contains the existing chunk-size/dynamic-import warnings; no temporary DOM harness remains in dist. AU generated45 route HTML files and25 sitemap URLs; KR generated30/12. A local-only commit preserves this change; no push, merge or deployment was performed.

## Protected boundaries

No changes to RENEWAL_OFFERS, MOCHI_FLAVOURS, price calculation, order schemas/readers, DB, pickup validation, runtime flags, Notification/Reminder or Custom Cake implementation. KR rendering and market-boundary tests remain required. The SEO module under reservation-api/src is consumed by the frontend/static builder; it is not imported by the production Function entrypoints. Its directory location does not require an Appwrite deployment.

Sitemap remains25 canonical public URLs, with no private, retired, query or error URLs. Robots training/search policy is unchanged. No fabricated lastmod is added. Build generation writes public/sitemap.xml and public/llms.txt, so final artifacts must be generated for AU after KR validation.

## Remaining account work (not executed)

- Verify Search Console property ownership (including possible DNS verification), sitemap submission and URL Inspection for homepage, Mochi, Brownie and Classes.
- Verify Bing Webmaster ownership/sitemap; only configure IndexNow after confirming account/support requirements.
- Review actual Google/OAI crawler access and CDN behavior, indexing and Core Web Vitals in account reports.
- Check Business Profile's approved pickup hours/location without publicly adding a private home address.
- Korean search URLs/hreflang are a separate second-phase project.

## SEO-only deployment after separate approval

1. Fetch/review remote main and preserve any newer changes. Review this local commit; no force push/reset.
2. Run relevant SEO/renewal/full tests, lint, KR build and AU build last. Ensure no temporary test harness is in the deploy artifact.
3. Record the currently active Pages deployment and deploy only the AU frontend/static artifact through the existing au-cake-next main pipeline. Do not redeploy Appwrite or change flags/schema.
4. Inspect real GET and rendered DOM for all sitemap URLs, retired aliases, Mochi prices, Brownie form query, OG dimensions and Classes archive; verify404 and private noindex.
5. With account access and approval, submit the sitemap/request recrawl of key URLs. Submission is not proof of indexing.
6. If frontend SEO regresses, restore the preceding compatible Pages deployment or revert only this SEO commit. No DB restore, price recalculation or writer-flag change is required.
