# Local implementation ledger — 2026-10-15 (history retained)

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
2. Deploy compatible September storage v1 and renewal storage v2 readers (renewal price contracts v1+v2) in notification/reminder/reservation API and admin first. Shared artifact manifests include renewal core/reader dependencies. Keep writes closed.
3. Deploy API writer and health flags, still false. Do not deploy pending prices as approved prices; a later price approval requires a new policy version, preserving this version's historical decoder.
4. Deploy matching AU frontend/static SEO, smoke-test with isolated fixtures; verify Custom Cake/KR read compatibility. Confirm cookie price, provisional cupcake prices, real photos/allergens, physical device checks.
5. After separate approval, enable AU_RENEWAL_WRITES_ENABLED to cut over general new orders. Legacy create-cake new writes then reject; already stored requests replay first. Custom Cake APIs are separate.
6. On Sydney 2026-10-19 the operator may manually enable AU_RENEWAL_PREORDERS_ENABLED after readiness checks; no exact hour is assumed. D02 is resolved; AU_RENEWAL_WEEKEND_APPROVED no longer controls the approved schedule. No flags were changed in this session.

Rollback: stop new renewal writes first and retain all version2 readers/operational output. Never roll notification/reminder/admin back to readers that reject already stored version2 orders. Restore a compatible frontend/API deployment checkpoint; do not rewrite old prices, assign sizes to old orders, delete records, or automatically cancel reservations. Current flags are proposed deployment controls, not an operational rollout record.

## Pending, not failed implementation
Cookie sale price; production approval of provisional brownie cupcake prices; manual opening timing/readiness; final photos/allergens/storage guidance; physical phone QA; actual Appwrite schema/deployment compatibility in the target environment. No live DB inspection or mutation was performed.

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

Cookie sale price remains null. Brownie whole6/8/10=82/117/168 is user-confirmed on 2026-10-15 (D09 resolved). Cupcake6=36/42,12=66/78 remains local-only provisional pricing; server writes reject those cupcake offers until separately approved/versioned. Final photos/allergens/storage guidance and physical device checks remain pending. New-product opening hour remains unset; no automatic activation.

Future rollout needs separate approval: (1) confirm AU target resources/schema/permissions and backup checkpoints; (2) compatible v1+v2 readers and notification/reminder/admin first, writes closed; (3) API writer+matching pickup-policy health, writes/preorders still closed; (4) matching AU frontend/SEO and isolated smoke checks, verify KR/Custom/Class; (5) separately activate confirmed general offers; (6) operator manually opens eligible cookie/mochi on SydneyOct19 when ready, with no assumed hour. The obsolete weekend approval variable needs no edit and is no longer a schedule gate. Cookie/provisional offers can stay blocked while confirmed offers proceed.

Rollback stops renewal writes first and keeps storage v2 readers supporting renewal price v1+v2 and operational output. Restore a compatible frontend/API checkpoint; do not reprice, reschedule, delete or automatically cancel stored orders. No production deployment, remote writes or transports took place during this task.

Final documentation check: imported Markdown hard-break whitespace was detected by the staged check and replaced with paragraph breaks. Public checksums were regenerated; the final full change-range whitespace check must pass before reporting the checkout clean. A small local documentation formatting commit records this correction.

## 2026-10-15 — confirmed Brownie Whole Cake prices

User replaced the prior8/10-inch provisional115/155 with confirmed6/8/10-inch AUD82/117/168. Vanilla cream remains+10 (92/127/178); loaf remains58/68. Shared frontend/server pricing now uses `au-renewal.2026-10.v2`; storage JSON remains version2 with no new DB attributes. New writes accept only the active price contract. Readers and operational renderers accept both immutable renewal price contracts; old request fingerprints still replay before new-write gates. Synthetic frozen v1 fixtures preserve82/115/155 and size facts; these do not represent real orders. Current v0.7/FE/BE/QA/fixtures/decision log were synchronized; original research is kept locally as superseded history. Cookie and provisional cupcake gates remain. No production changes or transports.

2026-10-15 verification: `npm test` passed (includes `test:renewal`:31 Node +3 bundled +3 UI =37), `npm run lint` passed. AU and KR production builds passed (existing chunk-size warnings only). Playwright at390px verified all three displayed prices and10-inch vanilla cream178; scroll width remained390. External requests were blocked; only intentionally blocked font requests appeared in the console. No order submission. Local screenshot: `output/playwright/brownie-prices-20261015-390.png`. `git diff --check` passed. The full prior mobile QA remains recorded above. The price/storage tests were first run RED against the old provisional gate, then GREEN with the confirmed prices. A separate API test verifies the old v1 HMAC request fingerprint still replays unchanged and that new v1 writes are rejected.

## 2026-10-15 — six-flavour mochi, latest user instruction

Authority: user explicitly confirms mochi has never been deployed. Renewal v2 stays; no v3 or historical $35 branch. Earlier four-flavour/signature QA above is superseded local implementation history.

Read-only audit: clean branch at6827512; prior ledger records no deployments. Public production llms.txt GET succeeded and contains no mochi/Renewal marker. No Appwrite control credentials or CLI session found in the task environment; production DB counts were not independently queried. No operational data was modified. User subsequently reaffirmed non-deployment, so lack of DB credentials does not block this local replacement.

Plan: core pricing/negative tests → keyed six-flavour persistence/operational output + cart re-selection → 390px two-mode builder/edit/explicit box allocation → full tests/builds/browser QA and one final independent review.

Ruling: use the six approved prices and stable IDs in the provided plan; English labels remain that plan's proposed customer-facing names. The latest explicit implementation request authorizes proceeding within the existing branch.

Core: removed fixed signature pricing and four-count input. New gift-four and singles sum six unit prices; gift packaging free, selected singles50c each; no automatic conversions/discounts. Core tests RED→GREEN; existing brownie/history tests stay green. Historical reader source files are unchanged. Cart migration preserves non-mochi items and archives old mochi selections before overwriting the active cart.

Final six-flavour verification: `npm run test:renewal` passed42 (33 Node +6 bundled +3 UI); `npm test`, `npm run lint`, AU production build and KR production build passed. Existing chunk-size warnings only. Shared pricing/operational tests cover six prices, forged/invalid/overflow payloads, no automatic box/discount, mixed134.50 with3 boxes/15 pieces, v2 storage and notification/reminder/PIN output. Actual historical reader source files have no diff.

Browser QA used localhost only, blocked external APIs, synthetic capability response and a local2026-10-20 clock for eligibility; no submit was clicked. Verified Box A×2=74, B=35, packaged singles3=25.50; mochi134.50 plus preserved cake75=209.50. Explicit5-to4+1 allocation removes2 packaging dollars; cancel allocation/editor preserves selections. Language toggle preserves counts. Product/cart widths360/375/390/430 and product200% root text size showed no horizontal overflow. Screenshots: `output/playwright/mochi-six-product-en-390.png`, `mochi-six-product-ko-390.png`, `mochi-six-cart-390.png`, `mochi-six-cart-ko-390.png` (local ignored evidence). A header overflow at375 was reproduced and fixed by applying the compact wordmark through430px. On mobile mochi detail, help remains below the footer so it cannot obscure flavour controls. Physical-device/accessibility audit remains pending.

One read-only independent final review found an important edit/delete state bug; reproduced RED in the browser, cleared editing state on removal, and repeated GREEN with checkout re-enabled. No other critical/important findings. Reviewer deferred visual QA, production status, build completion and operational content; these are respectively covered by the browser evidence, user non-deployment confirmation/read-only audit, command results, and remaining release items above. Final full suite/build/lint re-run passed after the fix.

No live Appwrite reads with privileged access were possible; DB absence is user-confirmed rather than independently counted. No push/deploy/DB mutation/transport. Public documents contain sales contracts and synthetic examples only; recipe/R&D originals remain ignored and are not staged. Launch remains manually gated; English flavour display names, final photos/allergens/storage, cookie price and provisional cupcake approvals still require operational confirmation.

Local implementation commit: `a83c210` (six-flavour v2 core, cart, UI, tests and executable price fixtures). The following documentation commit records synchronized decisions and validation. No remote push.

## 2026-10-15 — all AU detail UI unified

Started from clean `f1d4384` on the existing branch. User explicitly specified the design and authorized local implementation/commits, so no redundant design approval or new worktree was needed. Brainstorming/uncodixfy/playwright/verification guidelines applied; one final read-only reviewer used. Shared interface plan: existing RenewalSelection → shared OptionButton/QuantityStepper → existing priceRenewalOrder/cart; new controls only produce existing values. No server, persistence, pickup, admin or Custom Cake contract edits. Existing CakeDetailPage only imports the extracted, behavior-identical OptionButton.

Implementation: reusable existing Pavé option class and gallery, photo placeholders, immediate totals/mobile fixed action; all12 products and both languages. Latest user addition specifically requires empty photo areas: product/finish/pack/mochi flavour slots are provided without substituting other product assets. Current extra prices are derived through server pricing; independent quantities remain attached to parent lines. Existing approved cake prices and mochi v2 rules unchanged.

Tests first failed for old select/number UI and missing servings/extra-card structure, then passed. Added four SSR UI tests to test:renewal; current renewal suite46 =33 Node+6 bundled+3 pickup UI+4 detail UI. Full `npm test`, `npm run lint`, `npx tsc -b`, KR and AU production builds passed. Existing chunk-size/dynamic-import warnings remain. `git diff --check` passed.

Browser evidence and per-screen table are in qa-contract-v0.7.md. Twelve pages ×two languages at390px, no overflow and44px minimum button height. All product families were clicked and saved to the local bag; checked persisted size/finish/chocolate type/parent references/six-flavour counts. No reservation submission. Photo/title/card/sticky-bar screenshots compared with the live Pavé read-only reference.

Final review: two findings labelled minor were treated as required fixes because they affect the explicit photo-slot requirement and selection feedback accuracy. Pack photo slots test failed0 versus3 before the fix, then passed. Restoring converted mochi boxes to singles left stale Added status: reproduced in browser before the fix, then confirmed cleared after the fix; whole suite/builds rerun green. No deferred findings. Reviewer deferred visual/a11y, live operation and command evidence: browser visual/layout covered here, physical-device/screen-reader audit remains unperformed, production is intentionally outside scope, test/build completion verified from local exit codes.

No push/merge/deployment/Appwrite writes/real orders/messages. Cookie price and provisional brownie cupcake production approval remain pending. Missing actual photos are explicit placeholders awaiting user assets. Backend/historical readers, KR business logic and Custom Cake remain unchanged.

Final visual fix: a portrait option asset expanded its photo area beyond4:3; browser assertion reproduced the mismatch, the image/placeholder is now positioned inside a fixed aspect-ratio frame, and the assertion passed. Repeated all24 screens, targeted46 renewal tests, lint and both builds after this CSS correction.

Local UI implementation commit: `5c2e86b`; subsequent documentation commit records the screen-by-screen QA and public document checksums. Branch remains `codex/au-renewal-20261014`, no remote push.

## 2026-10-16 — Production launch execution (IN PROGRESS; no remote mutation yet)

Latest user explicitly authorizes GitHub/main/Production deployment and confirmed offer activation after mandatory safety checks. Previous no-deploy instructions are superseded only within that safe scope. Started clean at e06f04b. Fetched origin/main079083664e8919a2d65abb347010766106633b95;0 remote-only/10 local-only commits. Public production HTML currently references079083664e89 asset prefix, matching fetched main. User confirms main push triggers AU Cloudflare Git deployment. Cloudflare dashboard currently requires login; live Pages deployment ID/config are not yet independently captured.

Read-only AU Appwrite Console access verified at api.verygood-chocolate.com, projectverygood-au. Reservation API active6abcb839d5640c83d30a Node22; Notification6abcb73e4fa12c803750 Node22; Reminder6abcb727d0aa9411ed2d Node16. API health returnedready with September cake/chocolate/smore capabilities; renewal-health404 (current production does not support Renewal). No real create action was called. Public function/schema control GET correctly401 without privileged credentials.

Reservation DBverygood_cake_au/reservations schema reviewed:productId string40,orderLinesJson string65535,orderLineCount/orderItemCount/cents/packaging/fingerprint attributes present;quantity int32 ceiling retained. Legacy totalPrice integer is already rounded at main.js persistence boundary; authoritative cents/snapshots preserve exact price. Table access is administrator-only with row security disabled, no public direct write. No schema change is required from this comparison.

Recovery gate: self-hosted Console Backups explicitly unavailable/Manual backup disabled. No verified database snapshot/export or privileged local control credentials available yet. Existing API shows previously pending configuration changes. Existing runtime/config/scopes/secrets must be preserved; generic default deploy script would choose Node16 and replace options, so it must not be run blindly on the actual API/Notification Node22 setup. Local official archive builders were used without network operations.

Local corrections: Oct16 minimum date with manual flag+actual24h kept; first eligible Saturday10:30 slot for Friday10:20 receipt tested. Cookies retain null price; provisional brownie cupcakes remain blocked. PHOTO COMING SOON/사진 준비 중 used in real missing image slots, with separate pending-price messaging. User supplied private recipe PDF and approved approx80–100g depending on fruit, refrigeration/day-of consumption/max3days recommended. Customer copy uses only those approved facts; PDF/recipes are not staged or bundled. Final full allergen statement is awaiting user confirmation.

Release review identified a separate prerequisite: renewal creation currently also goes through legacy beforeNew, so CAKE_WIRE_LEGACY_NEW_SUBMISSIONS must be compat before activation; required mode would block creation despite enabled renewal-health. Actual value remains masked in Console and is not yet verified. No Custom Cake mode is changed. Existing generic deployment health does not verify Renewal; explicitrenewal-health and immutable reader fixtures are required after compatible deployment.

Local validation: full tests/lint/AU+KR builds pass; renewal48=34Node+6bundled+3pickupUI+5detailUI. Function archivesnpmci passed. API/Notification entrypoint imports passed Node22v22.23.3; Reminder passed actualNode16v16.20.2; sharp native syntheticPNG passedNode22. Runtime test's initial sharp deep-path assumption was corrected to package resolution; no product implementation change was needed. Privileged target deployment/backup/allergen gates are still pending, therefore no deployment/activation success is claimed.

2026-10-16 later evidence: Cloudflare existing login became available. Actual Production project is **au-cake-next**, not paused au-cake. Current deploymente8ec9daf-0150-4cef-9579-d78621ea4e58, SHA079083664e8919a2d65abb347010766106633b95; domainsau.verygood-chocolate.com andau-stage.verygood-chocolate.com. Gitnam9295-cmyk/au-cake,main auto-deploy enabled,npm run build→dist. Production public envVITE_MARKET=AU,endpointapi.verygood-chocolate.com/v1,projectverygood-au,APIreservation-api/modeall verified. Other Pages projects untouched.

API functionCAKE_WIRE_LEGACY_NEW_SUBMISSIONS was visually revealed as **compat**, then the read-only update dialog was cancelled with no save. This resolves the reviewer’s legacy gate prerequisite for the observed configuration. Node16 Reminder tests passed with synthetic fixtures under actualv16.20.2 in addition to entrypoint import. Generic deployment script option replacement remains a reason to preserve existing settings explicitly rather than run its defaults.

User confirmed final public allergen copy: milk/almonds/soy; shared facility handleswheat/eggs/sesame/peanuts. This is now in both languages together with user-approved80–100g/refrigeration/day-of/up-to3days guidance. Raw PDF remains only at the supplied private local location; no source recipe or manufacturing proportions are public.

390px browser QA: A×2=74+B=35+packaged Nama singles3=25.50, cart134.50;gift/singles configurations preserved separately. Both languages show latest date/photo/allergen/storage copy with no horizontal overflow. Screenshotsoutput/playwright/launch-mochi-20261016-{en,ko}-390.png andlaunch-mochi-cart-20261016-390.png. Initial CLI assertions needed an explicit render wait after navigation (no product defect); corrected checks passed.

Final local verification48 renewal tests, fullnpm test,lint,AU+KR production builds passed after public allergen copy. Existing build chunk warnings only. No schema migration, DB write, flag change, Function deployment, main merge or GitHub push has occurred. **Production launch remains incomplete pending a verified recoverable DB backup**. The Console self-hosted Backup button is unavailable; no .env.local or explicitly matching SSH config is available. Console administrative access is available; the missing .env.local is not independently a deployment blocker because the existing UI can preserve configuration. Existing secure operator credentials would be one way to export a backup. Awaiting a verified backup/recovery checkpoint requested during this run.

Rollback boundary: recorded original IDs are only the pre-launch checkpoints. Before activating any Renewal writer, capture and verify a new API/operational reader checkpoint that can read both legacy andRenewal v2, plus a compatible frontend checkpoint. After any v2 order exists, do not restore an old September-only reader. On incident, closeRenewal flags first, preserve compatible readers, restore compatible checkpoints; never delete/reprice/reschedule stored orders.

Local preparation commit: `d0a803e`. Launch attempt is BLOCKED BEFORE DEPLOYMENT by the missing verified recoverable production DB backup. No Production success is claimed. A following local docs commit records this exact checkpoint; GitHub/main remain untouched.

## 2026-10-16 — verified backup and Production rollout resumed

This entry supersedes the earlier backup blocker. User explicitly authorized SSH backup, encrypted T7/Google Drive copies, isolated restore, compatible Function deployment, main fast-forward/Pages auto deployment and confirmed-offer activation after verification. Source started clean at2260775; fetched main0790836 remains an ancestor with no remote-only changes. KR/cake and verygoodhompage use separate Git repositories; old au-cake Pages is paused. Only au-cake-next is the AU deployment target.

Backup ID20261015T232018Z: SQL snapshot2026-10-16 10:21:50–10:21:53 AEDT; Appwrite1.8.1/MariaDB10.11.16,416 InnoDB tables/644137 rows. Logical single-transaction SQL, account recovery definitions, persistent uploads/functions/builds/sites/imports/certificates/config, compose/environment and image/deployment metadata are included. Live DB files and transient Redis/cache/job queues are excluded intentionally. Persistent file hashes/mtimes matched before/after; full table/index/constraint/trigger/routine/event schema also matched, ignoring advancing AUTO_INCREMENT counters. No production DB stop or schema write.

Authenticated age1.3.2 ciphertext3169652706 bytes; SHA256 `14568b616cf233a25531ecd6ee4ab82b7c904f030802828619a3521fa8655a02`. T7 dedicated timestamp folder and server encrypted copy match. Google Drive API confirms completed full-size private file; DriveFS provider metadata MD5 matches the local ciphertext. The connector cannot independently download a file over256MiB, so no downloaded cloud SHA256 is claimed. Recovery identities are separately retained in a FileVault Mac folder, login Keychain and independent server recovery directory, never in T7/Drive/Git or archive; byte readback verified. Simultaneous loss of both key-custody hosts still requires an additional operator-held key escrow.

Actual T7 ciphertext authenticated/decrypted over SSH and restored to a unique MariaDB container/volume with networknone, no published ports and no production mounts. PASS2026-10-16 10:50:09 AEDT: all416 exact table row counts/column schemas/CHECK TABLE results, normalized full SQL roundtrip, and1155 persistent-file hashes matched. SQL import605.24s; import+DB verification663.58s. Initial attempt exposed an incorrect readiness check in the temporary test harness, fixed to authenticated TCP SELECT1 before retry; backup hashes were valid throughout. Bulk-import durability tuning applied only to the disposable test DB; production remained unchanged. Temporary DB container/volume removed, source backups retained.

Read-only real-order audit:64 production reservations,37 legacy+27 stored-v1,zero Renewal-v2. Previous active API source versus candidate produced identical stored reader, customer lookup and PIN Calendar output for all64. Notification rows/text/HTML rendered all64; customer payloads rendered11 with existing email,53 historical missing-email records skipped. No transport invoked and no order created/edited. No historical mochi compatibility layer was added.

Fresh verification:48 renewal tests, fullnpm test,lint,AU and KR production builds, official Function archives/dependency installation/runtime imports and whitespace check passed. Reminder tests also passed on actual Node16.20.2. Fresh reviewer passed52 targeted safety/compatibility tests; its key-custody and full-schema evidence dependencies were resolved above. Local browser24 product/language screens at390px passed overflow and44px core-control checks; screenshots remain local/ignored.

Compatible operational deployments now active with original runtime/scopes/events/schedules/environment preserved: Notification `6ad166d56f2ebc5bb596` (Node22), Reminder `6ad166e0135ded3c8248` (Node16.0), API closed-writer checkpoint `6ad16703aee8874b1737` (Node22). Public generic health ready; renewal health confirms `au-renewal.2026-10.v2` and `au-renewal-pickup.2026-10-14.v2`, both writes/preorders false. Existing customer orders, Custom Cake settings and collection permissions were not changed. Frontend Production deployment and manual activation are the next gates; this entry does not yet claim those complete.

## 2026-10-16 — Production launched and confirmed offers open

Initial frontend launch: main fast-forward `e9e8a752a5c89b8069ba47feedebe9fc5245c81f`; Cloudflare au-cake-next Production deployment `ecd014c8-846f-42c1-a41d-847e3b5b4969`, completed10:54:34 AEDT. HTTPS public asset prefix matches main. Live browser24 product/language screens passed at390px. Menu5, cards5/4/3, Brownie10-inch+vanilla178 and immediate quantity2 total356 verified. Mochi A×2=74+B=35+three packaged Nama singles25.50 produced134.50; distinct configurations and free-box/paid-single packaging remained separate. Before activation, the real frontend correctly kept reservation submission closed.

Manual activation completed11:01:03 AEDT. Active Reservation API `6ad16934f17e6b0995ac` reports generic health ready and renewal contract/pickup versions matching the frontend, writes=true/preorders=true. API/Notification Node22 and Reminder Node16.0 settings/scopes/events/schedules/existing variables remain identical to the captured baseline. Only the two supported renewal flags were introduced/changed. Compatible closed-writer API rollback checkpoint remains `6ad16703aee8874b1737`; compatible frontend checkpoint remains the initial launch deployment above. Later documentation-only builds retain identical application source.

Live cart/pickup QA after activation: Wednesday/Friday29 slots09:00–16:00, Saturday/Sunday13 slots09:00–12:00, closing times included; Monday/Tuesday/Thursday and same-day mochi pickup0. At verification time, next-day Saturday offered11:15/11:30/11:45/12:00, all at least24 elapsed hours away. Sunday12:00 selection enabled the real submission button and survived EN→KO. Customer fields remained blank; submit was never clicked. The initial automation locator included native option text in its exact label, so the test was corrected to read the actual select element; no product-code fix was needed. Local ignored screenshots: t7-production-*390.png.

Read-only post-launch audit: all64 pre-launch reservations retain original amounts/sizes/pickup facts; permissions unchanged; current reservation count64 at audit. KR public HTML is byte-identical before/after. Custom Cake public capability200/ready with customCakeV1=true,cakeOrderV2=true,legacyNewSubmissions=compat. Recent active-deployment executions are completed/HTTP200 with zero runtime error bytes. Notification remains on its existing schedule; Reminder deliberately retains its pre-existing dry-run mode, so actual reminder sending was not enabled. No manual test order, payment, email or SMS was generated. Admin/PIN/CSV compatibility is covered by the full regression suite and actual-order projections; no real admin edit was performed.

Open: Pavé Whole Cake, Signature Gâteau Loaf, Brownie Whole Cake82/117/168, Brownie Loaf58, six-flavour Chocolate Mochi, Almond Chocolate, Pavé Chocolate, Eiffel Tower Chocolate, Gâteau Cupcakes, S’more Sticks and their approved configurations/extras. Blocked: cookie-six (no price), brownie-cupcakes-6/12 (provisional prices). Server production price validation retains these blocks independently of frontend state. Actual missing photos remain honest placeholders.

Incident procedure: set both renewal flags false and switch to the verified compatible closed-writer API checkpoint; check renewal-health false/false. Keep compatible readers/Notification/Reminder and the compatible frontend. The server operator helper supports this closure without replacing secrets or permissions. Never revert to September-only readers after a v2 order exists. Never delete/reprice/reschedule orders. The verified DB backup is a last-resort pre-launch snapshot, not point-in-time recovery: reconcile all orders since10:21 AEDT before any production restore. Original T7/Drive/server backups are retained; only isolated restore containers, volumes and scratch copies were removed.

### 2026-10-16 — Product detail recovery, local only; hold deployment for photos

User reported missing product detail content after launch. Reproduced on Production: Pavé had its purchase controls but zero `.au-pave-story` elements. Renewal routing replaced the former detail page with `AuRenewalShop.Product`, which retained the purchase UI but omitted the existing lower story and non-Pavé galleries. Original components and image files were intact.

Restored the original Pavé story and the existing Gâteau Loaf, Brownie Whole, Gâteau Cupcakes, Almond Chocolate and S’more galleries/stories through a presentation-only adapter. Current related-product links/prices come from the renewal catalog. Removed the discontinued Brownie Pavé topping from the restored presentation; only Basic/Vanilla Fresh Cream is described. Historical editorial/catalog data is not mutated. Whole-cake photos are not substituted for the Brownie Loaf, and Pavé packaging reference photos are not substituted for other products. Missing packaging photos remain PHOTO COMING SOON / 사진 준비 중. Remaining current non-Mochi product pages have the shared practical/related detail sections; Mochi’s existing six-flavour builder and approved safety information are preserved.

Two regression tests reproduced the missing stories/current-menu boundary before the fix, then passed. Renewal coverage is now50 tests including7 rendered-detail tests. Full `npm test`, lint, AU/KR production builds and `git diff --check` pass. Browser QA covered all12 public products in EN/KO at390px: no horizontal overflow, no failed product images, current pickup hours, no retired related links. Brownie10in+cream178, quantity2=356 and local cart data match; gallery selection works and chat/order bar do not overlap. Screenshots remain ignored under `output/playwright/detail-recovery-*`.

Latest user instruction: restore locally and deploy together with the forthcoming real photos. **No GitHub push, main merge, Cloudflare/Function deployment, operational flag change or production data write is included in this recovery task.** Production remains at the prior release while the local recovery awaits photos. Cookie and provisional Brownie Cupcake sales blocks, current prices, renewal v2, pickup/lead-time policies, KR and Custom Cake are unchanged. No real order/payment/notification was sent.

### 2026-10-16 — Mobile spacing polish, local only

Reproduced the collection-image defect at390px: images were169px wide but retained the HTML600px height, producing large blank areas above/below the product. Set responsive height with a square display area, consistent with missing-photo slots. Tightened collection headings, card names/prices/notices and bottom spacing;360px now keeps two columns while320px uses one. Removed duplicated mobile navigation subtitles, increased footer text readability, made detail-gallery touch targets44px, and kept checkout fields at16px. Empty bags now explain the state and provide a clear menu button; edit/remove actions are visually secondary. Mobile chat is below renewal pages so it cannot cover product cards or checkout inputs.

Browser checks:50 EN/KO route/viewport combinations across collections, Home, all12 product details, empty bag, Custom Cake/Business entry pages, plus menu open/close. Additional collection checks at320/360/390/430/1280px verified square images and no overflow. A populated local bag retained AUD75 and all checkout inputs used16px text; no request was submitted. Final screenshots are local/ignored under `output/playwright/mobile-polish-*`. These are browser-emulated viewport checks, not physical-device certification.

Validation: `npm test`, `npm run test:renewal` (50 tests), lint, AU/KR builds and whitespace checks passed. Existing build size/dynamic-import warnings remain. Prices, ordering contracts, pickup rules, operational resources and stored orders are unchanged. **Keep this commit local with the detail recovery; deploy together with the forthcoming photos only.**

### 2026-10-16 local banana assortment update (deployment held for photos)
Replaced new-sale amande with banana AUD9, retaining original8/strawberry10/grape9.50/mandarin9/butter-redbean8.50. Public weights: original80g; fruit/butter-redbean85g minimum. User confirmed no almond ingredient; milk/soy ingredients and almond/wheat/egg/sesame/peanut facility cross-contact displayed. Private manufacturing ratios were not added.
The already-deployed v2 almond catalogue remains stored-reader-only, including historical replay canonicalization and operational summaries. New requests reject almond keys; mixed browser carts preserve non-mochi lines and request mochi reselection. Synthetic pre-change quote fixture verifies exact historical price/contents and unchanged stored document reading. Production data was not read or changed during this task; historical compatibility is retained regardless of order count.
Validation: npm test, test:renewal, lint, AU/KR production builds and diff check passed. 390px Korean six-card screenshot has no horizontal overflow, with honest photo placeholders. Screenshot: output/playwright/mochi-banana-ko-390.png (ignored). No push, deploy or production flag changes. At release, deploy compatible readers then backend before frontend, verify banana acceptance/almond rejection and prices; v2 label alone does not distinguish assortments. Photos and explicit release remain pending.

Additional browser check: banana ×4 updates immediately to AUD36 with free gift packaging; switching to English retains selections and has no 390px overflow. English screenshot: output/playwright/mochi-banana-en-390.png.

### 2026-10-16 local product photography
Imported 16 user-supplied photos as optimized WebP copies in public/products/renewal-photos (about1.8MB combined). Drive originals untouched. Extras use the new Pavé100g and cream100g photos. Brownie loaf/cupcakes have independent hero/inside/cream galleries, matching finish photos and compact two-image introductions without video or occasion sections. Mochi uses gift-box hero + six-piece overview gallery and six individual flavour photos/short descriptions inside the existing selector to avoid duplicated long sections. Product cards use the respective new heroes. Cookie placeholders and provisional cupcake order block remain intact; prices/pickup/writer contracts unchanged.
Browser390px: loaf, cupcakes, mochi and Pavé extras have no overflow or broken images. All three new galleries switch to their correct second photo; Korean/English mochi checked. Screenshots output/playwright/photos-*-390.png are ignored local evidence. Local only; no push/deploy.
Validation passed: npm run test:renewal, npm test, npm run lint, AU/KR production builds, git diff --check. Existing chunk-size warnings only.
