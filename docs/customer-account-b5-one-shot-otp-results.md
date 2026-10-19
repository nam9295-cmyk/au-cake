# B5 one-shot OTP — SMTP rolled back, OTP NOT RUN

2026-10-19 KST. Execution code `d52e10a`, branch `feat/customer-account`.
Approved manifest SHA-256:
`1ba95fe97db0dbc939227b832b9377918a0a1126e93ccc5f11de58e255d479a1`.
Original `executionApproved=false`, separate approval, baseline and failure journals
are preserved. **B5: BLOCKED — RELEASE BLOCKER (DEFERRED).**

## Results

| Item | Result |
| --- | --- |
| Common SMTP | Temporarily applied, fully restored; not retained |
| Test Account / Email OTP ON | NOT RUN; never opened |
| OTP request / code submission / reception | NOT RUN; operator requests0 |
| OTP UID equals existing Google G UID | NOT RUN |
| G Preferences / fixture owner and status | Unchanged, Owner GET comparison PASS |
| Browser carts | No test interaction or cart mutation in this attempt |
| Four operating projects | Current semantic fingerprints unchanged |
| Console configuration | Original full API/worker env and Compose restored; no policy write |
| Final state | Account403/OFF, OTP/JWT OFF, sessions0, Function disabled/execute=[], B6, flags false, CLOSED27 |

Existing Google/cart/MY ORDERS/readiness PASS is preserved. The original D1 health
timeout and historical AU/Gallery raw fingerprint uncertainty remain unresolved.

## Failure and restoration

The approved two containers were recreated with the same pinned Appwrite1.8.1 image.
The root helper used Python `urllib` for public health although the operational
plan used `curl`. It failed with `HEALTH_60S_FAILED` before enabling test Account/OTP.
Read-only comparison on the server found **urllib HTTP403** with a Cloudflare header
and **curl HTTPS200 / version1.8.1** at the same path. This establishes a
client-dependent public probe failure; the exact edge rule/UA/TLS cause remains
**UNVERIFIED**. No Cloudflare rule or TLS protection was changed.

Automatic rollback restored `.env` and API, but the same Python health check stopped
it before worker restoration. This was a defect in the maintenance helper. The
original closure record correctly remains `verified=false`; cleanup probe failures
during API recreation are preserved. The user then ran a fixed-scope root script
for the **single remaining worker restoration**, without another SMTP apply or OTP
attempt. It verified original files/API env, HTTPS curl and image, durably claimed
the remaining recreation, restored worker once and verified both services.

Root restoration evidence at `2026-10-19T02:07:50.892Z`: **425.369seconds** since
application began, within the approved600-second maximum. Verified:

- `.env`/Compose exact original bytes, `.env`0600, both original full environments.
- Same image; unrelated Compose container IDs/start times unchanged.
- Mail queue0 / processing0 / failed1 preserved, no retry or deletion.
- Public API HTTPS200 / Appwrite1.8.1.

A separate GET-only restoration addendum confirmed all final test states, operating
semantic fingerprints, G Preferences and fixture owner/status. It supplements the
failed record. B4 SMTP and Google settings are unchanged.

## Resend and actual use

One domain-limited Sending access system Key was created through the official
Console and stored untracked0600. After restoration the user deleted that exact
Key; the official list retains the operating and B4 keys. Before deletion the new
Key showed **0 uses / No activity**. No secret was printed or committed.

Shared quota changed daily0/100→4/100 and monthly82/3000→86/3000. Individual mail
contents/recipients were not inspected; attribution of these shared-team increments
is **UNVERIFIED**, not reported as OTP sends.

| Resource | Use |
| --- | --- |
| Pages | OPEN26 + CLOSED27; cumulative27 |
| API/mail-worker recreations | Four: apply worker/API, restore API/worker |
| Function deployments / executions | 0 / 0; prior B7 journal16/120 preserved |
| New users / DB/schema / orders / coupons | 0 |
| Operator OTP sends / verification / Google retry | 0 / 0 / 0 |
| System Key | One created, then revoked; existing keys unchanged |

Final sample: RAM available9.299GiB, disk available82.562GiB, load1≈0.124, API healthy.
No main merge or production site deployment occurred.

## Local correction and next boundary

The local helper now uses verified HTTPS curl without disabling certificate checks.
Rollback restores both services before the final health gate, so a rejected probe
cannot leave the worker on the trial credential. These corrections were **not used
for another maintenance attempt**. Two regressions failed first, then passed after
the minimal fixes; focused SMTP/byte/session tests: **13PASS / 0FAIL / 0SKIP**.
No new framework or full product regression run was added.

OTP-entry targeted lint passed. OPEN26 publication preceded inspection of that lint
result; the module-export correction generated identical public JS/CSS/HTML, so no
corrective redeployment occurred. Artifact credential scan found0matches.

Further OTP execution needs fresh approval and credential/Pages budget. No automatic
retry, new authentication window or additional deployment follows this attempt.
