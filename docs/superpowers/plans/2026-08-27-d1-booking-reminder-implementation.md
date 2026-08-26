# D-1 booking reminder implementation plan

**Scope:** Task 9B only. This plan implements the approved D-1 reminder design
without changing existing booking, review, retry, or SMS/message-copy flows.

## 1. Shared Sydney time contract

- Extract the existing reviewed Sydney calendar calculation into the shared,
  server-only `appwrite-functions/shared/sydney-calendar.js` module.
- Preserve `addSydneyCalendarDays` semantics used by review/coupon expiry and
  expose `getSydneyDateParts`, `formatSydneyDateKey`, and
  `isSydneyReminderWindow` for the reminder Function.
- Cover normal dates plus DST start/end and the inclusive 10:00–10:59 Sydney
  scanning window before moving the review code to the shared implementation.

## 2. Reminder candidates and pagination

- Add a private `booking-reminder` Function with an injected repository,
  transport, clock, and logger boundary for network-free tests.
- Gate execution before any database work unless the Sydney local hour is 10;
  calculate tomorrow as a Sydney calendar date.
- Query Cake reservations by `status = 예약확정` and `pickupDate = targetDate`,
  Class first sessions by `status = Confirmed` and `classDate = targetDate`,
  and Advanced sessions by `status = Confirmed` and
  `advancedClassDate = targetDate`.
- Use cursor pagination with a page size of 50, flatten rows into normalized
  Cake / Class-session candidates, and process them with a three-worker pool.
- Re-read each source row immediately before payload/ledger work and skip rows
  that are cancelled, completed, rescheduled, malformed, or lack a valid
  recipient.

## 3. Delivery identity and templates

- Extend the existing allowlisted event-key builder only for the new
  `booking-reminder-d1-customer` template, validating Cake dates and Class
  `first`/`advanced` session occurrences.
- Reuse `deliverEmail`, recipient/payload hashing, first-send claim,
  `firstAttemptAt`, attempts, deterministic Resend idempotency key, and shared
  provider classification. No retry action or automatic retry is added.
- Create Cake/Class v1 Korean-first bilingual HTML and text templates using the
  existing HTML/control-character protections. Restrict data to the approved
  customer-facing allowlists; omit notes, admin memo, detailed allergy,
  emergency, internal, review, coupon, and payment-audit data.

## 4. Function and deployment contract

- Implement `BOOKING_REMINDER_MODE` with strict `dry-run|send` values and a
  `dry-run` default. Dry-run may query/revalidate/build summaries but must not
  write the ledger or call transport.
- Add a deploy config/runtime/script for the new 30-second private Function:
  hourly `0 * * * *`, no event triggers, empty user execute access, and only
  database/document read-write scopes.
- Package the entrypoint, reminder modules, shared Sydney/email modules, and
  Node dependencies in the archive. Require the dynamic runtime
  `x-appwrite-key` in send mode; never add an `APPWRITE_API_KEY` fallback.

## 5. Source schema, documentation, and verification

- Add only the three approved composite source-schema indexes and extend the
  private delivery/claim template enums. Do not apply schema changes.
- Add package scripts, deploy/archive/schema tests, and README rollout/rollback
  guidance including dry-run default and D-3 deferral.
- Follow RED → GREEN per focused behavior, then run targeted tests,
  `git diff --check`, `npm test`, lint, build, setup dry-run, and new deploy
  dry-run. Create local commits only after every check passes.

## Rollout / rollback boundary

Production rollout remains a future manual operation: apply indexes and wait
for availability, deploy the Function in `dry-run`, validate a scheduled scan,
then explicitly switch `BOOKING_REMINDER_MODE=send`. Rollback is independent of
booking flows: switch back to `dry-run` and/or disable the schedule while
preserving ledger rows for audit.
