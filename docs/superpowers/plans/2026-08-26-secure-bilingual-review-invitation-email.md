# Secure bilingual review invitation email implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized administrator send one idempotent Korean-first/English-second review invitation email for a completed cake or class booking without rotating an existing active review link.

**Architecture:** `review-api` remains the authoritative boundary: it authenticates the administrator, re-reads the reservation, creates or recovers an encrypted review token, constructs the allowlisted message, and uses the shared delivery ledger plus Resend transport. The browser asks only for an action and source ID; it receives a minimal status or copy-ready message and never reads delivery rows or encrypted token fields.

**Tech Stack:** React/TypeScript, Appwrite Functions with node-appwrite, AES-256-GCM from Node crypto, existing private `email_deliveries` ledger, injected fake repositories/transports in Node tests.

**Spec:** User-approved Task 5 “Secure bilingual review invitation email” requirements in this conversation (2026-08-26).

## Global Constraints

- Work only in `fix/au-email-automation-recovery`; do not modify the dirty `feat/vanilla-detail` worktree.
- Do not push, deploy, apply an Appwrite schema, write production data, alter Cloudflare, or send a real Resend request.
- Keep `tokenHash` as review authorization; encrypted token material is recovery-only and never logged or sent to the browser except inside the copy-ready customer message.
- Reuse Task 2/3 `email_deliveries` identity/claim semantics. Failed, pending, stale-pending, and uncertain events do not automatically resend in this task.
- Keep existing review submission, coupon issue/redeem, and review-request copy capability working. Do not implement Task 6 reward email or any reminder.

---

### Task 1: Lock the review-token recovery contract with tests

**Files:**
- Create: `appwrite-functions/review-api/src/invite-token-envelope.js`
- Modify: `appwrite-functions/review-api/src/business.js`
- Test: `tests/review-invite-token-encryption.test.mjs`, `tests/review-api.test.mjs`

**Interfaces:**
- Produces `resolveReviewInviteTokenEncryptionKey`, `encryptReviewInviteToken`, and `decryptReviewInviteToken` using a deterministic AAD composed from invite ID, source type, and reservation ID.
- Produces `issueReviewInvite(..., { tokenEncryptionKey })` that returns the existing active token when its complete encrypted envelope can be authenticated.

- [ ] Write tests showing a new invite stores only `tokenHash` plus AES-GCM envelope, decrypts with its own AAD, rejects a wrong key/AAD, and preserves 30 Sydney calendar days.
- [ ] Run the focused test and observe failure because the envelope module and recovery behavior do not exist.
- [ ] Implement the smallest AES-256-GCM envelope following the existing coupon encoding rules and validate the 32-byte base64url key fail-closed.
- [ ] Replace unused-invite rotation with: active envelope reuse; used/review rejection; expired rejection; legacy hash-only `REVIEW_INVITE_UNRECOVERABLE`; no photo cleanup rotation.
- [ ] Run focused token/business tests and retain existing hash-only review submission coverage.

### Task 2: Add private schema/config/archive support

**Files:**
- Modify: `scripts/review-schema.mjs`, `.env.example`
- Modify: `scripts/review-api-deploy-config.mjs`, `scripts/review-api-deploy-runtime.mjs`, `scripts/deploy-review-api.mjs`
- Test: `tests/review-schema.test.mjs`, `tests/review-api-deploy.test.mjs`

**Interfaces:**
- `review_invites` gets optional `tokenCiphertext`, `tokenIv`, `tokenAuthTag`, `tokenEncryptionVersion` fields for legacy compatibility.
- The review deployment config requires the separate token key and customer-email Resend configuration, marks only secrets as secrets, and archives the shared ledger/transport modules.

- [ ] Write schema/deploy tests for optional envelope fields, separate canonical key, no VITE value, masked dry-run output, private source permissions, and archive inclusion.
- [ ] Run those tests and observe the expected missing configuration/schema/archive failures.
- [ ] Add the minimal schema and deployment source changes without applying them or broadening public/admin direct access.
- [ ] Run focused schema/deploy/archive tests and `node scripts/review-api-deploy-config.mjs`-level dry-run tests.

### Task 3: Reuse one safe delivery transport and build bilingual email payloads

**Files:**
- Create/modify shared delivery modules under `appwrite-functions/shared/`
- Modify: `appwrite-functions/reservation-notification/src/main.js`
- Create: `appwrite-functions/review-api/src/review-invite-email.js`
- Test: `tests/reservation-notification.test.mjs`, `tests/review-invite-email.test.mjs`, `tests/email-delivery*.test.mjs`

**Interfaces:**
- Produces a shared injected Resend transport and first-send delivery helper retaining Task 3’s 400/409/408/5xx mapping.
- Produces `buildReviewInviteEmailPayload({ source, sourceType, token, ... })`, with `review-invite-customer:{sourceType}:{reservationId}`, deterministic Resend idempotency key, escaped Korean-first HTML/text content, and no private source fields.

- [ ] Write payload/template tests for recipients, bilingual ordering, 5% text/10% photo honest-review wording, both 30-day policies, safe URL/text fallback, and injection/privacy exclusions.
- [ ] Run them to observe failures before template and shared delivery integration exist.
- [ ] Extract only the reusable transport/delivery pieces from reservation notification, retaining its public exports and regression contracts.
- [ ] Implement the review payload builder using the configured canonical frontend origin, not a new hardcoded origin.
- [ ] Run focused email, ledger, and reservation-notification regression tests with fake transports only.

### Task 4: Add authenticated review email/copy/status actions

**Files:**
- Modify: `appwrite-functions/review-api/src/main.js`, `appwrite-functions/review-api/src/business.js`
- Create/modify: review delivery repository adapter as needed
- Test: `tests/review-api.test.mjs`, `tests/review-invite-email.test.mjs`

**Interfaces:**
- Accepts only `{ action, data: { sourceType, sourceReservationId } }` for `send-review-invite-email`, `copy-review-invite-request`, and `get-review-invite-email-status`.
- Returns safe minimal delivery DTOs: status, optional `sentAt`, optional masked recipient, and a copy-ready bilingual message for the copy action.

- [ ] Write authorization, authoritative reservation re-read, completed-state, missing email, spoofed client field, submitted/expired/legacy invite, and safe status DTO tests.
- [ ] Run focused API tests and observe failures for unknown actions or missing implementations.
- [ ] Implement server-only admin allowlist checks before reservation reads; use runtime `x-appwrite-key` only for Appwrite/ledger access.
- [ ] Implement the first pending-row claim, ledger status mapping, no retry policy, and safe failure isolation without changing reservation or review data.
- [ ] Run focused API/email delivery tests; verify no log assertion exposes keys, tokens, URLs, recipient addresses, notes, or allergy content.

### Task 5: Wire the admin UI and bilingual copy flow

**Files:**
- Modify: `src/lib/review-repository.ts`, `src/lib/review-messages.ts`, `src/ReviewInviteButton.tsx`
- Test: `tests/review-messages.test.ts`, `tests/review-invite-button*.test.*`, `tests/admin-pages-module-contract.test.mjs`

**Interfaces:**
- Browser sends only action/source IDs and parses only safe status/message DTOs.
- `ReviewInviteButton` provides primary **Send review email** and secondary **Copy review request** while retaining clipboard/toast behavior and handling sent, pending, failed, uncertain, used, expired, missing-email, and legacy-unrecoverable states.

- [ ] Write client/UI tests for action allowlists, server-originated bilingual copy, state-dependent disabled controls, existing copy preservation, and no token/ledger internals in status responses.
- [ ] Run them to observe failures against the current one-button/token-returning implementation.
- [ ] Implement the minimal request parsers and UI state queries/actions without changing review submission or unrelated admin drawers.
- [ ] Run focused UI/client/message tests and preserve the existing admin module contracts.

### Task 6: Verification and local commit

**Files:** all Task 5 files only.

- [ ] Run `git diff --check`.
- [ ] Run targeted review invite/encryption/template/UI/ledger/schema/deploy tests, then `npm test`, `npm run lint`, `npm run build`, `node scripts/setup-appwrite.mjs --dry-run`, and `node scripts/deploy-review-api.mjs --dry-run`.
- [ ] Record each command’s real exit code and distinguish source verification from any missing optional local runtime configuration.
- [ ] If and only if all commands pass, create a local commit such as `feat: add secure bilingual review invitation emails`; do not push or deploy.

## Rollback impact

This adds optional encrypted fields and new admin-only Function actions. A rollback consists of reverting the local Task 5 commit and redeploying the prior Function/frontend only after an operator decides to do so; existing `tokenHash` authorization and completed reviews continue to work. The optional envelope attributes may remain harmlessly in schema, and no reservation, review, coupon, SMS, or delivery data is modified by rollback.
