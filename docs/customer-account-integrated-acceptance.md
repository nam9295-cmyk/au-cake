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
Before that separate approval, the deployed relay was unchanged and no additional
Pages deployment or Function execution was performed for this correction.

The user subsequently authorized corrected OPEN21 and final CLOSED22, preserving
OPEN20 and all existing execution/resource limits. The signed scope and original
journal are unchanged; a separate protected continuation approval records the
new Pages slots. The replacement independent monitor completed two real checks
while the previous monitor remained active, then took over with CLOSED22 as its
single closure target. There is no automatic time expiry.

Corrected OPEN21 deployment `add6e093-e8f4-466f-b681-f7c80dc5c17a` has source
`19f1046`, on the existing isolated Pages project/branch. Its custom HTTPS domain
returns Account page 200, enabled integrated-read mode, private Worker-source
route 404 and unauthenticated relay 401 (460 ms, zero Function executions).
Cloudflare inventory is now 24: three initial B3 deployments plus the 21 logical
test Pages deployments. CLOSED22 is reserved and unused. No Function deployment,
variable change, order creation or additional Function execution occurred for
this correction. G own-list/detail and H empty-list/foreign-detail provider
results are pending the user's manual Chrome actions; none is yet marked PASS.

## OPEN21 safety stop and CLOSED22 restoration

The user reported G login succeeded, then the test closed when opening orders.
The first actual read execution, `6ad55f14822b9fa08642`, is `customer-orders`
on the approved integrated deployment. It completed with HTTP 403 in 0.722 s;
its only guard diagnostic is `REJECTED / IDENTITY`. It did not reach runtime
HMAC verification or the original order handler. Its request metadata matches
the approved body hash and server-side signature; that is not proof of runtime
JWT/header delivery. No list/detail success or order-query performance is
established by this rejected execution.

The monitor rejected the guard failure and automatically closed the session.
The generic monitor reason is `POLICY_OR_EXECUTION_MISMATCH`; the execution log
narrows this incident to the guard's identity check, which requires both an
allowed platform UID and a nonempty platform JWT. The specific failing field
was not logged and remains **UNVERIFIED**. Persisted execution request headers
are an allowlist-filtered view and cannot establish that either runtime header
was absent. This is not evidence of an unexpected external execution.

The Appwrite 1.8.1 source exposes a concrete compatibility concern: JWT-only
authentication validates the JWT/session and resolves the user without
populating the cookie/session-secret store. Execution creation generates its
`x-appwrite-user-jwt` only after matching that store secret to an active session.
The test relay sends the short-lived JWT without a session credential. An empty
generated platform JWT is therefore the leading source-supported explanation;
the runtime log has insufficient per-field diagnostics to prove it for this
execution. Sources: [user authentication resource](https://github.com/appwrite/appwrite/blob/1.8.1/app/init/resources.php#L236-L355),
[execution creation](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Modules/Functions/Http/Executions/Create.php#L186-L216).
The product ownership checks and runtime guard have not been relaxed or changed.
Further runtime/deployment work requires a separate authorized scope.

Actual automatic restoration and subsequent Owner/public GET checks confirm:
Account OFF / public 403, JWT issuance OFF, Function disabled / execute empty,
all three customer/Renewal flags false, signing key invalidated, B6 active,
this run's G/H sessions removed, and custom HTTPS site CLOSED22. Closure also
verified the four production semantic fingerprints unchanged. The user must
not attempt to log in while Account is intentionally OFF.

Final usage: one new Function deployment for this integrated session (none for
the relay fix); one of ten approved read executions used; B7 cumulative 10/120;
Pages OPEN20, corrected OPEN21 and CLOSED22 consumed, cumulative 22 logical
test deployments. No orders, coupons, users, schema or payment/mail writes were
created. G/H cart and profile separation PASS remains preserved. G list is
FAIL (403 identity rejection); own detail, H empty list and H foreign-order 404
are NOT RUN. Guest relay 401 is PASS, distinct from original Function 401.
**B5 — DEFERRED / RELEASE BLOCKER**, original D1 timeout and historical AU raw
configuration UNVERIFIED remain unchanged.

## Local JWT transport correction — pending retry approval

The user's request to retry is being prepared locally. The original closed run,
its V3 evidence and usage counters are preserved. No new Function/Pages
deployment or authentication window has been opened.

The test-only relay now forwards the short-lived Appwrite customer JWT in a
nonreserved execution header. HMAC protocol `CA-INTEGRATED-JWT-v2` binds the
request body, nonce, timestamp and a digest of the relay-verified UID plus JWT.
The runtime derives that digest from Appwrite's actual platform UID; changing
the UID or token invalidates the signature. Missing/unknown platform UID still
fails closed. The JWT itself is absent from the path, returned evidence and logs.

After transport validation, the test adapter supplies that JWT to the unmodified
product handler. The original `resolveCustomerIdentity()` still calls Appwrite
Account.get() and requires the returned UID to match the platform UID; the
original order-owner and DB readiness/ACL checks still run. A signed but expired
JWT or a valid token belonging to a different UID returns original HTTP 401.
H's foreign-order request reaches the original owner check and returns 404 in
local tests. A transport signature alone never establishes order ownership.
Identity diagnostics now distinguish `IDENTITY_UID` and `IDENTITY_JWT` and log
only credential-presence/UID-allowlist booleans. Historical runtime evidence
still cannot identify the missing field and remains UNVERIFIED.

Local RED reproduced the 403 before the transport correction. GREEN evidence:

- Related guard/ownership/storage tests: 28 PASS on Node 24 and Node 22.23.3.
- Customer account suite: 378 PASS, 0 FAIL, 0 skipped; ESLint and TypeScript pass.
- Native Cloudflare workerd fetch → test guard → original product handler:
  G list/detail 200, H empty list 200 / foreign detail 404, Guest relay 401.
  This uses synthetic local API responses, an empty generated platform JWT,
  and zero real Appwrite calls/executions. These are not provider PASS results.
- AU test client and server archive built. All 56 original Function files,
  including dependency manifests/lockfile, match the worktree originals.
  Scans of 58 unpacked archive files and 926 public assets find no signing key.
  The manual CLOSED artifact and its no-script page are ready.

Read-only retry preflight confirms OFF/B6/CLOSED, three existing M/G/H users,
no unexpected Functions/webhooks and unchanged production semantic fingerprints.
It also found one G Google session created 8.5 seconds after the prior closure
receipt. That session was removed under the already authorized G/H cleanup;
creation cause is UNVERIFIED. Subsequent GET confirms all test sessions empty.
Account and JWT issuance stayed OFF throughout that cleanup.

Prepared retry scope, **not yet execution-approved**: one new test Function
deployment with a fresh key/window fixed before deployment, OPEN23/CLOSED24,
temporary test Account/JWT ON, existing G/H only, manual termination with the
same emergency shutdown. At most nine additional read executions remain from
the original ten-call acceptance limit; frontend/relay/runtime/monitor all use
that cap. Prior B7 usage is 10/120 and Pages usage 22. No new orders, users,
coupons, health executions, profile writes, schema or operational configuration
changes are included. Existing G/H fixture, carts, saved profiles and PASS
results are reused. The protected retry controller rejects external writes
without a separate approval proof and reserves CLOSED24 for restoration.

Protected local artifacts:
`.superpowers/sdd/2026-10-19-customer-account-integrated-retry/`.
**B5 — DEFERRED / RELEASE BLOCKER** and other unresolved findings persist.

The user subsequently approved the retry scope. Its separate protected approval
binds the scope/archive hashes, test project/Function, one deployment,
OPEN23/CLOSED24 and nine remaining read executions. The original proof and closed
run were preserved. Actual pre-OPEN inventory was 20 Function executions and 25
Cloudflare deployments (three B3 plus 22 logical test deployments).

New test deployment `6ad56315a98353b9a89a` was created on Node 22 after freezing
the fresh runtime key/window and existing eight variable values. OPEN23 and
temporary test Account/JWT ON are confirmed; read-only execution roles remain
G/H only and Renewal writes/preorders false. The independent manual-termination
monitor completed its real startup checks. No Function execution or new order
was used to open the retry; actual MY ORDERS acceptance awaits user Chrome
actions. CLOSED24 remains reserved for manual/emergency restoration. No health
test, SMTP/Google change, additional user, order, coupon or schema write occurred.

## Retry real read acceptance — PASS, still OPEN pending manual stop

The first G list attempt completed server-side with one owned order, HTTP 200
in 4.027 s, but the browser recorded a connection failure at 2.450 s. Two early
H detail attempts received relay busy 409 without Function execution. These
failed attempts remain preserved; the exact browser disconnect cause is
UNVERIFIED. It was not a measured ten-second deadline expiry. A network-isolated
workerd cancellation probe did not reproduce a permanently stuck busy state;
no speculative lock removal or deployment was performed.

The user then explicitly authorized computer-use inspection of this test site.
H's list and foreign detail were checked sequentially on the same Chrome tab.
H was signed out for an unmodified Guest cart comparison; the user personally
completed G Google login, and G's list/detail were then inspected without
navigating away during the requests. No additional deployment was used.

| Real Chrome / original server check | Result | Browser total | Function runtime |
| --- | --- | --- | --- |
| G own list: one cancelled fixture displayed | PASS / 200 | 5.026 s | 3.391 s |
| G own fixture detail and cancelled state displayed | PASS / 200 | 4.788 s | 3.071 s |
| H list: zero orders displayed | PASS / 200 | 4.863 s | 3.450 s |
| H requesting G fixture: original owner check | PASS / 404 | 4.441 s | 3.097 s |

All four successful browser observations are within the original ten-second
frontend limit. Runtime diagnostics confirm allowed platform UID, empty
Appwrite-generated JWT, signed forwarded customer JWT present, original handler
invocation and original 200/404 responses. This confirms the test JWT transport
correction with actual user authentication. Guest relay 401 remains the prior
PASS; it was not rerun or represented as original unauthenticated Function 401.
Order creation/JWT owner assignment remains NOT RUN.

Unmodified cart UI comparison on that same tab: G two items, H four, Guest four.
G explicitly displays that Guest items are saved separately; H's import prompt
is absent. The store/conditional UI logic is consistent with H retaining a prior
Guest-import operation for that Guest signature; operation history itself was
not directly inspected. Similar H/Guest contents alone do not prove new automatic
merging. No items were imported, added, removed or changed during inspection.
G/H current phone inputs are blank; this read-only retry does not establish a new
profile-save/phone-autofill acceptance result. Earlier user-reported cart and
profile-separation evidence is preserved separately.

Actual retry usage: one Function deployment, five of nine read executions
(including the first server-success/browser-failed G request), B7 cumulative
15/120; OPEN23 used and CLOSED24 still reserved. Account/JWT and the read-only
G/H Function remain open under the independent monitor until user `종료` or a
confirmed safety failure. No new order, payment, coupon, mail, user, schema or
operational resource was created. B5 remains DEFERRED / RELEASE BLOCKER.

## 2026-10-19 — Product cart clarity and final local regression

The real order-read acceptance above remains PASS; no additional Function execution,
health check, deployment or order creation was used for this change. The current
retry monitor still reports `open`, `safe=true`, with five additional executions.

The bag now identifies the signed-in account (login email) or Guest. When the
current Guest contents have already been explicitly copied to the current account,
EN/KO copy explains that history and that the bags remain separately saved. This
uses existing import records; it does not infer history from matching product names,
move/delete products, auto-import, or change cart storage and pricing policies.
The live H import history has not been directly inspected, so its historical cause
is not claimed as proven solely from matching quantities.

A regression first failed because the prior-import explanation was absent, then
passed after implementation. It covers explicit import, return/refresh, Guest
preservation, no duplicate import, and a fresh other member's empty cart. The actual
AU Bag test also checks that the displayed account is G rather than H.

Validation:
- Focused cart tests: 20 PASS / 0 FAIL.
- Full `npm test`: 2,156 PASS / 0 FAIL / 1 SKIP (the existing KR-only static assertion
  is conditional in the AU build run); exit 0.
- ESLint and TypeScript: exit 0.
- KR then AU builds: exit 0; existing chunk-size warnings remain.
- Git whitespace validation: PASS. Changed source/diff reviewed for credentials;
  none added. Runtime browser checks for these new labels remain NOT RUN until deployed.

No new Pages deployment was made. OPEN23 remains current and CLOSED24 remains
reserved for manual termination. A further OPEN deployment requires additional
budget before publishing this local UI change. Existing Google/cart/order-read
PASS results remain preserved. Profile save/phone autofill observations in this
retry do not add a new manual PASS. Actual member order creation/JWT owner assignment
remains outside this read-only acceptance.

Diagnostic incident: a macOS `ps comm` inspection unexpectedly included a Penpot
connection URL in a process title. It was not copied into files or repeated. The
repository already provides `scripts/security/safe-process-inventory.mjs`; use that
rather than process command/title columns. The earlier Penpot rotation evidence
remains in `customer-account-b7-v3-readiness.md`; this incident did not perform a
new credential validity test or access Penpot.

B5 remains **DEFERRED — RELEASE BLOCKER**. D1 reservation health timeout and the
historical AU raw configuration fingerprint difference remain unresolved/UNVERIFIED.
Production, main, DB, ACL, coupons, payment and email were not changed.

## 2026-10-19 — Approved OPEN24 published and visibly verified

The user approved the additional OPEN deployment after `19b38f7`. Its separate
0600 approval addendum preserves the earlier scope, approval and journals.
OPEN24 is used; **CLOSED25 is reserved**. No new Function deployment/execution,
user, order, coupon, profile write, schema or environment-variable change occurred.

The new build scanned 926 public files with zero signing-key/credential-pattern
matches. The server-only relay and Worker entry were byte-for-byte preserved.
HTTPS `/cart` returned 200, JS/CSS content types and bytes matched the new local
artifact, and `/_worker.js` remained inaccessible (404). Account remains ON, the
same G/H-only Function deployment remains active, and operating project fingerprints
still match the session baseline.

The independent monitor was handed over in 10.538 seconds to the controller that
reserves CLOSED25; it reported multiple healthy cycles before publishing. Its
read budget, drift detection, automatic emergency closure and manual-only normal
termination are unchanged. The active controller is now
`.superpowers/sdd/2026-10-19-customer-account-integrated-retry/manage-open24.mjs`;
use its `close` action on the user's `종료`, not the former `manage.mjs` controller.
No new authentication window was started or time limit introduced.

Actual Chrome after reloading `/cart`: signed-in G, the new account bag/login-email
label visible, G's two existing pavé units retained, Guest separate-save explanation
visible, and order submission disabled. No cart mutation was performed. The
already-imported Guest explanation is deployed and locally covered, but H's live
historical notice has not been claimed as visually verified in this publication.

Real G/H list/detail ownership acceptance remains PASS from the preceding section;
it was not rerun to publish a bag label. Remaining release blockers are unchanged:
B5 **DEFERRED — RELEASE BLOCKER**, actual Email OTP/Google↔OTP UID verification
NOT RUN, actual member order creation/JWT owner assignment NOT RUN, D1 original
health timeout unresolved, and historical AU raw settings difference UNVERIFIED.
