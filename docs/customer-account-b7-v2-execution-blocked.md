# B7 V2 — prerequisite failure; live execution NOT RUN

2026-10-18. Worktree: au-cake-customer-account; branch: feat/customer-account.

Approved manifest SHA-256 remains `2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41`. Original V1 and V2 manifests are unchanged. The separate approval proof is stored in an ignored, access-restricted local directory.

## Stop condition

The compiled, closed-state test artifact failed its browser acceptance test: `/account` rendered only the B7 control overlay, not the product application. Browser diagnostics show blocked external font stylesheets under the restrictive CSP, followed by `Unable to preload CSS` for the application main stylesheet. The exact causal relationship still needs isolation; do not relax CSP or external-network restrictions merely to make the test green.

The user explicitly requires no live authentication window when prerequisite checks fail. No Account activation, Function activation/deployment, Pages deployment, new user, coupon or order was performed during this implementation attempt. Owner login completion was reported by the user; the renewed credential has not yet been validated against remote management metadata in this attempt. Prior closed-state evidence is not a fresh remote verification.

## Results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Approved V2 manifest bytes | PASS | SHA verified again at stop |
| Local contract, guard, SDK headers, fixture and watchdog unit checks | PASS | Mock/local tests; not deployed adapters |
| Full suite checkpoint | PASS | 1,919 pass, 0 fail, 1 skip before the final runner mutation regression was added; not final-tree certification |
| Runner mutation regression | PASS | Four runner tests at latest checkpoint |
| ESLint, overlay TypeScript, KR then AU builds | PASS | Checkpoint before final runner change; repeat required |
| Existing Chrome/WebKit customer Mock scenarios | PASS | 12 scenarios, isolated local routes |
| Compiled B7 artifact browser acceptance | FAIL | Product application did not mount |
| Independent live watchdog and manual recovery | NOT RUN | Factory tests exist; process and remote adapters are incomplete |
| Guarded archive and actual platform JWT adapter | NOT RUN | Guard factory exists; deployment wiring incomplete |
| Unexpected-execution correlation monitor | NOT RUN | Provider metadata header filtering must be accounted for |
| G/H Google authentication, six orders, two coupons, ownership and guest checks | NOT RUN | No live window opened |
| Final remote closed-state and operating-project comparison | NOT RUN | Must be freshly checked before any later activation |

New local implementation files remain uncommitted for review and completion. HEAD remains `e453ce810e0b22c439020645017b4716cbf21f00`. This is neither a completed B7 implementation nor a release-readiness claim.

## Required before another live attempt

1. Isolate and fix the artifact loading failure; rerun compiled artifact acceptance in Chromium and WebKit without weakening network restrictions.
2. Complete actual JWT verification, create-only preparation, packaging and deployment adapters.
3. Complete and prove independent watchdog, bounded recovery operations, manual recovery and unexpected-execution monitoring.
4. Freeze native Checkout bodies/requestIds and verify exact wire serialization.
5. Repeat all required final-tree tests, KR→AU builds, browser regression and secret scans; perform fresh read-only remote preflight.
6. Preserve the approved single 15-minute window and all resource limits. No live window has been consumed by this attempt.

## B5 — DEFERRED — RELEASE BLOCKER

- [ ] Shared SMTP impact approval for the four operating projects and Console.
- [ ] OTP recipient access and abuse prevention.
- [ ] Gallery semantic fingerprint review.
- [ ] System SMTP credential and sender.
- [ ] Operating backups, root authentication, API/mail-worker recreation and rollback.
- [ ] Real Email OTP and Google↔OTP same-UID verification.

Native OTP remains outside B7. No production deployment, main merge, B5 or B8 execution is authorized by this result.
