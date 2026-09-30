# AU Custom Cake ops validation

Validated on 2026-09-30 in the isolated Mac worktree `/Users/nam9295/Desktop/john_2.0/code/au-cake-custom-cake-ops`, branch `fix/au-custom-cake-ops`, based on latest fetched origin/main `4606b3098ab847309b3dc72cd86ca45778bad8fb`. Frontend-polish changes were not imported. The server checkout was not accessed or modified. No deployment, push/merge, customer order mutation or email send occurred.

## Manual Discount

Checkpoint `2d9cf11602249d66b2c174d8099780c9b0332804` (`Custom Cake manual discount`).

An optional strict `quote.manualDiscount` extension in existing payloadJson stores version, type, integer input value, basisCents, discountCents, replacedAutomaticDiscountCents and reason. No new Appwrite columns or migration.

Source of truth is the immutable creation receipt: baseCents and paid S’more line subtotalCents, plus newly agreed design/figurine extras. Original cake promo and S’more discount fields remain as audit evidence. Nonzero manual selection replaces their combined discount effect. Manual absence preserves existing automatic pricing. Zero normalizes to automatic, retaining existing discounts.

Percentage has up to two decimal places, stored as integer basis points; cents use deterministic half-up BigInt rounding. Fixed AUD has up to two decimal places and is stored as integer cents. Final amounts and discount outputs are computed and validated by the server. Unknown/forged fields, negative/unsafe/non-integer values, percentage over 100%, amounts above G and unsettled extras are rejected. Every quote revision retains existing CAS, history, latest-version acceptance and confirmed-state restrictions.

For G=A$295.00 (saved base 200.00 + design 20.00 + figurine 30.00 + saved paid S’more gross 45.00), saved automatic discounts total A$33.50. Automatic final is A$261.50.

| Selection | Discount | Final |
| --- | ---: | ---: |
| Percentage 10% | −A$29.50 | A$265.50 |
| Percentage 20% | −A$59.00 | A$236.00 |
| Percentage 40% | −A$118.00 | A$177.00 |
| Percentage 12.5% | −A$36.88 | A$258.12 |
| Fixed A$10 | −A$10.00 | A$285.00 |
| Fixed A$30 | −A$30.00 | A$265.00 |
| Fixed A$75.50 | −A$75.50 | A$219.50 |

Legacy exact quote fixtures remain readable without new fields or price changes. New persistence, admin-list, browser and notification readers recompute and validate manual quote outputs using stored amounts. Admin/customer/email/notification show matching basis, negative discount, final amount and reason. Existing immutable cached notification payloads are preserved. Previous acceptance history remains but cannot confirm a later quote. Confirmed requotes remain blocked.

## PIN Calendar

Existing PIN authentication, `calendar:read` token and 30-day TTL remain unchanged. No new login or document permission.

Monthly events include compact Custom Cake tier/size/quantity/flavour only. Flavour is parsed only from a complete, exact first-line `[Flavour: ...]` prefix; missing/malformed prefixes are not inferred. Missing flavour displays Not specified. Month responses omit design/additional free text and private metadata.

The separate read-only `calendar-production-detail` action verifies the existing token before reading storage. Its explicit response allowlist covers pickup date/time, status and every Custom Cake line's tier, size, quantity, flavour, design request and figurine source, plus additional request. Design request comes from the original custom line; additional request comes exclusively from `snapshot.request.requestNote`.

Invalid/missing/expired/tampered tokens are rejected before any repository read. Phone, email, customer identity, photo/storage references, quote/history/audit and admin metadata remain absent. Strict client parsing rejects extra private fields. React text nodes preserve script/HTML strings as literal text. Logout/date/month changes and newer detail selections discard stale detail responses. Existing privacy tests were retained and their approved monthly projection expectations updated explicitly.

## Validation evidence

Tests were written and their failures observed before implementation. Relevant regressions cover integer percentages/fixed cents, auto replacement, immutable receipt pricing, over-discount/malformed/forged/unsettled rejection, versions/acceptance/confirmed restrictions, strict legacy/new readers and email reason/amounts; PIN auth/privacy, flavour/legacy notes, design+additional requests, all figurine enums, all custom lines, plain text and stale detail after logout.

Final resumed verification:
- Full `npm test` on Node 22: 1655 tests, 1654 passed, 0 failed, 1 market-specific skip. The skipped KR dist assertion was separately exercised with KR build.
- `npm run lint`: 0 errors/warnings.
- AU build: passed in full suite (tsc, Vite, SEO output). KR build and KR static route checks: passed separately. Existing large-chunk warnings remain informational.
- API/Notification/Reminder deploy packaging plus Appwrite/Notification internal endpoint regressions: 43 tests passed.
- Python internal routing rollout: 6 tests passed.
- Actual offline Function archives were generated/extracted and the packaged manual-discount module imported for API, Notification and Reminder. No Function deployment.
- `git diff --check`: passed before commit.

Earlier same-code verification before the pause: relevant 102/102 and UI 21/21. Desktop 1365×900 and mobile 390×844 browser checks used actual React components with synthetic transport responses. PIN flow, compact month card, production detail fields, literal script text and no horizontal overflow were confirmed. Admin 40% preview and quoteVersion increase were confirmed without a real order. Local QA files, browser session and own Vite process were removed/stopped. Screenshots were saved outside the worktree at `/tmp/au-ops-browser-qa/playwright`.

One independent whole-branch review found no critical/important issues. An extreme safe-integer cents formatting issue was fixed with a failing then passing regression and integer formatting. The resumed final full suite includes that regression and all 21 UI tests.

Logs are local temporary evidence: `/tmp/au-ops-resume-full.log`, `au-ops-resume-lint.log`, `au-ops-resume-packaging.log`, `au-ops-resume-routing.log`, `au-ops-resume-kr.log`, `au-ops-resume-kr-static.log`.

## Production rollout and rollback proposal — requires separate approval

1. Read-only compare and preserve the berry server's uncommitted calendar changes. Build/deploy from a clean artifact or separate release directory; never reset/clean/pull/checkout or overwrite that existing checkout.
2. Keep `CUSTOM_CAKE_MANUAL_DISCOUNT_WRITES_ENABLED=false`. Deploy quote-compatible API/Notification consumers, including any Reminder/shared readers, while preserving verified internal routing/proxy configuration. Validate historical quote reads and existing automatic writes.
3. Deploy frontend controls and the approved PIN detail API/UI; validate monthly omission and authenticated detail allowlist without customer mutation or mail sends.
4. Enable manual writes only after every active consumer is compatible. Actual customer quote update and email send require separate approval. Confirmed-order requotes remain outside this feature.
5. For rollback, turn off manual writes first. Retain compatible quote readers and all snapshots/outbox/acceptance/history. Never activate an old exact reader that cannot read already saved manual quotes. Calendar UI/action can be reverted to the discount checkpoint, without changing PIN login, storage or the protected server checkout.

## Files by checkpoint

Manual Discount — 25 files:

- `.env.example`
- `appwrite-functions/reservation-api/src/cake-order-pricing.js`
- `appwrite-functions/reservation-api/src/custom-cake-discount.d.ts`
- `appwrite-functions/reservation-api/src/custom-cake-discount.js`
- `appwrite-functions/reservation-api/src/custom-cake-list.js`
- `appwrite-functions/reservation-api/src/custom-cake-persistence.js`
- `appwrite-functions/reservation-api/src/custom-cake-runtime.js`
- `appwrite-functions/reservation-api/src/custom-cake-workflow.js`
- `appwrite-functions/reservation-notification/shared/reservation-api/custom-cake-discount.js`
- `appwrite-functions/reservation-notification/src/custom-cake-notification.js`
- `docs/custom-cake-api-contract.md`
- `docs/superpowers/plans/2026-09-30-custom-cake-manual-discount.md`
- `package.json`
- `scripts/booking-reminder-deploy-runtime.mjs`
- `scripts/custom-cake-deploy-config.mjs`
- `scripts/reservation-notification-deploy-runtime.mjs`
- `src/components/AdminCustomCakesSection.tsx`
- `src/components/CustomCakeLookupResult.tsx`
- `src/components/ManualDiscountSummary.tsx`
- `src/lib/custom-cake-client.ts`
- `src/lib/custom-cake-contract.ts`
- `src/lib/custom-cake-ui.ts`
- `tests/custom-cake-manual-discount.test.mjs`
- `tests/custom-cake-ui.test.mjs`
- `tests/custom-cake-workflow.test.mjs`

Calendar production details — 14 files (including this validation record):

- `appwrite-functions/reservation-api/src/calendar-access.js`
- `appwrite-functions/reservation-api/src/main.js`
- `package.json`
- `src/ReadOnlyCalendarPage.tsx`
- `src/lib/repository.ts`
- `src/styles/readonly-calendar.css`
- `tests/calendar-access.test.mjs`
- `tests/custom-cake-ui.test.mjs`
- `docs/calendar-production-details.md`
- `docs/superpowers/plans/2026-09-30-calendar-production-details.md`
- `src/components/CalendarProductionDetails.tsx`
- `src/lib/calendar-production.ts`
- `tests/calendar-production-detail.test.mjs`
- `docs/au-custom-cake-ops-validation.md`
