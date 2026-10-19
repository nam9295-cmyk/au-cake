# B5 FINAL execution — ready for a new operational approval

2026-10-19 KST. Branch `feat/customer-account`, prior result `dfd438a`.
Run `b5-final-native-20261019`; prior approvals/journals/claims are not reused.

[Fresh manifest](customer-account-b5-final-execution-manifest-v3.json) SHA-256:
`179f9f06113e7d81d60316744a86692501ec9b80a49537cb5bca11f55e92ba8f`.
`executionApproved=false` is preserved. A separate fresh proof is required.

## Preflight evidence

- Modified Mac and actual server staging operator SHA both
  `0d68678a4f5e3169b84e7d24ea90651de699da694fd3ebeb3d3d3982b3717a09`.
- Actual root helper curl HTTPS health and API-container loopback health PASS.
- Independent root systemd timer invoked the root-copied helper successfully;
  its own curl and internal health probes PASS. No container was recreated.
- Fresh root-only backup of original `.env`, Compose, container environments and
  the identical Appwrite1.8.1 image verified. `.env` already0600, SMTP unchanged.
- Official Owner GET: Account403/OFF, native OTP/JWT OFF, sessions0, test Function
  disabled/execute empty/B6, customer/Renewal flags false, site CLOSED27.
- Four operating semantic policies, Google/B4 SMTP, G Preferences/fixture owner
  and Function execution inventory match preserved evidence.
- Resend Console: operating domain Verified; daily4/100, monthly86/3000,10req/s.
  The previous shared-quota increase4 remains unattributed/UNVERIFIED.
- Cloudflare pagination: physical30 deployments = documented B3 setup3 + B7/later
  budget27. Third-oldest is B3 final `c21f53ed-e3c2-4937-b638-2b7e2f29895c`.
  No new deployment is hidden or budget reset; next budget slots are OPEN28/CLOSED29.
- Focused local tests15PASS/0FAIL, including fresh-proof rejection, exact internal
  health, HTTPS validation and both-service rollback before final health.
  OTP entry targeted ESLint/build PASS;904 public files scanned,0 credential matches.
  No new framework or full product regression run; prior product PASS is reused.

## Single approval requested

Approval must cover the common-instance impact, one new domain-limited Sending
Key `VERYGOOD Appwrite SYSTEM SMTP B5 FINAL 20261019`, exactly seven approved SMTP
fields, worker/API apply and API/worker restoration (maximum four recreations),
identical image, OPEN28/CLOSED29, test Account/native OTP temporarily ON, one G OTP
request/code verification and one subsequent G Google UID check. Function and
order/payment/coupon operations remain prohibited.

Common SMTP enables existing native authentication-mail paths for the four
operating projects and built-in Console without changing their Auth policies.
API recreation causes short instance-wide API interruptions; duration is not
guaranteed. Existing operating HTTP notification keys and B4 override are unchanged.
There is no proven G-only recipient restriction: existing H and other allowed
native routes may request mail. Appwrite OTP10/hour per email/IP, MagicURL60/hour,
abuse checks, shared Resend daily/monthly quotas and monitoring do not constitute
a global recipient or one-email firewall. Quota/availability risk is shared.

Start the root rollback timer before the first SMTP-capable recreation, trigger
rollback at480seconds and preserve the600-second maximum without extension.
Restore common SMTP even on success, close Account/OTP/JWT and all test sessions,
keep Function OFF/B6, publish CLOSED29 and revoke only the new Key.
Unknown sessions/configuration, unexpected sends or unsafe monitoring trigger closure.

Until that fresh approval: no SMTP changes, key issuance, Account ON or deployment.
Exact Python403 edge cause, old AU/Gallery raw uncertainty and original D1 health
timeout remain unresolved. B5 remains **DEFERRED / BLOCKED — RELEASE BLOCKER**.
