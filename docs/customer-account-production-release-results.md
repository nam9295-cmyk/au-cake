# Customer Account — current production checkpoint and remaining release

2026-10-19. **PR25/26 integration and the customer-OFF production deployment are complete.** This document supersedes the operational instructions in the [first stopped release report](customer-account-production-release-results-v1-stopped.md); that evidence remains unchanged. No completed merge, OFF deployment or functional acceptance is repeated.

## Current checkpoint

| Item | Verified state |
| --- | --- |
| Production main | `08799b739f6d8047154c0ea699aab81837196ce2` |
| Pages project / active customer-OFF checkpoint | `au-cake-next` / `65a7ccae-422a-4d79-9262-fccea9b51c7f` |
| Domains | AU and au-stage share that deployment |
| Prior immutable Pages deployment | `0af308ee-ad99-4345-838e-649c5a60111a`, historical fallback only; the new OFF checkpoint is used for the remaining release rollback |
| Actual Cloudflare build | Node22.16.0/npm10.9.2; npm ci, TypeScript/Vite/SEO PASS. This existing PASS is cited, not rerun remotely |
| Current customer UI | OFF; frontend flag absent, native operating Account/OTP/JWT settings preserved |
| Current reservation Function | Original `6ad33cd2615e4096f7bf`, node-22,timeout60,8vCPU/8GiB,existing11 scopes/hourly schedule/execute[any] and37 variables unchanged |
| Renewal / Custom Cake / guest | Renewal writes/preorders=true/true; existing Custom Cake/admin/guest configuration preserved |
| Schema / ACL | Fresh Owner GET: DB2/Collection22,private19/public-read-only3 complete; owner Attribute/Index still absent; no ACL or document writes |
| Operating4 project policy | Current Auth/SMTP/OAuth/service semantic fingerprints match; historical AU/Gallery raw equivalence remains UNVERIFIED |
| Shared server | API/mail worker running, original1.8.1 image and full runtime hashes unchanged; common SMTP host empty; queue0/processing0/failed1 |
| Resource sample | Available RAM≈7.9GiB, disk≈81.6GiB,load1≈0.45; recheck before writes |
| Resend official observation | Daily5/100,monthly87/3000; root and test domains Verified; existing keys unchanged |

No operating resources/configuration, Function execution, key issuance, SMTP or site activation was changed in this preparation.

Final GET-only recheck at `2026-10-19T07:27:50.053Z` again confirmed main/OFF deployment, all four current semantic hashes and the registry's exact `node-22` runtime. This new read-only observer does not import an old approval or carry mutation capability; prior execution helpers correctly reject the superseded manifest SHA. No customer documents or Function executions were read or created.

## Preserved usage and remaining limits

| Action | Already consumed | New approval maximum |
| --- | --- | --- |
| Normal main integration |2: PR25+26 |0 |
| Normal production Pages attempts |2: failedOFF1+successfulOFF1 |UION1; cumulative normal3 |
| Pages recovery |0 |1 to current OFF checkpoint; total attempts including reserve≤4 |
| Production Function deployment |0 |reader1+memberwrites1 |
| Production customer readiness |0 |1 read-only execution,HTTP200/ready=true/client<8s |
| Owner schema |0 |optional Attribute1+Index1 only |
| System Sending Key |1 issued then revoked |1 fresh key; cumulative production release issuance2 |
| SMTP apply / rollback recreations |0/0 |2 apply+2 recovery; same image only |
| Isolated acceptance |Logical Pages31 / B7 execution19/120 |Unchanged; no new acceptance window |

Function additions are exactly APPWRITE_ADMIN_USER_IDS (same existing ACL UID,secret=true) and CUSTOMER_ACCOUNT_ENABLED (false reader/true member/false rollback,secret=false). Preserve all37 existing values and REVIEW_ADMIN_USER_IDS. The UI phase adds only VITE_CUSTOMER_ACCOUNT_ENABLED=true; rollback removes that newly added setting. No native Auth setting or new administrator is authorized.

## New frozen proposal and local preparation

- New immutable manifest: [customer-account-production-release-manifest.json](customer-account-production-release-manifest.json), version2,executionApproved=false.
- New SHA-256: `9972124a53e9a1bb8c9962e4165c5b1bf7c9dc1e427a4ec45e7b4dd1caf2fc4f`.
- New run/stage: `ca-release-resume-20261019` / `/home/john/.verygood-account-smtp-production-resume`. New proof/journal/root backup/global apply claim required; old approval is rejected. No executable approval proof or new secret exists yet.
- The [v1 manifest](customer-account-production-release-manifest-v1.json) retains SHA `ef000413dab463a916e7fe6df821e390750f7d25f14ff44b0600f36a1b1e9fb2`; it is historical authority only and cannot authorize this run.
- New frontendON artifact:1062 files, latest main1973 source files matched; locally built on Linux x64/Node22.16.0/npm10.9.2 with exact production public configuration and explicittrue flag. **Prepared only, not deployed.** SHA `5934c9ef52e6f1f2404f9eeac21e211e3b10501f9e645d1fc245d65095a94964` over sorted path/NUL/content-hash records. Public secret/test-resource scan PASS.
- New deterministic Function archive SHA `4854bfbd7be3a538b8cfa02cff38a61d43159957696867473d6738fd72d5d617`:56 source/lock files match latest main and accepted implementation. Nonexecutable Mac AppleDouble sidecars were omitted; code/dependency/policy changes0. Each actual approved deployment still requires Linux native smoke in its build.
- Existing SMTP byte/rollback/keep implementation reused; only fresh binding and explicit named-operator acceptance gate updated. Local RED→GREEN verifies historical proof rejection, current checkpoint/budget and operator refusal. **18PASS/0FAIL/0SKIP** focused tests. No full accepted feature suite/provider test repeated.
- Root original env/Compose byte hashes are expected immutable values. Current container env/image equality is observed, but **fresh on-disk root validation/backups/timer probe for this run remain NOT RUN** and must pass before any release write. No root upload or timer was started.

## One remaining execution sequence, after a new approval

Follow the [exact resume plan](superpowers/plans/2026-10-19-customer-account-production-resume.md): fresh current-target/operator/root gates → additive owner Attribute/Index → compatible false reader deployment → new true member deployment → readiness1 with client<8s → fresh systemKey/seven-field SMTP apply and locked keep confirmation before480s → UION Pages1. No main merge or automatic OFF build belongs to this approval.

The default total SMTP pre-confirmation exposure is bounded by the independent480s restore timer and600s hard limit. An unconfirmed keep, health>60s, queue/config/TLS failure or unsafe proof rolls back API→worker. No extensions/retries. A successful durable keep receipt disarms that timer and keeps SMTP permanently enabled; closing the Mac does not create another expiry. Manual rollback from the new protected root backup stays available.

Failure closes only the new customer feature via OFF Pages65a7ccae and the false reader runtime. Preserve operating Account/OTP/JWT/admin sessions, Renewal true/true, Custom Cake, existing guest sales and all normal customer/order data. Retain additive schema; do not delete it during rollback.

## Required operational acceptance and unresolved risks

Common SMTP enables shared email-auth transport for all existing4 operating projects and Console, while direct order/review Resend keys remain untouched. API recreation can briefly interrupt all Appwrite API/auth traffic; health must recover within60s or recovery is required. Same-image worker/API apply2 and recovery2 are the entire recreation budget.

Resend Free quota100/day,3000/month and10req/s is shared with operating notifications. Domain restriction does not restrict recipients or reserve notification capacity. Native Appwrite limits are not a global sending cap; direct Account API requests bypass frontend UI gating. No G-only guarantee or new automatic monitoring system is claimed. Start/keep requires daily remaining≥50/monthly≥1000; daily used50,monthly80%,unexpected+10 in5min,429/Auth/TLS or queue/failed increases require the named operator to stop new customer entry/escalate and if necessary roll back shared SMTP/revoke this key.

**nam9295 must accept this new SHA's rollout monitoring and emergency root/Pages/credential recovery responsibility, including ongoing quota/error checks after Codex's execution ends.** Earlier acceptance remains evidence but does not authorize this new run. A final operating approval covers the shared blast radius, risk limits, root changes/new key and permanent SMTP keep. Legitimate root/login/secret entry handoffs are still required and are not additional operating approvals.

Common fallback actual email delivery is **NOT VERIFIED**: accepted B5 OTP used the test project override. This proposal sends0 test emails and requires explicit acceptance of that gap. Actual Google/OTP/sameUID/cart/profile/MYORDERS/real JWT member creation PASS is preserved. D1 legacy health timeout, review-api sharp issue and historical raw fingerprint uncertainty remain separately unresolved. Persistent SMTP and final UI activation are still **RELEASE BLOCKERS until approved and successfully applied**.
