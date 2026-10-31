# Journal release state

No pending Journal releases are recorded.

## Completed 2026-10-31 — article03 and article02 hero

- Published article03 at `/journal/what-does-70-percent-cocoa-mean` with the three owner-specified folder photographs. The actual native FigCraft desktop/tablet/mobile/compact and executive-summary image fills were synchronized to those files under a private backup; manuscript and layout were preserved.
- Released article02’s held hero replacement in the same deployment. Its body image, index cover and Open Graph image now use the supplied chocolate-block/shavings photograph. The existing URL and first `publishedAt` remain unchanged. The prior article03 deployment hold is fulfilled.
- Release code commit: `8c2fcce2675c6fd1c5bd41b6106e3679315b6795`. Cloudflare production deployment: `ebc70487-38cc-4679-99fb-9c404e7b71a1`, status `success`.
- Verified three public articles, article03 native text layers and H1 line break, all nine article03 responsive photo assets, article02 body/cover/OG consistency, feed/sitemap/catalog, existing entry routes and hard404 behavior. Journal51 tests, full npm test, lint and AU/KR builds passed. Independent review reported no Critical/Important findings.
- Browser UI verification was unavailable because the browser host and native Chrome window lookup failed. Four native design renders, generated HTML/assets and live HTTP responses were checked; do not describe this as a completed live-browser visual audit.

Native designs, original photo files, backups, source checks and detailed verification reports stay private under `.journal-workspace/`. No order/payment/auth/Appwrite data, hosting flags or other services were changed. No new billing service was added.

This record is updated after deployment with a documentation-only skip-CI commit; the production code SHA above remains the deployed version. Verify actual Git and Pages state before any future release.
