# Public Review Browser Implementation Plan

> **For Hermes:** Implement task-by-task with strict RED-GREEN-REFACTOR and verify production behavior before deleting the test review.

**Goal:** Keep the homepage review showcase compact while letting customers browse every approved review and open full photos and complete review text in an accessible desktop dialog or mobile full-screen view.

**Architecture:** Extend the existing `list-public` Review API action into a cursor-paginated, strict public page response. Keep approved photo files private until publication, expose a transformed thumbnail URL plus full-photo URL only for photo-consented published reviews, and reuse one card/dialog component in the homepage showcase and `/reviews` archive. The homepage requests three reviews and shows `View all reviews` only when more exist; `/reviews` requests six at a time and appends via cursor.

**Tech Stack:** React 19, TypeScript, Vite, Appwrite Functions/Databases/Storage, native browser history and focus management, CSS, node:test.

---

### Task 1: Public pagination and image DTO contract

**Objective:** Return strict cursor pages with public review IDs, thumbnail URLs, full-photo URLs, and `hasMore` without exposing reservation/customer/coupon fields.

**Files:**
- Modify: `functions/review-api/src/business.js`
- Modify: `functions/review-api/src/main.js`
- Modify: `tests/review-api.test.mjs`
- Modify: `tests/review-photo-api.test.mjs`

**TDD steps:**
1. Add failing tests for limits 1-6, opaque cursor validation, `limit + 1` lookahead, stable next cursor, and strict public IDs.
2. Add failing tests for separate Appwrite `/preview` thumbnail and `/view` detail URLs.
3. Run focused Review API tests and confirm expected failures.
4. Implement the minimal repository/service/url-builder changes.
5. Run focused tests and refactor only while green.

### Task 2: Enable safe image transformations

**Objective:** Allow Appwrite to generate thumbnails for already-public, photo-consented review files while preserving file-level security.

**Files:**
- Modify: `scripts/review-schema.mjs`
- Modify: `tests/review-schema.test.mjs`

**TDD steps:**
1. Change the schema expectation to require transformations and confirm RED.
2. Enable bucket transformations without changing bucket-level public permissions.
3. Run schema tests, dry-run, apply, and verify an unauthenticated approved thumbnail returns WebP while pending/hidden files remain inaccessible.

### Task 3: Strict frontend public review pages

**Objective:** Parse and execute the new paginated public response fail-closed.

**Files:**
- Modify: `src/lib/public-reviews.ts`
- Modify: `src/lib/public-reviews-demo.ts`
- Modify: `tests/public-reviews.test.ts`

**TDD steps:**
1. Add failing tests for the exact page envelope, public IDs, both trusted URLs, cursor requests, and rejected extra fields/origins.
2. Implement page payload/parser/executor helpers.
3. Preserve a three-review homepage helper and add a six-review archive helper.
4. Run `npm run test:reviews` and keep demo fixtures development-only.

### Task 4: Shared compact card and accessible detail dialog

**Objective:** Make cards concise and open full review/photo content with keyboard, focus, history, and scroll-lock behavior.

**Files:**
- Create: `src/PublicReviewCard.tsx`
- Create: `src/PublicReviewDialog.tsx`
- Create: `src/lib/public-review-dialog.ts`
- Modify: `src/PublicReviewsSection.tsx`
- Modify: `src/index.css`
- Modify: `tests/public-reviews-component.test.mjs`
- Create: `tests/public-review-dialog.test.ts`

**TDD steps:**
1. Add failing pure tests for dialog history URLs and previous/next selection.
2. Add failing component contract tests for a real card button, three-line excerpt, dialog semantics, Escape, focus restore, body scroll lock, and no autoplay.
3. Implement shared cards and a portal-based dialog.
4. Desktop: max 960px, full uncropped image, content column, previous/next.
5. Mobile below 768px: fixed 100dvh detail screen, sticky close, safe-area spacing.
6. Run focused tests and build.

### Task 5: `/reviews` archive and homepage handoff

**Objective:** Add a public archive with six-at-a-time cursor loading while keeping homepage sections at three.

**Files:**
- Create: `src/ReviewsArchive.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/app-routes.ts`
- Modify: `src/lib/seo.ts`
- Modify: `scripts/generate-seo-pages.mjs`
- Modify: `src/index.css`
- Modify: `tests/review-isolation.test.mjs`
- Modify: `tests/public-reviews-component.test.mjs`

**TDD steps:**
1. Add failing route/SEO/component tests for `/reviews`.
2. Implement the public route, header, archive state, retry state, and cursor append.
3. Add `View all reviews` only when homepage `hasMore` is true.
4. Keep archive mobile layout single-column and homepage mobile layout native horizontal scroll-snap.
5. Do not add filters, search, custom zoom, autoplay, or review structured-rating markup.

### Task 6: Verification and rollout

**Objective:** Prove the complete approved-review browsing flow locally and in production.

**Verification:**
1. Run focused review/client/API/schema tests.
2. Run full `npm test`, `npm run lint`, AU production build, audits, demo leakage scan, and `git diff --check`.
3. Check desktop dialog behavior and 320px/360px mobile full-screen behavior in-browser.
4. Deploy schema first, then Review API, then commit/push frontend.
5. Verify production `/`, `/classes`, and `/reviews`; confirm card thumbnails and full images return 200 and browser console has no errors.
6. Keep the current internal test review until john confirms the final UI. Delete test invite/review/coupon/photo only after explicit approval.
