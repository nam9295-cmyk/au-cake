# Journal release state

## Pending 2026-11-02 — approved article05

- The owner requested publication of the completed tiramisu cups/tray FigCraft article. Approved public package: `journal-source/draft-05/`; URL: `/journal/tiramisu-cups-vs-tray`; Sydney publication date: 2 November 2026.
- The three embedded photos exactly match `pic-05/01.png`, `02.png` and `03.png`. Native source and original photos remain unchanged. All 62 text layers match the native manuscript across four responsive frames. Only public WebP copies, HTML/CSS and metadata are included in the package.
- Journal52 tests, the AU account-enabled build, local HTTP/metadata/date/image/feed/sitemap/CTA checks and independent review passed, with no Critical/Important findings. Existing article01–04 packages and timestamps are unchanged. No importer/app/protected-system or hosting-flag change is included. Release is approved; production deployment and live verification are next.
- Browser visual QA remains unavailable because the browser host is unavailable. Native 1440/768/390/320px renders and generated HTML/assets were checked. Private profile, source checks and verification reports stay in `.journal-workspace/article-05/`.

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
