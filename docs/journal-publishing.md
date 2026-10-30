# verygood AU Journal publishing

The Journal uses static HTML/CSS/photo packages on the existing AU Cloudflare Pages project. The first owner-approved article was exported from the real FigCraft 0.12.1 document, with desktop, tablet, mobile and compact frames. Native Pencil compatibility remains **unverified**; generic package tests do not establish support for a particular design tool export.

## Start in a new session

Open this repository/worktree in the new session. The owner can send:

```text
AU Journal에 아래 FigCraft 글을 발행해줘.
AGENTS.md와 docs/journal-publishing.md를 읽고 기존 발행 절차를 사용해줘.
파일: /이 컴퓨터에서 접근 가능한 경로/story.figcraft
대상 글 제목 또는 프레임: [발행할 글]
PC·모바일·사진·링크·SEO 검증 후 실제 발행하고 공개 주소를 알려줘.
```

A request naming the file and article is sufficient when this project and its entry instructions are available. Do not require the previous conversation transcript. On another computer, this repository's guidance, official FigCraft CLI, native file/photos and existing Git/Cloudflare access must be available there. A Mac-local path is not automatically accessible on Very/rice; a share link must yield an accessible native file for the CLI. If the target article is ambiguous, inspect the document and ask only for the missing identity.

Agent checklist:

1. Check Git status/worktrees and current remote main; use an isolated Journal checkout and preserve existing changes. Read this guide and the existing approved package as the format reference. Reverify the live Pages target/settings before release.
2. Inspect the supplied native file, select this article's actual desktop/mobile/tablet frames, heading layers, cover and photo alts, and explicit links. Build a new private metadata profile from the identified content. Do not depend on `.journal-workspace/figcraft-review/article-input.json` existing, copy article01 IDs, or assume that “2편” means draft02 in the original pack. New articles need their own unique stable ID/slug; edits preserve the existing ID/slug and first publication date.
3. Export privately with `journal:figcraft`, check/prepare using the actual current local revision (zero only for a new local entry), and compare the web render with the source. Preserve manuscript, photo crops and design; review unsupported conversion cases instead of silently changing them.
4. Apply the implemented title/description/canonical/OG/BlogPosting/sitemap/RSS and image checks. Do not invent authors, reviewers or factual claims. Additional author displays, content summaries, Search Console submissions and other suggested GEO enhancements are not implemented merely because they were discussed.
5. On an explicit publish request, prepare only that approved public package. Run Journal tests and an AU build, plus checks appropriate to code/dependency changes. Run AU/KR builds and the full suite sequentially if needed; clean-install dependency validation should match the current Pages Node/npm toolchain. Confirm the Git diff excludes private native source, other drafts and credentials.
6. Use the existing Git → Pages release, without new billing services. Verify the exact deployment commit/status, public article/list, photos, metadata, sitemap and `/journal/feed.xml`. Report the live URL and actual validation results. `journal:publish` and save-triggered publication do not exist.

These entry instructions and this guide are versioned with the Journal. On another clone/computer, sync the repository as well as the native source file; local-only preparation state and credentials do not travel with Git.

## Where files live

- Google Drive: original manuscript/design/photo archive. Never use Drive image links on the public site.
- External export folder: a whole article's HTML, CSS, images and `article.json`.
- `.journal-workspace/`: ignored **local-only** preparation state, immutable revisions, inventory and previews. Never upload this directory or its screenshots to Git or public previews.
- `journal-source/{article-id}/`: explicitly approved public-source packages only. The repo is public: `draft` and `noindex` do not hide its files.
- `dist/`: production build. Reads **only** approved published packages under `journal-source/`, never the private workspace. Generated static pages do not load the React SPA initializer.

No Appwrite tables, buckets, functions, account flows, order flows or magazine ingestion are required or changed.

## Export contract

A design-tool adapter must produce the following complete local package. The verified FigCraft adapter is described below. This is a conservative package importer, not a universal lossless converter. New design profiles need visual comparison; content-only updates can reuse a verified profile.

```text
my-export/
  article.json
  index.html
  style.css
  photos/...
```

HTML may reference local CSS via `<link rel="stylesheet">` or include `<style>` blocks. Inline declarations are parsed and converted to scoped classes. Relative assets, encoded spaces/non-ASCII names, nested CSS folders and uppercase raster extensions are supported. Bundled WOFF/WOFF2 `@font-face` assets are supported. Package paths and symlinks cannot escape the export folder.

```json
{
  "id": "example-story",
  "slug": "example-story",
  "title": "Example story",
  "seoTitle": "Example story | verygood chocolate",
  "excerpt": "The description used by the index, search and sharing metadata.",
  "locale": "en-AU",
  "status": "draft",
  "cover": { "src": "photos/cover.jpg", "alt": "Describe the photograph" },
  "source": { "tool": "pencil", "version": "Record the actual export version" }
}
```

`html` can optionally name an entry file other than `index.html`. `title` must match the single real-text `h1`. Preserve heading order. Every content image requires meaningful alt text; explicit `alt=""` is reserved for decoration. Links must be fragments, site-relative paths, HTTPS, `mailto:` or `tel:`. Imported fragments and ids are namespaced automatically.

Unsupported inputs fail with an actionable error before becoming an active revision: JavaScript, event handlers, iframes, forms, active SVG, remote images/styles, CSS imports/nesting, fixed/sticky or variable positioning, unsupported at-rules, and dynamic framework dependencies such as a Tailwind runtime. Rasterize reviewed SVG illustrations before import. Fixed-width layouts can still fail responsive QA; the importer does not invent an approved mobile design.

Images are batched into Sharp WebP variants (up to 2000px, never enlarged), dimensions and responsive srcsets. HTML/CSS asset references and covers use the same content-hash mapping under `/journal-assets/{id}/{hash}/`. CSS selectors, ids, keyframes and bundled font families are namespaced. Review font rendering and complex animation manually against the real export.

## FigCraft native import

Install the official FigCraft CLI and make `figcraft-cli` available on PATH (or set `FIGCRAFT_CLI` to its absolute executable path). Headless `figcraft-cli mcp` opens the native document, reads layers and requests the real `inspect.code` HTML/CSS export; the desktop app need not stay open. The original file is never saved or modified.

```sh
npm run journal:figcraft -- --file /absolute/story.figcraft --metadata /private/story-profile.json --output /private/story-export
npm run journal:check -- --input /private/story-export
```

The private metadata profile contains normal article fields, `cover.layer` (desktop photo layer ID), and:

```json
"figcraft": {
  "desktop": 3,
  "variants": [{ "maxWidth": 1100, "frame": 125 }, { "maxWidth": 600, "frame": 73 }, { "maxWidth": 360, "frame": 195 }],
  "imageAlt": { "14": "Describe the first photograph" },
  "links": { "68": "/cakes" }
}
```

IDs above are examples from the first reference design; select actual frame/photo/link IDs for each document. All content images require their own alt text. Name text layers with H1/H2–H6 to preserve heading semantics. Source layers named `Source [1]` or a multiline `Sources List` / `References List` provide citation targets. Native text line breaks are retained; surrounding prose parentheses stay outside source URLs. Normal HTTPS source URLs and manuscript citations become real links. Uniquely named empty leaf frames (for example dividers) map by exact name across viewports; ambiguous names fail for review. Explicit link metadata keeps product destinations reviewable.

Raw FigCraft 0.12.1 HTML has generic paragraphs, fixed widths and repeated placeholder image URLs. The adapter resolves native embedded photos, converts named headings, merges supplied viewport styles into one DOM and emits honest `source.tool: "figcraft"` provenance. Responsive frames must contain the same ordered manuscript and image sequence, including repeated content. Decorative locale/kicker omissions are allowed; reordered/different content, ambiguous matching, added layout wrappers, crop/filter adjustments, native CSS conditions and unsupported vectors fail for review. Removed responsive properties reset rather than leaking desktop styles. Article CSS never becomes a new hand-written React route.

The first profile is kept locally in `.journal-workspace/figcraft-review/article-input.json`. Its original `.figcraft` and PNG photos stay in the existing Drive folder. The public package contains only this approved article, CSS and WebP copies of its three photos.

## Inspect, prepare and preview

```sh
npm ci
npm run journal:check -- --input /absolute/path/my-export
npm run journal:prepare -- --input /absolute/path/my-export --expected-revision 0
VITE_MARKET=AU npm run build
npm run journal:preview
```

`journal:check` reads and compiles in memory, without writing or fetching external assets. `journal:prepare` stores a private immutable revision and an import report; it does not change public source or deploy. Preview listens **only on `127.0.0.1:4317`**. Open `/journal` and `/journal/{slug}`. It adds `noindex` headers/meta and a visible publication-preview notice. Drafts stay out of the feed, sitemap and catalog. Existing AU routes use the local `dist` build as fallback; no remote production mutations occur.

`npm run journal:serve` serves the approved local AU `dist` build on the same port. Stop the other preview process first. `npm run dev` remains the existing React development server; use the Journal server to inspect static documents.

Check 320, 390, 768 and 1440px, 200% zoom, no-JavaScript reading, single h1, alt text, source/product links, images, menu, direct visit, refresh, list return and back/forward navigation. Mobile Journal navigation uses a native `details` control, so it works without hydration. Article language is explicit; no translation toggle is shown for a single-language article. The static header links to the existing cart/account flows and does not initialize customer state or display a fabricated cart count.

## Re-import and recovery

Re-export from the same design, preserving `id` and `slug`:

```sh
npm run journal:prepare -- --input /absolute/path/my-export --expected-revision 1
npm run journal:preview
```

The state file lists the current revision. Stale revisions, another article's slug, a changed slug, concurrent imports and validation failures are rejected. The previous active revision remains usable. Reports are in `.journal-workspace/revisions/{id}/{revision}/prepared.json`.

Static output is staged on the output filesystem. Unexpected file/directory shapes fail before moving the old output. Write failures restore the previous generated paths; if restoration itself fails, the error names a retained `.au-journal-build-*/.previous` backup. Preserve that directory and inspect the failure before retrying. No failed local build is a production deployment.

```sh
npm run journal:rollback -- --id example-story --expected-revision 2 --target-revision 1
npm run journal:preview
```

Rollback changes the active snapshot and advances the revision counter (2 → 3 in this example); the next import uses `--expected-revision 3`. Existing snapshot files are retained. If a process crashes while holding `.journal-workspace/.import-lock`, confirm no Journal importer is running before removing **only that lock directory**. Do not delete other worktrees or source originals.

## Public release gate

After the owner authorizes publication of the actual design, copy and photos, record `status: "published"`, `publishedAt`/`updatedAt` with timezone (no future dates), and:

```json
"publication": {
  "approved": true,
  "approvedBy": "Actual approving owner",
  "approvedAt": "2026-10-30T00:00:00Z"
}
```

This declaration records a human decision; tooling does not grant approval. Only then copy the reviewed package to public `journal-source/{id}/` and review the Git diff for unpublished material. The importer does not itself grant approval, promote private drafts or deploy. The first article records the owner’s explicit publication request; it does not invent an author or specialist fact-review credit.

```sh
npm run test:journal
VITE_MARKET=AU npm run build
npm run journal:serve
```

The production build emits `/journal.html`, `/journal/index.html`, `/journal/{slug}.html`, `/journal/{slug}/index.html`, catalog, RSS and sitemap. Slash aliases use the same extensionless canonical URL. Existing hard 404 behavior remains; no global SPA rewrite is added. Only published packages generate public assets and metadata. KR builds emit no Journal files.

The existing project was checked read-only through Cloudflare: `au-cake-next`, GitHub `au-cake`, production branch `main`, `npm run build` → `dist`, `VITE_MARKET=AU` and `VITE_CUSTOMER_ACCOUNT_ENABLED=true`. Preserve all existing environment flags and Appwrite settings. Publish approved Journal changes with an ordinary fast-forward Git update; the existing Pages integration performs its production build. Check the resulting deployment commit/status and public article, cover assets, sitemap and RSS before reporting success. Build/test commands must run sequentially because existing SEO scripts write shared generated files.

For recovery, use a new Git revert commit for the specific released change, or restore the known-good Pages deployment through the existing project. Do not force-push, delete worktrees or operate on order data. Preserve import reports and immutable private revisions for diagnosis.

## Simple publishing without a new billing service

Use the current Pages/Git integration. R2, Workers routing and a new billing subscription are not needed for this static system. A future publishing wrapper can hide the existing sequence behind one explicit action:

`FigCraft design ready → native export → validation/photo optimization → approved package update → Git commit/push → existing Pages build → live URL verification`

Users need not manually repeat Git commands or approve a preview for every routine content update. An agent can perform the sequence when asked to publish; a future dedicated CLI can apply the same checks and authorization. `journal:figcraft` exists today; **a one-command `journal:publish` wrapper, save watcher and ready-folder service do not yet exist**. Do not mistake export success for a successful deployment. Avoid publishing on every file save, which can expose unfinished work; use an explicit publish action or a deliberate ready marker.

Mac/Linux publication needs the official platform CLI, this code, source-file access and existing Git credentials. Very/rice have not been installed or tested for this workflow; do not wake or change them as part of the first release. Once a Pages deployment succeeds, the authoring computer/server can sleep. If direct Wrangler uploads are considered later, they must include the complete site with the exact production build settings; uploading only a Journal folder would replace the rest of the site. The current release keeps the existing Git integration.

References: [FigCraft 0.12.1 MCP and headless CLI](https://github.com/storytold/figcraft/blob/v0.12.1/docs/mcp.md), [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Cloudflare static routing](https://developers.cloudflare.com/pages/configuration/serving-pages/), [R2 subscription setup](https://developers.cloudflare.com/r2/get-started/).
