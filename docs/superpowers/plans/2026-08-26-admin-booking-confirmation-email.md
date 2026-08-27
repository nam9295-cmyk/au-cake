# Admin booking confirmation email implementation plan

## Scope

Add an administrator-triggered final confirmation email for cake and class
reservations.  The existing reservation-created receipt event remains a separate
entry path; changing a reservation status never sends an email.

## Files and steps

1. Extend `appwrite-functions/reservation-notification/src/main.js` with two
   admin-only actions: `send-booking-confirmation` and
   `get-booking-confirmation-status`.  Authenticate with the existing exact
   `REVIEW_ADMIN_USER_IDS` allowlist and `x-appwrite-user-id`, then use the
   runtime `x-appwrite-key` to re-read the current reservation.  Validate only
   cake `예약확정` and class `Confirmed` before creating an allowlisted,
   sanitized customer template.
2. Reuse the Task 2/3 delivery ledger, payload identity and Resend transport.
   The confirmation event keys are
   `booking-confirmed-customer:{sourceType}:{reservationId}`.  Reuse the
   first-pending-row claim and return only safe, masked delivery status to the
   browser; failed, uncertain and stale states are never automatically resent.
3. Add a small client action module and a confirmation-button component.  Wire
   it into `ReservationDrawer.tsx` and `ClassReservationDrawer.tsx` without
   changing the existing status-save flows or any SMS/message copy controls.
   The component will query the server-side status when opened and disable
   unsafe states, missing recipient addresses and duplicate sends.
4. Extend `scripts/reservation-notification-deploy-config.mjs` and its tests so
   the Function retains its reservation-created event trigger and permits
   manual execution only for configured admin user roles; anonymous execution
   remains absent.  Add only required runtime variables and document them in
   `.env.example` if needed.
5. Write red tests before each implementation unit: authorization and
   authoritative re-read, allowed statuses and privacy-safe templates, ledger
   idempotency/status query, client request minimality, drawer/SMS contracts,
   and deploy permission/archive contracts.  Then run targeted tests followed
   by the complete test, lint, build, and dry-run suite.

## Rollback impact

This is an additive manual Function action plus admin UI.  A rollback can
remove the frontend deployment and revert this local commit; existing booking
receipt events and SMS copy paths remain independent.  No schema migration or
production deployment is part of this task.
