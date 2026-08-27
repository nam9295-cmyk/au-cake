# AU email recovery production rollout checklist

## 1. Current production state and branch baseline

- Reported Cloudflare Pages known-good rollback deployment: `4b6dd3e`. **REQUIRES MANUAL VERIFICATION** in Cloudflare before release actions.
- Recovery branch: `fix/au-email-automation-recovery`, `9027b2041c7bb2f22d5c032bee16d98e05ca0c1c`.
- After `git fetch origin`: `origin/main` and merge-base are `01c2fbb65be757e00edc6ef62c45908cc90f276d`; recovery is 15 ahead and 0 behind.
- This document authorizes no external operation. All actual production values, resource state, revisions, and permissions are **REQUIRES MANUAL VERIFICATION**.

## 2. Recovery commit inventory

| Commit | Category |
| --- | --- |
| `e745540` | Customer email contract |
| `5a5f951` | Review/coupon 30-day policy |
| `3ff0fc0`, `b600ddd` | Private delivery ledger and permission correction |
| `354954c`, `bae289b` | Booking-received delivery and failure hardening |
| `0ff901c` | Admin booking confirmation |
| `9e59d4c` | Secure bilingual review invite |
| `39028d0` | Bilingual review reward |
| `a33e643` | Retry/reconciliation design only |
| `170883a`, `9a63ac6` | Safe retry foundation and UI |
| `fd20f16` | Bilingual booking emails |
| `3e8b52c` | D-1 reminder design only |
| `9027b20` | D-1 booking reminder Function |

Commit-stat review found no unrelated product feature mixed into this series: all changes are customer email, ledger/retry, review/reward, reminder, deployment contract, tests, or documentation.

## 3. Additive Appwrite schema migrations

Take and retain a production schema, index, and permission snapshot first. Every live-state column below is **REQUIRES MANUAL VERIFICATION**. Do not deploy a dependent Function until its target attributes and indexes are `available`.

| Target resource | Source delta | Backward compatibility / gate |
| --- | --- | --- |
| Cake reservations | Optional `customerEmail` string, max 120 | Additive; legacy documents may omit it. Apply before reservation-api, then frontend. |
| `review_invites` | Optional `tokenCiphertext` (64), `tokenIv` (16), `tokenAuthTag` (22), `tokenEncryptionVersion` (integer 1) | Additive; legacy hash-only invites remain valid but unrecoverable for resend/copy. Apply before review-api. |
| `email_deliveries` | New private table: `eventKey`, `sourceType`, `sourceId`, `template`, `status`, `recipientHash`, `payloadHash`, `attempts`, optional `firstAttemptAt`, optional provider/timestamp/error fields, timestamps; unique `eventKey` | Create and verify no browser permissions before notification/review/reminder send. No raw recipient/body/token/coupon storage. |
| `email_delivery_retry_claims` | New private table: event/source/template/status, `claimedByUserId`, `claimedAt`, optional completion/error/timestamps; unique `eventKey` | Create and verify no browser permissions before retry-enabled Functions/UI. One immutable explicit safe retry claim. |
| Cake reservations index | `status_pickupDate_idx` on `status`, `pickupDate` | Must be available before reminder send mode. |
| Class reservations indexes | `status_classDate_idx` on `status`, `classDate`; `status_advancedClassDate_idx` on `status`, `advancedClassDate` | Must be available before reminder send mode. |

The ledger/claim tables and review envelope fields are intended to be Function-only; browser users, authenticated users, and direct admin browser sessions have no direct CRUD. The schema helper may tighten a partial legacy ledger permission pattern, so manually verify no independent integration relies on that old access before applying.

There is no source migration that deletes, renames, makes required, or backfills an existing customer/review field. Existing encrypted coupon schema is reused. On rollback, retain additive schema and ledger audit rows; never delete customer data.

## 4. Function deployment inventory

| Function | Entrypoint and role | Runtime/events/execute | Scopes | Required configuration and archive contract |
| --- | --- | --- | --- | --- |
| reservation-api | `appwrite-functions/reservation-api/src/main.js`; public reservation boundary | `node-16.0`, 20s, no events, public execute | Existing DB/document read/write plus collection/attribute/index reads | Cake/Kids/table IDs, calendar settings, coupon HMAC; frontend uses reservation API mode/ID. |
| reservation-notification | `appwrite-functions/reservation-notification/src/main.js`; reservation-created receipt plus admin confirmation/status/retry | `node-16.0`, 15s, TablesDB/legacy reservation-create events, exact configured admin execute, no anonymous execute | databases/documents read/write | Resend, delivery/claim IDs, admin IDs, reservation IDs. Archive includes ledger, retry, sender, repository, transport, safety modules. |
| review-api | `appwrite-functions/review-api/src/main.js`; public token submit plus admin invite/status/retry | deploy config allows `node-16.0`, 30s; public execute remains needed for customer token review, server guard protects admin actions | databases/documents and existing files read/write | Resend, review/coupon/invite/encryption config, ledger/claim IDs, admin IDs, HTTPS origins. Archive includes shared ledger/retry/transport/Sydney modules. |
| booking-reminder | `appwrite-functions/booking-reminder/src/main.js`; private D-1 scanner | `node-16.0`, 30s, `0 * * * *`, no events, no browser execute | databases/documents read/write | Reservation/table IDs, Resend, ledger ID, `BOOKING_REMINDER_MODE`; archive has reminder, Sydney, ledger/repository/transport/template safety/order parser modules. |

**Runtime hard gate:** `.env.example` says `APPWRITE_REVIEW_API_RUNTIME=node-20.0` and notes `sharp` needs Node 18+, while review deploy config accepts only `node-16.0`. Reconcile the intended production runtime, deploy config, and `sharp` compatibility before review-api deployment. This audit intentionally changes neither source file.

## 5. Environment variables

### Cloudflare Pages Production public build variables

Set all required variables explicitly in the Production environment; a successful local Vite build does not prove this.

| Variables | Consumer | Requirement |
| --- | --- | --- |
| `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, `VITE_MARKET` | Frontend Appwrite client | Required |
| `VITE_APPWRITE_CAKE_DATABASE_ID`, `VITE_APPWRITE_KIDS_DATABASE_ID` | Reservation/repository clients | Required |
| `VITE_APPWRITE_CAKE_RESERVATIONS_TABLE_ID`, `VITE_APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID`, `VITE_APPWRITE_KIDS_RESERVATIONS_TABLE_ID`, `VITE_APPWRITE_KIDS_BOOKED_DATES_TABLE_ID`, `VITE_APPWRITE_SETTINGS_TABLE_ID` | Reservation/admin flows | Required |
| `VITE_APPWRITE_REVIEW_INVITES_TABLE_ID`, `VITE_APPWRITE_REVIEWS_TABLE_ID`, `VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID`, `VITE_APPWRITE_REVIEW_PHOTOS_BUCKET_ID`, `VITE_APPWRITE_REVIEW_PHOTO_CLEANUP_TABLE_ID` | Review/customer/admin flows | Required |
| `VITE_RESERVATION_API_MODE`, `VITE_RESERVATION_API_FUNCTION_ID`, `VITE_RESERVATION_NOTIFY_FUNCTION_ID`, `VITE_REVIEW_API_FUNCTION_ID` | Function-backed flows | Required, actual IDs must match deployments |
| `VITE_REVIEW_API_DIRECT_URL` | Private admin review photo preview | Required when that preview is enabled |
| `VITE_ADMIN_EMAILS`, `VITE_REVIEW_DEMO_MODE` | UI convenience/demo | Explicit configuration; not server authority |
| `VITE_GA_MEASUREMENT_ID` | Analytics | Optional |

**Cloudflare hard gate:** all Production `VITE_*` values are **REQUIRES MANUAL VERIFICATION**. Before merge or push, a release operator must prove values are non-empty, intended-AU-project values, and applied to the next production build. `NO` or `UNKNOWN` means no merge and no push. Never hardcode build-time values in source.

### Function/deploy private configuration

Never expose or record values. All are server/deploy configuration, never `VITE_*`:

- Deploy: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.
- Runtime Appwrite endpoint/project plus platform-provided dynamic `x-appwrite-key`; no long-lived runtime API-key fallback.
- Relevant server table/bucket/database IDs: Cake/Kids reservations, settings/openings/booked dates, review invites/reviews/coupons/photos/cleanup/manual coupons, deliveries and retry claims.
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`, and notification-only `RESEND_TO_EMAILS`.
- Admin/review: `REVIEW_ADMIN_USER_IDS`, `REVIEW_FRONTEND_ORIGINS`, `REVIEW_INVITE_TOKEN_ENCRYPTION_KEY`, existing coupon encryption secret and `REVIEW_COUPON_HMAC_SECRET`.
- Existing reservation calendar values: `CALENDAR_VIEW_PIN`, `CALENDAR_TOKEN_SECRET`.
- Reminder: `BOOKING_REMINDER_MODE`, initially explicit `dry-run`, later explicit `send`.
- Existing migration controls: `APPWRITE_RESERVATION_WRITE_MODE` and reservation-event overrides. Preserve current safe mode until its Function/frontend smoke test.
- Function IDs, names, and runtime values required by deploy scripts.

No Resend full-access/reconciliation key, provider GET credential, or webhook credential is required.

## 6. Final email flow matrix

| Flow | Trigger, recipient, language | Event identity / dedupe | Retry and impact | Fallback / Function |
| --- | --- | --- | --- | --- |
| Cake receipt | Reservation-created; `customerEmail`; bilingual v2 | `booking-received-customer:cake:{reservationId}`; ledger claim | One safe retry only if hashes match and `<23h`; reservation unchanged | Existing SMS/message copy; reservation-notification |
| Class receipt | Reservation-created; `parentEmail`; bilingual v2 | `booking-received-customer:class:{reservationId}` | Same | Existing class copies; reservation-notification |
| Cake operator receipt | Reservation-created; canonical `RESEND_TO_EMAILS`; internal | `booking-received-operator:cake:{reservationId}` | Server capability only; no UI; reservation unchanged | Admin reservation visibility; reservation-notification |
| Class operator receipt | Reservation-created; canonical operator list; internal | `booking-received-operator:class:{reservationId}` | Same | Admin reservation visibility; reservation-notification |
| Cake confirmation | Explicit admin action after confirmed status; customer email; bilingual v2 | `booking-confirmed-customer:cake:{reservationId}` | Same safe retry; never changes reservation | Confirmation SMS copy; reservation-notification |
| Class confirmation | Explicit admin action after `Confirmed`; parent email; bilingual v2 | `booking-confirmed-customer:class:{reservationId}` | Same | Class payment/confirmation copies; reservation-notification |
| Review invite | Explicit admin action after completion; source email; bilingual | `review-invite-customer:{sourceType}:{reservationId}` | Same retry only for active encrypted invite; same link/token | Bilingual copy request; review-api |
| Review reward | Review/coupon commit then source email; bilingual | `review-reward-customer:review:{reviewId}` | Same retry; same coupon; commit never rolls back | Coupon remains in customer UI; review-api |
| Cake D-1 | Private hourly scan, Sydney 10:00–10:59; customer email; bilingual | `booking-reminder-d1-customer:cake:{reservationId}:{YYYY-MM-DD}` | First-send only; no automatic/reminder UI retry; reservation unchanged | Manual contact/message process; booking-reminder |
| Class D-1 | Per confirmed first/advanced session, parent email; bilingual | `booking-reminder-d1-customer:class:{reservationId}:{first|advanced}:{YYYY-MM-DD}` | Same; reschedule gets new date identity | Manual contact/message process; booking-reminder |

## 7. Exact rollout order

### Phase 0 — backups and hard gates

1. Record active Pages deployment, current Function revisions, schema/index/permission snapshot, and rollback commands. **REQUIRES MANUAL VERIFICATION.**
2. Verify every Cloudflare Production `VITE_*` above.
3. Verify intended Function IDs/runtimes, sender/domain, secrets, encryption keys, admin allowlist, and review origins without displaying values.
4. Resolve or formally accept the nested review-api `sharp` high-severity advisory and runtime mismatch.
5. Re-fetch and confirm `origin/main` remains reviewed; otherwise re-audit divergence before opening a PR.

### Phase 1 — additive Appwrite schema only

1. Add optional Cake `customerEmail`, then wait for `available`.
2. Add optional review invite envelope fields, then wait for `available`.
3. Create and permission-check private `email_deliveries` with unique event key.
4. Create and permission-check private retry claims with unique event key.
5. Create the three reminder query indexes and wait for `available`.
6. Verify old frontend/function behavior remains healthy. Do not delete/rename/backfill/rotate data.

### Phase 2 — Functions, one at a time

1. Deploy reservation-api and smoke existing reservation behavior while retaining current reservation-write migration mode.
2. Deploy reservation-notification; verify event subscriptions and admin action access using controlled recipients only.
3. Deploy review-api only after the runtime hard gate; verify customer-token execute remains intentional and admin guard works.
4. Deploy booking-reminder with `BOOKING_REMINDER_MODE=dry-run`, hourly schedule, empty events, and no browser execute permission.
5. After each Function, record the new and previous revision and check safe logs for configuration errors.

### Phase 3 — reminder dry-run

1. During Sydney 10:00–10:59, verify candidate scanning, latest-row revalidation, pagination, and aggregate-only summaries with controlled data.
2. Verify no Resend transport call and no delivery-ledger write in dry-run.
3. Do not run a late catch-up outside the window.

### Phase 4 — frontend release

1. Immediately re-verify Cloudflare Production `VITE_*` values.
2. Use a protected-branch PR from recovery; review the 15 commits and this checklist. Do not locally merge main then push.
3. Merge only after every gate is green, then allow the normal Pages production build.
4. Smoke the deployed bundle: endpoint, project, Cake/Kids database IDs, and reservation API mode/ID must not be empty.

### Phase 5 — controlled smoke tests

Use test-owned reservations and recipients only.

- Cake: submit, admin visibility, bilingual receipt, admin confirmation, confirmation SMS copy.
- Class: submit, admin visibility, bilingual receipt, confirmation, payment/confirmation message copies.
- Review: invite, same-link copy, submit, coupon customer UI, reward email ledger status.
- Retry: controlled failed/uncertain delivery within the window; confirm no force send or second safe retry.

### Phase 6 — reminder enable

After dry-run evidence is accepted, explicitly change `BOOKING_REMINDER_MODE=send`, retain hourly schedule, and observe one controlled Cake and one controlled Class reminder at Sydney 10:00. D-3 coupon reminders are excluded.

## 8. Stop conditions

Never merge, push, deploy, or enable reminder send if any applies:

- tests, lint, build, schema dry-run, or Function dry-run fails;
- unreviewed `origin/main` divergence exists;
- a required Cloudflare VITE value is missing or **REQUIRES MANUAL VERIFICATION**;
- a required Resend/encryption/admin/runtime/function-ID setting is missing or unverified;
- review-api runtime mismatch or `sharp` advisory remains unresolved/unaccepted;
- a schema/table/index is absent, non-private, or not `available`;
- archive/function-ID contract differs from deployed target;
- rollback revision or command is unknown;
- controlled smoke test shows duplicate, authorization, PII, booking/review/coupon integrity, or Pages configuration failure.

## 9. Rollback procedures

| Problem | Rollback | Data policy |
| --- | --- | --- |
| Frontend / Pages build | Restore known-good Pages deployment reported as `4b6dd3e` | Do not alter Appwrite schema/data |
| reservation-api | Restore prior Function revision and prior write-mode/permissions | Reservations remain |
| reservation-notification | Restore prior revision and stop new side effect | Reservations and ledger rows remain |
| review-api | Restore prior revision | Reviews/coupons/invites remain; do not rotate tokens/coupons |
| booking-reminder | Set mode to `dry-run` or disable schedule | Keep ledger audit rows |
| schema/index | Stop dependent Function release | Retain additive schema; do not delete customer/audit rows |
| Cloudflare VITE incident | Restore Pages deployment, correct environment out of band | Never add hardcoded source fallback |

## 10. Local verification and security evidence

Fresh verification in the recovery worktree completed with exit 0: root `npm install --package-lock=false`; nested `(cd appwrite-functions/review-api && npm install --package-lock=false)`; `git diff --check`; `npm test`; `npm run lint`; `npm run build`; `node scripts/setup-appwrite.mjs --dry-run`; and all four Function deploy dry-runs for reservation-api, reservation-notification, review-api, and booking-reminder.

Each Function dry-run reported `wouldFailApply: true` in this value-free worktree. That proves source/deploy contract parsing only, not live secrets, resource IDs, runtime, schema availability, or Cloudflare configuration.

The Vite build emitted the non-fatal large-chunk warning. The nested review-api production dependency audit reported a high-severity `sharp`/libvips advisory; root production dependency audit reported none. Repository scans found no hardcoded bearer/API-key literal, secret-named `VITE_*` variable, plaintext coupon/token log, full email-body log, or public email-ledger/retry-claim permission. This is source evidence only, not a Cloudflare, secret-manager, or production database audit.

## 11. Explicitly deferred features

- D-3 coupon-expiry reminder;
- provider GET/webhook reconciliation and full-access Resend key;
- automatic/background retry, force resend, multi-attempt retry leases, and reminder retry UI;
- schema/data cleanup or token/coupon regeneration migrations.
