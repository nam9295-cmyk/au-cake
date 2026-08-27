# D-1 booking reminder design

**Status:** Task 9A design. This document defines the future implementation
boundary only; it does not change runtime behaviour.

## 1. Goals / Non-goals

The system sends one Korean-first, English-second transactional reminder at
Sydney local 10:00 on the calendar day before a confirmed cake pickup or Kids
Class session. Cake pickup and every class session are independent logical
events, so a package's first and Advanced sessions receive separate reminders.

It reuses the private `email_deliveries` ledger, deterministic Resend
idempotency key, shared transport, recipient/payload hashes, and first-send
claim. It never changes reservation, payment, review, invite, or coupon state.

It does not add D-3 coupon reminders, locale preferences, SMS/Kakao delivery,
a queue, automatic retry, force-send, provider GET/webhook reconciliation, a
reminder dashboard, or a reminder-specific retry button. Existing booking,
confirmation, review, reward, retry, and SMS/message-copy event keys remain
unchanged.

## 2. Scheduling & Sydney Time

**Chosen architecture: a new `booking-reminder` Appwrite Function.**
`reservation-notification` remains event/manual-action only. The new Function
owns scheduled read/re-read/send batches, so disabling it cannot affect booking
receipts or confirmations.

Its schedule is exactly `0 * * * *`. Cron is not treated as Sydney time. On
every execution, a Sydney helper converts the injected `now` instant to
`Australia/Sydney` parts. The scanner runs only for `hour === 10`, which is the
closed-open local window **10:00:00–10:59:59.999**. At 09:59 and exactly 11:00
it returns a normal no-op. This stays correct across UTC+10/UTC+11 and allows a
server-side recovery execution inside the same hour.

The implementation extracts the existing reviewed `addSydneyCalendarDays`
algorithm into `appwrite-functions/shared/sydney-calendar.js` without changing
review-expiry outputs. It exposes Sydney date parts and canonical `YYYY-MM-DD`.
Tomorrow is `addSydneyCalendarDays(now, 1)` followed by that formatter; it is
never `now + 86_400_000`. Existing normal, DST-start, and DST-end review tests
become regression coverage for the extracted helper.

The Function has no event trigger and `execute: []`. Scheduled executions and
controlled Server SDK/Console executions bypass user execute access, while
browser and anonymous domain callers cannot invoke it. It accepts no action,
recipient, payload, or event-key input; all invocations only pass the time gate
then scan. Appwrite documents that empty execute access denies user execution
but permits scheduled/Server SDK executions, and that `0 * * * *` is hourly
([Functions docs](https://appwrite.io/docs/products/functions/functions)).

## 3. Cake Eligibility

For a target Sydney `YYYY-MM-DD`, a cake candidate requires all of:

- `status === '예약확정'`;
- `pickupDate === targetDate`;
- a valid normalised stored `customerEmail`; and
- a valid Appwrite reservation ID.

`예약신청`, `픽업완료`, `취소`, malformed rows, legacy rows without email, and
every other pickup date are skipped. Payment state is not a substitute for
status. Just before the ledger claim, the Function re-reads the reservation by
ID and repeats status/date checks; a cancelled or rescheduled row creates no
delivery row and sends no old reminder.

## 4. Class Session Eligibility

Class rows are flattened into session candidates only when the reservation has
`status === 'Confirmed'`, a valid normalised stored `parentEmail`, and a valid
reservation ID.

- A **first** candidate requires `classDate === targetDate` and a non-empty
  `classTime`.
- An **advanced** candidate requires `advancedClassDate === targetDate` and a
  non-empty `advancedClassTime`.

Requested, Completed, Cancelled, malformed-session, and invalid-recipient rows
are skipped. Immediately before a send, the Function re-reads the row and
confirms that it is still Confirmed and that the exact session kind still has
the target date/time. A cancellation, date change, or removed session skips the
old candidate.

## 5. Event Identity

The new allowlisted template is `booking-reminder-d1-customer`, with only
`cake` and `class` source types. `sourceId` remains the unmodified Appwrite
reservation ID in the ledger.

The shared event-key builder receives one additive, template-specific
`occurrence` argument. It validates source ID with the existing Appwrite-ID
rule and accepts only these occurrence forms:

```text
cake: YYYY-MM-DD
class first: first:YYYY-MM-DD
class advanced: advanced:YYYY-MM-DD
```

It produces:

```text
booking-reminder-d1-customer:cake:{reservationId}:{pickupDate}
booking-reminder-d1-customer:class:{reservationId}:first:{classDate}
booking-reminder-d1-customer:class:{reservationId}:advanced:{advancedClassDate}
```

Dates are canonical Sydney dates and session kind is a fixed allowlist, never
customer input. Keys remain below the current 128-character limit. Existing
templates reject `occurrence` and keep their exact three-segment keys.

The existing `verygood:sha256(eventKey)` Resend key is reused. Re-running a
scan at 10:05/10:30 or a duplicate scheduler execution reaches the same unique
ledger row and cannot obtain a second first-send claim. Date inclusion means a
28 August reminder does not suppress the required 29 August reminder after a
reschedule. A same-date time change does not make a second event: an unsent row
fails closed on payload mismatch, while a sent row remains final and staff use
the normal direct-contact/message path.

## 6. Query Strategy

The current schema has individual date and status indexes, but this scanner
filters both fields in each query. Appwrite recommends an index covering all
attributes queried together ([Databases API reference](https://appwrite.io/docs/references/cloud/server-rest/databases)).
The future source-schema migration therefore adds these non-unique indexes:

| Collection | Index key | Attributes |
| --- | --- | --- |
| cake `reservations` | `status_pickupDate_idx` | `status`, `pickupDate` |
| class `class_reservations` | `status_classDate_idx` | `status`, `classDate` |
| class `class_reservations` | `status_advancedClassDate_idx` | `status`, `advancedClassDate` |

The scanner makes three narrow cursor-paginated queries with `Query.limit(50)`:

1. cake `status = 예약확정` and `pickupDate = targetDate`;
2. class `status = Confirmed` and `classDate = targetDate`;
3. class `status = Confirmed` and `advancedClassDate = targetDate`.

Each page passes its final document ID to `Query.cursorAfter` and scanning
continues until the page is short. This avoids the default 25-row truncation
and offset drift on changing data ([Appwrite pagination docs](https://appwrite.io/docs/products/databases/legacy/pagination)).
If a class row appears in both class queries, it is two candidates only when
the session kind/date differ; otherwise the deterministic candidate identity
deduplicates it. The final re-read is authoritative over every query result.

## 7. Email Templates

Template versions are `booking-reminder-d1-customer-cake-v1` and
`booking-reminder-d1-customer-class-v1`.

Every message has inline-style HTML and a plain-text fallback. Both use the
same normalised projection and appear as `[한국어]`, Korean content, a visible
divider, then `[English]`, English content. Dynamic names, course labels,
order labels, and free-text-derived values pass through established control
character stripping, one-line normalisation, HTML escaping, and safe attribute
encoding. Raw stored values are never interpolated into a template.

**Cake subject:** `[Verygood] 내일 픽업 예정이에요 | Your cake pickup is tomorrow`

The Korean section thanks `{customerName}`, says the cake pickup is tomorrow,
and includes booking number, pickup date/time, canonical map/location, compact
public order summary, and a contact instruction. The English section gives the
same fields and a clear tomorrow reminder. The compact order summary uses the
stored order-line parser plus product/size/quantity labels. It never includes a
customer request note.

**Class subject:** `[Verygood] 내일 키즈 클래스가 있어요 | Your Kids Class is tomorrow`

The Korean section names the parent and child, identifies `첫 수업` or
`Advanced 세션`, and includes booking number, course/package, date/time,
1 Bundil Blvd location, and the existing general arrival/preparation reminder.
It asks the parent to reconfirm any previously supplied allergy information
without repeating it. The English section presents the same projection and
states the class is tomorrow. It does not include second-child details, detailed
allergy text, emergency contact, consent fields, or payment audit.

The identity remains `YYYY-MM-DD`; Korean and English presentation derive from
the same validated date/time fields. The existing Cake map URL is in both the
HTML link and plain-text fallback.

## 8. Privacy

Cake reminders allow only customer name, reservation number, compact public
order summary, pickup date/time, and public map/location. Class reminders allow
only parent name, child name, reservation number, course/package, session kind,
date/time, public location, and general preparation wording.

They never include or persist `adminMemo`, request note, emergency contact,
detailed allergy information, consent audit fields, Appwrite document/table or
database IDs, provider IDs, ledger IDs, recipient/payload hashes, operator
recipient lists, review/coupon data, headers, or secrets. Logs use target date,
aggregate counts, controlled event-key/status/error values, and a masked or
hashed recipient only when correlation is required.

## 9. Delivery / Idempotency

The future implementation adds `booking-reminder-d1-customer` to the shared
template allowlist/template-source mapping and to the template enum of both
private `email_deliveries` and `email_delivery_retry_claims`. It adds no ledger
table, recipient plaintext field, raw payload field, token, or coupon field.

For each final verified candidate, the Function constructs the authoritative
payload, recipient hash, payload hash, occurrence-aware event key, and existing
deterministic Resend key, then calls `deliverEmail`. The unique pending ledger
row is the first-send claim. Only its winner sets `firstAttemptAt`, increments
`attempts`, updates `lastAttemptAt`, and calls transport. Accepted send records
the existing provider Email Resource ID field; clear provider rejection records
`failed`; timeout, 408, 5xx, reset, and ambiguous acceptance record
`uncertain`.

There is **no reminder-specific Safe Retry action or UI in the first reminder
implementation**. Adding the template to both common allowlists keeps it
compatible with the approved 23-hour evaluator/claim design when a later admin
action is approved. Until then, failed, uncertain, and stale pending reminders
stay fail-closed and staff use normal direct contact. No scheduler retries or
silently marks a delivery sent.

## 10. Failure Isolation

Candidate enumeration, final re-read, payload construction, ledger claim,
transport, and ledger result update are isolated per candidate. An invalid
email is skipped; malformed order data, lookup failure, or ledger failure is a
safe per-candidate failure; provider classification stays shared. No error
changes the source reservation or cancels the batch.

The scheduled execution logs only this safe summary: target date, cake candidate
count, class-session candidate count, sent, skipped, failed, uncertain, and
ledger-error counts. It does not log an email address, name, child name, order,
note, allergy data, body, token, coupon, API key, dynamic key, or raw provider
response.

## 11. Authentication / Scopes

The Function uses the dynamic runtime `req.headers['x-appwrite-key']` with
`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` for its
server client. It has no `APPWRITE_API_KEY` fallback. A missing dynamic key is a
safe configuration error before database work or sending begins.

Required dynamic-key scopes are exactly `databases.read`, `databases.write`,
`documents.read`, and `documents.write`. Read scopes cover candidate/final
reservation and ledger reads; write scopes cover only private ledger
transitions. No user, storage, function, or broader Resend reconciliation scope
is added. `execute: []`, no domain, no HTTP action parser, and Appwrite
scheduling keep this Function out of browser/admin paths.

## 12. Batch Processing

Candidate pages are flattened to deterministic cake/session work items and run
through a fixed worker pool of **three**. This avoids an unbounded `Promise.all`
provider burst while ensuring one bad row or timeout does not stop other
reminders. Each worker awaits final re-read and `deliverEmail` before taking its
next item; `Promise.allSettled` joins the worker loops after every item has an
outcome.

The Function timeout is 30 seconds, matching the existing Review API budget.
The shared Resend transport retains its 10-second request timeout. A 429 records
the shared deterministic failure state; workers continue with unrelated
candidates without a retry/sleep loop. This is intentionally small-volume and
queue-free.

`BOOKING_REMINDER_MODE` is a server-only variable with exact values `dry-run`
or `send`, defaulting to `dry-run` when absent. In dry-run, the Function performs
time gating, narrow queries, validation, and final re-reads but creates no
ledger row and makes no transport call; its summary reports `wouldSend` instead
of `sent`. In send mode it uses normal ledger-backed delivery. No recipient
override is added, so production validation cannot redirect a customer message.

## 13. Testing

Implementation uses injected clock, repository, and transport fakes. It never
calls Appwrite or Resend production network resources. Required tests are:

1. Sydney 09:59 is no-op; 10:00 starts a scan; 10:59 is permitted; 11:00 is no-op.
2. Tomorrow calculation returns correct canonical dates for normal, DST-start,
   and DST-end boundaries without a 24-hour-millisecond shortcut.
3. Confirmed cake tomorrow is eligible; requested, cancelled, completed,
   invalid-email, and non-tomorrow cakes skip.
4. Confirmed class first and Advanced sessions independently become eligible;
   requested, cancelled, completed, malformed, and invalid-recipient rows skip.
5. Cake identity includes pickup date; class identities differ by kind/date; a
   reschedule creates a new identity.
6. Repeated/concurrent scheduled scans invoke transport once for the same key.
7. Final re-read skips a cake/class candidate cancelled or date-changed after
   query and before delivery.
8. Invalid rows, ledger errors, deterministic rejections, and timeouts do not
   stop other candidates; timeout is uncertain and clear rejection is failed.
9. Cake/class subject, HTML, and text fallback are bilingual with Korean first,
   matching booking number/date/time in both sections, and Cake plain-text map.
10. Escaping/control/newline protection holds; no admin memo, note, emergency
    contact, detailed allergy, internal ID, hash, or provider ID leaks.
11. Dry-run creates no delivery row and calls no transport; send records
    `firstAttemptAt` and attempts through the shared helper.
12. Dynamic key, four scopes, empty user execute access, hourly schedule, and
    archive inclusion of shared email/Sydney helpers are all asserted.
13. Existing booking, confirmation, review, reward, retry, coupon, and
    SMS/message-copy regression suites remain unchanged.

## 14. Rollout

1. Apply the future source-schema migration for three composite reservation
   indexes and both reminder template enum values; wait until all are available.
2. Confirm `email_deliveries` and retry-claim permissions remain Function-only
   and their current unique event-key indexes are available.
3. Deploy the new Function with `enabled: false`, `execute: []`, schedule
   `0 * * * *`, four scopes, and `BOOKING_REMINDER_MODE=dry-run`.
4. In staging with synthetic reservations, test gating, pagination, final
   re-read races, and fake/controlled-recipient delivery.
5. In production, make a private server execution during Sydney 10:00–10:59 in
   dry-run and inspect only aggregate summary data.
6. Enable the schedule while still dry-run, confirm the next Sydney 10:00
   summary, then set `BOOKING_REMINDER_MODE=send`.
7. Inspect the next aggregate summary and private ledger statuses; never expose
   ledger data to browser clients.

## 15. Rollback

Set `BOOKING_REMINDER_MODE=dry-run` immediately and disable the
`booking-reminder` schedule. If necessary, disable the Function or redeploy its
previous version. Keep reminder ledger and retry-claim records as private audit
evidence; do not delete or mutate them to reopen sends. Existing reservation,
receipt, confirmation, review, reward, coupon, and message-copy paths continue
because they do not invoke this Function.

## 16. Deferred Features

- D-3 coupon-expiry reminder;
- reminder-specific admin status, Safe Retry, and retry UI;
- manual late-send or catch-up after 11:00 Sydney time;
- resend-as-new for changed same-date details;
- provider GET/webhook reconciliation or a full-access Resend key;
- customer language preference and separate locale messages;
- SMS, Kakao, queue, cron retry, and bulk-campaign behaviour.

## Design self-review

The hourly cron is gated by Sydney local hour, and tomorrow is a Sydney civil
date operation. Event keys distinguish cake pickup date and class session
kind/date. Unique first-send claims protect duplicate scheduled runs; final
re-reads protect cancellation and date races. The design has no automatic
retry, no additional PII in the ledger, and no D-3 coupon scheduler. Its
separate Function, disabled-first rollout, dry-run mode, and schedule-disable
rollback keep existing booking and review email paths independent.
