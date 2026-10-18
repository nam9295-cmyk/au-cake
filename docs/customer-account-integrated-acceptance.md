# Integrated customer account acceptance — 2026-10-19

Scope: existing `verygood-au-account-test`, `ca-test-reservation-api`, G/H and
the single cancelled Renewal v2 fixture `ca-myorders-g-read-20261019`.
Production/main/SMTP/schema/order creation are excluded. Previously completed
Google/cart/readiness/ACL acceptance is preserved; no health action is allowed.

## Approved limits and reconciled baseline

- One new Appwrite deployment; at most ten read-only executions.
- B7 execution budget starts at 9/120; actual historical Function inventory is
  19, including the ten earlier B6 executions outside that B7 budget.
- OPEN20 and CLOSED21 only. Cloudflare inventory has 22 deployments: B3 initial
  three documented in `customer-account-b3-google-validation.md`, then B7's 19.
  This reconciles the two counters without increasing the approved limits.
- Explicit manual termination, no fifteen-minute deadline. Confirmed drift or
  three consecutive failed safety reads causes emergency shutdown.
- Separate user approval permits test `authJWT` temporarily ON for SDK JWT
  creation; it returns OFF at closure. Other authentication methods remain OFF.

## Connection and safeguards

The test Pages deployment uses a server-only advanced-mode Worker to sign and
forward only `customer-orders` and `customer-order` for the fixed fixture. The
browser obtains a short-lived JWT from its real Google session. No Owner
credential, signing key or Owner signature enters the browser. The relay checks
the JWT through Appwrite Account; the unmodified product handler independently
verifies platform JWT/user ID and order ownership. H's G-order query reaches
the original ownership check. Missing authentication receives relay HTTP 401
without consuming a Function execution; this is distinct from invoking an
unauthenticated product Function action.

Function execution roles are limited to existing G/H, not `any`. Its new test
entry validates the new frozen runtime key digest, manual window, exact target,
HMAC/body/path/timestamp/nonce, a read-only action allowlist and ten-call limit.
Renewal writes/preorders stay false. No order policy or product code is relaxed.
The browser serializes requests and tracks dispatch claims across its tabs;
the server relay/runtime also impose per-instance limits. The independent Mac
monitor checks actual global execution inventory, signatures and guard logs;
per-instance counters are not claimed as a distributed Appwrite quota. At ten
actual executions it disables further Function access while Account/profile/cart
remain available for manual completion. Unexpected execution or configuration
drift triggers full shutdown. No call is retried automatically.

The actual AccountPage, profile service, CartProvider and AU Renewal bag/Checkout
are reused. Network boundaries block direct DB/Function access, OTP and order
writes; Checkout submission is disabled at both UI and transport boundaries.
Profile inputs accept only the documented synthetic G/H values. Lists/details
record full browser latency and fail when it reaches the original ten-second
frontend limit. Browser evidence contains actor labels, actions, HTTP/timing
only; no JWT, signatures or contact data are copied.

## Execution and restoration

Local guard/relay/core storage tests: 13 PASS, 0 FAIL. Changed TSX ESLint passes.
AU artifact and server Worker compile. Source/lock attestation and secret scans
pass. Local Worker tests confirm private server-source route 404, preview-host
denial and unauthenticated relay 401. Actual integrated acceptance remains
NOT RUN until the user operates Chrome.

Protected controller/evidence directory:
`.superpowers/sdd/2026-10-19-customer-account-integrated-acceptance/`.
The exact controller uses `manage.mjs open`, independent `monitor`, and
`manage.mjs close`; creation/deployment claims prevent duplicate attempts.

On user `종료`, or a confirmed emergency: Account OFF/403, Function disabled and
execute empty, customer/Renewal flags false, signing key revoked, B6
`6ad41e576cb7a8f346af` restored, test JWT OFF, this run's G/H sessions removed,
CLOSED21 deployed and directly verified. Production four semantic fingerprints
must match. Synthetics, saved profiles and carts are preserved.

**B5 — DEFERRED / RELEASE BLOCKER**. Original D1 health timeout remains
UNRESOLVED; historical AU raw fingerprint difference remains UNVERIFIED.
Actual order creation/JWT owner linkage is NOT RUN in this read-only acceptance.

## Manual results and relay correction

The user confirmed that G/H show separate carts, names and phone numbers.
These observations are PASS; they do not establish order ownership checks.
Copied browser evidence records G list HTTP 503 in 1,095 ms and H's foreign
fixture detail HTTP 503 in 1,017 ms, both with zero upstream/execution timing.
Three Guest requests returned relay HTTP 401. The independent inventory monitor
observed zero additional Function executions. The G list and H foreign-detail
attempts are FAIL (503); successful own-detail 200 and foreign-detail 404 remain
NOT RUN. Guest 401 proves the relay boundary only.

The deployed relay passed `redirect: 'error'` to native fetch. Native Cloudflare
workerd rejects that option with a TypeError before sending the first request;
the injected Node transport tests had not exercised that runtime contract.
A network-isolated local workerd reproduction returned 503 with zero mocked
outbound requests before correction. With `redirect: 'manual'`, the same
reproduction returns 200 after two mocked requests. Neither reproduction calls
real Appwrite or consumes the execution budget.

The local correction explicitly rejects authentication redirects and never
follows redirects with a user JWT; execution redirects remain fail-closed too.
Related guard/relay/original ownership/storage tests: 15 PASS, 0 FAIL, 0 skipped.
The native workerd result is a local mock result, not provider acceptance.
No Function or DB change is needed. Applying the correction requires one more
OPEN Pages deployment beyond OPEN20, while preserving a final CLOSED deployment;
that extra deployment is not authorized by the original OPEN20/CLOSED21 limit.
Until separately approved, the deployed relay is unchanged and no additional
Pages deployment or Function execution is performed for this correction.
