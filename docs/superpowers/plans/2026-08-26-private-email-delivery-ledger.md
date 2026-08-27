# Private Email Delivery Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, persistent Appwrite-backed email-delivery ledger foundation without sending an email or changing an existing notification flow.

**Architecture:** Store delivery records in the existing private review-resources collection family in the cake database, so cake, class, and review workflows can share one server-only ledger. Keep identity hashing, canonical payload hashing, event-key validation, state decisions, and the Appwrite repository adapter in a reusable server-only module; production Functions will inject their request-scoped `x-appwrite-key` database client when Task 3 connects a sender.

**Tech Stack:** Node.js ESM, built-in `node:crypto`, node-appwrite 22.1.3 Databases/Documents API, Node test runner, Appwrite source-schema scripts.

**Spec:** User Task 2, “Private email delivery ledger foundation” (2026-08-26 conversation).

## Global Constraints

- Work only in `fix/au-email-automation-recovery`; do not modify the dirty `feat/vanilla-detail` worktree or apply its backup patch.
- Do not push, deploy, change Cloudflare, apply an Appwrite schema, write Appwrite production data, or invoke Resend.
- Do not add any booking, operator, confirmation, review-invite, reward-email, or admin-UI delivery behavior in this task.
- Function server access must use the request-scoped `x-appwrite-key`; never add an `APPWRITE_API_KEY` runtime fallback.
- Keep `email_deliveries` non-public: browser roles have no read/create/update/delete permission and raw recipient email is never stored.
- Keep the installed Appwrite/node-appwrite major versions unchanged; do not require transaction support for this foundation.
- Commit only after `git diff --check`, targeted tests, full tests, lint, build, and dry runs pass.

---

## File Structure

- Create `appwrite-functions/shared/email-delivery.js`: server-only pure identity helpers, event-key builder, canonical payload hash, stale lease policy, and state-decision function.
- Create `appwrite-functions/shared/email-delivery-repository.js`: Appwrite Documents adapter with injected SDK/database client, unique-conflict recovery, and status-transition helpers.
- Modify `scripts/review-schema.mjs`: private `emailDeliveries` resource definition, server-only resource-id resolution, and setup dry-run inclusion.
- Modify `appwrite-functions/review-api/src/main.js` and `scripts/review-api-deploy-config.mjs`: optional server-only ledger ID for the future review Function integration; do not make it apply-required.
- Modify `.env.example`: blank server-only `APPWRITE_EMAIL_DELIVERIES_TABLE_ID` placeholder and no public Vite equivalent.
- Create `tests/email-delivery.test.mjs`: pure contracts and concurrent-create repository behavior using an in-memory Appwrite-shaped adapter.
- Modify `tests/review-schema.test.mjs`: private schema, unique event key, permission, and dry-run contracts.
- Modify `tests/review-api.test.mjs`, `tests/review-api-deploy.test.mjs`, and `package.json`: server-only configuration/dry-run contract and canonical test entrypoint.

### Task 1: Prove and implement server-only delivery identities and decisions

**Files:**
- Create: `tests/email-delivery.test.mjs`
- Create: `appwrite-functions/shared/email-delivery.js`

**Interfaces:**
- Produces `buildEmailDeliveryEventKey({ template, sourceType, sourceId })`, `recipientHashForEmail(email)`, `payloadHashForEmail(payload)`, `decideEmailDelivery(existing, identity, now)`, and `EMAIL_DELIVERY_PENDING_LEASE_MS`.
- `identity` is `{ eventKey, sourceType, sourceId, template, recipientHash, payloadHash }`; a decision is one of `create_pending`, `already_sent`, `in_progress`, `retryable`, `reconciliation_required`, or `identity_mismatch`.

- [x] **Step 1: Write failing pure-contract tests**

```js
assert.equal(
  buildEmailDeliveryEventKey({ template: 'booking-received-customer', sourceType: 'cake', sourceId: 'cake-123' }),
  'booking-received-customer:cake:cake-123',
)
assert.equal(recipientHashForEmail(' TEST@Example.com '), recipientHashForEmail('test@example.com'))
assert.equal(decideEmailDelivery({ status: 'sent', recipientHash: 'a', payloadHash: 'b' }, { recipientHash: 'a', payloadHash: 'b' }).kind, 'already_sent')
```

- [x] **Step 2: Run the new test file and verify RED**

Run: `node --test tests/email-delivery.test.mjs`

Expected: FAIL because the new server-only module and its exports do not exist.

- [x] **Step 3: Implement the minimal pure module**

```js
export const EMAIL_DELIVERY_PENDING_LEASE_MS = 5 * 60 * 1000

export function decideEmailDelivery(existing, identity, now = new Date()) {
  if (!existing) return { kind: 'create_pending' }
  if (existing.recipientHash !== identity.recipientHash || existing.payloadHash !== identity.payloadHash) {
    return { kind: 'identity_mismatch' }
  }
  if (existing.status === 'sent') return { kind: 'already_sent' }
  if (existing.status === 'failed') return { kind: 'retryable' }
  if (existing.status === 'uncertain') return { kind: 'reconciliation_required' }
  return isFreshPending(existing, now) ? { kind: 'in_progress' } : { kind: 'reconciliation_required', stale: true }
}
```

Use SHA-256 hexadecimal digests, strict email validation after trim/lowercase normalization, a fixed allowlist for template/source identifiers, and a fixed-order canonical payload object. Exclude credentials and headers from the canonical payload object.

- [x] **Step 4: Re-run the pure test file and verify GREEN**

Run: `node --test tests/email-delivery.test.mjs`

Expected: PASS for deterministic keys, identity hashes, property-order independence, payload differences, every status branch, mismatch fail-closed behavior, and stale pending behavior.

### Task 2: Prove and implement an injected Appwrite repository adapter

**Files:**
- Modify: `tests/email-delivery.test.mjs`
- Create: `appwrite-functions/shared/email-delivery-repository.js`

**Interfaces:**
- Consumes the pure `identity` and state-decision interfaces from Task 1.
- Produces `createEmailDeliveryRepository({ databases, databaseId, collectionId, idFactory })` with `getByEventKey`, `createPending`, `getOrCreatePending`, `markAttempt`, `markSent`, `markFailed`, and `markUncertain`.

- [x] **Step 1: Write the concurrent-create failing test**

```js
const first = await repository.getOrCreatePending(identity, now)
const second = await repository.getOrCreatePending(identity, now)
assert.equal(first.kind, 'created')
assert.equal(second.kind, 'existing')
assert.equal(fakeDocuments.length, 1)
```

The in-memory adapter must emulate the actual `createDocument` unique-index conflict as `{ code: 409 }`, then return the row from `listDocuments(Query.equal('eventKey', ...), Query.limit(1))`.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/email-delivery.test.mjs`

Expected: FAIL because the repository module is missing.

- [x] **Step 3: Implement the minimal adapter**

```js
try {
  return { kind: 'created', delivery: await databases.createDocument({ databaseId, collectionId, documentId: idFactory(), data }) }
} catch (error) {
  if (!isAppwriteConflict(error)) throw error
  const delivery = await getByEventKey(identity.eventKey)
  if (!delivery) throw error
  return { kind: 'existing', delivery }
}
```

The adapter must only accept a caller-injected database object. It must not construct a client, load environment secrets, log identities, or infer a long-lived API key.

- [x] **Step 4: Re-run the test and verify GREEN**

Run: `node --test tests/email-delivery.test.mjs`

Expected: PASS; the second create handles the real project’s documented `code === 409` conflict shape by looking up the existing event.

### Task 3: Add private schema and dry-run contracts

**Files:**
- Modify: `scripts/review-schema.mjs`
- Modify: `.env.example`
- Modify: `tests/review-schema.test.mjs`

**Interfaces:**
- Adds `emailDeliveriesCollectionId` to `resolveReviewResourceIds` using only `APPWRITE_EMAIL_DELIVERIES_TABLE_ID` or `email_deliveries`.
- Adds private `REVIEW_COLLECTIONS.emailDeliveries` and an `eventKey_unique` unique index.

- [x] **Step 1: Write failing schema and dry-run tests**

```js
const deliveries = REVIEW_COLLECTIONS.emailDeliveries
assert.deepEqual(deliveries.publicPermissions, [])
assert.equal(attribute(deliveries, 'recipientHash').size, 64)
assert.deepEqual(index(deliveries, 'eventKey_unique'), {
  key: 'eventKey_unique', attributes: ['eventKey'], type: 'unique',
})
assert.ok(buildReviewSetupPlan({}).collections.some((entry) => entry.id === 'email_deliveries'))
```

- [x] **Step 2: Run schema tests and verify RED**

Run: `node --test tests/review-schema.test.mjs`

Expected: FAIL because `emailDeliveries` does not yet exist in the review resource schema.

- [x] **Step 3: Implement the minimal source schema**

Define bounded required `eventKey` (128), `sourceType` enum (`cake`, `class`, `review`, `system`), `sourceId` (64), `template` enum, `status` enum (`pending`, `sent`, `failed`, `uncertain`), 64-character recipient/payload hashes, required attempts (0+), optional provider ID (128), optional timestamp fields (40), optional short error code (80), required timestamps (40), and `eventKey_unique`. Reuse `PRIVATE_REVIEW_ACCESS`; do not add a Vite variable or public collection permission. Place a blank server-only ID placeholder in `.env.example`.

- [x] **Step 4: Re-run schema tests and the setup dry-run**

Run: `node --test tests/review-schema.test.mjs && node scripts/setup-appwrite.mjs --dry-run`

Expected: PASS; the dry run lists the private ledger without constructing an Appwrite client or network request.

### Task 4: Regression verification and local commit

**Files:**
- Verify all files from Tasks 1–3 only.

- [x] **Step 1: Run focused verification**

Run: `git diff --check && node --test tests/email-delivery.test.mjs tests/review-schema.test.mjs && node scripts/setup-appwrite.mjs --dry-run`

Expected: all commands exit 0.

- [x] **Step 2: Run full repository verification**

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit 0. Use the nested review Function install command before the full suite if the clean dependency baseline requires `libheif-js`.

- [x] **Step 3: Review actual evidence and commit only if green**

```bash
git status --short
git add .env.example package.json scripts/review-schema.mjs scripts/review-api-deploy-config.mjs appwrite-functions/shared/email-delivery.js appwrite-functions/shared/email-delivery-repository.js appwrite-functions/review-api/src/main.js tests/email-delivery.test.mjs tests/review-schema.test.mjs tests/review-api.test.mjs tests/review-api-deploy.test.mjs docs/superpowers/plans/2026-08-26-private-email-delivery-ledger.md
git commit -m "feat: add private email delivery ledger"
```

Expected: one local commit only; do not push or apply/deploy anything.

## Self-Review

- Spec coverage: Tasks 1–2 cover deterministic identity, hash safety, all required state outcomes, stale-pending handling, unique-conflict recovery, and injected server access. Task 3 covers the private schema, permissions, environment placeholder, and no-network setup dry run. Task 4 covers required verification and a guarded local commit.
- Placeholder scan: no execution step depends on an unspecified helper, error branch, identifier, or validation rule.
- Type consistency: the `identity` shape is defined once in Task 1 and is passed unchanged to the repository in Task 2; resource id `emailDeliveriesCollectionId` maps to the `emailDeliveries` schema key in Task 3.
