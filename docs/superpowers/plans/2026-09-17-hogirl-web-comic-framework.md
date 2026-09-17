# HOGIRL Web Comic Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy, static-SEO-ready HOGIRL reader framework without publishing unaudited Season 1 material or affecting the homepage entry bundle.

**Architecture:** The eager application router recognizes only the HOGIRL URL family. A lazy HOGIRL application owns its content loading, reader UI, and runtime SEO. Production content starts empty; a clearly marked test-only fixture exercises generated direct-access routes without entering production output, indexing, or the sitemap.

**Tech Stack:** React 19, TypeScript, Vite 8, Node test runner, existing static SEO generator, Cloudflare Pages static output.

**Spec:** User-approved HOGIRL architecture audit and implementation adjustments, 2026-09-17.

## Global Constraints

- Do not modify Appwrite, reservation, order, review, database, or admin logic.
- Do not publish or index invented Season 1 story copy, captions, or artwork.
- V1 published locales are `en` and `ko` only; future locale files/routes exist only after explicit publication.
- HOGIRL images must remain external CDN URLs; do not emit artwork through Vite.
- Source dimensions are authoritative; default responsive widths are 540w, 720w, and 1080w without upscaling.
- A dedicated social crop is optional; the designated episode artwork is the V1 OG fallback.
- Direct access must have generated static route artifacts. No global SPA fallback may be added.
- HOGIRL code, captions, media URLs, and CSS must be absent from the homepage entry bundle.
- Do not deploy, merge, or publish production HOGIRL content in this change.

---

### Task 1: Add pure HOGIRL route recognition and lazy route boundary

**Files:**
- Create: `src/stories/hogirl/routes.ts`
- Create: `src/stories/hogirl/HogirlApp.tsx`
- Modify: `src/lib/app-routes.ts`
- Modify: `src/App.tsx`
- Test: `tests/app-routes.test.ts`
- Test: `tests/app-private-lazy-routes-contract.test.mjs`

- [ ] Write route expectations for unprefixed English and `/ko` HOGIRL URLs.
- [ ] Verify they fail against the current router.
- [ ] Implement a pure path parser with no episode-content imports.
- [ ] Add one public React.lazy boundary and ensure `App` skips generic runtime SEO/analytics for HOGIRL.
- [ ] Re-run route and lazy-boundary tests.

### Task 2: Add content contracts, lazy loaders, and fixture isolation

**Files:**
- Create: `src/content/hogirl/series.json`
- Create: `src/stories/hogirl/types.ts`
- Create: `src/stories/hogirl/loaders.ts`
- Create: `src/stories/hogirl/media.ts`
- Create: `src/stories/hogirl/fixture.ts`
- Create: `tests/fixtures/hogirl/demo-season-01.json`
- Test: `tests/hogirl-content.test.mjs`

- [ ] Write validation tests for actual source dimensions, non-upscaling source sets, optional social crop fallback, and no unpublished locale output.
- [ ] Verify the tests fail before the contracts/loaders exist.
- [ ] Implement empty production catalogue plus a test-only fixture source.
- [ ] Implement dynamic, non-eager loader maps and media URL helpers.
- [ ] Re-run content tests.

### Task 3: Build the lazy vertical reader shell

**Files:**
- Create: `src/stories/hogirl/HogirlReader.tsx`
- Create: `src/stories/hogirl/HogirlLandingPage.tsx`
- Create: `src/stories/hogirl/HogirlSeasonPage.tsx`
- Create: `src/stories/hogirl/HogirlEpisodePage.tsx`
- Create: `src/styles/hogirl.css`
- Test: `tests/hogirl-reader-contract.test.mjs`

- [ ] Write a reader contract for semantic panels, visible captions, eager/high-priority first image, lazy following images, and dimensions.
- [ ] Verify it fails.
- [ ] Implement the responsive vertical reader and an explicit unpublished/fixture state.
- [ ] Import HOGIRL CSS only from the lazy entry.
- [ ] Re-run reader tests.

### Task 4: Extend static/runtime SEO without publishing fixture content

**Files:**
- Create: `scripts/hogirl-seo.mjs`
- Create: `src/stories/hogirl/seo.ts`
- Modify: `src/lib/seo.ts`
- Modify: `scripts/generate-seo-pages.mjs`
- Modify: `scripts/render-au-llms.mjs`
- Test: `tests/hogirl-seo-generator.test.mjs`

- [ ] Write a generator test that explicitly enables the fixture and requests all direct route paths over local static HTTP.
- [ ] Verify it fails before HOGIRL generator support exists.
- [ ] Implement directory-style artifacts, canonical/hreflang/JSON-LD/fallback HTML, and runtime SEO ownership.
- [ ] Ensure default production generation excludes fixtures from pages, sitemap, and llms output.
- [ ] Re-run generator/direct-access tests.

### Task 5: Prove the homepage boundary and run integrated verification

**Files:**
- Create: `tests/hogirl-performance-contract.test.mjs`
- Modify: `package.json`
- Modify: existing targeted test runners as required

- [ ] Write a build test that reads Vite output and proves the homepage entry omits HOGIRL captions, media URLs, and lazy CSS.
- [ ] Verify it fails before the implementation is complete.
- [ ] Run targeted tests, production build, fixture build, generated-artifact requests, lint, and the full relevant AU suite.
- [ ] Report evidence, changed files, chunk comparison, direct-route results, and the external content inputs still needed.
