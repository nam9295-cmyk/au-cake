# Journal release state

No pending Journal releases are recorded.

## Completed 2026-11-02 — article05

- Published article05 at `/journal/tiramisu-cups-vs-tray`, showing `Published 2 November 2026` in the list and article top. The three embedded photos exactly match the supplied folder's `pic-05/01.png`, `02.png` and `03.png`; only optimized WebP copies were published. Native source, original photographs, manuscript and layout remain unchanged.
- All 62 text layers match the native manuscript across four responsive frames. Original article01–04 packages and publication timestamps are unchanged. This release adds one static article package and changes no app/importer code, protected system or hosting flag.
- Release code commit: `b112a1ffefbcc837548d5a13cbb92223f3fc171d`. Cloudflare production deployment: `15207b1f-38b1-4735-a4a7-8225c746bdbf`, status `success`.
- Journal52 tests, the AU account-enabled build, fresh public-package validation and independent review passed without Critical/Important findings. Verified five public articles and dates, all nine article05 responsive photo variants, cover/OG, native text, source/product links, feed/sitemap/catalog, existing entry routes and hard404 behavior through live HTTP. Cited FSANZ temperature/allergen pages were checked against the manuscript.
- Browser visual QA remains unavailable because the browser access host is unavailable. Native renders at 1440/768/390/320px and generated HTML/assets were checked; do not describe this as a completed live-browser visual audit. Private source/profile and verification evidence remain under `.journal-workspace/article-05/`.

## Completed 2026-11-01 — article04 and visible publication dates

- Published article04 at `/journal/what-makes-dubai-chocolate-crunchy` with the three owner-specified `pic-04` photographs. The native design's four responsive frames and summary use those photos under private backups. Two owner-approved source-accuracy corrections were applied to the native manuscript and regenerated public package; all 58 public text layers match the corrected native source.
- Added visible first-publication dates to the shared Journal list and article top. Sydney dates are article01: 30 October 2026; articles02–03: 31 October 2026; article04: 1 November 2026. Article02's UTC timestamp is 30 October, while its Sydney and Korean date is 31 October. Original article01–03 timestamps and packages remain unchanged. Later photo/content updates do not reset first publication.
- Release code commit: `37a2bdd0a95b9d15764f31392e7df8150701c1a0`. Cloudflare production deployment: `9ad08037-ba58-4b26-b214-b84220d6d285`, status `success`.
- Verified four public articles and visible dates against their original timestamps and structured metadata, article04's nine responsive photo assets, cover/OG consistency, source and product links, feed/sitemap/catalog, existing entry routes and hard404 behavior. Journal52 tests (including the Sydney midnight boundary), full npm test, lint and sequential KR/AU builds passed. Independent review reported no Critical/Important findings.
- Browser visual QA remains unavailable because the browser access host is unavailable. Native renders at 1440/768/390/320px, generated HTML/assets and live HTTP responses were checked; do not describe this as a completed live-browser visual audit.

## Completed 2026-10-31 — article03 and article02 hero

- Published article03 at `/journal/what-does-70-percent-cocoa-mean` with the three owner-specified folder photographs. The actual native FigCraft desktop/tablet/mobile/compact and executive-summary image fills were synchronized to those files under a private backup; manuscript and layout were preserved.
- Released article02’s held hero replacement in the same deployment. Its body image, index cover and Open Graph image now use the supplied chocolate-block/shavings photograph. The existing URL and first `publishedAt` remain unchanged. The prior article03 deployment hold is fulfilled.
- Release code commit: `8c2fcce2675c6fd1c5bd41b6106e3679315b6795`. Cloudflare production deployment: `ebc70487-38cc-4679-99fb-9c404e7b71a1`, status `success`.
- Verified three public articles, article03 native text layers and H1 line break, all nine article03 responsive photo assets, article02 body/cover/OG consistency, feed/sitemap/catalog, existing entry routes and hard404 behavior. Journal51 tests, full npm test, lint and AU/KR builds passed. Independent review reported no Critical/Important findings.
- Browser UI verification was unavailable because the browser host and native Chrome window lookup failed. Four native design renders, generated HTML/assets and live HTTP responses were checked; do not describe this as a completed live-browser visual audit.

Native designs, original photo files, backups, source checks and detailed verification reports stay private under `.journal-workspace/`. No order/payment/auth/Appwrite data, hosting flags or other services were changed. No new billing service was added.

This record is updated after deployment with a documentation-only skip-CI commit; the production code SHA above remains the deployed version. Verify actual Git and Pages state before any future release.
