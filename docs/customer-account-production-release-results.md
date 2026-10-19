# Customer Account production release — stopped at OFF frontend build

2026-10-19. Approved manifest SHA-256: `ef000413dab463a916e7fe6df821e390750f7d25f14ff44b0600f36a1b1e9fb2`. The immutable manifest still has `executionApproved=false`; separate protected approval and journal record the explicit user approval and nam9295's monitoring/emergency recovery acceptance. Prior functional acceptance and test usage are preserved, not rerun.

## Execution and stopping point

- Feature `97456fc648465384d58aeb8a7920722d9a7d194f` was pushed and normally merged through [PR 25](https://github.com/nam9295-cmyk/au-cake/pull/25). Main is `0701c540dd1124adaa64dd13c7d029df80f5415e`. No rebase, force push, reset, or main worktree modification.
- The one automatic customer-OFF production build was `cd8d9070-5f36-4b82-a69f-8c9fbb6dbb98`. Its dependency installation failed before application build/deploy. It did not replace the live deployment.
- Cloudflare detected Node22.16.0/npm10.9.2. `npm clean-install --progress=false` failed with `EUSAGE`: package.json/package-lock.json are not install-consistent in that environment. Logs report missing `@emnapi/core@1.11.3`, `@emnapi/runtime@1.11.3`, nested `@emnapi/core@1.11.1`/`@emnapi/runtime@1.11.1`, and `@emnapi/wasi-threads`1.2.2/1.2.3 inconsistencies.
- The required OFF frontend checkpoint therefore failed. No retry, manual replacement OFF upload, schema migration, Function deployment/execution, SMTP apply, or UI-ON deployment followed. The root controller was asked to stop and reported `not-applied`, `commonSmtpUnchanged=true`; no apply or keep request was created.
- The newly issued production Sending Key had no activity, was revoked by nam9295, and its absence was confirmed in the official Console. Existing operating and B4 keys remain.

## Verified final state

| Check | Result |
| --- | --- |
| Live Pages | Original `0af308ee-ad99-4345-838e-649c5a60111a`, source34ba1072f475 remains canonical |
| AU homepage / cart | HTTP200 / HTTP200, original JS asset. Actual order submission was deliberately not performed |
| New customer UI / MY ORDERS | Not released; `/account` HTTP404 on the original site |
| Operating reservation Function | Original `6ad33cd2615e4096f7bf`, all options/37 variables preserved; Renewal writes/preorders bothtrue |
| Other operating Functions | All4 deployment IDs/options unchanged |
| Operating4 projects | Auth/SMTP/OAuth/service semantic fingerprints unchanged |
| SMTP / API / mail worker | SMTP host remains empty; original full container-env hashes and identical1.8.1 image unchanged; both running |
| Root recovery preparation | Protected original configuration/image backup and harmless independent timer probe PASS; SMTP never applied, no container restoration required |
| Mail queue / quota | queue0,processing0,failed1 preserved; Resend daily5/100,monthly87/3000 unchanged |
| Isolated test environment | Account403 and CLOSED31 preserved; no new acceptance window |

## Actual usage

Main normal integration1. Normal production Pages build attempts1/2, successful new Pages deployments0, Pages recovery0/1. Function deployments0/2, customer-readiness executions0/1. Schema writes0/2; new Function/env variables0; common SMTP changes0; container recreations0/4. New system Sending Key1/1, revoked. Agent-created users/orders/payments/coupons/emails0. Prior isolated test logical Pages31 and B7 executions19/120 remain unchanged.

Protected evidence is in `.superpowers/sdd/2026-10-19-customer-account-production-release/`, including the failed build metadata/logs, approval proof, journal, final Owner/HTTP state and root stop receipt. It contains no published credentials. Root-only backups remain available on the server; secret files are not committed.

## Required before resumption

Repair root lockfile consistency and verify a fresh clean install against the actual Cloudflare Node22/npm10.9.2 contract. This failure is not a reason to disable npm lock validation, weaken CSP, change selling policy, or upload the prepared ON artifact early. No dependency fix or additional production attempt was made in this execution.

Main is already integrated and must not be merged again as if this attempt had not happened. A follow-up normal fix integration will trigger another automatic build; its budget allocation, subsequent ON build, fresh baseline/approval proof and replacement system credential must be explicitly resolved before resuming. Prior approval/use counters are not reset. Original production remains live and no rollback deployment was needed.

Always-on SMTP/customer production release remains incomplete. Existing Google/OTP/same-UID/cart/order/actual-member-create PASS evidence remains valid for the accepted test environment and is not relabeled as fresh production validation. D1 legacy general-health timeout, review-api sharp issue, common SMTP fallback actual delivery gap and historical AU/Gallery raw fingerprint uncertainty remain separately unresolved.
