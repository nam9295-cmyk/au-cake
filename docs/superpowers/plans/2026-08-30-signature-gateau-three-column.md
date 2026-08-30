# Signature Gâteau Desktop Three-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Penpot desktop three-column purchase layout only to Signature Gâteau au Chocolat while preserving the current tablet, mobile, and other-cake layouts.

**Architecture:** Keep the shared `CakeDetailPage` and add one product-scoped layout class for `detail.id === 'signature-gateau'`. Split the purchase markup into configurator and checkout wrappers so desktop CSS can place gallery, options, and checkout in separate columns without duplicating state or changing the order flow.

**Tech Stack:** React 19, TypeScript 6, Vite 8, shared CSS, Node test runner contract tests.

**Spec:** Penpot board `AU Cake · Desktop 3-column layout · 2026-08-30` (`b8f47740-b341-802f-8008-8f92673d4a95`) in file `dfb31d12-cc0a-8037-8008-8f880a08662a`.

## Global Constraints

- Scope three columns to `signature-gateau` and `min-width: 1200px` only.
- Keep the existing two-column tablet and one-column mobile layout.
- Preserve DOM order: gallery, configuration, checkout.
- Keep gallery images unchanged; use vertical thumbnails only on desktop.
- Keep the finish preview at 112 × 88 px and Chocolate Extras in a 2 × 2 desktop grid.
- Keep quantity, selected options, total, CTA, and ordering notice in a sticky checkout column.
- Add no internal scroll, dependency, gradient, large radius, or decorative shadow.

---

### Task 1: Add the Signature Gâteau layout contract

**Files:**
- Modify: `tests/cake-detail-component.test.mjs`

**Interfaces:**
- Consumes: `src/CakeDetailPage.tsx` and `src/index.css` as text fixtures.
- Produces: a regression contract for product scoping, DOM order, the 1200 px breakpoint, vertical thumbnails, 2 × 2 extras, and sticky checkout.

- [ ] **Step 1: Write the failing test**

```js
test('Signature Gâteau alone uses the approved three-column desktop purchase layout', () => {
  assert.match(detailSource, /const usesSignatureDesktopLayout = detail\.id === 'signature-gateau'/)
  assert.match(detailSource, /cake-detail-gallery[\s\S]*cake-detail-configurator[\s\S]*cake-detail-checkout/)
  assert.match(detailSource, /is-signature-three-column/)

  const desktopCss = cssSource.slice(cssSource.indexOf('@media (min-width: 1200px)'))
  assert.match(desktopCss, /\.cake-detail-hero\.is-signature-three-column\s*\{[^}]*grid-template-columns:[^}]*minmax\(0, 1fr\)[^}]*minmax\(380px, 0\.82fr\)[^}]*minmax\(300px, 0\.62fr\)/s)
  assert.match(desktopCss, /\.is-signature-three-column \.cake-detail-thumbnails\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(desktopCss, /\.is-signature-three-column \.cake-detail-options\.is-stacked\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(desktopCss, /\.is-signature-three-column \.cake-detail-checkout\s*\{[^}]*position:\s*sticky[^}]*top:\s*72px/s)
})
```

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/cake-detail-component.test.mjs`

Expected: FAIL because the product flag and desktop selectors do not exist.

### Task 2: Add configurator and checkout wrappers

**Files:**
- Modify: `src/CakeDetailPage.tsx`
- Test: `tests/cake-detail-component.test.mjs`

**Interfaces:**
- Consumes: existing `CakeDetailSelection`, option controls, price calculation, and callbacks.
- Produces: `usesSignatureDesktopLayout`, `cake-detail-configurator`, `cake-detail-checkout`, and `cake-detail-checkout-card`.

- [ ] **Step 1: Add the product-scoped flag**

```tsx
const usesSignatureDesktopLayout = detail.id === 'signature-gateau'
```

- [ ] **Step 2: Group the existing content without changing its order**

```tsx
<section className={`cake-detail-hero${usesSignatureDesktopLayout ? ' is-signature-three-column' : ''}`}>
  <div className="cake-detail-gallery">{/* unchanged gallery */}</div>
  <aside className="cake-detail-purchase">
    <div className="cake-detail-configurator">{/* title, description, options */}</div>
    <div className="cake-detail-checkout">
      <div className="cake-detail-checkout-card">{/* price, quantity, summary, CTA */}</div>
      {/* existing ordering notice */}
    </div>
  </aside>
</section>
```

- [ ] **Step 3: Add a desktop-only selected-option summary**

```tsx
<div className="cake-detail-order-options">
  <span>{selectedFinishOption.label}</span>
  <span>{language === 'ko' ? selectedChocolateExtra.labelKo : selectedChocolateExtra.label}</span>
</div>
```

Hide this summary below 1200 px so mobile remains visually unchanged.

### Task 3: Implement the approved desktop CSS

**Files:**
- Modify: `src/index.css`
- Test: `tests/cake-detail-component.test.mjs`

**Interfaces:**
- Consumes: Task 2 wrapper classes and existing AU Cake tokens.
- Produces: gallery/configurator/checkout desktop columns with unchanged fallbacks.

- [ ] **Step 1: Add the 1200 px layout**

```css
@media (min-width: 1200px) {
  .cake-detail-hero.is-signature-three-column {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 0.82fr) minmax(300px, 0.62fr);
  }

  .is-signature-three-column .cake-detail-purchase { display: contents; }
  .is-signature-three-column .cake-detail-checkout { position: sticky; top: 72px; }
}
```

- [ ] **Step 2: Compact the gallery**

Use a 72 px vertical thumbnail rail plus the unchanged main image and cap the main image around 600 px.

- [ ] **Step 3: Match the approved option density**

Keep the 112 × 88 preview, use two columns for Chocolate Extras, tighten fieldset spacing, and use a simple bordered AU forest checkout card.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `node --test tests/cake-detail-component.test.mjs`

Expected: PASS.

### Task 4: Verify and record the design comparison

**Files:**
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: the Penpot source board and browser-rendered Signature Gâteau route.
- Produces: fresh desktop/mobile evidence with `final result: passed` or a blocking report.

- [ ] **Step 1: Run automated verification**

```bash
npm run test:cake
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify the browser flow**

At 1440 × 900, test the three columns, thumbnails, finish/extra selections, summary, sticky checkout, CTA, and console. At 390 px, confirm the existing mobile order remains unchanged.

- [ ] **Step 3: Compare source and implementation**

Capture both at the same state, combine them into one comparison image, fix P0/P1/P2 differences, and update `design-qa.md`.

- [ ] **Step 4: Commit the verified slice**

```bash
git add docs/superpowers/plans/2026-08-30-signature-gateau-three-column.md tests/cake-detail-component.test.mjs src/CakeDetailPage.tsx src/index.css design-qa.md
git commit -m "feat: add signature gateau desktop purchase layout"
```
