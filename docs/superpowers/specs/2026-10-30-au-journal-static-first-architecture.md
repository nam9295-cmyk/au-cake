# **verygood** AU Journal — Pencil static-first architecture recommendation

- Date: 2026-10-30
- Status: **Pencil is user-confirmed. Static-first is the recommended architecture, not yet an implementation or live deployment.**
- Repository: `nam9295-cmyk/au-cake`
- Existing related documents: [original design](./2026-10-30-au-journal-publishing-design.md), [implementation plan](../plans/2026-10-30-au-journal-publishing.md)
- Scope: AU Journal only. Exclude `brief.verygood.run`, existing magazine ingestion scheduler, and reservation/order backend modifications.

## Recommendation

**Do not add a new Appwrite database or Storage bucket for the MVP.** Use a versioned static article package produced from a real Pencil `HTML+CSS` export, with its referenced images imported in one batch. Publish under the existing Cloudflare Pages AU domain as `/journal/{slug}`, and generate the index metadata, sitemap, canonical, OG tags, and RSS from a manifest.

The author works **only in Pencil** and should not have to re-enter text or images in a blog admin. Do not require a new hand-coded React component for every article. The import/build system should generate a complete static HTML document from the approved Pencil package and add the site-wide navigation/layout only once, keeping article CSS isolated. Where the export has nonresponsive fixed layout or unsupported behavior, report and correct it during a reviewed import, rather than promising lossless one-click conversion.

### Suggested package (paths provisional)

```text
journal-source/
  my-first-story/
    source.html
    style.css
    assets/
    article.json       # id, slug, title, excerpt, locale, cover, alt, status, dates
scripts/
  journal-import.mjs    # validate, inspect CSS/image paths, reject scripts and unsafe markup
  journal-build.mjs     # scope styles, optimize images, compose shared shell, build publishable HTML
dist/
  journal/index.html
  journal/my-first-story/index.html
  journal-assets/my-first-story/{revision}/...
  journal/feed.xml
```

Source package placement in the public repo is permitted **only for public-ready content**; `draft` and `noindex` alone do not make files secret. Keep private drafts and unapproved assets outside public branches/previews.

### Site integration

- Add a `JOURNAL` link to AU navigation and a simple journal list page.
- Article detail pages may be **independent static documents**, so the `src/main.tsx` React SPA initializer must **not** load on those documents unless client route/hydration behavior is explicitly implemented and tested. Otherwise it can replace the static article with a 404.
- If embedding shared React header/footer in prebuilt HTML, verify the mobile menu and navigation interactions; do not assume static markup alone preserves hooks.
- Direct visit, refresh, canonical URL normalization, article texts and assets must work without client-side JavaScript.
- Preserve a single `h1`, reading order, alt text, links, 320/390px responsive behavior, and 200% zoom.
- No arbitrary uploaded HTML/JS execution. Reject scripts, event attributes, iframes, unsupported dynamic dependencies and unsafe SVG/URLs before publishing.
- Same article id/slug, with revision check, must update in place without creating a second post.
- Keep the existing AU order, auth, Appwrite schema, and Functions unchanged.

### Why defer Appwrite

**Bucket stores files; DB stores metadata.** A bucket HTML file is not automatically a canonical website route or SEO-ready article. DB-driven articles need an additional rendering strategy (server HTML, a build-triggered static snapshot, or a Worker), cache invalidation, access control and operational recovery. It would add a runtime dependency to the self-hosted Appwrite stack, which the initial static journal does not need.

Use the existing Cloudflare Pages asset delivery for compressed images while within the site's capacity. Cloudflare Pages docs as of Sep 2026 list 20,000 files per Free site and a 25 MiB per-asset limit. Keep originals outside the public deployment and generate appropriate WebP variants.

### When Appwrite is worth adding

Add a **dedicated Journal** Appwrite project/table/bucket (separate from reservation data) only when a real need appears:
1. Editor(s) must publish, unpublish or schedule from a browser without a Git/Pages build workflow.
2. Many articles and contributors need roles, approval queues, search/filtering and editorial analytics.
3. Media size/volume justifies separate asset storage and its operational overhead.

At that point: Store **metadata/status** in a `journal_posts` table and **approved versioned media/export packages** in a `journal_assets` bucket. A server-side publish job should validate and render static snapshots, or serve fully-rendered HTML with a suitable cache. Do not put large raw HTML blobs into arbitrary DB string columns and run them in a user's browser. Use permission gates: private drafts not publicly readable, public assets only after explicit approval, write permissions never available to anonymous users. Appwrite docs confirm per-resource access controls and separate DB/file storage.

### Publication flow

1. Pencil author finishes an editorial design and exports **HTML+CSS with asset references**.
2. Importer accepts the whole export bundle, resolves all images in batch, creates a preview and a report (missing assets / CSS / external links / browser behavior / SEO).
3. User approves the desktop and mobile preview.
4. A Git content update triggers the Cloudflare Pages build. The build produces index+article static pages and feed/sitemap; if build fails, previous production remains.
5. Edits happen in the same Pencil design; re-export and re-import at the same id/slug.
6. No article should require hand-creating a React route or manually re-uploading photos once the importer is built.

**First validation still requires an actual Pencil export**. An invented sample HTML page must not be claimed as verified compatibility. Check current AU tree/deploy configuration before coding.

## References

- [Pencil HTML + CSS export](https://docs.pencil.dev/core-concepts/import-and-export)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Appwrite databases](https://appwrite.io/docs/products/databases)
- [Appwrite Storage](https://appwrite.io/docs/products/storage/buckets)
- [Appwrite permissions](https://appwrite.io/docs/advanced/security/permissions)
