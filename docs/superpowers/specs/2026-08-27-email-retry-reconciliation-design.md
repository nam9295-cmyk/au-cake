# Email retry and reconciliation design

**Status:** approved design for the next implementation task. This document does
not change runtime behaviour.

## 1. Goals / Non-goals

This is one common, conservative recovery policy for every transactional email:

1. booking received — operator;
2. booking received — customer;
3. booking confirmation — customer;
4. review invitation — customer; and
5. review reward coupon — customer.

The policy makes durable Appwrite email_deliveries rows the long-term audit and
duplicate-prevention record, makes retry an explicit authenticated administrator
action, and preserves the existing SMS/message-copy fallbacks.

It does **not** add automatic retries, a scheduler, force-send, resend-as-new,
provider GET/webhook reconciliation, a broad Resend key, an email control-centre,
or a customer-facing email history endpoint. It never changes a reservation,
review, invite, or coupon as an effect of retrying email.

## 2. Existing Architecture

The current implementation already has a shared Function-only delivery layer.

- email_deliveries is a private review-resource collection. Browser sessions,
  including administrator browser sessions, have no direct read/create/update/
  delete permission. Functions use the runtime x-appwrite-key to access it.
- eventKey is unique and is built from an allowlisted template, source type, and
  validated Appwrite source ID. Templates are booking-received-operator,
  booking-received-customer, booking-confirmed-customer,
  review-invite-customer, and review-reward-customer.
- A newly created ledger row is the current first-send claim. It starts pending
  with attempts 0, then markAttempt records an attempt immediately before
  transport is invoked. A 409 unique-index conflict is re-read and evaluated,
  not used as a second claim.
- The pending lease is five minutes. Fresh pending means in_progress; stale
  pending and uncertain require reconciliation and are deliberately not resent
  today.
- recipientHash is SHA-256 of a normalised recipient. Operator recipients are
  normalised, deduplicated, sorted, joined deterministically, then hashed.
  payloadHash is SHA-256 of canonical JSON containing from, recipient set,
  reply-to, subject, text, HTML, template, and template version. It contains no
  secret.
- The deterministic provider key is verygood:sha256(eventKey). It is 73
  characters, within Resend's 256-character maximum.
- deliverEmail maps an existing sent row to already_sent, fresh pending to
  in_progress, failed to retry_deferred, and uncertain/stale pending to
  reconciliation_required. It never automatically calls the provider for an
  existing row.
- The booking Function uses separate payloads and Promise.allSettled for
  operator and customer receipts. Manual booking confirmation re-reads the
  reservation server-side and uses the same ledger/transport.
- The review invitation action reuses the active encrypted review token, and the
  post-commit reward hook re-reads and decrypts the persisted coupon. Neither
  plaintext secret is stored in the ledger.

providerMessageId currently receives result.id from POST /emails. This is the
**Resend Email Resource ID**, not an RFC/Internet Message-ID. The field is
retained for compatibility and its documented meaning is now exactly “provider
email resource ID”. It is not renamed to providerEmailId: a rename adds
migration risk without benefit before production schema rollout. A future
feature that needs RFC message_id must add a distinct field, not reinterpret
this one.

## 3. Resend Constraints

This design follows Resend's documented behaviour:

- an idempotency key is 1–256 characters;
- the same key and same request are deduplicated for 24 hours;
- the same key with a different request is rejected as
  invalid_idempotent_request;
- a request while that key is in progress is
  concurrent_idempotent_requests; and
- a successful send response returns an email resource id.

Sources: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys),
[send email API](https://resend.com/docs/api-reference/emails/send-email), and
[Resend errors](https://resend.com/docs/api-reference/errors).

The 24-hour provider window is a short safety guard, **not** audit retention and
not the application source of truth. email_deliveries remains the long-lived
audit and deduplication record.

The MVP continues to require only the existing sending-capable RESEND_API_KEY.
It does not add RESEND_RECONCILE_API_KEY or a full-access key. Resend documents
that sending access cannot perform non-send resource operations, while full
access can; requiring broader access only for reconciliation violates least
privilege for this low-volume service. See
[API key access](https://resend.com/docs/dashboard/api-keys/introduction).

## 4. Security / Least Privilege

Every retry endpoint is a server action. Before source, ledger, or payload work,
it verifies the canonical admin guard: x-appwrite-user-id against the configured
REVIEW_ADMIN_USER_IDS allowlist. The Function's dynamic x-appwrite-key is used
only for server-side Appwrite access and never has an APPWRITE_API_KEY fallback.

The reservation-notification Function keeps exact administrator execution
permissions for manual actions. The review API must remain publicly executable
for public review submission, so retry actions use mandatory server-side admin
validation rather than widening permission or trusting a browser.

The client may send only a source identifier and allowlisted email kind. It is
never authoritative for recipient, subject, body, template, event key,
idempotency key, status, coupon, token, or payload hash.

Do not log or persist raw recipient email, email body/HTML, request headers,
RESEND_API_KEY, x-appwrite-key, review URL/token, coupon plaintext/ciphertext,
or customer note/allergy/emergency information. Continue logging only safe event
keys, controlled error codes, status, and a masked or hashed recipient if needed.

## 5. Delivery State Model

The email_deliveries.status enum remains exactly pending, sent, failed, and
uncertain.

| Status | Durable meaning | Normal action |
| --- | --- | --- |
| sent | Resend accepted the request and the ledger recorded its Email Resource ID. | Never retry; return already_sent. |
| pending | A send claim is active; the five-minute lease distinguishes fresh from stale. | Fresh: wait. Stale: treat as uncertain and evaluate only through explicit Safe Retry. |
| failed | Resend clearly rejected before acceptance, or a terminal local/provider validation error was recorded. | Only the retryable-after-fix subset can Safe Retry. |
| uncertain | Delivery cannot be proved absent or accepted. | Explicit Safe Retry only within the safe window and after all identity checks. |

No retrying state is added to email_deliveries. A separate private retry claim
represents in-progress manual retry, so the original result is not overwritten
just to acquire a lock. A fresh retry claim is presented as pending with retry
state wait. If that claim itself is stale after the existing five-minute lease,
it is presented as uncertain with manual_fallback: it is not re-claimed or
automatically retried.

attempts means the number of durable provider-invocation claims: first send is
one; the single Safe Retry below adds one. Status reads, eligibility checks,
clipboard/SMS copies, and blocked requests do not increment it. A claim is
persisted immediately before transport, which is the durable boundary for an
attempted provider call.

## 6. Retry Eligibility Matrix

Safe Retry is allowed only when **all** conditions hold:

1. the status/error category is eligible;
2. authoritative source data can rebuild the original payload;
3. rebuilt recipientHash equals the stored hash;
4. rebuilt payloadHash equals the stored hash;
5. the original deterministic Resend idempotency key can be reused;
6. now is strictly before the safe-retry deadline; and
7. there is no terminal condition and no previous manual retry claim.

| Current row / condition | Retry DTO | Provider call |
| --- | --- | --- |
| no delivery row | not_sent / not_needed | Use ordinary initial-send action, not retry. |
| sent | sent / not_needed | Deny. |
| fresh pending | pending / wait | Deny. |
| stale pending, all conditions true | uncertain / eligible | One explicit Safe Retry may claim and send. |
| uncertain, all conditions true | uncertain / eligible | One explicit Safe Retry may claim and send. |
| retryable failed, all conditions true | failed / eligible | One explicit Safe Retry may claim and send. |
| expired window | original status / expired_window | Deny. |
| recipient or payload differs | original status / recipient_changed or payload_changed | Deny. |
| terminal error, missing first-attempt time, unavailable source, unrecoverable secret, or retry claim consumed | original status / terminal_error or manual_fallback | Deny. |

There is one manual Safe Retry claim per logical email event. This caps attempts
at initial claim plus one administrator retry. It is safer than repeated button
presses; existing message-copy/SMS fallback remains available if the retry is
unsuccessful or uncertain.

## 7. Idempotency Window

The chosen application safety window is **23 hours from firstAttemptAt**.
Eligibility is now < firstAttemptAt + 23 hours; equality is already expired. The
one-hour margin covers clock skew, response latency, and ambiguity about when
Resend begins its documented 24-hour retention interval.

createdAt is **not** the retry clock. It means the pending ledger row was
created and may precede any provider attempt. lastAttemptAt remains useful for
the five-minute lease and audit but never extends the deadline. Retrying at
22:59 does not start a new 23- or 24-hour window.

Add immutable, optional-for-compatibility firstAttemptAt to email_deliveries. It
is set with the first durable provider-attempt claim and never changes. Existing
rows without it are not given a fabricated time and are not Safe Retry eligible;
they use manual fallback. New rows have it before transport runs.

## 8. Payload Reconstruction

The ledger intentionally contains neither raw recipient nor body. Retry rebuilds
authoritative data and compares hashes before a claim:

| Email type | Authoritative reconstruction requirements |
| --- | --- |
| Booking received — operator | Reservation is readable; rebuild existing operator-recipient set and receipt template. |
| Booking received — customer | Re-read reservation and valid customer/parent email, then receipt. |
| Booking confirmation | Re-read reservation. It must still be in canonical confirmed status with a valid stored recipient. |
| Review invitation | Re-read completed source and the same active, unexpired invite; decrypt existing envelope and use that same token/link. Used, expired, and legacy hash-only invites cannot retry. |
| Review reward | Re-read committed review, linked active coupon, and source; decrypt existing coupon envelope and use exactly that code, percentage, and persisted expiry. Never issue a coupon. |

An edited pickup time, order, class session, email, recipient set, or template
input changes a hash. Return payload_changed or recipient_changed and deny
retry. Sending changed information is a future **new communication event**, not
a retry; no stored hash is overwritten to force a retry.

## 9. Concurrency Strategy

**Chosen option: private unique email_delivery_retry_claims (Option B), with
the existing deterministic Resend key as last defence.**

The implementation must not assume production Appwrite supports a usable
transaction/CAS feature merely because a local SDK exposes transactions. Direct
ledger state updates (Option C) allow two administrators to read the same
eligible state, race updates, and lose counters.

For an eligible event, create one retry-claim document with unique eventKey. The
caller whose create succeeds alone increments attempts, writes lastAttemptAt,
and calls transport. A 409 is re-read as an active/consumed claim and returns
pending/wait without calling Resend. A retry claim older than five minutes
returns uncertain/manual_fallback, also without calling Resend. One-time claim
makes an ambiguous retry unrepeatable by button clicks.

The same original idempotency key and exact payload remain Resend's final
defence for an unexpected crash after claim but before a final ledger write. It
is not the long-term duplicate-prevention source of truth.

## 10. Server APIs

Both Functions use one shared evaluator and retry-claim repository; domain
actions only choose an allowlisted payload builder.

Reservation notification:

    { action: 'retry-booking-email',
      data: { sourceType: 'cake' | 'class', reservationId: 'Appwrite ID',
              emailKind: 'booking-received-operator' |
                         'booking-received-customer' |
                         'booking-confirmed-customer' } }

get-booking-email-status takes the same data. The existing
get-booking-confirmation-status stays compatible and delegates internally for
its one kind.

Review API:

    { action: 'retry-review-email',
      data: { emailKind: 'review-invite-customer',
              sourceType: 'cake' | 'class', reservationId: 'Appwrite ID' } }

    { action: 'retry-review-email',
      data: { emailKind: 'review-reward-customer', reviewId: 'Appwrite ID' } }

get-review-email-status uses the same discriminated input. Existing review
invite status stays compatible and delegates internally.

All status/retry responses have only:

    {
      status: 'not_sent' | 'pending' | 'sent' | 'failed' | 'uncertain',
      retry: 'not_needed' | 'eligible' | 'wait' | 'expired_window' |
        'payload_changed' | 'recipient_changed' | 'terminal_error' |
        'manual_fallback',
      sentAt?: string,
      lastAttemptAt?: string,
      retryUntil?: string,
      recipientMasked?: string,
      safeErrorCode?: string,
    }

They never reveal ledger documents, hashes, provider resource IDs, token, coupon
code, HTML, text, or provider body.

## 11. Admin UX

Do not add a dashboard. Add only contextual controls:

- Cake/class drawers: retain the existing confirmation-email block and SMS/
  message copy. Add a compact booking-receipt delivery line only when it needs
  attention and a Safe Retry control when its customer-receipt DTO is eligible;
  add the same control to confirmation when that DTO is eligible.
- ReviewInviteButton: current status area gains the same action when eligible.
  Copy review request remains and uses the same encrypted-token URL.
- AdminReviewsPage: the existing reward section next to 리워드 메시지 복사 shows
  reward-email state and Retry email only when eligible.

Recommended text: “Safe to retry — the original email content has not changed.”
For uncertain delivery: “Delivery could not be confirmed. Retrying within the
safety window reuses the same delivery ID.” Terminal and expired states say:
“This email can no longer be retried safely. Use the message copy option
instead.” There is no Force resend, Send anyway, or retry button for sent, fresh
pending, expired-window, changed, or terminal records.

## 12. Email-type-specific Recovery

The shared policy covers all five types. Booking-received **operator** has
server capability through retry-booking-email but no administrator UI button in
this task. A failed operator receipt does not hide a reservation, which the
operator already sees in admin; customer recovery and message-copy paths are
more valuable.

Booking receipt retry never changes reservation state. Booking confirmation
requires current confirmed state and never changes it. Review invitation retry
uses the same encrypted token/link and never rotates an invite. Reward retry
uses the committed encrypted coupon and never creates, reissues, or extends it.
Missing/invalid legacy email, deleted source, used/expired invite, or
unrecoverable envelope returns manual_fallback, never a fake recipient or
regenerated secret.

## 13. Data Model Changes

These are **future implementation/migration requirements**, not changes made by
this document.

1. Add firstAttemptAt to private email_deliveries: optional ISO string, maximum
   40. It is immutable once present. Existing rows remain valid but cannot Safe
   Retry.
2. Add private email_delivery_retry_claims in the same private review-resource
   database. It has no public or browser-admin permissions. Required fields:
   eventKey (string 128, unique), sourceType, sourceId, template, status
   (pending|sent|failed|uncertain), claimedAt, createdAt, and updatedAt.
   Optional fields: completedAt and lastErrorCode (80). It stores no recipient,
   body, token, coupon, or payload hash.
3. Add APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID as a server-only Function
   variable after schema exists. Both Functions need only current
   databases/documents read-write scopes; no new user, storage, or Resend scope.

providerMessageId remains optional string 128 with the documented Email Resource
ID meaning. No rename occurs.

Future rollout order: create private schema and wait for attributes/indexes;
deploy Functions and server-only variable; then deploy contextual admin UI.
Rollback hides UI/actions first, then rolls Function code back while retaining
audit and retry-claim records. Do not drop either collection in rollback.

## 14. Error Classification

Persist only controlled symbolic codes; parse at most allowlisted provider codes
and discard raw response bodies.

| Current/normalised code | Durable status | Safe Retry policy |
| --- | --- | --- |
| resend_invalid_idempotent_request | failed | Terminal. Same key already saw another payload; fail closed. |
| resend_invalid_idempotency_key | failed | Terminal programming/key error; do not retry same logical event. |
| resend_concurrent_idempotent_requests | uncertain | Eligible only within 23h and after common checks/no claim. |
| resend_timeout, resend_network_uncertain, resend_http_408, resend_http_409 with no recognised provider code, resend_http_5xx, resend_invalid_success_response | uncertain | Eligible only within 23h and after common checks. Never assume sent. |
| resend_http_429 or curated future resend_rate_limit_exceeded, resend_daily_quota_exceeded, resend_monthly_quota_exceeded | failed | Retryable after wait/fix, within 23h and common checks. |
| resend_http_400, resend_http_401, resend_http_403, resend_http_422 | failed | Retryable only after external configuration/domain/credential correction, within 23h with unchanged hashes. |
| resend_http_404, resend_http_405, other unrecognised 4xx, local identity mismatch, unavailable source/envelope/recipient | failed or no attempt | Terminal/manual fallback. |
| ledger-write or claim persistence failure | no safe state assumed | Manual fallback; do not manufacture claim or call transport. |

Current transport already makes 408/5xx/network uncertain and recognises the
three idempotency errors. Future refinement may store the listed curated 429
codes but must not store arbitrary provider text.

## 15. Testing Strategy

Implementation uses fake repositories and fake transport only; it makes no
Resend or production-Appwrite call. At minimum test:

1. sent denies retry; fresh pending denies retry; stale pending within window is
   eligible only through an explicit action;
2. retryable failed within window is eligible, terminal failed is denied,
   uncertain within window is eligible, and the exact 23-hour boundary denies;
3. retry updates lastAttemptAt but never firstAttemptAt or retryUntil;
4. equal rebuilt recipient/payload is allowed; changed recipient/payload denies
   before provider;
5. retry reuses exact idempotency key and attempts increments only for winning
   provider-attempt claim;
6. simultaneous administrators create one unique retry claim and one provider
   caller; conflict returns pending/wait, while a stale retry claim returns
   uncertain/manual_fallback without another provider call;
7. client recipient/eventKey/subject/body/template/status/coupon/token spoofing
   is ignored; anonymous/non-admin is rejected before source/ledger access;
8. confirmation retry leaves reservation unchanged; operator receipt has no UI
   retry; SMS/message-copy contracts remain;
9. invite retry uses same encrypted link; reward retry uses same committed
   coupon and never regenerates it;
10. all five kinds use common evaluator and DTO has no raw ledger/provider/PII;
11. schema tests verify private permissions, unique index, optional
   firstAttemptAt, retry-claim fields, and deploy/archive tests preserve minimal
   scopes; and
12. existing receipt, confirmation, invitation, reward, coupon, and clipboard
   regressions pass without a full-access Resend key.

## 16. Rollout / Migration

Before implementation, add dry-run schema coverage for both data changes.
Production rollout must create optional firstAttemptAt and private retry claims
first, wait for readiness, deploy Function code/variables, then deploy the
small UI controls.

Do not backfill old rows. A fabricated first-attempt time falsely extends
provider safety. Existing sent stays sent; legacy failed/uncertain/stale records
without firstAttemptAt show manual fallback.

## 17. Future Provider Reconciliation

A later, separately approved feature may retrieve stored Resend Email Resource
IDs or consume webhooks with a broader provider permission. It may map:

- accepted/success: sent, delivered, opened, clicked, complained;
- in-flight: queued, scheduled, delivery_delayed; and
- failure: failed, bounced, suppressed, canceled.

That feature reconciles a ledger row without sending new mail. It is absent from
this MVP: no full-access key, provider GET, or webhook is called, and an expired
safe-retry window never becomes permission to resend.

## 18. Explicitly Deferred Features

- automatic retry, scheduler, queue, and background retry worker;
- a second or unlimited Safe Retry for one event;
- force resend, resend-as-new, updated-confirmation/new-event UI, and an
  operator-reason/audit workflow for those actions;
- provider GET/webhook reconciliation and every full-access Resend credential;
- email control centre, generic delivery-history page, or customer delivery
  status endpoint; and
- changes to email templates, review/coupon validity, reservation data, review
  invite lifecycle, coupon issuance, SMS provider behaviour, or clipboard
  message-copy behaviour.
