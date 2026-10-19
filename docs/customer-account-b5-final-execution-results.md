# B5 FINAL — native OTP and existing Google UID PASS

2026-10-19 KST. Run `b5-final-native-20261019`, execution code `8ff760a`.
The user explicitly approved this one attempt after root/Owner/Resend preflight.
Manifest SHA-256: `179f9f06113e7d81d60316744a86692501ec9b80a49537cb5bca11f55e92ba8f`.
The manifest remains `executionApproved=false`; the separate fresh approval and
all previous manifests, failures, journals and counters are preserved.

| Verification | Result |
| --- | --- |
| SMTP TLS/AUTH in worker and API | PASS |
| Actual G email receipt | PASS — user confirmed |
| Native six-digit Email OTP login | PASS — user entered code directly |
| Google ↔ OTP existing G UID | PASS — UI and official Owner session API |
| G Preferences and existing order owner/status | PASS — before/after hashes unchanged |
| Operating environment restoration | PASS |
| B5 one-shot validation complete | YES |

## Execution evidence

The modified Mac/staging/root helper had SHA
`0d68678a4f5e3169b84e7d24ea90651de699da694fd3ebeb3d3d3982b3717a09`.
Actual root HTTPS curl and container loopback health passed before SMTP changes;
an independent systemd timer invoked the root-copied helper and passed both probes.
Fresh root-only originals, resolved configuration, image archive and rollback state
were created. No previous execution approval or durable claim was reused.

Immediately before application: load1≈0.27, available RAM9.28GiB, disk82.07GiB,
mail queue0/processing0/failed1, observed established HTTP connections0. The Mac
was connected by SSH, on AC power at100% battery. This sampled traffic observation
is not a guarantee that no operating request could arrive during recreation.

Only the seven approved SMTP/system fields changed. Worker then API were recreated
using the pinned Appwrite1.8.1 image, without pulls/upgrades. Both AUTH-only SMTP
connections and public/internal health passed. Operating policies and queue were
checked before test Account/native OTP ON; JWT and all other disabled methods stayed
OFF. Google and B4 Custom SMTP were preserved, and Function stayed OFF/B6 throughout.

The test UI issued exactly one native `Account.createEmailToken` request and checked
the returned existing G UID. The user received the email, submitted the six-digit
code once and observed `OTP PASS`. Owner session metadata confirmed existing G with
provider `token` (session creation02:55:27.061UTC, observed02:56:00.390UTC).
The user then logged out OTP and signed in with G Google once. Both the UI and
Owner session API confirmed the same G with provider `google` at02:57:21.489UTC.
No code, OAuth credential, Cookie, JWT, session secret or API Key was logged.

The actual OTP used the preserved test-project B4 SMTP override. Common SMTP
enabled Appwrite's native route gate; its system credential was TLS/AUTH-tested,
not used to send an additional common-fallback sample. No such fallback delivery
test is claimed. This was an existing Google account round trip; a new OTP-first
signup/Google-linking account was not created or tested.

## Restoration and counts

Common SMTP was restored even though authentication succeeded. API and worker
were restored before the final health gate. Root restoration at02:57:58.937UTC
verified original `.env`/Compose bytes, `.env`0600, both full original environments,
identical image, unrelated container IDs/start times, API health and queue0/0/failed1.
SMTP exposure was **297.793seconds**, below the600-second maximum. The480-second
independent timer was armed; it did not need to force restoration or get extended.

The close controller completed at02:58:04.962UTC: `closed=true`, `verified=true`,
every step PASS. Account OFF/API403, native OTP/JWT OFF, all test sessions absent,
Function disabled/execute empty/B6, customer/Renewal flags false and HTTPS CLOSED29.
Four current operating semantic fingerprints, G Preferences, fixture owner/status,
Google/B4 SMTP and Function execution inventory were unchanged. Console/full service
environment and Compose were restored. Historical raw uncertainty is not resolved.

| Resource | Actual use |
| --- | --- |
| Test Pages | OPEN28 + CLOSED29, exactly2; budget cumulative29 |
| Physical Pages inventory |32, including documented B3 setup3; not a reset |
| Container recreations |4: apply worker/API, restore API/worker |
| OTP requests / code submissions / Google-after-OTP |1 / 1 / 1 |
| Actual test email |1, user-confirmed receipt |
| SMTP exposure / apply-to-completed-close |297.793s / 303.818s |
| Function deployment / execution |0 / 0; prior B7 budget16/120 preserved |
| New users / DB/schema changes / orders / coupons / payments |0 |
| New system Sending Key |1, then revoked; operating/B4 keys preserved |

Resend daily usage4→5/100 and monthly86→87/3000 matched the one receipt. The new
system Key detail showed0 uses/No activity; B4 showed the test's recent activity.
After root restoration the user deleted exactly the new system Key, and the official
Console list retained the operating and B4 keys. The earlier unrelated increase4
remains **UNVERIFIED**, not reclassified as OTP.

Final resource sample: available RAM9.24GiB, disk82.017GiB, load1≈0.395, queue0/0/1.
No retry, window extension, new framework, full product regression rerun, customer
order operation, main merge or production site deployment occurred. Preparation
focused tests15PASS/0FAIL and targeted lint/build evidence are retained.

## Release boundary

The requested B5 one-shot verification is complete. Common SMTP is OFF/restored,
the system Key is revoked and test Account/native OTP remain OFF. Always-on SMTP,
operating abuse/quota policy, production resources/activation and main merge still
require separate approval. There is no proven recipient allowlist. The original
D1 reservation health timeout and historical AU/Gallery raw uncertainty remain
separate unresolved items; prior Google/cart/MY ORDERS/readiness PASS is preserved.
