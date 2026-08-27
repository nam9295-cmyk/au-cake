# Post-review bilingual reward coupon email implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a review and its reward coupon are durably committed, send at most one Korean-first/English-second reward email without changing review or coupon success semantics.

**Architecture:** Keep `submitReview` as the sole owner of validation, reward calculation, coupon encryption, and Appwrite transaction commit. Its post-commit result is passed to a narrowly scoped reward-email side effect that re-reads the committed coupon and authoritative source reservation, builds an allowlisted payload, and uses Task 2's `email_deliveries` first-send claim plus the shared Resend transport. Every email error is caught at the post-commit boundary and cannot alter the public review-success response.

**Tech Stack:** Appwrite Function / node-appwrite, Node AES-256-GCM coupon recovery, React/TypeScript customer review page, private `email_deliveries`, injected test repositories and transports.

**Spec:** User-approved Task 6 “Post-review bilingual reward coupon email” requirements (2026-08-27).

## Observed review-submit commit boundary (2026-08-27)

`submitReview` first validates the token, input, and completed source. Inside an Appwrite transaction it re-reads the invite and source, derives the trusted photo reward, creates the review, creates the encrypted coupon envelope, and marks the invite used. It calls `commitTransaction` only after those three writes have been staged. Its public result contains `rewardPercent`, the coupon code, and `couponExpiresAt` only after that commit resolves.

If the commit response is lost, it rolls back locally and uses `reconcileSubmittedReview` to re-read the invite, review, and coupon. A success result is returned only when all persisted fields—including coupon hash, reward, expiry, source, and used timestamp—match the proposed submission. The reward-email hook must therefore run after either a direct commit or this positive reconciliation, receive only private committed identifiers, re-read its authoritative records, and be unable to change the public success result.

## Global constraints

- Work only on `fix/au-email-automation-recovery`; do not modify `feat/vanilla-detail`.
- Do not push, deploy, apply schemas, write production data, change Cloudflare, or make a real Resend request.
- Do not add coupon fields, coupon keys, or VITE secrets. Reuse the encrypted coupon envelope, existing review-api Resend variables, and `email_deliveries`.
- Resend may run only after the review transaction commits and a committed result is available.
- Missing/invalid recipient, source lookup, decryption, ledger, or transport errors are non-fatal side effects; no coupon regeneration or review/coupon rollback.
- Keep existing ReviewPage coupon-success UI and Task 5 review invite behavior unchanged.

---

### Task 1: Trace and lock the post-commit contract

**Files:**
- Read: `appwrite-functions/review-api/src/business.js`, `src/main.js`, coupon envelope/digest helpers, review repository/client, review/coupon tests, Task 5 email modules.
- Modify test: `tests/review-api.test.mjs` and/or a dedicated `tests/review-reward-email.test.mjs`.

**Interfaces:**
- Consume the exact committed review/coupon result returned by `submitReview`.
- Produce an explicit post-commit hook boundary that can be injected in tests.

- [x] Write failing transaction-order tests: no email before commit, no email after a failed review/coupon transaction, and exactly committed result data reaches the hook.
- [x] Run the focused test and confirm failure because no reward-email hook exists.
- [x] Add the smallest optional post-commit hook invocation only after durable commit/reconciliation succeeds; catch every hook error at this boundary.
- [x] Run review submission and coupon regression tests; assert public coupon success response remains unchanged.

### Task 2: Build the authoritative bilingual reward payload

**Files:**
- Create: `appwrite-functions/review-api/src/review-reward-email.js`
- Test: `tests/review-reward-email.test.mjs`

**Interfaces:**
- `buildReviewRewardEmailPayload({ review, coupon, reservation, couponCode, from, replyTo, cakeOrderUrl })` accepts only committed server records and returns a Resend payload with `review-reward-customer:review:{reviewId}` identity.
- `resolveReviewRewardRecipient(reservation, sourceType)` normalizes only cake `customerEmail` or class `parentEmail`.

- [x] Write failing template tests for Korean-first/English-second content, persisted 5/10 percent, persisted Sydney expiry rendering, coupon code, CTA/text fallback, privacy allowlist, escaping, and control-character handling.
- [x] Run the focused test and confirm the module is absent.
- [x] Implement the payload builder with the shared recipient/payload/event/idempotency helpers; use the persisted coupon expiry rather than recomputing dates.
- [x] Run template tests and prove no review body, rating, photo, order, admin, allergy, emergency, ID, envelope, or provider fields enter either body.

### Task 3: Connect post-commit delivery with failure isolation

**Files:**
- Modify: `appwrite-functions/review-api/src/business.js`, `appwrite-functions/review-api/src/main.js`
- Create/modify: `appwrite-functions/review-api/src/review-reward-actions.js` only if a small adapter keeps `main.js` focused.
- Test: `tests/review-reward-email.test.mjs`, `tests/review-api.test.mjs`, `tests/shared-resend-transport.test.mjs`.

**Interfaces:**
- Re-read the committed coupon, decrypt it with the existing coupon envelope helper, then re-read its source reservation after commit.
- `attemptReviewRewardEmail(...)` returns an internal delivery outcome and never throws across the submit-success boundary.

- [x] Write failing tests for authoritative cake/class recipients, spoofed client values ignored, encrypted committed-code recovery, deterministic review-ID event key, unique concurrent first-send claim, and no coupon regeneration.
- [x] Write failing failure-isolation tests for missing/invalid recipient, source/decrypt/ledger errors, 4xx/5xx/timeouts, sent/pending/failed/uncertain states, and unchanged public success.
- [x] Run the focused tests and confirm the expected missing post-commit behavior.
- [x] Implement the smallest post-commit adapter using shared `deliverEmail`; map unavailable recipient/decryption to safe skipped/failed logs without creating a fake ledger recipient.
- [x] Run focused tests and retain Task 5 invite and coupon redemption regressions.

### Task 4: Archive/config and complete verification

**Files:**
- Modify only if required: `scripts/review-api-deploy-runtime.mjs`, `tests/review-api-deploy.test.mjs`, `package.json`, `README.md`
- Test: review deploy/archive and all existing suites.

- [x] Add an archive regression test for the reward runtime source.
- [x] Ensure no new schema/env value is required; existing review-api Resend, coupon encryption, delivery-table variables and scopes remain sufficient.
- [x] Run `git diff --check`, targeted tests, `npm test`, `npm run lint`, `npm run build`, `node scripts/setup-appwrite.mjs --dry-run`, and `node scripts/deploy-review-api.mjs --dry-run`.
- [ ] Create `feat: send bilingual review reward emails` only after every command exits successfully; do not push or deploy.

## Rollback impact

Reverting the Task 6 commit removes only the post-commit email side effect. Existing reviews, coupon encryption/redeem, the immediate ReviewPage coupon display, review invite email, and optional schema fields remain compatible. No reward coupon needs to be regenerated or revoked for rollback.
