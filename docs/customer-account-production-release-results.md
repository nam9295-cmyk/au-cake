# Customer Account — current production checkpoint and remaining release

2026-10-19. **PR25/26 integration and the customer-OFF production deployment are complete.** This document supersedes the operational instructions in the [first stopped release report](customer-account-production-release-results-v1-stopped.md); that evidence remains unchanged. No completed merge, OFF deployment or functional acceptance is repeated.

## New SMTP/UI-only proposal — awaiting approval

V4 manifest SHA **`6a498278d9cef1cfc5b4aa1a937fac101db0387a7a5b41dd484a04914bb9725d`**, run `ca-release-smtp-ui-20261019`. [Minimal execution plan](superpowers/plans/2026-10-19-customer-account-smtp-ui-final.md). Preparation only: official Wrangler refresh/Cloudflare GET200 and Owner policy GET passed; current reader/customerfalse, member ready and OFF65a7ccae unchanged. The corrected versioned apply entry is connected to fresh local helpers;20 targeted tests PASS, failed auth/policy/claim→root requests0. Old run/claims/journals, used Keys2 and container actions4 are preserved. New scope proposes key1/SMTP apply2/UI1/member-reactivation1 with Pages recovery1/container recovery2; schema/deployment/readiness0. No executable approval or new operating mutation. Fresh root backup/timer/quota checks remain mandatory after explicit approval. No earlier PASS is repeated.

## Latest execution after amended approval — SMTP restored, UI still OFF

The user approved amended SHA `0fd7a7c99681f6c236679a29c84e1d084c861c5d6cd65ca4d61e93653682acc3`. A fresh proof was created and counters2 schema writes/2 Function deployments/1 readiness were preserved. Legitimate root preflight and independent timer probe passed using the new SHA and a new immutable root backup. The user created the single Sending access root-domain system Key and captured it into protected storage. The validated existing member deployment was reactivated without deployment/execution.

**The release executor then made an operational error.** The raw-token Cloudflare GET returned401 during the before-SMTP policy observer; a local SMTP apply counter had also not been initialized. The shell command block did not propagate either nonzero exit and continued to the root apply request. The durable local claim file and independent root global claim still constrained application to one attempt, but these do not excuse crossing a failed preflight gate. This was an executor defect, not a product/authentication defect.

The root helper applied exactly the approved seven variables and worker/API once each. TLS/AUTH passed. On observing the failed preflight, Codex requested immediate authorized restoration, did not produce a keep confirmation, did not retry SMTP and did not deploy Pages. Root restoration completed after **84.021 seconds** of SMTP exposure: original files and complete API/worker environments, same image, unrelated containers and queue0/processing0/failed1 were verified; API health passed. Recovery used exactly two container recreations. Root serve exited. The customer metadata flag was setfalse and false reader **6ad5ce82a6ae17a3830a** restored without deployment.

Official Wrangler authentication refresh was used only for recovery observation; subsequent GET verified unchanged OFF Pages **65a7ccae-422a-4d79-9262-fccea9b51c7f**, absent frontend flag, four operating policy fingerprints, native Auth, Renewal true/true and existing37 Function variables. UI deployment attempts for this release remain0; cumulative production Pages attempts remain2. No customer orders/payments/coupons/emails or Function executions were created by this SMTP attempt.

| Item | Latest result |
| --- | --- |
| owner schema1+1 / accepted Function2 / readiness1513ms | PASS, retained; no repetition |
| SMTP TLS/AUTH | PASS during the single application |
| Permanent SMTP keep | NOT RUN / not confirmed; common SMTP fully restored OFF |
| worker/API apply / restoration |2 /2, full approved budget consumed |
| UI ON / Pages recovery |0 /0; original OFF checkpoint maintained |
| New system Key |1 created and revoked by the user; official Console confirms absence and only the two original keys remain |
| Final production Google/MY ORDERS acceptance | NOT RUN; user-facing release did not occur |

Final credential cleanup is complete: `VERYGOOD Appwrite SYSTEM SMTP PROD R2 20261019` was deleted by the user and its absence verified in the official Resend Console. Existing order/B4 keys remain. Final quota is unchanged at daily5/100 and monthly87/3000. No new operational attempt was made during cleanup.

No approval or budget is silently reused for another SMTP attempt. The root run's global apply claim is consumed. All error/claim/journal/root evidence is retained, including the counter reconciliation recording the actual one application without resetting usage. Release remains incomplete; any new application would require corrected execution control and explicit new authority.

The exact shell error-propagation defect was subsequently reproduced locally with intercepted executables: the original block dispatched the SSH stage after a failed prerequisite. The corrected entry block uses `set -Eeuo pipefail`, official Wrangler refresh before reading its token, and an explicit initialized zero-counter precondition. Local auth/policy/counter failures each dispatch0; the successful stub case dispatches1. This is a local-only regression (real network/mutation calls0); the corrected entry was **not** used for another operating application. Current consumed counters/global claim remain intact. Root and local execution proofs were archived as stopped. This does not constitute a new operating approval.

## Earlier in this retry — backend complete, credential label amendment

The user authorized one fresh retry after `60386f4`, retaining manifest/run identity where safe. An independent attempt2 proof/journal/claims was created in the protected `production-resume-retry` directory; the stopped attempt1 evidence and root backup remain untouched. Fresh Owner metadata still matched main08799b7/OFF65a7ccae and operating4 policy. The corrected optional-default adapter was verified in the actual execution path using a fully intercepted local transport.

- Optional customerUserId Attribute1 and customerUser_created_idx Index1: **available**. Existing documents/ACL unchanged.
- Compatible reader deployment: **6ad5ce82a6ae17a3830a**, active with customer flagfalse as the present safe checkpoint.
- Member writes deployment: **6ad5cea0eb161f62de24**, built/activated successfully and retained for reactivation without another deployment.
- Both builds: Linux x64/Node22.23.2/sharp0.35.5 native JPEG/PNG/WebP and invalid image checks PASS. Original37 variables/options, Renewal true/true and admin/Custom Cake/guest policies preserved; only the two approved variables added, total39.
- Sole production customer readiness execution **6ad5ceade17ea3ec5c60**: **HTTP200 / enabled=true / ready=true / client1513ms**. This PASS will not be repeated.
- New system Key0, SMTP changes0/container recreations0, UI Pages0. Official Resend observation remained daily5/100,monthly87/3000.

The approved credential display name `VERYGOOD Appwrite SYSTEM SMTP PRODUCTION RESUME 20261019` (56 characters) is rejected by the official Resend create form. The shorter proposed `VERYGOOD Appwrite SYSTEM SMTP PROD R2 20261019` is accepted by that form with the same **Sending access / verygood-chocolate.com** restriction. Add was never clicked; no key exists. The exact maximum length was not independently asserted.

Because the credential name is manifest-bound, it was not silently substituted. Pending manifestv3 SHA **`0fd7a7c99681f6c236679a29c84e1d084c861c5d6cd65ca4d61e93653682acc3`** changes that label and carries all completed usage forward. Its remaining schema/Function-deployment/readiness budgets are0; it permits only reactivation of the already validated member snapshot, key1, SMTP7/two apply containers/480s keep gate, UI Pages1, and existing recovery reserves. No main merge/OFF build/provider test/full suite is repeated. The immutable [approved v2 manifest](customer-account-production-release-manifest-v2-approved.json) retains SHA9972124a…; no previous approval is executable for v3.

During this approval pause, the customer metadata flag was setfalse and the already deployed false reader restored; native operating Account/OTP/JWT and all normal sales flags remain unchanged. The user stopped the waiting root process. Both root backups/status records and the used v2 approval are archived, with no key/apply/keep request. Existing OFF Pages65a7ccae remains live. Root preparation for v3 must use its own fresh proof and backup; no old approval reuse or new Function/readiness attempt is permitted.

Only the new manifest binding was changed in the existing SMTP adapter. Focused local binding/rollback tests: **18PASS/0FAIL/0SKIP**; no accepted product suite or provider test repeated. Approval of the pending SHA is required before continuing the remaining SMTP/UI work.

## Historical first approved resume — stopped before the first resource write

The user explicitly approved SHA `9972124a53e9a1bb8c9962e4165c5b1bf7c9dc1e427a4ec45e7b4dd1caf2fc4f`, run `ca-release-resume-20261019`, and nam9295's monitoring/recovery responsibility. A new protected approval/journal was created; no prior approval, key or usage was reused.

Fresh Owner metadata at `2026-10-19T07:45:39.852Z` matched the approved checkpoint. Legitimate root preflight passed at `07:46:54Z`: current env/Compose bytes, protected original/image backup, public curl/internal health and actual independent systemd probe. Available RAM7.79GiB/disk80.79GiB, established public80/443 connections0; queue0/processing0/failed1; Resend5/100 daily and87/3000 monthly.

The fresh migration dry-run passed with exactly the two approved owner schema additions. **The newly bound local execution adapter then rejected the attribute payload before `fetch`**: it required explicit `default:null,array:false`, while the existing migration definition correctly sends only `key,size,required` and relies on those safe Appwrite defaults. This is an adapter validation defect introduced during the resume, not an Appwrite rejection or a production schema failure.

| Remaining release action | Actual result |
| --- | --- |
| owner Attribute / Index creation | NOT RUN / NOT RUN; both still absent404 |
| compatible reader / member writes deployment | NOT RUN / NOT RUN; original deployment remains active |
| production customer readiness | NOT RUN; allowance not consumed |
| new Sending Key / SMTP changes / container recreation |0 /0 /0; common SMTP still OFF |
| customer UI ON / Pages recovery | NOT RUN / NOT NEEDED; current OFF65a7ccae retained |

No automatic retry occurred. The attribute's pre-dispatch claim and the failure remain in the journal; actual schema create requests are0 and no counters/evidence were erased. The defect was reproduced locally, then corrected only in the protected execution adapter by normalizing omitted safe defaults before strict equality. A transport-stubbed regression accepts the two equivalent safe payloads and rejects four unsafe payloads; actual network writes0. The migration was **not rerun**.

The user stopped the root preparation process with Ctrl+C. No key/apply/keep request existed; approval proofs were archived as stopped and are not executable authority. Final Owner GET at `07:49:51.833Z` confirmed current main/OFF deployment, Function37 variables, both owner items missing, DB2/Collection22 ACL and unchanged operating4 semantic fingerprints. API/mail-worker complete environment hashes, Console policy, image and queue were also compared to the pre-run baseline and remained unchanged. Root backup evidence is retained. Further release actions require explicit user direction; this attempt is stopped.

## Current checkpoint

| Item | Verified state |
| --- | --- |
| Production main | `08799b739f6d8047154c0ea699aab81837196ce2` |
| Pages project / active customer-OFF checkpoint | `au-cake-next` / `65a7ccae-422a-4d79-9262-fccea9b51c7f` |
| Domains | AU and au-stage share that deployment |
| Prior immutable Pages deployment | `0af308ee-ad99-4345-838e-649c5a60111a`, historical fallback only; the new OFF checkpoint is used for the remaining release rollback |
| Actual Cloudflare build | Node22.16.0/npm10.9.2; npm ci, TypeScript/Vite/SEO PASS. This existing PASS is cited, not rerun remotely |
| Current customer UI | OFF; frontend flag absent, native operating Account/OTP/JWT settings preserved |
| Current reservation Function | Compatible false reader `6ad5ce82a6ae17a3830a` active; member `6ad5cea0eb161f62de24` retained inactive. Original options and37 variables preserved; two approved variables added, total39; customer flagfalse |
| Renewal / Custom Cake / guest | Renewal writes/preorders=true/true; existing Custom Cake/admin/guest configuration preserved |
| Schema / ACL | DB2/Collection22,private19/public-read-only3; optional customerUserId and customerUser_created_idx available; no ACL, backfill or document writes |
| Operating4 project policy | Current Auth/SMTP/OAuth/service semantic fingerprints match; historical AU/Gallery raw equivalence remains UNVERIFIED |
| Shared server | API/mail worker running, original1.8.1 image and full runtime hashes unchanged; common SMTP host empty; queue0/processing0/failed1 |
| Resource sample after restoration | Available RAM8.24GiB, disk79.69GiB; a sample, not continuous monitoring |
| Resend official observation after cleanup | Daily5/100,monthly87/3000; new system Key revoked, original two keys retained |

The latest attempt retained additive schema and two compatible Function deployments, used one readiness execution, and applied then restored shared SMTP. Four container recreations were used (apply2/restore2). No Pages deployment or customer data writes occurred. Current policy matches the baseline except the explicitly approved additive schema/Function configuration. The new system Key is revoked and all execution authority is stopped.

Recovery GET at `2026-10-19T08:25:57.751Z` confirmed main/OFF deployment, all four current semantic hashes, native Auth/Renewal policy and the false reader/customerOFF state. AU and au-stage returned HTTP200. Original API/worker environment hashes, Console policy and queue0/processing0/failed1 matched after restoration. The sole readiness PASS above is preserved without another execution.

## Preserved usage and remaining limits

| Action | Already consumed | New approval maximum |
| --- | --- | --- |
| Normal main integration |2: PR25+26 |0 |
| Normal production Pages attempts |2: failedOFF1+successfulOFF1; UION0 |Stopped authority; do not deploy |
| Pages recovery |0 |Not needed; original OFF checkpoint retained |
| Production Function deployment |2: reader1+memberwrites1 |0; do not repeat |
| Production customer readiness |1: HTTP200/ready=true/client1513ms |0; do not repeat |
| Owner schema |optional Attribute1+Index1 available |0; do not repeat |
| System Sending Key |2 cumulatively issued/revoked, including this run's1 |0 under this stopped authority |
| SMTP apply / rollback recreations |2/2 |0; full budget consumed, global apply claim retained |
| Isolated acceptance |Logical Pages31 / B7 execution19/120 |Unchanged; no new acceptance window |

Function additions are exactly APPWRITE_ADMIN_USER_IDS (same existing ACL UID,secret=true) and CUSTOMER_ACCOUNT_ENABLED (false reader/true member/false rollback,secret=false). Preserve all37 existing values and REVIEW_ADMIN_USER_IDS. The UI phase adds only VITE_CUSTOMER_ACCOUNT_ENABLED=true; rollback removes that newly added setting. No native Auth setting or new administrator is authorized.

## Historical initial v2 proposal and local preparation

The following records the initial preparation before the completed backend rollout and SMTP rollback above. It is not the current execution authority.

- New immutable manifest: [customer-account-production-release-manifest.json](customer-account-production-release-manifest.json), version2,executionApproved=false.
- New SHA-256: `9972124a53e9a1bb8c9962e4165c5b1bf7c9dc1e427a4ec45e7b4dd1caf2fc4f`.
- New run/stage: `ca-release-resume-20261019` / `/home/john/.verygood-account-smtp-production-resume`. This attempt's proof/journal/root backup are preserved; the approval is archived as stopped, with no executable proof or new system secret remaining. Old approval is rejected.
- The [v1 manifest](customer-account-production-release-manifest-v1.json) retains SHA `ef000413dab463a916e7fe6df821e390750f7d25f14ff44b0600f36a1b1e9fb2`; it is historical authority only and cannot authorize this run.
- New frontendON artifact:1062 files, latest main1973 source files matched; locally built on Linux x64/Node22.16.0/npm10.9.2 with exact production public configuration and explicittrue flag. **Prepared only, not deployed.** SHA `5934c9ef52e6f1f2404f9eeac21e211e3b10501f9e645d1fc245d65095a94964` over sorted path/NUL/content-hash records. Public secret/test-resource scan PASS.
- New deterministic Function archive SHA `4854bfbd7be3a538b8cfa02cff38a61d43159957696867473d6738fd72d5d617`:56 source/lock files match latest main and accepted implementation. Nonexecutable Mac AppleDouble sidecars were omitted; code/dependency/policy changes0. Each actual approved deployment still requires Linux native smoke in its build.
- Existing SMTP byte/rollback/keep implementation reused; only fresh binding and explicit named-operator acceptance gate updated. Local RED→GREEN verifies historical proof rejection, current checkpoint/budget and operator refusal. **18PASS/0FAIL/0SKIP** focused tests. No full accepted feature suite/provider test repeated.
- Fresh on-disk root validation, protected configuration/image backups and the harmless independent timer probe **passed for this attempt**. The root stage was uploaded and verified, then the user stopped its waiting process after the local adapter rejection. No SMTP rollback timer was armed because apply never began. A future execution must revalidate current state and may not reuse this stopped approval.

## Historical sequence — stopped, not executable

The [original resume plan](superpowers/plans/2026-10-19-customer-account-production-resume.md) covered owner schema → reader/member deployments → readiness → SMTP keep → UI. Schema, both deployments and readiness are now complete and must not be repeated. The SMTP attempt was restored and its budget consumed. Persistent SMTP and UI activation remain incomplete; the stopped approval cannot authorize another attempt or a new key. No main merge or OFF build is needed.

The default total SMTP pre-confirmation exposure is bounded by the independent480s restore timer and600s hard limit. An unconfirmed keep, health>60s, queue/config/TLS failure or unsafe proof rolls back API→worker. No extensions/retries. A successful durable keep receipt disarms that timer and keeps SMTP permanently enabled; closing the Mac does not create another expiry. Manual rollback from the new protected root backup stays available.

Failure closes only the new customer feature via OFF Pages65a7ccae and the false reader runtime. Preserve operating Account/OTP/JWT/admin sessions, Renewal true/true, Custom Cake, existing guest sales and all normal customer/order data. Retain additive schema; do not delete it during rollback.

## Required operational acceptance and unresolved risks

Common SMTP enables shared email-auth transport for all existing4 operating projects and Console, while direct order/review Resend keys remain untouched. API recreation can briefly interrupt all Appwrite API/auth traffic; health must recover within60s or recovery is required. Same-image worker/API apply2 and recovery2 are the entire recreation budget.

Resend Free quota100/day,3000/month and10req/s is shared with operating notifications. Domain restriction does not restrict recipients or reserve notification capacity. Native Appwrite limits are not a global sending cap; direct Account API requests bypass frontend UI gating. No G-only guarantee or new automatic monitoring system is claimed. Start/keep requires daily remaining≥50/monthly≥1000; daily used50,monthly80%,unexpected+10 in5min,429/Auth/TLS or queue/failed increases require the named operator to stop new customer entry/escalate and if necessary roll back shared SMTP/revoke this key.

**nam9295 explicitly accepted this SHA's rollout monitoring and emergency root/Pages/credential recovery responsibility.** That approval authorized this one stopped attempt; its evidence is preserved, not automatically reused for another attempt. The shared blast radius, risk limits, root changes/new key and permanent SMTP keep still require valid execution authority. Legitimate root/login/secret entry handoffs are not additional operating approvals.

Common fallback actual email delivery is **NOT VERIFIED**: accepted B5 OTP used the test project override. This proposal sends0 test emails and requires explicit acceptance of that gap. Actual Google/OTP/sameUID/cart/profile/MYORDERS/real JWT member creation PASS is preserved. D1 legacy health timeout, review-api sharp issue and historical raw fingerprint uncertainty remain separately unresolved. Persistent SMTP and final UI activation are still **RELEASE BLOCKERS until approved and successfully applied**.
