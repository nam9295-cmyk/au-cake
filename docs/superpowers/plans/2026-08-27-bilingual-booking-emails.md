# Bilingual Booking Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render customer booking-received and booking-confirmed emails as Korean-first and English-second messages without altering delivery identity, retry semantics, or SMS/message copy.

**Architecture:** Keep the reservation-notification Function's existing authoritative reservation projection, payload builders, sanitizers, ledger, and retry reconstruction. Replace only customer receipt/confirmation subject and content factories with bilingual v2 content; operator messages keep their existing v1 projection and version. Existing event keys remain fixed, so an outstanding v1 failed/uncertain delivery naturally evaluates as `payload_changed` against v2.

**Tech Stack:** Node ESM Appwrite Function, inline HTML email, Node test runner, React/TypeScript admin UI contracts.

**Spec:** User-approved Task 8 request in this conversation.

## Global Constraints

- Do not change eventKey, recipientHash, idempotency key, ledger schema, retry claim behavior, firstAttemptAt, 23-hour policy, admin authentication, or provider classification.
- Do not modify operator notifications, review invitation/reward templates, or any SMS/message copy.
- Each customer message is one Korean-first/English-second email with a plain-text fallback.
- Customer template versions become v2; operator receipt stays v1.
- No network calls, deploy, schema apply, push, or production data writes.

---

### Task 1: Characterize v2 customer payload behavior before implementation

**Files:**
- Modify: `tests/reservation-notification-email.test.mjs`
- Modify: `tests/reservation-notification-confirmation.test.mjs`

**Interfaces:**
- Consumes: `buildBookingDeliveryPayload({ reservation, role, from, operatorRecipients, replyTo })`
- Consumes: `buildBookingConfirmationPayload({ reservation, sourceType, from, replyTo })`
- Produces: explicit v2 expectations for subject, bilingual text/HTML, unchanged event identity, and retry compatibility.

- [x] **Step 1: Write failing receipt tests**

```js
assert.equal(cakeCustomer.templateVersion, 'booking-received-customer-cake-v2')
assert.match(cakeCustomer.subject, /^\[Verygood\].*\|.*Booking request received/)
assert.ok(cakeCustomer.text.indexOf('[한국어]') < cakeCustomer.text.indexOf('[English]'))
assert.equal(operator.templateVersion, 'v1')
```

- [x] **Step 2: Run receipt tests and verify they fail because v1 text/version is still emitted**

Run: `node --test tests/reservation-notification-email.test.mjs`

- [x] **Step 3: Write failing confirmation and compatibility tests**

```js
assert.equal(cakeConfirmation.templateVersion, 'booking-confirmed-customer-cake-v2')
assert.match(cakeConfirmation.text, /예약이 최종 확정되었습니다/)
assert.equal(sentV1Status.result.status, 'sent')
assert.equal(failedV1Status.result.retry, 'payload_changed')
```

- [x] **Step 4: Run confirmation tests and verify they fail because v1 content/version is still emitted**

Run: `node --test tests/reservation-notification-confirmation.test.mjs`

### Task 2: Implement customer receipt v2 content

**Files:**
- Modify: `appwrite-functions/reservation-notification/src/main.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `customerCakeRows`, `customerClassRows`, `plainTextCell`, and `escapeHtml`.
- Produces: `booking-received-customer-{cake|class}-v2` payloads with unchanged `booking-received-customer:{sourceType}:{sourceId}` event keys.

- [x] **Step 1: Add minimal bilingual receipt copy/data renderers**

```js
const receiptTemplateVersion = `booking-received-customer-${sourceType}-v2`
const text = ['[한국어]', koreanContent, '', '--------------------', '', '[English]', englishContent].join('\n')
```

- [x] **Step 2: Reuse normalized rows in both language sections and preserve `plainTextCell`/`escapeHtml` at every dynamic boundary**

- [x] **Step 3: Run receipt tests and verify green**

Run: `node --test tests/reservation-notification-email.test.mjs`

### Task 3: Implement customer confirmation v2 content and retry-safe behavior

**Files:**
- Modify: `appwrite-functions/reservation-notification/src/main.js`
- Modify: `tests/reservation-notification-confirmation.test.mjs`

**Interfaces:**
- Consumes: current `confirmationCakeRows`, `confirmationClassRows`, map URL, and `evaluateEmailDeliveryRetry`.
- Produces: `booking-confirmed-customer-{cake|class}-v2` payloads while retaining existing confirmation event key/idempotency key.

- [x] **Step 1: Add bilingual confirmed content around the existing normalized confirmation rows**

```js
const templateVersion = `${BOOKING_CONFIRMATION_TEMPLATE}-${sourceType}-v2`
const html = renderKoreanSection(...) + divider + renderEnglishSection(...)
```

- [x] **Step 2: Assert sent v1 rows return `sent` before hash comparison and failed/uncertain v1 rows return `payload_changed`**

- [x] **Step 3: Run confirmation/retry tests and verify green**

Run: `node --test tests/reservation-notification-confirmation.test.mjs tests/email-delivery.test.mjs`

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `package.json` only if an existing canonical test script needs the new test file.

- [x] **Step 1: Document that booking receipt, booking confirmation, review invitation, and review reward customer emails are Korean + English; operator notifications are unchanged**

- [x] **Step 2: Verify no review/SMS code is changed**

Run: `git diff --check && rg -n "buildSmsMessage|Copy review request" src appwrite-functions`

- [x] **Step 3: Run targeted and full checks**

Run: `npm test && npm run lint && npm run build && node scripts/deploy-reservation-notification.mjs --dry-run`

- [ ] **Step 4: Commit the completed bounded change**

```bash
git commit -m "feat: add bilingual booking emails"
```
