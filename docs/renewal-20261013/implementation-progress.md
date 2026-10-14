# Local implementation ledger — 2026-10-14

Authority: latest user instruction and public-decisions-20261014.md plus the latest user instruction, then v0.7.
Base: 079083664e8919a2d65abb347010766106633b95. Branch: codex/au-renewal-20261014.
Initial phase: no deployment, remote writes, real notifications, commits or private recipe publication. The latest user instruction authorizes reviewed local commits; deployment restrictions remain.

## Tasks
1. Shared offer contract, pure pricing, pickup policy and negative tests.
2. Versioned persistence/readers, API gate and operational projections.
3. Existing AU shell with 5/4/3 categories, product selections, cart and reservation.
4. Reconcile v0.7 documents/fixtures, integration tests, AU/KR builds and mobile QA.

Ruling: Work in the existing checkout on a local feature branch; no new worktree/clone. This follows the user's preserved-work requirement.
Ruling: Keep provisional prices available only to local preview/pure tests. Runtime new-order writes require explicit server enablement and never accept provisional offers. Wrong assumption cost: provisional products remain unavailable in production until separately approved.
Superseded initial ruling (D02 now resolved): Weekend slots were excluded from the default renewal operational policy until approved; tests can explicitly supply the proposed weekend schedule. Existing historical/Custom/Class policies remain unchanged. Wrong assumption cost: weekend launch slots need the pending operational decision.

Tasks 1–4: local implementation and verification complete. Release gates remain as listed below.

## Current evidence
- Task 1/2: 2026-10-14 `npm run test:renewal` passed 19 tests (16 Node contract/API/operational + 3 bundled cart/admin/lookup/CSV/SMS render tests). No transports invoked.
- Task 3: AU build and lint passed. Playwright Chromium 390×844, external requests blocked; explicit one-each signature transition stored signature at3500c, cart submission disabled. Full regression and final independent review in progress.
- Task 4: v0.7 main/FE/BE/QA/start/change/fixture documents reconciled with latest decisions. Original ZIP and reference images preserved.

## Deployment plan — NOT executed
1. Verify target AU project/environment, schema limits for version2 JSON and productId, export/backup existing documents and record current Function/Pages IDs. Do not use KR resources.
2. Deploy compatible version1+version2 readers in notification/reminder/reservation API and admin first. Shared artifact manifests include renewal core/reader dependencies. Keep writes closed.
3. Deploy API writer and health flags, still false. Do not deploy pending prices as approved prices; a later price approval requires a new policy version, preserving this version's historical decoder.
4. Deploy matching AU frontend/static SEO, smoke-test with isolated fixtures; verify Custom Cake/KR read compatibility. Confirm cookie price, provisional prices, real photos/allergens, physical device checks.
5. After separate approval, enable AU_RENEWAL_WRITES_ENABLED to cut over general new orders. Legacy create-cake new writes then reject; already stored requests replay first. Custom Cake APIs are separate.
6. On Sydney 2026-10-19 the operator may manually enable AU_RENEWAL_PREORDERS_ENABLED after readiness checks; no exact hour is assumed. D02 is resolved; AU_RENEWAL_WEEKEND_APPROVED no longer controls the approved schedule. No flags were changed in this session.

Rollback: stop new renewal writes first and retain all version2 readers/operational output. Never roll notification/reminder/admin back to readers that reject already stored version2 orders. Restore a compatible frontend/API deployment checkpoint; do not rewrite old prices, assign sizes to old orders, delete records, or automatically cancel reservations. Current flags are proposed deployment controls, not an operational rollout record.

## Pending, not failed implementation
Cookie sale price; production approval of provisional brownie prices; manual opening timing/readiness; final photos/allergens/storage guidance; physical phone QA; actual Appwrite schema/deployment compatibility in the target environment. No live DB inspection or mutation was performed.

## Independent review and fix evidence
The executing-plans skill required one fresh reviewer (gpt-6-astra). It reviewed the uncommitted working tree, including untracked files; no second review or implementation agents were used.
- Final: fixed strict identifier/enum types. Array-coerced offerId could bypass preorder policy and array-coerced size could bypass provisional price detection. `string field coercion cannot bypass provisional or preorder policy boundaries` RED→GREEN.
- Final: fixed trailing slash hydration. Catalog test RED→GREEN and browser direct loads `/celebrate/`, `/cakes/levain-cookies/`, `/chocolates/chocolate-mochi/` render their proper headings.
- Final: fixed operational parent association. `each operational line names its stable ID...` RED→GREEN; extras reference the ID printed on the parent, preserving unambiguous matching across repeated cake types.
- Final: Ruling: reviewer classified editable pending contact fields as Minor; treated as Important because a retry could conflict with its original request fingerprint. Pending fields now freeze; delayed MOCK response browser evidence changed `nameDisabled:false` to `true` while submit remains disabled. No real create call was transmitted. Cost if wrong: the user must wait for completion before editing.
- Previous deferred minor resolved by the latest user approval: common frontend copy and weekend slots now derive from the same approved schedule.
- Final: Ruling: review set live schema/deployment, flags, pending price approval, physical devices and final photos/allergens aside. They remain explicit release gates, not claimed verified. Cost if omitted: production could reject valid orders or display incomplete product/operating information; therefore no rollout is authorized or performed here.
- Additional QA: footer overflow at390px reproduced (scrollWidth471); wrapped navigation links with44px targets. Browser recheck of home, three collections, brownie whole, brownie cupcakes, mochi, cart and two hubs: scrollWidth390 for all10 pages; card counts5/4/3.
- Additional QA: regenerated AU llms content from current cards and confirmed prices, preserving archived-class/HOGIRL navigation and excluding historical sale prices/provisional prices.


## Final verification — 2026-10-14
- `npm test`: exit0, full configured regression suite including new renewal suite, historical order compatibility, Custom Cake, admin/lookup/calendar/notification/reminder/artifact checks, AU/KR rendering boundaries. Runtime deploy tests are local artifact checks, not deployments.
- `npm run test:renewal`:23 tests (20Node+3bundled); includes8 executable document fixture cases inside the pricing test. Passing aggregate counts of repeated suites are not reported as unique tests.
- `npm run lint`, AU build, KR build, `git diff --check`: exit0. KR static check:2 passed/2AU-only skipped. AU dist regenerated last. Existing large-bundle warning remains; no build failures.
- Browser: Chromium390×844; 10 screens have no horizontal overflow, menu counts5/4/3; English/Korean language switch retains brownie8in selection; explicit mochi signature transition stored signature3500c; slash routes hydrate; delayed mocked create freezes contact and submit. Physical phones and external font delivery were not tested. All external requests blocked except synthetic execution responses fulfilled inside browser interception; no remote order or notification sent.
- Document arithmetic:45 current +5history examples checked separately;8 new confirmed/local-only executable cases. Reference hashes preserved. Updated checksums describe the revised local docs, not the original ZIP contents.
- Final branch retained: `codex/au-renewal-20261014`, HEAD remains079083664e8919a2d65abb347010766106633b95. No commit/push/merge/deploy/DB changes/live orders/payments/email/SMS. Existing checkout and original reference/ZIP files preserved.


## Pickup finalization and local stabilization — latest task

D02 resolved by final user/Jenny approval: Wednesday/Friday09–16, Saturday/Sunday09–12; Monday/Tuesday/Thursday closed. Australia/Sydney,15-minute intervals, closing slot included. No live environment variables or activation flags changed.

Implementation plan: preserve existing renewal → common approved policy + pure negative/DST tests → public/checkout/admin/lookup/receipt/SEO copy and selectors → saved-order invariance →390px browser QA → complete suite/AU/KR builds → inspect explicit stage allowlists and make three local commits.

Ruling: retire the obsolete weekend approval gate in code, while keeping health.weekendApproved=true as a compatibility field. Actual order/preorder flags remain default closed. The client verifies pickupPolicyVersion before submission. This ensures stale runtime approval data cannot redefine an approved schedule; operational closures can still use the existing closed-date/interval policy.

Ruling: frozen legacy pricing/pickup contracts and Custom Cake/Class preparation policies remain intact. New AU UI uses the renewal validator; historical lookups, reminders, PIN events and admin metadata saves keep stored appointment times. Admins retain existing operator authority to arrange exceptional handovers; customers receive only approved general slots.

Ruling: new-SKU product detail rendering had fallen back to Pavé for Brownie. Fixed the actual snapshot display in shared lookup/admin detail rows, with a failing then passing render test. No stored product or appointment data changed.

Public Git selection: reviewed sources/tests, approved heart-tin asset, and sanitized development documents only. Internal original research/manufacturing notes, recipe photos, reference originals, earlier plans and ZIPs remain local and ignored. Original files were not deleted.

Validation and commit evidence will be appended after final checks.


## Final pickup stabilization evidence

- D02 final: Wed/Fri09:00–16:00,Sat/Sun09:00–12:00; Mon/Tue/Thu general pickup closed, Sydney,15min including closing. The common policy generates frontend copy, slots, FAQ/SEO guidance and server service-time validation. No operating variables/flags were changed.
- Pickup files: `au-renewal-pickup-policy.js/.d.ts`, `au-renewal-pickup.js/.d.ts`, API health in `main.js`, `renewal-client.ts`, `AuPickupNotice.tsx`, `AuRenewalShop.tsx`, AU-guarded `i18n.ts`/`ReservePage.tsx`, `ReservationDrawer.tsx`, `CompletePage.tsx`/`LookupPage.tsx`, Home/common footer, `au-public-pages.json`, `au-renewal-seo.js`, regenerated llms/sitemap. Notification/Reminder/PIN consume stored appointment times; their outputs were tested without sending transports.
- Latest `npm run test:renewal`:35 passed (29Node+3bundled+3UI). Includes nine final pickup-policy tests, real-time24h/DST/closing/15min/closed weekdays, API weekend/replay, saved appointment outputs, shared copy, new SKU details and the actual versioned admin drawer.
- Latest `npm test`:exit0 across the configured full suite. `npm run lint`:exit0. AU and KR production builds completed; KR static exclusion2pass/2AU-onlyskip. AU regenerated last. `git diff --check` and staged whitespace checks passed. Existing large-bundle warnings remain.
- Fresh independent review found an AU-copy leak into KR. KR regression reproduced failure then passed after AU-only guards. `VITE_MARKET=KR node scripts/run-bundled-tests.mjs tests/market-boundary.test.ts`:6/6. The review also checked saved-time preservation, policy-version refusal and metadata-only versioned drawer behavior. No second review was dispatched.
- Final: minor (deferred): a checkout left open without any render does not automatically refresh time eligibility when the clock crosses a preparation/cutoff boundary. Reselecting a date or refreshing recalculates the list; the server always validates current receipt time. No invalid order can be accepted through this display limitation.
- Review limitations were explicitly addressed: staged filenames/blob credential scans completed locally; private originals excluded without reading recipes; live schema/permissions/deployment, physical devices and real payments/notifications remain unverified release gates.
- Mobile Chromium390×844:Home/Header/mobile menu, collections5/4/3, Brownie whole/loaf/cupcakes,Mochi andCart verified. Nine pages had scrollWidth390; menu open/close checked. Explicit signature conversion and quantity+packaging49.50 remained distinct cart contracts. No chat/submit overlap in checked viewport; full/viewport screenshots saved locally under output/playwright/final-*.png (ignored).
- Local browser clock fixture Fri2026-10-23 11:00 Sydney, mocked health only:Saturday24th slots11:00–12:00(5),Sunday25th09:00–12:00(13),Monday/Tuesday/Thursday0,Wednesday/Friday09:00–16:00(29).Saturday12:00 selection retained in English/Korean. All create actions were blocked; no real order/payment/email/SMS was sent.
- Public-file audit: source/test/dev-document allowlists, no credential-pattern findings. Approved heart-tin photograph visually checked. Internal originals/reference/ZIP/R&D remain local and ignored, not deleted.

## Latest local commits

- `b64fcee`: versioned pricing/storage/API/operational readers and approved pickup policy;26 explicit files.
- `eee4b4a`: storefront/cart/shared pickup copy/receipt/lookup/admin/SEO and regression tests;49 explicit files.
- Documentation/privacy allowlist commit follows these two; its hash is available in `git log -1`. No push or merge.

## Remaining release items and sequence

Cookie sale price remains null. Brownie whole8/10=115/155 and cupcake6=36/42,12=66/78 remain local-only provisional prices; server writes reject them until separately approved/versioned. Final photos/allergens/storage guidance and physical device checks remain pending. New-product opening hour remains unset; no automatic activation.

Future rollout needs separate approval: (1) confirm AU target resources/schema/permissions and backup checkpoints; (2) compatible v1+v2 readers and notification/reminder/admin first, writes closed; (3) API writer+matching pickup-policy health, writes/preorders still closed; (4) matching AU frontend/SEO and isolated smoke checks, verify KR/Custom/Class; (5) separately activate confirmed general offers; (6) operator manually opens eligible cookie/mochi on SydneyOct19 when ready, with no assumed hour. The obsolete weekend approval variable needs no edit and is no longer a schedule gate. Cookie/provisional offers can stay blocked while confirmed offers proceed.

Rollback stops renewal writes first and keeps v2 readers/operational output. Restore a compatible frontend/API checkpoint; do not reprice, reschedule, delete or automatically cancel stored orders. No production deployment, remote writes or transports took place during this task.
