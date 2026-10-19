# B5 final controlled attempt — BLOCKED before common SMTP apply

Date: 2026-10-19 KST. Branch `feat/customer-account`; start `d1f1c93`.
The latest user approved ending the existing integration test and preparing one
controlled OTP attempt. Actual shared SMTP changes/recreation still require one
explicit operational approval **after** recipient restriction and recovery gates.

## Result

**B5: DEFERRED — RELEASE BLOCKER. SMTP: BLOCKED, not applied, no rollback needed.**
No operational-change approval was requested because the required recipient
restriction is not proven. OTP reception/session and Google↔OTP UID equality are
**NOT RUN**, not FAIL or PASS. No email, token-creation request or negative-recipient
probe was sent.

## Existing test safely closed — PASS

The previously approved `manage-open24.mjs close` completed CLOSED25 and directly
verified: Account OFF / API403 `general_service_disabled`, JWT OFF, Function
disabled/execute empty, B6 `6ad41e576cb7a8f346af` active, customer/Renewal flags false,
signing key invalidated, approved G/H sessions absent, and HTTPS site CLOSED.
CLOSED25 was the only Pages deployment in this attempt. No new OPEN build,
Function deployment/execution, order, coupon or user was created. Prior results,
G/H carts and fixture are preserved. Prior B7 usage remains 16/120; Pages now25.

## Exact blocking condition

The deployed `account.php`, `mails.php`, `variables.php` and `resources.php` hashes
still match the already pinned Appwrite1.8.1 sources. In its native
`POST /v1/account/tokens/email` route:

1. Empty common SMTP host is rejected before user lookup.
2. An existing email loads that user; signup count is checked only in the new-user
   branch. Therefore `authLimit=2` does not restrict OTP to G among existing G/H/M.
3. That route has no `authWhitelistEmails` recipient check. The inspected whitelist
   belongs to Console password account creation, not the test project's OTP route.
4. The mail worker accepts the payload recipient and adds that address. A verified
   sender/domain-restricted sending key does not establish a TO allowlist.

These are pinned source/control-flow findings, **not an actual attempted OTP send
to H**. No direct/alternate API ingress policy that enforces G-only recipients has
been demonstrated. UI restrictions, CORS, Google Testing and the user cap cannot
prove that invariant. Account remains OFF rather than opening it to test an
unapproved recipient.

The smallest missing capability is a test-project mail delivery path that enforces
G's exact address and one accepted delivery at the SMTP server, or an authoritative
project-specific ingress restriction covering every direct/alternate API route.
That capability is not present in the current B4 SMTP override/approved seven
common environment changes. A new verified restriction is required before enabling
SMTP; changing a flag or issuing another Resend key does not implement it. No new
relay, container, ingress policy or credential was installed in this attempt.

A second unapplied prerequisite is legitimate root/sudo authorization: the current
noninteractive read check still fails. This does not prove the user lacks sudo,
but no root session, protected image/config backup or rollback exercise was
available. No Docker host-file permission workaround was used. Backups and
same-image recreation were not claimed ready.

## Current metadata and provider checks

- Official Owner GET: four operating Auth/SMTP/OAuth/service semantic fingerprints
  match the preceding integration baseline. Fresh per-field semantic baselines for
  all five stored projects were captured and matched again at the end. Operating
  Function IDs/runtimes/active-deployment metadata were read, not modified.
- Test Google provider and B4 SMTP override remain enabled in configuration while
  Account/OTP/JWT remain OFF. G's existing UID/login email match the approved target.
- Console is a built-in configuration, not a stored `GET /projects/console` resource.
  Its relevant runtime environment digest was captured and matched again: root
  signup limited, invites ON, session alerts OFF, whitelist counts0/0. This is
  read-only server configuration evidence, not an invented Projects API response.
- Original `.env`/Compose hashes and Appwrite1.8.1 images are unchanged from B5.
  Common SMTP host is still empty in API and mail worker. Queue pending0 /
  processing0 / failed1 was checked twice. No payload was read, retried or deleted.
- Public API version health200/1.8.1. Available RAM8.40GiB, disk82.95GiB, load1≈0.69
  at the initial sample; no service recreation or restart occurred.
- Authenticated official Resend Console: operating and test domains both Verified;
  daily0/100, monthly82/3000, shared rate10requests/s. No key was issued/changed,
  no message was opened/sent, and no existing notification key was reused. Usage
  was observed in Console; **a Resend usage API call was not performed**. Aggregate
  quota is not proof of each operating notification's delivery status.

## Counts and evidence

| Operation in this attempt | Count |
| --- | ---: |
| Pages CLOSED25 | 1 |
| Pages OPEN / Function deployments / Function executions | 0 / 0 / 0 |
| System key issuance / common environment changes / recreations | 0 / 0 / 0 |
| OTP/API email-token requests / all email sends | 0 / 0 |
| New orders / coupons / users | 0 / 0 / 0 |
| Full regression reruns / new test frameworks | 0 / 0 |

Existing close controller, metadata fingerprint helper, read-only server inspectors
and pinned sources were reused. A small local read-only collection script stored
fresh evidence under ignored 0700 `.superpowers/sdd/2026-10-19-customer-account-b5-final/`;
evidence files are0600 and contain hashes/status only. Original B5 manifest,
source evidence, approval records and integration journals were preserved.
Document/JSON/hash validation was performed; this is not a claim of provider
acceptance or SMTP rollback verification.

Historical Gallery raw fingerprint uncertainty and historical AU raw settings
difference remain **UNVERIFIED**; the fresh semantic match does not resolve either
retroactively. Original D1 reservation health timeout remains separately unresolved.
Production/main/DB/ACL/sales/payment/coupon settings were not changed. No repeated
Google/cart/MY ORDERS/readiness acceptance was run.

## Sources

- [Appwrite1.8.1 native Account routes](https://github.com/appwrite/appwrite/blob/1.8.1/app/controllers/api/account.php)
- [Appwrite1.8.1 mail worker](https://github.com/appwrite/appwrite/blob/1.8.1/src/Appwrite/Platform/Workers/Mails.php)
- [Resend key permissions/domain configuration](https://resend.com/docs/dashboard/api-keys/introduction)
- [Resend SMTP TLS modes and shared API rate limit](https://resend.com/docs/send-with-smtp)
