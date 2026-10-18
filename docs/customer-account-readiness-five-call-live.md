# Customer readiness: five-call live verification

Date: 2026-10-18. Product source: `feat/customer-account` / `c7a52f0`.

## Result: PASS

Only the existing test project `verygood-au-account-test` and Function
`ca-test-reservation-api` were changed. Official Owner CLI authentication was used.
No Account activation, public Function execution permission, Pages deployment,
customer login, order, coupon, payment, mail, schema or ACL write occurred.

### Required metadata gate

Official Owner GET returned exactly two databases and all twelve expected
collections. Every collection included `$permissions`, `enabled` and
`documentSecurity`. All were enabled, with document security false. Permission
sets exactly matched the approved B2 resource manifest. No missing, duplicate,
unclassified or unexpected resource was found. GET status was 200 for database
inventory and both `listCollections` calls.

### One fresh runtime / one signed execution

| Measurement | Actual result |
| --- | --- |
| Deployment | `6ad4da63e6394097e97b` |
| Execution | `6ad4da7601b79927c54c` |
| Runtime | Node `v22.23.2` |
| Owner execution API HTTP | 201 |
| Handler response HTTP | 200 |
| Response | `{"ok":true,"result":{"enabled":true,"ready":true}}` |
| Readiness handler wall time | 4,341 ms |
| Appwrite execution duration | 5.169856 s |
| Owner request round trip, including cold start/transport | 6,285 ms |
| Frontend timeout | 10,000 ms; observed margin 3,715 ms |

This is one successful observation, not a latency percentile or a browser
measurement. No second execution, retry or redeployment was performed.

A read-only diagnostic entry delegates **only** the signed
`customer-account-health` action to the unchanged product handler. It validates
the exact test project/Function/database/admin IDs, HMAC, timestamp, nonce/path,
exact body, bounded 300-second window and one-call limit. Customer flag was true
only for this diagnostic; Renewal writes and preorders stayed false. The official
Owner API authentication and HMAC protect this health call; presence of platform
JWT headers is not customer JWT/ownership acceptance.

New signing material and window were fixed before deployment creation. All 30
existing variables and secret metadata were checked; their digest stayed fixed
through activation and execution. Actual runtime logs confirmed the matching
source digest, fresh window, signed entry acceptance and Node 22. Original
Function sources, lockfile, dependencies and native build command were packaged
unchanged. The archive contained 58 expected files and no Owner credentials.
Original V1/V2/V3 manifests and historical approval records were preserved; a
separate protected approval and continuation journal record this one-call scope.

## Restoration: PASS

- Account OFF, public Account API HTTP 403 / `general_service_disabled`.
- Function disabled, `execute=[]`, B6 active: `6ad41e576cb7a8f346af`.
- Customer, Renewal writes and preorders flags false.
- Signing key invalidated; other guard configuration restored to its prior values.
- Site remained CLOSED throughout. No authentication session was created.
- Test Auth/SMTP/Google/service settings and Function variable metadata/values
  matched the pre-run state after restoration (timestamps excluded).
- Four operating projects' current Auth/SMTP/OAuth/service fingerprints matched
  before and after. No operating project mutation API was permitted.
- B7 execution budget: **9/120**, previously 8; raw historical test Function
  execution inventory: 18 → 19, exactly the authorized new execution.
- Pages usage unchanged: **19**, new deployments **0**.

An independent deadline recovery process was armed before configuration. Normal
restoration was directly verified, then the idle recovery process was stopped.
The diagnostic introduced no new Function variables, API keys or Appwrite
resources besides the single authorized deployment/execution.

Host aggregate readings before → after: available RAM 9,037,729,792 →
8,988,409,856 bytes; disk free 89,091,502,080 → 88,989,483,008 bytes; load1
0.291 → 0.620; OOM kills 0 → 0. API version health remained normal.

Protected local evidence (Git-excluded, credential values not reported):
`.superpowers/sdd/2026-10-18-customer-account-readiness-five-live/`
contains `owner-listCollections.safe.json`, `package.safe.json`,
`frozen.safe.json`, `requests.safe.json`, `result.safe.json`,
`recovery.safe.json` and `completion.safe.json`. The original approval evidence
and cumulative usage were not reset.

## Local verification

New probe tests first failed RED (implementation absent), then passed GREEN.
Probe, five-call readiness, ACL failure and existing D1 recovery tests: **18 PASS,
0 FAIL, 0 SKIP**. Secret scan passed for the new source/helper/archive, and private
credential paths were confirmed Git-excluded. Previously completed `c7a52f0`
full regression results remain documented separately; they were not rerun or
claimed as fresh results for this server check.

## Remaining acceptance / blockers

G/H MY ORDERS actual acceptance: **NOT RUN**. Minimum next step is a separately
approved, bounded read-only G/H test: freeze a fresh key/window/customer flag
before a fresh deployment, temporarily enable only the test Account and guarded
read-only Function, provide OPEN/CLOSED test Pages budget, then check existing
G/H synthetic order lists, own details and cross-customer 404; finally restore
OFF/B6/CLOSED. Existing customers, carts and synthetic fixtures must be reused.
Do not create orders merely to repeat this health measurement.

Original D1 reservation `health` timeout remains **UNRESOLVED**. This customer
readiness result does not prove that independent settings + seven metadata path.

**B5 — DEFERRED / RELEASE BLOCKER**. Native OTP, abuse protection, common SMTP,
Google↔OTP UID acceptance and the remaining B5 safeguards are not complete.
Historical operating AU raw fingerprint difference remains **UNVERIFIED**.
No main merge or production release is authorized by this result.
