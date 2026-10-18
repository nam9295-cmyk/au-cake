# Customer cart isolation — local validation

Date: 2026-10-18. Worktree: `au-cake-customer-account`; branch: `feat/customer-account`.

## Product behavior

- Both existing cake and Renewal carts use the verified Appwrite UID. Guest, G and H have independent browser storage. The original common keys remain Guest base data; they are never copied to the first member automatically.
- Login selects that member's cart; logout selects Guest. Authentication checking hides/locks cart data. Failed authentication returns to the independent Guest cart. No member's cart is erased by either transition.
- An explicit EN/KO **Import guest bag** action adds the Guest items to the current member. The Guest source remains intact; repeating the same import does not duplicate it.
- CartProvider now sits inside CustomerAccountProvider. Owner/epoch tickets and the existing random auth-notice key reject stale callbacks and other-tab auth transitions, including before a delayed storage event arrives.
- Cart actions are stored under unique owner-scoped event keys and folded deterministically. Concurrent tabs cannot overwrite a shared snapshot. Existing cart normalization, pricing, mochi, addon and submitted-quantity helpers remain in use. Storage failures retain existing goods and show an error; no compaction or automatic history deletion is performed.
- Cart records contain product selections only. UID is a storage namespace, never server authorization. Profile fields, login email, JWT and session credentials are not stored in cart records.
- Checkout capture/signature/resume is owner-scoped. Another member's draft cannot populate the form. Guest OAuth keeps the form, options, consent and requestId without transferring Guest products. Cart changes require review; callback routing neither consumes the draft nor calls Function readiness. A same-UID focus recheck preserves the form and valid completion; a real owner change invalidates old completion callbacks.

## Verification

- Focused real store/provider/Checkout tests: **26 PASS, 0 FAIL**. Includes G → logout → H → logout → G, Guest, refresh, both common keys, explicit import, mochi/addons, quantities/removal, interleaved tabs, auth failure/checking, stale async completion, save failure, scoped signatures and OAuth callback.
- Existing cart UI/provider/multiline contract tests: **19 PASS, 0 FAIL**. Assertions now require the owner-scoped provider and owner-plus-session form key; existing handoff, capability, pricing and submitted-quantity checks remain.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- ESLint: PASS (`npm run lint`, exit 0, no diagnostics).
- Full `npm test`: **2,128 PASS, 0 FAIL, 1 existing SKIP**, exit 0. Baseline was 2,110 PASS/1 SKIP; 18 new cases were added. No existing test was deleted. All 69 reported test groups completed.
- Final AU build: PASS (`VITE_MARKET=AU npm run build`, exit 0). Existing large-chunk warnings remain; 47 SEO pages and 25 sitemap URLs were generated.
- Changed-file credential scan: 0 findings; known protected Owner credential checked in memory only, no secret values or process argument lists printed.

The first full attempt found that temporary artifact builders copy only Git-tracked source files; staging the new product modules corrected those missing imports. A subsequent existing source-contract assertion expected only the old session key; it now requires both the original session counter and cart owner. Failed runs remain in ignored local evidence, with no test deletion.

## Deployment boundary and remaining acceptance

Read-only official Owner GET and actual HTTPS/API check at `2026-10-18T12:58:50Z` confirmed the existing **OPEN14** site, test Account ON, Function disabled/execute empty/B6 active and all three write flags false. Function metadata/settings/variables/execution inventory matched the pre-existing protected baseline. Account API returned unauthenticated 401; the site served its current app. No remote write or deployment was performed for this change.

The deployed site still contains the **previous shared-cart code**. Pages usage is 14; slot 15 is reserved exclusively for CLOSED restoration. There is **no approved new OPEN slot**, so this product change must not consume CLOSED15 and is **not deployed**. The existing manual monitor and explicit user-close path are unchanged; no timed window was added.

After a separately authorized test deployment, the user must verify in one Chrome profile: Guest items remain Guest; G adds an item; logout shows Guest; H sees no G items and adds a different item; G returns to only G items; refresh and a second tab retain the correct owner. Also verify explicit Guest import and OAuth return with the existing form. New-build live Google/cart acceptance is **NOT RUN**. No actual order, payment, coupon or email is required.

No Appwrite schema/ACL/Function, production resource, product/price/coupon policy or main change is included. No DB, order, payment or email was created.

**B5 — DEFERRED — RELEASE BLOCKER.** Historical operating AU raw fingerprint discrepancy: **UNVERIFIED**. This cart change does not resolve either release condition.
