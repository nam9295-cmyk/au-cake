# VERYGOOD AU — Customer readiness 17→5 local optimization

2026-10-18. Worktree `au-cake-customer-account`, branch `feat/customer-account`. This local change is **not** deployed to Appwrite, Cloudflare Pages, production or main.

## What changed

- `appwrite-functions/reservation-api/src/customer-account-readiness.js`: `assertCustomerResourceInventory` collects the **fresh, complete** list of collection metadata from each known database and returns a map by database/collection ID.
- DB inventory count, IDs, duplicates, missing and unclassified collections are rejected; incomplete/partial list responses fail closed.
- Existing private and public ACL rules still run on each collection's returned `enabled`, `documentSecurity` and `$permissions`. No positive cache, cross-request metadata reuse, privilege increase or bypass was added.
- Owner attribute and index checks remain exact and are now fetched concurrently after the ACL checks.
- Cost for current test target with DB2 / Collection12: **1 DB list + 2 parallel Collection lists + 2 parallel owner schema reads = 5 metadata requests**, formerly 17 sequential. This is a static count, **not measured real provider latency**.
- Existing JWT verification, order ownership, cursor, Guest, pricing/coupons, Checkout, B6 and D1 reservation `health` logic are unchanged.

## Local evidence

- Added RED→GREEN tests that reject unknown/missing/duplicated collections, incomplete ACL metadata, unsafe private/public grants and later ACL drift. These tests require the full inventory path with no `getCollection` calls.
- Updated synthetic metadata fixtures and B7/migration/ownership tests to provide realistic complete collection listings. No security assertion was removed.
- Account-related regression tests: **365 PASS / 0 FAIL**, including protected customer-order/foreign-owner paths.
- Changed-file ESLint: **PASS** (full repository-wide lint was not completed; it was stopped after an unusually long run).
- TypeScript and AU build: **PASS** (`VITE_MARKET=AU npm run build`); existing bundle-size warnings only.
- Full `npm test` on Mac Node24.12.0: **2,142 PASS / 0 FAIL / 1 existing SKIP**, across 69 complete test groups (exit 0). The prior default AU chunk-size warnings remain.

## Mandatory gates before actual release

1. Through the authorized read-only **test** Owner API, confirm Appwrite 1.8.1 `listCollections` actually returns all 12 collections with the exact `$permissions`, `enabled` and `documentSecurity` fields for the Function scope. If missing or incomplete, do not deploy this optimization; do not weaken ACL validation.
2. Record request timings and first identify why the original `checkReservationReadiness` settings + seven metadata calls timed out in D1. This optimization does **not** fix or explain that earlier 20-second timeout.
3. Any test Function deployment must be separately approved. Freeze run env/window/signing key **before** a new deployment and validate fresh runtime; never reuse a warm deployment after changing env variables.
4. Customer order E2E (G own order, H foreign 404, Guest separation, profile autopopulate) is still NOT RUN. The 10-second UI bound also needs measured latency validation. Test account and Pages remain CLOSED at the last recorded checkpoint.
5. **B5 — DEFERRED / RELEASE BLOCKER.** Email OTP actual sends/Google↔OTP UID and shared SMTP safeguards remain open. Historical production AU raw settings difference is **UNVERIFIED**.

No remote project/settings/DB/Function/Pages or main changes have been made as part of this local optimization.
