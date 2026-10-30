# AU Journal Phase 1 verification

Status: static foundation and real FigCraft import implemented. The owner requested publication of the completed first design; its approved public package is prepared. Production deployment verification is recorded separately after release. No operational data or backend changes.

Worktree: `au-cake-journal`, branch `feat/au-journal-phase1-20261030`, base fetched `origin/main` `47730d4`. The existing `au-cake` checkout remains on its original `feat/account-design` branch.

## Source inventory

The original extracted draft pack and ZIP have 19 byte-identical archive entries (SHA-256 comparison). Only the extracted pack was read; all source hashes remain unchanged. There are five en-AU Markdown drafts, a manuscript reader, metadata and source records. The initial pack contains only reader-verification PNGs and no product photographs or design exports. The later `261030/` folder contains the completed `.figcraft`, a `.pen` placeholder and three photographs. The native FigCraft archive embeds the same three images. Originals remain in place.

The full private titles, content/photography requirements, original path and inventory are recorded locally in ignored `.journal-workspace/inventory.md`. Only the first draft progressed from the initial content review to an actual FigCraft export; the other four were inventoried only. The original proposed order is 01 → 05 → 02 → 03 → 04.

## Implemented and exercised

- Generic HTML/CSS package import; no per-article React code or route registration.
- Parsed unsafe markup/CSS rejection, package containment including symlinks, namespaced selectors/ids/keyframes/fonts, responsive Sharp WebP assets and cover registration.
- Same-id/slug revision 1 → 2 re-import; stale writers and duplicate slugs reject; immutable snapshots and rollback. Failure before state commit leaves the current revision intact.
- Independent static index/detail documents, shared AU navigation/footer, native no-JS mobile menu, canonical/OG/BlogPosting, responsive cover, published-only catalog/sitemap/RSS. AU only; original SPA initialization is absent from Journal documents.
- Approved-only production input, local-only noindex preview; unapproved manuscript and assets stay outside Git and production output.
- Output obstruction regression: the failed replacement preserves previous articles/assets. Commit-stage failures restore the previous generated paths or retain a named recovery backup.

## Verification record

- Journal focused suite: 46 tests, including actual generated WebP bytes, safety failures, output isolation, local HTTP behavior and native FigCraft normalization regressions.
- Complete `npm test` PASS; `npm run lint` PASS; AU/KR builds PASS. Existing Vite chunk-size warnings are unchanged in scope. The full suite requires the existing review function test dependencies (`npm ci --prefix appwrite-functions/review-api`); installing them changed no Function source or deployment.
- First real import: all 23 original manuscript blocks are present unchanged and in order; single h1, six h2s, working citation fragments and `/cakes` CTA. Both source URLs returned HTTP 200 (one canonical redirect). Native FigCraft 0.12.1 export completed with four viewport frames, three embedded photos and no missing fonts. No specialist fact-review credit was inferred.
- Browser checks at 320/390/768/1440px; no visible elements outside viewport; 200% CSS zoom at 390px after header-wrap correction; mobile menu, index/detail, refresh and no-JS reading. Screenshots and exact metrics are private under `.journal-workspace/verification/`.
- Real FigCraft preview checked at 1440/768/390/320px: no horizontal overflow; photos load at their supplied crops; mobile source links wrap. The first public source photos total 596,500 bytes, compared with 5,662,866 bytes embedded PNG input; production assets receive further responsive WebP processing. Original native design is private. Pencil export fidelity remains **unverified**.

## Review fixes

One independent read-only review identified retained body-title/meta event attributes, escaped CSS position properties, uppercase global font-family registration, replacement failure losing prior output, and normalized invalid calendar dates. Each issue was reproduced by a failing test and fixed; calendar-date correctness was treated as required SEO metadata validation. Shared heading CSS leakage and zoom overflow were also corrected during browser QA. No review findings are knowingly deferred.

A second independent review of the native adapter found non-bijective variant mapping, missing responsive style resets, unchecked mobile photo adjustments and flattened CSS conditions. Ordered one-to-one content checks, explicit resets, all-frame validation and strict native CSS rejection now cover them. Follow-up inherited-property and added-wrapper cases also have regression coverage. The final reviewer reported no remaining blockers in the reviewed scope (40/40 FigCraft/import tests). The parent performs real visual/build/deployment checks; code review does not assert photo rights or specialist fact review.

## Deployment target

Read-only Cloudflare API verification confirmed existing `au-cake-next`, GitHub `au-cake`, production `main`, `npm run build` → `dist`, `VITE_MARKET=AU`, `VITE_CUSTOMER_ACCOUNT_ENABLED=true`. This release retains all current settings. R2/new billing is excluded by owner preference. Other authoring servers were not changed or awakened.

The first Git-triggered attempt (`a8025c4`, deployment `530f0bec`) failed before the build because the macOS/npm 11 lockfile omitted two optional WASM dependencies required by npm 10 clean-install validation. Reproduced with npm 10.9.9 and Linux/x64 selection, regenerated the lock in an empty directory, and verified no existing locked versions changed. A clean Node 22.23.4/npm 10.9.9 install and AU build with the customer-account flag enabled then passed. This failure left the previous production deployment live.

Actual release commit, deployment ID and public HTTP evidence are stored locally in `.journal-workspace/figcraft-review/release-verification.json` and reported to the owner after successful deployment.
