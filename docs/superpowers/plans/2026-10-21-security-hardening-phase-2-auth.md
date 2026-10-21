# Security Hardening Phase 2 Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable the three unused production auth methods without changing required login, session, platform, or guest-order behavior, then evaluate the 30-day session policy as an independent release.

**Architecture:** Use the official Appwrite 1.8.1 Owner project API against exactly `verygood-au`. Each auth method is a separate guarded write followed by a complete semantic GET comparison, with reverse-order field-only rollback; session duration uses a separate manifest and approval.

**Tech Stack:** Appwrite 1.8.1 Console Owner API, Node.js read-only semantic comparison, Git documentation evidence

**Spec:** `docs/security/security-hardening-phase-2-auth.md`

## Global Constraints

- Work only from `/Users/nam9295/Desktop/john_2.0/code/au-cake-security` on `fix/security-review-api`.
- Do not modify the design, customer-account, or Cloudflare lockfix worktrees.
- Target only endpoint `https://api.verygood-chocolate.com/v1`, project `verygood-au`.
- Preserve Account ON, Google ON, Email OTP ON, Email/password ON, JWT ON, Invites ON.
- Preserve duration `31536000`, sessions limit `10`, user limit `0` during the auth-method rollout.
- Do not create users, sessions, tokens, emails, SMS, orders, coupons, or customer data.
- Do not alter API keys, Functions, SMTP, Pages, DB, Appwrite containers, Web platforms, or `main`.
- Session duration requires a separate approval and must not be folded into the auth-method change.

## Review Focus

- A stale Owner target must fail before the first PATCH and produce zero writes.
- `authLimit=0` must never be mistaken for `authSessionsLimit=10` or sent to either limit endpoint.
- A successful method PATCH accompanied by any unrelated semantic drift must trigger reverse-order rollback.
- Existing customer/admin sessions must remain valid because the rollout changes creation methods, not session documents.
- An uncertain Web platform must remain registered even if its current HTML has no Appwrite call.

---

### Task 1: Freeze the approved auth-method execution

**Files:**
- Read: `docs/security/security-hardening-phase-2-auth-methods-manifest.json`
- Create outside Git: `.superpowers/sdd/2026-10-21-security-phase2-auth/approval-proof.json`
- Create outside Git: `.superpowers/sdd/2026-10-21-security-phase2-auth/journal.jsonl`

**Interfaces:**
- Consumes: manifest SHA `b4aeb0f19aad296457485b2ca007d2caa62905435baa30595b4354f9715f7eaf` and explicit user approval.
- Produces: one-run claim binding endpoint, project, manifest SHA, approval, and write budgets.

- [ ] **Step 1: Verify the tracked manifest hash and `executionApproved=false`**

Run `shasum -a 256 docs/security/security-hardening-phase-2-auth-methods-manifest.json` and parse the JSON. Expected: exact approved SHA; the original manifest remains immutable and a separate approval proof authorizes the run.

- [ ] **Step 2: Create the one-run approval proof and exclusive claim**

Record only non-secret approval metadata and reject an existing/incomplete claim. Expected: no project request has been sent yet.

- [ ] **Step 3: Commit nothing**

Operational evidence stays ignored/protected; no secret or Owner session enters Git.

### Task 2: Capture and compare the fresh production baseline

**Files:**
- Create outside Git: `.superpowers/sdd/2026-10-21-security-phase2-auth/project-before.private.json` mode `0600`
- Create outside Git: `.superpowers/sdd/2026-10-21-security-phase2-auth/project-before.safe.json` mode `0600`

**Interfaces:**
- Consumes: official Owner session and Task 1 claim.
- Produces: authoritative baseline for every protected field and all seven Web platforms.

- [ ] **Step 1: GET project, team membership, providers, and platforms**

Expected target: `verygood-au`, Appwrite `1.8.1`, Owner membership valid, 7 exact platform IDs.

- [ ] **Step 2: Compare semantic fields with the manifest**

Assert Account/required auth/provider/session/user-limit values exactly. Treat any `updatedAt` difference as a required semantic diff review; do not normalize a changed baseline silently.

- [ ] **Step 3: Verify zero mutation evidence**

Expected journal: Owner GET entries only and write count `0`.

### Task 3: Disable Phone, Magic URL, and Anonymous sequentially

**Files:**
- Modify outside Git: operational journal only

**Interfaces:**
- Consumes: exact Task 2 baseline.
- Produces: the three target flags false with every protected field unchanged.

- [ ] **Step 1: PATCH Phone OFF**

Call `PATCH /v1/projects/verygood-au/auth/phone` with only `{"status":false}`. GET the project and assert only `authPhone` changed.

- [ ] **Step 2: PATCH Magic URL OFF**

Call `PATCH /v1/projects/verygood-au/auth/magic-url` with only `{"status":false}`. GET and assert only `authUsersAuthMagicURL` changed relative to Step 1.

- [ ] **Step 3: PATCH Anonymous OFF**

Call `PATCH /v1/projects/verygood-au/auth/anonymous` with only `{"status":false}`. GET and assert only `authAnonymous` changed relative to Step 2.

- [ ] **Step 4: Enforce write budgets**

Expected: apply writes exactly `3`, service restarts `0`, session/platform writes `0`. Any failed predicate stops further writes.

### Task 4: Verify protected production behavior

**Files:**
- Modify outside Git: operational journal and safe result summary

**Interfaces:**
- Consumes: Task 3 final project state and existing sessions.
- Produces: PASS/FAIL evidence without creating operational data.

- [ ] **Step 1: Verify authoritative project metadata**

Expected false: Phone, Magic URL, Anonymous. Expected true: Account, Google, Email OTP, Email/password, JWT, Invites. Expected unchanged: duration `31536000`, sessions limit `10`, user limit `0`, seven platforms.

- [ ] **Step 2: Smoke existing authenticated paths**

Use already-valid customer and administrator sessions to check `Account.get`, MY ORDERS read, admin allowlist page, and JWT-dependent read path. Do not log identifiers or create a new session.

- [ ] **Step 3: Smoke public guest paths**

Check catalogue, cart, checkout form, and lookup availability without submitting an order.

- [ ] **Step 4: Avoid side-effecting disabled-method probes**

Do not request an anonymous session, Magic URL email, or phone token in production. The project GET is the authoritative disabled-state proof; direct negative probes belong to the isolated project.

### Task 5: Roll back only on a failed safety gate

**Files:**
- Modify outside Git: operational journal and safe result summary

**Interfaces:**
- Consumes: list of successfully applied fields and the Task 2 baseline.
- Produces: exact field-only restoration.

- [ ] **Step 1: Restore applied flags in reverse order**

PATCH true for Anonymous, Magic URL, then Phone, skipping any method never changed. Never touch required auth or session fields.

- [ ] **Step 2: GET and compare the complete baseline**

Expected: all auth/session/provider/platform values match Task 2. If restoration cannot be verified, report the exact non-secret field and stop.

- [ ] **Step 3: Close the claim**

Record final apply/rollback counts and status. Do not delete the journal or baseline.

### Task 6: Prepare the independent 30-day session release

**Files:**
- Read: `docs/security/security-hardening-phase-2-session-duration-manifest.json`
- Create only after separate approval: a separate approval proof, claim, and journal

**Interfaces:**
- Consumes: separate manifest SHA `38a04a137937c012dc0207feb9c0721227c4c6c02c9bf16e1d06f736afc60590` and separate user approval.
- Produces: duration `2592000` while sessions limit stays `10`.

- [ ] **Step 1: Refuse to reuse the auth-method approval proof**

Expected: session execution is blocked until its own approval binds the exact SHA.

- [ ] **Step 2: PATCH only auth duration**

Call `PATCH /v1/projects/verygood-au/auth/duration` with `{"duration":2592000}`. Expected write count: `1`.

- [ ] **Step 3: Verify session behavior**

Confirm new customer/admin sessions expire in 30 days within clock tolerance, existing sessions are not unexpectedly invalidated, and sessions limit remains `10`.

- [ ] **Step 4: Roll back on failure**

PATCH duration `31536000` once and verify. Do not delete or invalidate existing sessions.
