# AU Journal Phase 1 static implementation

**Goal:** Repeatedly import whole HTML/CSS/local-asset article packages, without a React page per article.

**Authority:** User's Phase 1 request and `origin/docs/au-journal-publishing-20261030:docs/superpowers/specs/2026-10-30-au-journal-static-first-architecture.md`. This supersedes the older plan's per-article React registry. Execute inline in the explicitly requested worktree; no publishing or approval loop for the already authorized foundation.

**Constraints:** AU only; no backend/schema/auth/order changes; no deploy/push; private drafts and generated previews stay in ignored `.journal-workspace/`. Real Pencil validation remains pending until an actual export exists. No design approval is inferred.

**Architecture:** Parse HTML and CSS with parsers, reject active/unsupported content, resolve local assets within the source package, generate Sharp WebP variants, and isolate article styles. Revision-controlled private preparation is separate from the production build, which reads only explicitly approved packages in `journal-source/`. Static documents use a shared AU chrome adapter, ordinary links and a native accessible mobile menu; they never run the SPA initializer. The existing React header/footer gain a Journal link in frontend code only.

## Tasks

- [x] 1. Inventory source files and compare ZIP hashes. Record private findings locally. Inspect existing routes, SEO generation, hosting conventions and navigation.
- [x] 2. Write import/preparation tests; observe failure, implement parser-based import, batched images, validation, immutable revisions, stale revision rejection and rollback.
- [x] 3. Write static build tests; implement index/article documents, shared chrome, published-only filtering, canonical/OG/schema/RSS/sitemap, AU-only build integration and local preview server.
- [x] 4. Prepare only the first original draft as a clearly labelled content review, preserving all body text. No photo or Pencil export is invented. Preview at 320/390/768/1440px, no-JS and zoom; check mobile menu, assets and links.
- [x] 5. Run focused tests, full suite, lint and AU/KR builds; inspect final diff and document import/re-import/recovery and remaining real-design approval work.

## Review focus

- HTML/CSS URLs, encoded traversal, symlinks, event attributes and active markup must fail before changing an existing revision.
- Root/global styles, keyframes and font names must not affect shared chrome or another article.
- Updating an id keeps its slug; stale writers and duplicate slugs fail; failed import leaves the old state usable.
- Unapproved/private inputs never enter default production output, feed, sitemap or source control.
- Static direct visits, refresh, navigation, unknown-route 404 and no-JS rendering work without React startup; KR produces no Journal output.

## Decisions and evidence

- Existing target was an empty directory; created a linked worktree from fetched `origin/main` `47730d4` on `feat/au-journal-phase1-20261030`. Operational checkout remains untouched.
- Real Pencil app connection failed. User explicitly selected foundation and inventory first. Actual Pencil design/export and visual approval remain pending.
- Use a static chrome adapter with a native `details` mobile menu rather than a non-hydrated React menu with dead controls. Reuse the actual AU footer and navigation data. No article language-switch control without a translated article.
- Synthetic parser/image tests demonstrate the package contract only, never real Pencil compatibility.

## Final verification

- Full `npm test` PASS; focused Journal 34/34 PASS; lint PASS; AU and KR builds PASS.
- First private content review re-imported at revision 2 without changing id/slug or source text. Browser 320/390/768/1440px, 200% zoom and no-JS PASS.
- Independent review fixes: reject events before scaffold early returns; normalize CSS property names and reject escapes; restore previous generated paths on write failure; reject invalid calendar dates. Each regression was RED then GREEN. No findings deferred.
- Real Pencil export/design/photos and live hosting/deployment remain unverified; user review precedes any release. Branch/worktree retained, no push/merge/deploy.
- Verification process correction: KR build and full tests both generate public crawl files, so final checks were run sequentially after an AU rebuild. Final public files match the AU baseline.
