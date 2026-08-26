# Safe Email Retry & Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add one explicit, concurrency-safe Safe Retry path for all five transactional email events without automatic retry, force resend, or business-state mutation.

**Architecture:** Keep initial delivery on the existing shared ledger/sender. Extend it to stamp immutable firstAttemptAt, add a pure retry-eligibility helper plus a private, one-use retry-claim repository, then route domain-specific authoritative payload reconstruction through reservation-notification and review-api actions. UI only consumes a minimal status DTO from those authenticated actions.

**Tech Stack:** Node 16 Appwrite Functions, node-appwrite Databases documents API, Resend HTTP transport abstraction, React/TypeScript, node:test.

**Spec:** docs/superpowers/specs/2026-08-27-email-retry-reconciliation-design.md

## Global Constraints

- Retry is an administrator click only; do not add a scheduler, event retry, queue, page-load retry, Force resend, provider GET, webhook, or full-access Resend key.
- Safe Retry is allowed only before firstAttemptAt plus 23 hours, with equal canonical recipientHash and payloadHash, the existing deterministic idempotency key, a retryable state/error, and no previous claim.
- A logical email receives one initial provider attempt and at most one manual Safe Retry. A retry claim is immutable and never released.
- Review invite retry must reuse the current active encrypted token. Reward retry must reuse the persisted encrypted coupon and must never issue or alter one.
- Browser clients must not send recipient, eventKey, payload, template, idempotency key, coupon, review token, or status as authority.
- Preserve all existing customer/operator receipts, confirmation email, review email, reward email, SMS/message copies, review submission, coupon redeem, and admin status editing.
- Do not push, deploy, apply schema, write production data, call real Resend, alter Cloudflare, or touch feat/vanilla-detail.

## Implementation Units

1. **Ledger schema/time semantics:** add immutable firstAttemptAt and the exact 23-hour provider safety window without inferring a legacy timestamp.
2. **Retry eligibility pure logic:** keep all state/hash/error/window checks deterministic and outside Appwrite/Resend adapters.
3. **Retry claim repository:** use one private, unique eventKey claim as the immutable MVP retry opportunity.
4. **Booking email retry server action:** reconstruct the three booking payload kinds from current reservation data, then fail closed on identity changes.
5. **Review email retry server action:** reconstruct an active encrypted invite or committed encrypted coupon without rotating/issuing either secret.
6. **Admin status DTO:** expose only status, retry reason, safe timing, and a masked recipient through authenticated Function actions.
7. **Admin UI:** add small explicit controls in existing booking, review-invite, and reward contexts while retaining all copy/SMS actions.
8. **Tests/deploy/schema dry-run:** prove the private schema, archive/config boundary, transport-free TDD behaviour, and full regression suite.

---

### Task 1: Shared retry contract and initial-attempt timestamp

**Files:**
- Modify: appwrite-functions/shared/email-delivery.js
- Modify: appwrite-functions/shared/email-delivery-repository.js
- Modify: appwrite-functions/shared/email-delivery-sender.js
- Modify: appwrite-functions/shared/resend-transport.js
- Test: tests/email-delivery.test.mjs
- Test: tests/shared-resend-transport.test.mjs

**Interfaces:**
- Produces EMAIL_SAFE_RETRY_WINDOW_MS equal to 23 * 60 * 60 * 1000.
- Produces evaluateEmailDeliveryRetry({ delivery, identity, retryClaim, now }) returning a fail-closed result with status, retry, retryUntil, and safeErrorCode only.
- Extends markAttempt(delivery, now) to set firstAttemptAt only when absent, increment attempts, and set lastAttemptAt.
- Extends Resend symbolic classification to distinguish terminal validation/422/idempotency errors, retryable external configuration/key/quota errors, and uncertain timeout/network/408/5xx/concurrency errors without saving raw provider bodies.

- [ ] **Step 1: Write failing shared-contract tests**

Add tests for first initial mark setting firstAttemptAt and attempts one; a second mark leaving firstAttemptAt unchanged; missing firstAttemptAt denial; 22:59 eligibility; exact 23:00 denial; sent/fresh pending/terminal denial; stale pending and uncertain eligibility; recipient and payload mismatch; and existing retry claim denial.

Add transport tests for validation_error 400 and 422 errors being terminal, key/config 401 and verified-domain-style 403 candidates being retryable-after-fix, quota/rate candidates being retryable-after-fix, and 408/5xx/concurrent idempotency being uncertain.

- [ ] **Step 2: Run the focused tests RED**

Run: node --test tests/email-delivery.test.mjs tests/shared-resend-transport.test.mjs

Expected: failures identify missing firstAttemptAt, safe retry decision, or symbolic provider classifications.

- [ ] **Step 3: Implement the smallest shared changes**

Keep the current eventKey, payloadHash, recipientHash, pending lease, and idempotency helper unchanged. Add strict timestamp parsing and retry error allowlists to email-delivery.js. Update markAttempt with an immutable firstAttemptAt write only when the document lacks it. Expand only the allowlisted Resend parser/error mapping; discard all other response body fields.

- [ ] **Step 4: Run the focused tests GREEN**

Run: node --test tests/email-delivery.test.mjs tests/shared-resend-transport.test.mjs

Expected: all focused shared tests pass with no network access.

- [ ] **Step 5: Commit later with the foundation task**

Do not commit before retry claims, schema, and deploy/archive contract tests are green.

### Task 2: Private retry claim repository, generic retry execution, schema, and deploy contracts

**Files:**
- Create: appwrite-functions/shared/email-delivery-retry-claim-repository.js
- Create: appwrite-functions/shared/email-delivery-retry.js
- Modify: scripts/review-schema.mjs
- Modify: scripts/setup-appwrite.mjs
- Modify: scripts/reservation-notification-deploy-config.mjs
- Modify: scripts/review-api-deploy-config.mjs
- Modify: .env.example
- Modify: README.md
- Test: tests/email-delivery-retry.test.mjs
- Test: tests/review-schema.test.mjs
- Test: tests/reservation-notification-deploy.test.mjs
- Test: tests/review-api-deploy.test.mjs

**Interfaces:**
- createEmailDeliveryRetryClaimRepository({ databases, databaseId, collectionId }) exposes getByEventKey, createClaim, getOrCreateClaim, and markCompleted.
- retryEmail({ payload, delivery, deliveryRepository, retryClaimRepository, transport, claimedByUserId, now, log, error }) re-evaluates identity, creates the unique claim before markAttempt/transport, and returns only safe status data.
- Schema adds optional email_deliveries.firstAttemptAt and private email_delivery_retry_claims with unique eventKey, sourceType, sourceId, template, claimedByUserId, claimedAt, createdAt, updatedAt, optional completedAt/lastErrorCode, and no public permissions.

- [ ] **Step 1: Write failing retry-claim and schema tests**

Use a fake Appwrite adapter to prove first claim creation wins, a 409 re-read denies the second caller, an existing claim prevents a provider call, and claim creation/validation rejection does not increment attempts. Assert successful retry increments attempts once and keeps firstAttemptAt.

Assert retry-claim schema privacy, eventKey uniqueness, minimum fields, firstAttemptAt optionality, default resource ID, setup dry-run coverage, server-only environment variable handling, unchanged minimal Function scopes, and both deployment archives include the new shared modules.

- [ ] **Step 2: Run the focused tests RED**

Run: node --test tests/email-delivery-retry.test.mjs tests/review-schema.test.mjs tests/reservation-notification-deploy.test.mjs tests/review-api-deploy.test.mjs

Expected: failures identify missing retry repository/module/schema/config/archive entries.

- [ ] **Step 3: Implement repository and generic retry executor**

Use the retry-claims collection in the same private review-resource database. Create the immutable claim after eligibility and before provider work. On 409, re-read and return retry_already_claimed without transport. Mark the claim’s controlled terminal result after transport when possible; if claim/result persistence is ambiguous, fail closed and never create a second claim.

Add the optional resource ID to runtime configuration without making ordinary initial sends depend on it. Only retry actions require the configured claim repository.

- [ ] **Step 4: Implement schema/config/docs**

Add firstAttemptAt as optional string size 40. Add the private collection to REVIEW_COLLECTIONS and resource resolution; include it in setup plans and keep all public/admin-browser permissions empty. Add the env placeholder and README migration order: firstAttemptAt attribute, retry claims table/index/permissions, Functions, then UI; no backfill.

- [ ] **Step 5: Run focused tests GREEN**

Run: node --test tests/email-delivery-retry.test.mjs tests/review-schema.test.mjs tests/reservation-notification-deploy.test.mjs tests/review-api-deploy.test.mjs

Expected: all foundation, schema, and archive tests pass.

### Task 3: Booking retry/status actions and client contracts

**Files:**
- Modify: appwrite-functions/reservation-notification/src/main.js
- Modify: src/lib/booking-confirmation-email.ts
- Create: src/lib/booking-email-retry.ts
- Test: tests/reservation-notification-retry.test.mjs
- Test: tests/booking-confirmation-email-client.test.ts
- Create: tests/booking-email-retry-client.test.ts

**Interfaces:**
- get-booking-email-status accepts sourceType, reservationId, and emailKind from the allowlist booking-received-operator, booking-received-customer, booking-confirmed-customer.
- retry-booking-email accepts the identical minimal input and returns the common safe status DTO.
- Existing send-booking-confirmation and get-booking-confirmation-status contracts remain supported.
- Client helpers expose getBookingEmailStatus and retryBookingEmail without accepting payload, recipient, or eventKey.

- [ ] **Step 1: Write failing booking action tests**

Test anonymous/non-admin rejection before source/ledger access; canonical reservation re-read; client spoofed recipient/eventKey/payload ignored; operator/customer/confirmation event keys remain distinct; confirmed status still required for confirmation retry; exact rebuilt payload succeeds; changed pickup detail yields payload_changed; changed stored email yields recipient_changed; operator recipient set remains canonical; claim conflict calls transport once; and retry does not mutate reservation.

- [ ] **Step 2: Run booking tests RED**

Run: node --test tests/reservation-notification-retry.test.mjs tests/reservation-notification-confirmation.test.mjs tests/reservation-notification-email.test.mjs

Expected: new retry/status actions and safe DTO parsing are missing.

- [ ] **Step 3: Implement booking actions**

Preserve event-trigger handling. In the existing admin action branch, authenticate first, re-read the current reservation, construct the allowlisted original template through the existing payload builders, read the ledger, evaluate retry, and only then create the retry claim and invoke shared retry execution. Build eventKey server-side. Return no raw ledger/hash/provider value.

For booking-received-operator reconstruct the normalised RESEND_TO_EMAILS set. Do not expose an operator retry UI.

- [ ] **Step 4: Implement browser parser/helpers**

Keep the existing confirmation API stable. Add strict parsing for the common status DTO and generic booking helpers; reject unknown keys and never surface private values.

- [ ] **Step 5: Run booking tests GREEN**

Run: node --test tests/reservation-notification-retry.test.mjs tests/reservation-notification-confirmation.test.mjs tests/reservation-notification-email.test.mjs tests/booking-confirmation-email-client.test.ts tests/booking-email-retry-client.test.ts

Expected: retry, status, and existing confirmation/receipt tests pass.

### Task 4: Review invitation/reward retry/status actions and client contracts

**Files:**
- Create: appwrite-functions/review-api/src/review-email-retry-actions.js
- Modify: appwrite-functions/review-api/src/main.js
- Modify: appwrite-functions/review-api/src/review-invite-actions.js
- Modify: appwrite-functions/review-api/src/review-reward-email.js
- Modify: src/lib/review-repository.ts
- Modify: src/lib/admin-reviews.ts
- Test: tests/review-email-retry-actions.test.mjs
- Test: tests/review-invite-actions.test.mjs
- Test: tests/review-reward-email.test.mjs
- Test: tests/review-invite-email-client.test.ts
- Test: tests/admin-review-reward-client.test.ts

**Interfaces:**
- get-review-email-status and retry-review-email accept either invite data (sourceType/reservationId) or reward data (reviewId), determined by allowlisted emailKind.
- Active encrypted invite retry reconstructs the same URL; used, expired, and hash-only legacy invites fail closed.
- Reward retry re-reads the committed review, linked coupon, source reservation, and decrypts the existing coupon; it never creates/updates a coupon or review.
- Existing get-review-invite-email-status remains compatible.

- [ ] **Step 1: Write failing review retry tests**

Test admin guard before source/ledger work; active invite retry uses the same token and never invokes issueReviewInvite; used/expired/legacy invite denial; changed recipient/payload denial; reward retry uses the same persisted coupon code, percentage, and expiry; no coupon issuance; and retry claim conflicts prevent duplicate transport.

Test minimum DTO parsing hides hashes/provider IDs/token/coupon and clients reject spoofed fields.

- [ ] **Step 2: Run review tests RED**

Run: node --test tests/review-email-retry-actions.test.mjs tests/review-invite-actions.test.mjs tests/review-reward-email.test.mjs tests/review-invite-email-client.test.ts tests/admin-review-reward-client.test.ts

Expected: generic review retry/status actions and parsers are missing.

- [ ] **Step 3: Implement review actions**

Route new actions through the existing admin gate in handleReviewRequest. Use getReviewInviteLifecycle plus encrypted-token recovery for invitations without issuing or rotating an invite. Reuse the existing reward payload builder after authoritative review/coupon/source reads and existing decryption. Reuse common retry evaluator/executor and return only safe DTOs.

- [ ] **Step 4: Implement client contracts**

Extend review-repository for invitation status/retry and admin-reviews for reward status/retry. Keep existing copy-review-invite-request, send-review-invite-email, reward message copy, and public review submit parsers unchanged.

- [ ] **Step 5: Run review tests GREEN**

Run: node --test tests/review-email-retry-actions.test.mjs tests/review-invite-actions.test.mjs tests/review-reward-email.test.mjs tests/review-invite-email-client.test.ts tests/admin-review-reward-client.test.ts

Expected: retry respects same token/coupon and all existing review flows remain green.

### Task 5: Contextual admin controls and regression verification

**Files:**
- Create: src/BookingReceiptEmailStatus.tsx
- Modify: src/BookingConfirmationEmailButton.tsx
- Modify: src/ReservationDrawer.tsx
- Modify: src/ClassReservationDrawer.tsx
- Modify: src/ReviewInviteButton.tsx
- Modify: src/AdminReviewsPage.tsx
- Test: tests/booking-email-retry-component.test.mjs
- Test: tests/review-invite-button-contract.test.mjs
- Test: tests/admin-review-reward-component.test.mjs
- Test: existing drawer/message-copy contract tests

**Interfaces:**
- A compact customer booking-receipt status exposes Retry email only when retry is eligible.
- Confirmation UI consumes the common DTO while preserving Send confirmation email and SMS copy.
- ReviewInviteButton retains Send review email and Copy review request.
- AdminReviewsPage retains 리워드 메시지 복사 and adds reward delivery state/retry without retaining coupon plaintext in state.

- [ ] **Step 1: Write failing UI contract tests**

Assert cake/class receipt retry appears only for eligible failed/uncertain states; confirmation retry appears only when eligible; expired/payload-changed/recipient-changed/claimed states show safe fallback and no retry button; ReviewInviteButton preserves Copy review request and only adds retry for eligible state; reward UI shows status/retry without coupon code; and all existing cake/class SMS/payment/confirmation copy contracts remain.

- [ ] **Step 2: Run UI tests RED**

Run: node --test tests/booking-email-retry-component.test.mjs tests/review-invite-button-contract.test.mjs tests/admin-review-reward-component.test.mjs

Expected: retry controls/status components are absent.

- [ ] **Step 3: Implement minimal UI**

Place a small booking receipt status line in cake/class drawers; extend confirmation status copy to describe eligible and non-eligible reasons; add Retry email click handlers only to explicit admin interactions. Extend ReviewInviteButton and AdminReviewsPage with equivalent controlled status. Do not retry during component mount, timer, or page reload.

- [ ] **Step 4: Run UI and existing copy tests GREEN**

Run: node --test tests/booking-email-retry-component.test.mjs tests/review-invite-button-contract.test.mjs tests/admin-review-reward-component.test.mjs tests/reservation-drawer.test.mjs tests/class-reservation-drawer.test.mjs

Expected: all retry controls are contextual and existing copy controls are preserved.

### Task 6: Full verification and local commits

**Files:**
- Verify only all files changed by Tasks 1–5.

- [ ] **Step 1: Inspect final diff**

Run: git diff --check

Expected: no whitespace errors and no unrelated file changes.

- [ ] **Step 2: Run targeted suites**

Run the shared retry, claim, booking action/client/UI, review action/client/UI, email-delivery, schema, and deploy/archive tests added above.

Expected: all pass with fake transport/adapters.

- [ ] **Step 3: Run repository verification**

Run:

    npm test
    npm run lint
    npm run build
    node scripts/setup-appwrite.mjs --dry-run
    node scripts/deploy-reservation-notification.mjs --dry-run
    node scripts/deploy-review-api.mjs --dry-run

Expected: exit code 0 for each. Dry-run may report wouldFailApply in the clean environment but must not make network calls.

- [ ] **Step 4: Commit verified changes**

Create one or two local commits only after all commands are green:

    feat: add safe email retry foundation
    feat: add admin email retry controls

Do not push, deploy, apply schema, write production data, or send an email.
