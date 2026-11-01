# Journal release state

## Pending 2026-11-01 — approved article04 and visible publication dates

- The owner requested article04 from the supplied FigCraft document and `pic-04` photos. The approved package is `journal-source/draft-04/`, with URL `/journal/what-makes-dubai-chocolate-crunchy`. Release validation is complete; production publication still requires verification.
- The three folder photos are synchronized into the native design's four responsive frames and summary under a private backup. The 58 desktop manuscript layers are preserved except for the two owner-approved corrections below. Native renders at 1440/768/390/320px were reviewed; browser access remains unavailable.
- Pre-release source review found two details unsupported by the cited Callebaut recipe: the current recipe specifies milk chocolate and does not include finely chopping the pastry. The proposed minimal corrections are `dark or milk chocolate` → `milk chocolate`, and `finely chopped and toasted` → `toasted`. Source: https://www.callebaut.com/en-US/recipes/dubai-bar/4898.
- The owner approved both corrections and publication. The native text occurrences and public package now contain those corrections. Final validation and the normal Git → Pages release are in progress. Private source/profile, backups and verification reports remain under `.journal-workspace/article-04/`.
- The owner also requested visible publication dates. Shared list/article metadata now shows the first publication date in Sydney time, without changing the first timestamps of articles01–03. Actual dates are article01: 30 October 2026; articles02–03: 31 October 2026; article04: 1 November 2026. Article02's UTC timestamp falls on 30 October, but its Sydney and Korean local date is 31 October. Later photo changes do not become new publication dates.
- Journal52 tests, the full npm test command, lint and sequential KR/AU builds passed. Local HTTP checks passed for all four articles, the nine article04 responsive photo variants, visible dates, metadata, feed, sitemap, existing entry routes and hard404. Independent review reported no Critical/Important findings. Browser visual QA remains unavailable.
- Production still serves the three-article release below. No other release is pending.

## Completed 2026-10-31 — article03 and article02 hero

- Published article03 at `/journal/what-does-70-percent-cocoa-mean` with the three owner-specified folder photographs. The actual native FigCraft desktop/tablet/mobile/compact and executive-summary image fills were synchronized to those files under a private backup; manuscript and layout were preserved.
- Released article02’s held hero replacement in the same deployment. Its body image, index cover and Open Graph image now use the supplied chocolate-block/shavings photograph. The existing URL and first `publishedAt` remain unchanged. The prior article03 deployment hold is fulfilled.
- Release code commit: `8c2fcce2675c6fd1c5bd41b6106e3679315b6795`. Cloudflare production deployment: `ebc70487-38cc-4679-99fb-9c404e7b71a1`, status `success`.
- Verified three public articles, article03 native text layers and H1 line break, all nine article03 responsive photo assets, article02 body/cover/OG consistency, feed/sitemap/catalog, existing entry routes and hard404 behavior. Journal51 tests, full npm test, lint and AU/KR builds passed. Independent review reported no Critical/Important findings.
- Browser UI verification was unavailable because the browser host and native Chrome window lookup failed. Four native design renders, generated HTML/assets and live HTTP responses were checked; do not describe this as a completed live-browser visual audit.

Native designs, original photo files, backups, source checks and detailed verification reports stay private under `.journal-workspace/`. No order/payment/auth/Appwrite data, hosting flags or other services were changed. No new billing service was added.

This record is updated after deployment with a documentation-only skip-CI commit; the production code SHA above remains the deployed version. Verify actual Git and Pages state before any future release.
