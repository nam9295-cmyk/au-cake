# FigCraft Journal import and first release

**Goal:** Publish the first owner-approved FigCraft article using the existing AU Pages deployment, preserving editable source in Drive and keeping future publication usable from a CLI.

**Authority:** Owner requested reviewing the completed FigCraft document and publishing the blog. Their later constraint rejects card registration/new usage-based services. Use existing Pages/Git integration; do not enable R2, create a subscription, wake rice, or change backend/production flags.

**Architecture:** Reuse FigCraft's real headless `inspect.code` export and the existing parsed Journal importer. A reusable adapter maps exported text/image layers to semantic HTML and merges the provided desktop/mobile/tablet/compact design styles into one responsive DOM. Metadata supplies explicit frame IDs, photograph alt text and product links. Native `.figcraft` remains private; only the approved HTML/CSS/optimized photo package enters public Git. Site publication uses the existing main → Pages build and its current AU/account settings.

## Work

- [x] Add failing tests for real export normalization (placeholder image paths, headings/links, responsive variant mapping, unsupported/different content). Implement the reusable FigCraft adapter and `journal:figcraft` command; allow honest FigCraft provenance in the existing importer.
- [x] Prepare the first native export privately, compare its rendered HTML to the native 1440/390/768/320 frames, verify original manuscript, actual photos, links, SEO and no-JS behavior. Fix conversion defects, not the original design.
- [x] Run Journal/full tests, lint, AU/KR builds sequentially. Obtain one independent code review; address substantive findings with regression tests.
- [ ] Recheck origin/main and the production Pages target/environment without changing settings. Publish only Journal changes and the first approved article; verify the actual deployment, public URLs, assets, metadata and unchanged order/account entry routes.
- [x] Document a card-free publishing workflow. A future explicit `publish` command may automate the existing Git push/build/check sequence; do not describe it as eliminating deployment, or claim a not-yet-implemented command exists.

## Release observations

- Read-only Cloudflare check: existing `au-cake-next`, GitHub `au-cake`, production `main`, `npm run build` → `dist`, `VITE_MARKET=AU`, `VITE_CUSTOMER_ACCOUNT_ENABLED=true`, current release commit `47730d4`. Preserve these values.
- Native FigCraft 0.12.1 headless import/render succeeded; 3 embedded photos, no missing fonts, desktop/mobile/tablet/320px frames. The raw HTML export contains generic paragraphs and repeated `url(image.png)` references, so it is not itself ready to publish.
- The owner requested publication; do not infer a Jenny fact-review credit or invent a byline. Do not publish the other four drafts, private native source, local state, raw diagnostic logs or credentials.
