# AU Product Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Apply the nine approved AU product-detail designs locally without changing commerce or KR behavior.

**Architecture:** Share the Pavé gallery/editorial layout through a product presentation configuration. Keep existing CakeDetailPage and AuChocolatePage purchase handlers and state; presentation does not calculate prices or construct new commerce contracts. Bento remains a non-purchasable preview.

**Tech Stack:** React, TypeScript, CSS Grid/Flex, native IntersectionObserver, Sharp at build time, Node test runner, browser QA.

**Spec:** John's October 7 request; read-only Pencil `au-cake-frontend-polish/design/au-site-redesign.pen` (18 frames).

## Global Constraints

- Protected frontend-polish worktree and Google Drive originals are read-only.
- Production catalogue/route/pricing helpers override stale Pencil purchase examples.
- Desktop photographs and narrative order are shared with Mobile; Mobile composition stays responsive.
- No backend, Appwrite, schema, pricing, SKU, payload, package, main push or production deployment changes.
- Work Sans headings; SUIT descriptive text. Reduced-motion remains static.
- Video without a supplied source is a finished still-photo section, with no development labels.

## Review Focus

- Repeated image basenames must resolve to the right product, not another product's hero.
- Almond six pack and Black Tub retain their distinct SKUs and coupon behavior.
- S’more remains on its existing route with its unbounded quantity and bulk pricing.
- Mobile does not inherit old Pavé photos from duplicated Pencil frames.
- Bento cannot acquire a purchase CTA or invented launch date/packaging promise.

### Task 1: Source and asset mapping

**Files:** `src/lib/au-detail-presentation.ts`, `scripts/optimize-au-detail-images.mjs`, `public/products/details/`, `tests/au-detail-images.test.mjs`, `tests/phase1-market-boundary.test.mjs`.

**Interfaces:** Presentation contains layout/content/assets only. Image manifest records source, SHA-256, dimensions and generated sizes; no prices.

- [x] Read all eighteen Pencil frames and inventory readable Drive originals.
- [x] Verify source identity against Pencil image files by SHA-256, including renamed Strawberry/S’more files.
- [x] Add failing tests for nine configurations, source identity, optional sections, no stale photos and no pricing data.
- [x] Implement mappings and generate necessary WebP widths from originals with alpha preserved.
- [x] Run mapping tests and inspect matching source photographs.

### Task 2: Shared presentation and commerce integration

**Files:** `src/components/AuDetailGallery.tsx`, `src/components/AuDetailStory.tsx`, `src/CakeDetailPage.tsx`, `src/pages/AuChocolatePage.tsx`, `src/styles/au-detail-presentation.css`, `src/index.css`.

**Interfaces:** `AuDetailGallery({presentation})` owns photographs only; `AuDetailStory({presentation,detail,editorial,language,onOpenCake})` owns editorial sections only. Existing purchase controls/state/handlers remain their source of truth.

- [x] Add failing rendered-page tests for all AU templates, existing commerce controls, Bento unavailable state, and KR unchanged output.
- [x] Implement reusable gallery, story, finish editions, video poster slot, practical details and catalogue-derived related cards.
- [x] Connect Cake and Almond presentation without altering purchase functions, quantity limits, prices or payloads.
- [x] Scope new CSS to AU detail roots; preserve existing Pavé, Home header/footer and SUIT/Work Sans split.
- [x] Run relevant tests and review copy against verified catalogue/editorial information.

### Task 3: Browser and regression verification

**Files:** `tests/au-product-details.browser.mjs`, local screenshots and `design-qa.md`.

- [x] Verify each page at 1440/834/390 for image order/loading/crop, overflow, related routes, and reduced motion.
- [x] Exercise real option/quantity/cart handlers locally, including S’more tiers, Almond variants and Bento unavailable behavior.
- [x] Run lint, AU/KR builds, full npm test, market boundary and diff check.
- [x] Report screenshots, mapping/optimization totals, copy changes and any unresolved facts; no merge/push/deploy.

Final evidence: `design-qa.md` and `docs/redesign/product-detail-implementation-20261007.md`. No commit/merge/push/deploy; local review candidate retained. Whole-branch read-only review found no important functional/KR defect. Follow-up review corrected mobile CTA access, S’more foreground asset and catalogue-derived related grouping.
