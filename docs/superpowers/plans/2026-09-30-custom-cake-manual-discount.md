# Custom Cake Manual Discount Implementation Plan

Goal: Add percentage and fixed AUD discounts to versioned Custom Cake quotes without changing historical prices or ordinary orders.
Spec: User-approved final design in this session (2026-09-30).
Architecture: An optional version-1 manualDiscount quote extension replaces automatic discounts using immutable receipt base and paid-line subtotals. Percentage value is integer basis points; fixed value is integer cents. Zero normalizes to automatic. Readers accept only exact legacy or exact extended shapes.
Constraints: No schema migration, confirmed requotes, production writes, deployment, push or merge. Preserve original quotes, paid lines and acceptance history. Separate calendar commit.

- [x] Write and run failing amount, workflow, persistence, reader, notification and UI regression tests.
- [x] Implement deterministic integer calculation and strict selectors; recompute basis/discount on server.
- [x] Extend snapshot validation, quote history, customer reader, administrator list and packaged notification reader; preserve omitted-selector discounts for legacy edit requests.
- [x] Add administrator automatic/percentage/fixed controls, reason, preview and matching customer/email breakdown.
- [x] Validate relevant suites, packaging and types; checkpoint commit `Custom Cake manual discount`.

Review focus: forged extension fields; stale acceptance after changing discount; null extras with manual mode; automatic discounts restored by explicit clear only; immutable historical receipt amounts.
Rollout: deploy compatible readers first with writes disabled, frontend next, manual writes last. Rollback to a compatible reader release, never delete quote or outbox history.
