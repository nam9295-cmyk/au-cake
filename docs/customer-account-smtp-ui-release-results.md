# Customer Account — production SMTP and UI release result

2026-10-19. **Production UI ON and permanent SMTP keep verified. Final real production Google/OTP/MY ORDERS acceptance by the user is still NOT RUN.** Existing isolated acceptance and the one production readiness PASS are preserved, not repeated.

Run `ca-release-smtp-ui-20261019`; approved immutable manifest SHA **`6a498278d9cef1cfc5b4aa1a937fac101db0387a7a5b41dd484a04914bb9725d`**. nam9295 explicitly accepted shared SMTP/API interruption, quota/recipient/fallback risk and monitoring/emergency recovery responsibility. Fresh proof/journal/root stage were used; no prior approval, revoked Key or consumed claim was reused.

## Current operating checkpoint

| Item | Result |
| --- | --- |
| Production main |08799b739f6d8047154c0ea699aab81837196ce2 unchanged; no merge/push/build |
| Production Pages |**d64ba5b3-8790-473b-a7d6-932f0108d92e**, au-cake-next, main; customer flagtrue |
| AU / au-stage |Both homepage and /account HTTP200; exact prepared ON JS/CSS references/bytes, MIME and unchanged CSP verified |
| Active reservation Function |Existing **6ad5cea0eb161f62de24** activated with customer flagtrue; no new deployment/execution |
| Schema/readiness |Earlier owner1+1 and readiness HTTP200/readytrue/client1513ms retained; new migration/execution0 |
| Shared SMTP |**COMMITTED**, TLS/AUTH passed in worker/API; public/internal API health PASS; root durable keep and timer disarm verified |
| Root keep timing |First application08:58:01Z → durable keep08:59:59Z;118.667sec before confirmation, below480sec timer/600sec hard ceiling |
| Operating policy |Four current project semantic hashes match; native Account/OTP/JWT/OAuth, original37 Function vars/options, Renewal true/true and Custom Cake/guest preserved |
| Server/queue |Same Appwrite1.8.1 image; all non-SMTP runtime env hashes/Console configuration unchanged; queue0/processing0/failed1 retained; no body read/retry/delete |
| Resend |Final5/100 daily,87/3000 monthly, unchanged; root-domain Sending Key1 active, old order/B4 keys preserved; agent email tests0 |
| Resource sample |RAM available8.39GiB/disk79.25GiB/load1≈1.69; observation only |

This release used the approved versioned `scripts/customer-account-production-smtp-apply.command` exactly once. Official Wrangler refresh and Cloudflare/Owner GET policy succeeded before its exclusive local/root apply claim. No failed gate was bypassed, no automatic retry or extension occurred. Root backed up original bytes/image and proved independent recovery first. SMTP changed exactly seven approved fields and recreated worker then API once each. Post-apply policy/Console/queue/non7 environment/quota passed; the fresh keep proof was consumed by root and a durable receipt committed before timer cancellation. Only then was the retained member snapshot activated and prepared frontendON deployed once. The Mac has no heartbeat/expiry role after the committed keep.

## Actual usage, with all previous counters preserved

| Action | This run | Cumulative production release |
| --- | --- | --- |
| New Sending Keys |1 active |3 issued: previous2 revoked, current1 retained |
| SMTP container apply / restore |2 /0 |4 apply /2 restore, total6; new recovery2 remains reserved |
| UI ON Pages / Pages rollback |1 /0 |Normal attempts3 (failedOFF1+successfulOFF1+ON1); rollback0, reserve1 |
| Existing member activation |1 |Earlier activation retained in old journal; no reset |
| Function new deployments / readiness executions |0 /0 |2 /1, completed allowance not repeated |
| Owner schema Attribute / Index |0 /0 |1 /1, completed allowance not repeated |
| Agent customer/order/payment/coupon/email test |0 |No new acceptance or customer-data mutation |

Key metadata: `VERYGOOD Appwrite SMTP FINAL R3 20261019`, Sending access, domainverygood-chocolate.com; ID3e0e5e0e-6bfc-4ea7-84f4-de6c58a78d31. Raw secret remains only in approved protected local/root storage and SMTP runtime. It is the active system credential and must not be revoked as routine cleanup.

## Recovery and operator handoff

Current immutable root backup: `/root/verygood-b5-backups/ca-release-smtp-ui-20261019-20261019T085319Z`. Original environment/Compose/image, used proof, candidate/receipt and global single-apply claim are retained. Root process completed normally. Legitimate root authentication is required for manual recovery; the known fixed command is:

```bash
python3 /root/verygood-b5-backups/ca-release-smtp-ui-20261019-20261019T085319Z/customer-account-system-smtp-production.py restore /root/verygood-b5-backups/ca-release-smtp-ui-20261019-20261019T085319Z
```

If recovery is needed, block the new frontend flag and restore OFF Pages65a7ccae-422a-4d79-9262-fccea9b51c7f (one reserved recovery), set existing customer flagfalse and reactivate compatible reader6ad5ce82a6ae17a3830a without deployment, restore only API/mail-worker from that backup (two reserved actions), and revoke only this run's new system Key. Preserve native operating Auth/admin sessions, Renewal true/true, Custom Cake/guest, additive schema and customer data. Local authorized Pages rollback entry is `.superpowers/sdd/2026-10-19-customer-account-smtp-ui-final/pages-step.mjs rollback`; proof/evidence retained for recovery, all normal-action claims consumed.

nam9295 monitors shared provider usage/error/queue and emergency recovery. Existing stop thresholds remain daily used50/monthly80%, unexpected+10 in5min, unexpected system sends,429/TLS/Auth failures, queue/failed increase or configuration drift. Limits100/day,3000/month and10req/s do not reserve notification capacity or block all recipient abuse. No new monitoring framework or recipient guarantee is claimed. Common fallback actual delivery remains NOT VERIFIED and no new test mail was sent. D1 legacy health timeout, review-api sharp and historical AU/Gallery raw equivalence UNVERIFIED remain separate unresolved records.

## Final user check

Open https://au.verygood-chocolate.com/account and choose Continue with Google. Confirm account identity and MY ORDERS directly; do not submit a real order or payment as a test. Deployment/HTTP/asset/configuration verification is PASS; actual production Google/OTP and private order access are NOT RUN until the user confirms. Authenticated production customer data was not opened by Codex.
