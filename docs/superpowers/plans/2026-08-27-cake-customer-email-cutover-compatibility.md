# Cake customer-email cutover compatibility

## Scope

Temporarily make only `reservation-api` accept the pre-recovery Cake request
shape during the production frontend/API cutover. No frontend, schema,
notification, review, or reminder behavior changes.

## Observed contracts

- `4b6dd3e` Cake requests and their request fingerprint canonical payload omit
  `customerEmail`; its response parsers do not require that field.
- The recovery frontend sends a normalized email and its response parsers
  require it for both single and multi-item Cake responses.
- The current API requires an email in both `canonicalCakeRequestPayload()` and
  `buildCakeReservation()`, so mode handling must be shared by both paths.
- Appwrite Function variables take effect only after a subsequent deployment;
  the existing deploy script already updates variables before creating and
  activating that deployment.

## Implementation steps

1. Add RED tests for the runtime mode resolver, single/multi legacy and new
   Cake requests, response shape, canonical fingerprints, DB projection, and
   deployment-config validation.
2. Add a server-only `CAKE_CUSTOMER_EMAIL_MODE` resolver. Only exact `compat`
   enables compatibility; unset, empty, and invalid runtime values resolve to
   `required`.
3. Thread the resolved mode through Cake canonicalization and reservation
   construction. In compat mode only an omitted `customerEmail` key is
   accepted; a present empty, null, or malformed value still fails
   `INVALID_EMAIL`. Omitted email remains omitted in the canonical payload,
   document data, and response, matching `4b6dd3e` semantics.
4. Preserve valid-email behavior in either mode: trim/lowercase it, persist it,
   return it, and include it in the request fingerprint. Class creation is not
   passed this mode.
5. Add deploy validation for `required`/`compat`, default it to `required`, and
   expose only the server runtime variable in the deployment plan.
6. Document the controlled cutover: deploy recovery API with `compat`, deploy
   recovery frontend and smoke single/multi/Class flows, then redeploy API with
   `required`.
7. Run focused API/deploy tests followed by repository verification and the
   reservation API dry-run before the local-only commit.

## Safety and rollback

`compat` is only a transition setting: it accepts legacy omission but never
accepts malformed email values or writes a placeholder. It does not send
email, change notifications, or alter existing reservations. If cutover smoke
fails, keep/return the API to the prior deployment while retaining the existing
optional schema attribute; do not modify customer data.
