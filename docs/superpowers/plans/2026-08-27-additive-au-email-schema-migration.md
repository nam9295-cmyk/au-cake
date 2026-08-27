# Additive-only AU Email Schema Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe, resumable script that creates only the AU email/reminder schema delta and never mutates existing application state.

**Architecture:** Keep the schema target list in side-effect-free modules. The migration core accepts a narrow Appwrite schema adapter, performs a complete read-only preflight, and only creates allowlisted resources after every target is verified as missing or matching. The CLI is dry-run by default and requires both `--apply` and `--market=AU` before it constructs a write-capable path.

**Tech Stack:** Node.js ESM, node-appwrite Databases adapter, node:test, existing `scripts/review-schema.mjs` definitions.

**Spec:** User-approved Task “Additive-only AU Email Schema Migration” in this conversation.

## Global Constraints

- Do not change `setup-appwrite.mjs` behavior, run it, or use it as the production migration path.
- Permit only additive attribute, table, and index creation named in the approved allowlist.
- Never update/delete resources or read/write reservation, review, coupon, settings, or booked-date documents.
- Default mode is dry-run; apply requires exact `--apply --market=AU` and target validation.
- Preflight every resource before any write; drift produces zero writes.
- Wait boundedly for every newly created asynchronous resource; preserve created resources after a later failure.
- Never emit secrets or row data.

### Task 1: Extract side-effect-free AU email schema contracts

**Files:**
- Create: `scripts/au-email-schema-contract.mjs`
- Modify: `scripts/setup-appwrite.mjs`
- Test: `tests/au-email-schema-migration.test.mjs`

**Interfaces:**
- Produces `AU_EMAIL_CAKE_RESERVATION_ATTRIBUTES` and `AU_EMAIL_REMINDER_INDEXES` frozen definitions used by both setup and migration.

- [ ] Write a failing structural/behavioral test that imports the new contract and expects optional `customerEmail` plus the three ordered composite key indexes.
- [ ] Run the focused migration test and observe the missing-module failure.
- [ ] Add the contract module and substitute its values into the existing setup arrays without changing their generated definitions.
- [ ] Re-run the focused test and `tests/review-schema.test.mjs`.

### Task 2: Build migration core with read-only preflight

**Files:**
- Create: `scripts/migrate-au-email-schema.mjs`
- Test: `tests/au-email-schema-migration.test.mjs`

**Interfaces:**
- Produces `buildAuEmailSchemaTargets(env)`, `preflightAuEmailSchemaMigration(adapter, env)`, and `runAuEmailSchemaMigration({ adapter, env, mode, confirmation })`.
- Adapter methods are limited to resource metadata reads and the allowlisted create operations.

- [ ] Write failing fake-adapter tests for all-missing dry-run, matching resources, exact schema definitions, and no document/delete/update calls.
- [ ] Run the focused test and observe missing exports/behavior.
- [ ] Implement target construction from the shared contract and `REVIEW_COLLECTIONS`; compare attributes, indexes, and exact private table permissions.
- [ ] Return a non-mutating summary with CREATE, EXISTS_MATCH, DRIFT, and `safeToApply` states.
- [ ] Re-run focused tests.

### Task 3: Add guarded additive apply and availability waits

**Files:**
- Modify: `scripts/migrate-au-email-schema.mjs`
- Test: `tests/au-email-schema-migration.test.mjs`

**Interfaces:**
- `runAuEmailSchemaMigration` requires `mode: 'apply'` and `confirmation: 'AU'` after a clean preflight.
- Creates only customerEmail, four review-token attributes, two private tables with source-defined attributes/indexes, and three composites in dependency order.

- [ ] Write failing tests for missing guard, wrong target, drift-before-write, partial resume, idempotent second run, asynchronous available/failed/timeout states.
- [ ] Run focused tests and observe expected failures.
- [ ] Implement guarded apply, bounded wait, exact creation dispatch, and immutable partial-failure behavior.
- [ ] Re-run focused tests and schema regression tests.

### Task 4: Add CLI, script entry, and rollout documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-27-au-email-production-rollout.md`
- Modify: `scripts/migrate-au-email-schema.mjs`
- Test: `tests/au-email-schema-migration.test.mjs`

**Interfaces:**
- `npm run migrate:au-email-schema` is dry-run.
- `npm run migrate:au-email-schema -- --apply --market=AU` is the only apply invocation.

- [ ] Write failing CLI tests for zero-write default/offline mode and apply guard behavior.
- [ ] Run focused tests and observe expected failures.
- [ ] Add masked CLI reporting and lazy real adapter construction only after apply validation; add the package script and explicit rollout warning.
- [ ] Re-run focused tests and the dry-run command.

### Task 5: Full verification and local commit

**Files:**
- Verify only all Task 1–4 files.

- [ ] Run `git diff --check`.
- [ ] Run targeted migration, review-schema, and booking-reminder schema tests.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and default migration dry-run.
- [ ] Inspect staged diff and commit only after every command exits successfully.

## Self-review

- The only creation paths are allowlisted attributes/tables/indexes; no update/delete/document method is part of the adapter contract.
- Apply preflights all targets before the first write; subsequent partial runs remain additive and resumable.
- Existing table permission mismatch is drift, never an update.
- `setup-appwrite.mjs` retains the same schema arrays through shared values and remains outside this migration’s execution path.
