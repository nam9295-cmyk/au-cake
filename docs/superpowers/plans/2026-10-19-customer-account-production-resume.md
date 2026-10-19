# Customer Account Production Resume Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Mac Codex alone. This plan is preparation only until the user explicitly approves the new manifest SHA and named operator responsibilities.

**Goal:** Resume only the remaining production release from main `08799b739f6d8047154c0ea699aab81837196ce2` and live customer-OFF Pages `65a7ccae-422a-4d79-9262-fccea9b51c7f`.

**Architecture:** Reuse the existing migration, reservation Function, Appwrite owner authentication, Pages project, byte-preserving SMTP operator and independent rollback/keep-confirmation adapter. Use fresh run identity, approval proof, journal, key and root backup; do not repeat completed integration or acceptance. Product files/artifacts are verified against the current main, independently of this documentation worktree.

**Tech Stack:** Appwrite1.8.1; existing node-22 reservation-api; Node22.16.0/npm10.9.2 frontend build; existing Cloudflare au-cake-next; Resend SMTP.

**Spec:** `docs/customer-account-production-release-manifest.json` (version2, executionApproved=false), `docs/customer-account-production-release-results.md`, approved original customer-account design.

## Global constraints and counters

- Existing PR25/26 normal merges and OFF automatic deployment are complete. Remaining main merges/OFF deployments:0. Do not push main, merge documentation into main, change automatic-build settings, or reuse earlier approval proofs.
- Production Pages attempts already used2: failed OFF1, successful OFF1. Remaining normal UI-ON1 gives cumulative3; optional rollback1 gives cumulative ceiling4. Function deployments used0, remaining2; readiness used0, remaining1. Prior production system Key issued/revoked1; remaining newKey1. Isolated test Pages31/B7 executions19/120 remain separate historical counters.
- Owner Attribute1+Index1 only. No existing documents/backfill/ACL edits. No synthetic or real customer/order/payment/coupon/email acceptance actions.
- Preserve operating4 projects (including verygood-au), Console policy, test project, Account/OTP/JWT/OAuth settings and sessions. Existing native Auth is alreadyON; never apply test shutdown procedures to production.
- Preserve Renewal writes/preorders=true/true, Custom Cake, administrator REVIEW allowlist, notification paths, schedule, scope, timeout and specification. Add the same existing ACL UID as audit configuration, not a new administrator.
- No new Appwrite key/project/Function/collection/test infrastructure. New credential is only the approved domain-limited Resend system Sending Key.
- Any unapproved main/configuration drift, incomplete ACL metadata, failed readiness, or readiness client elapsed>=8000ms blocks UI activation. No retries, deployment-budget extension, timeout increase or security bypass.
- Historical AU/Gallery raw fingerprint equivalence stays **UNVERIFIED**. Current semantic agreement does not resolve that history. D1 legacy health timeout and review-api sharp remain separately tracked.

## Review focus

- Wrong-project/resource writes: exact endpoint/project/collection/function/Pages IDs and per-action durable claim before mutation.
- Stale environment: each Function deployment is created only after the intended two-variable state is fixed; the false reader runtime is retained for rollback.
- Existing guest/admin/Custom Cake compatibility: original37 variables and Function options are preserved; never PUT redacted empty secrets or use the generic deploy script.
- Shared SMTP blast radius: private backup, identical image, seven-byte transformation, root timer and a fresh explicit keep receipt; customer UI OFF alone does not block direct native Account APIs.
- Counter reuse/receipt races: separate run/journal/root stage, prior counters retained, global single-apply claim, locked keep/rollback and expiry validation.

## Task 0 — Freeze preparation and obtain one new approval

**Files:** current manifest/results, archived v1 manifest/results, production adapter binding and focused tests; protected bundle under `.superpowers/sdd/2026-10-19-customer-account-production-resume/`.

- [x] Official read-only metadata: current Pages/main/customerOFF; operating4 semantic fingerprints; reservation Function/options/37 variables; DB2/Collection22 complete ACL and exactly two missing owner schema items. No customer documents read.
- [x] Read-only server resource/queue/runtime hashes and Resend quota/domain observation. Original root file byte hashes remain expected values; a fresh legitimate root check is mandatory, not claimed as already executed.
- [x] Finalize new ON artifact/hash from current main and new deterministic Function archive. No earlier frontend artifact or approval is executable authority.
- [x] Bind the existing operator to run `ca-release-resume-20261019`, stage `/home/john/.verygood-account-smtp-production-resume` and the final new SHA; focused RED→GREEN tests only. Do not modify the preserved one-shot operator.
- [x] Preserve original `executionApproved=false`; create no executable approval proof before user approval.
- [ ] Obtain one explicit approval covering remaining budget, common SMTP impact, fallback delivery gap, shared quota/recipient risk, new key/root changes and nam9295 monitoring/emergency recovery responsibility.

## Task 1 — Fresh pre-apply gate after approval, before resource writes

- [ ] Reconfirm exact main08799b7/live OFF65a7ccae and same operating semantic/Function/ACL configuration; compare to the new manifest. Stop on drift rather than silently accepting a new baseline.
- [ ] Start a new protected journal with prior counters carried forward and the new approval SHA/run. Keep all older evidence. No automatic approval or old proof/key reuse.
- [ ] Transfer only the finalized verified root bundle to the new stage. Confirm hashes against local committed source. Require the user's legitimate root session (`ssh -t very 'sudo -i'`); no Docker/SQL/credential bypass.
- [ ] Run the new production adapter `serve` only after approval. Fresh0700 backup/0600 original env/Compose/image, expected env/Compose hash checks, public curl/internal health and harmless independent timer probe must pass. No apply request yet. New key may be delayed until readiness succeeds; root preparation must not expire during this sequence.
- [ ] Recheck resources (available RAM>=3GiB, disk>=30GiB), queue0/processing0/failed1 and existing traffic. Resend start/keep gate: daily remaining>=50 and monthly remaining>=1000. If a gate cannot be proved, stop before mutation.

## Task 2 — Owner schema, additive only

- [ ] Use the existing `runCustomerAccountMigration` through official Console Owner admin authentication, exact `verygood-au` / `verygood_cake_au` / `reservations` targets. No new Appwrite API Key.
- [ ] Fresh GET-only dry-run must show precisely optional string customerUserId(size36,required=false,array=false,defaultnull) and key index customerUser_created_idx([customerUserId,$createdAt],[ASC,DESC]) missing; complete19 private+3 public read-only ACL checks must pass.
- [ ] Claim/create Attribute once → poll available; claim/create Index once → poll available. No parallel mass creation, automatic create retry, collection/setup call or backfill.
- [ ] On failure stop; retain additive schema. Do not delete or modify existing documents or permissions.

## Task 3 — Compatible false reader deployment1

- [ ] Create only APPWRITE_ADMIN_USER_IDS=`6a3785f5000b3e6adfc6` (secret=true) and CUSTOMER_ACCOUNT_ENABLED=false (secret=false), total37→39. Preserve REVIEW_ADMIN_USER_IDS and all original variable identities/values/secret metadata.
- [ ] Freeze/hash variables before createDeployment on existing reservation-api, activate=false. Use the finalized main08799b7 Function archive and command `npm ci --omit=dev --include=optional && node scripts/native-smoke.mjs --linux-node22`.
- [ ] No Function configuration PUT: keep node-22,8vCPU/8GiB,timeout60,execute[any],schedule0 * * * *,events[],existing11 scopes/logging. Preserve internal proxy endpoint and Renewal true/true.
- [ ] Poll deployment/build metadata (no execution); require ready and native smoke successful, no variable drift, then activate. Save reader ID and false runtime checkpoint. No health call here.

## Task 4 — Member writes deployment1 and readiness1

- [ ] Set only CUSTOMER_ACCOUNT_ENABLED=true and freeze the variables before the second deployment of the same exact archive. Require ready/native build and unchanged config; activate. Do not reuse the old runtime after a variable update.
- [ ] Claim exactly one customer-account-health read-only Function execution through the official execution API (POST transport is not an order/DB write). Preserve original Function timeout and DB/JWT/ACL checks.
- [ ] Require HTTP200,enabled=true,ready=true and full client elapsed<8000ms. Record duration/ID only. Old general health/D1 is not the gate and is not rerun.
- [ ] Failure, timeout/unknown response or>=8000ms: no retry/UION. Set customer metadatafalse and reactivate the saved false reader; do not redeploy. Guest/admin/Custom Cake paths stay available.

## Task 5 — Permanent SMTP single apply and keep confirmation

- [ ] Only after earlier gates pass, create exactly one `VERYGOOD Appwrite SYSTEM SMTP PRODUCTION RESUME 20261019` Sending access Key restricted to verified `verygood-chocolate.com`. Preserve order/review/B4 keys. User enters/captures the secret directly into0600 files; no secret in argv/chat/logs/Git.
- [ ] The new root preflight/backup/candidate and all gates must still be valid. Reconfirm quota/traffic/operating semantics immediately before apply. Claim apply globally once for this run.
- [ ] Existing helper changes only _APP_SMTP_HOST/PORT/SECURE/USERNAME/PASSWORD and _APP_SYSTEM_EMAIL_NAME/ADDRESS; all other .env bytes/Compose/env/options/images are preserved.
- [ ] Arm independent server-side480s rollback before change; same1.8.1 image only; worker→API, each exactly1 recreation, no pull/build/upgrade. Public health must recover within60s, internal health and TLS/AUTH of both services pass. No mail send test, queue retry/delete/body inspection.
- [ ] Fresh proof (age<=30s) confirms operating4 semantic+Console unchanged, quota policy accepted and nam9295 on-call acceptance. Root rechecks original non-SMTP environment, candidate bytes, unrelated containers, resource/queue/health/TLS under operation lock.
- [ ] Before480s and600s hard limit: durable receipt→committed state→stop this timer. If the timer has claimed rollback, confirmation cannot win. No time extension/unconditional timer cancellation. Missing/failed keep restores automatically.
- [ ] After committed, SMTP remains enabled without Mac heartbeat expiry. Manual root restore remains available from the new immutable backup. Failure uses API→worker original environment recovery, at most2 recreation actions; revoke only the new system Key.

## Task 6 — UI ON Pages1

- [ ] All gates must bePASS, current main still08799b7 and no unexpected drift. Verify new artifact/source/hash and copied public environment. Reconfirm exact au-cake-next/production main and original existing variables.
- [ ] Add only VITE_CUSTOMER_ACCOUNT_ENABLED=true to production build environment, preserving every other value/metadata. If a redacted secret would have to be rewritten, stop rather than overwriting it.
- [ ] Claim/manual upload the prepared ON artifact once to existing production Pages. No new Git/main merge or OFF deployment. This is cumulative normal attempt3.
- [ ] Verify canonical deployment and both AU/au-stage homepage/cart/product/account/callback pages, new JS/CSS MIME and original headers. No actual customer authentication/order/payment/email acceptance rerun.

## Task 7 — Failure recovery and final report

- [ ] If UI never opened, retain the current OFF checkpoint without spending a rollback Pages action.
- [ ] If UI opened, reset only the newly added frontend flag to its original absent/OFF state and restore existing Pages65a7ccae, at most1 recovery action. Keep future builds OFF.
- [ ] Set customer flagfalse and activate the saved compatible false reader without another Function deployment; preserve original6ad33cd2615e4096f7bf emergency checkpoint.
- [ ] SMTP unconfirmed→independent or immediate root rollback. Confirmed but unsafe→authorized manual root restore/API+worker only; revoke only this run's new system Key. If verification fails, request manual root recovery and never report success.
- [ ] Never turn operating Account/OTP/JWT off, delete operating sessions/users/orders, revert Renewal writes/preorders true/true, change native Google/ACL, or remove optional schema. Current normal customers/orders are retained.
- [ ] Report readiness HTTP/elapsed, exact deployment IDs/counts, root keep/rollback receipt, public state, original services/queue and remaining issues. D1 legacy health timeout, review sharp, historical raw uncertainty and common fallback actual delivery gap remain explicit.
