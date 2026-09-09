# Order core refactor: Stage 0

Source: `6d8288701d7539dfc8760b2806a0b5ca368bfc6e` (remote main checked 2026-09-09).
Branch: `refactor/order-core`; worktree: `/home/john/workspace/au-cake/.worktrees/order-core-refactor`.

## Constraints

No application behavior, policy, API fields/actions/errors, persistence, fingerprint rules, authorization, secrets, schema, idempotency or coupon transactions change. Custom Cake, S’more 30%, bulk removal and P2 corruption fixes are separate work. Sharing is optional and requires proven identical semantics/runtime and lower coupling. No main merge or deployment.

## Baseline

- Node v24.14.0; root and review-api dependencies linked from existing installation; no production environment files copied.
- Existing complete npm test: 1,181 passed, zero failed/skipped (sum of suite summaries).
- lint: passed.
- AU and KR builds: passed; existing >500 kB chunk warning remains.
- First full run stopped on missing worktree `libheif-js`. Linked existing review-api node_modules; complete rerun passed without code/test relaxation.
- Golden test: 17 synthetic cases, fixed time/number/key. Includes legacy request, S’more thresholds, active static coupon, review 5%/10% mixed order allocation, merged duplicate lines, invalid quantity, absent/null/malformed/version-mismatched JSON, historical pre-finish stored price.
- Fixed outputs include the entire built document (cents and raw orderLinesJson), parsed stored lines, canonical object and exact JSON string, HMAC fingerprint, create response, customer lookup response, and existing errors.
- No production customer information or keys used. Synthetic fingerprint key is Buffer.alloc(32, 7).

## Reproduction

`node --test tests/order-core-golden.test.mjs` compares current code to committed immutable JSON; it never updates expectations. `npm test` runs it via pretest before existing suites. Do not regenerate the golden file after refactoring. Expected source commit is recorded in the file.

Existing tests remain necessary: goldens supplement rather than replace strict validation, transaction/concurrency, capability, admin/client parser and packaging tests. Captured creation responses represent the response projector, while fingerprint captures the canonical payload and digest used by main; existing API tests cover orchestration.

## Next stages

1. Separate create/lookup/health contracts one responsibility per commit, preserving old exports.
2. Extract stored-order interpretation independently of new input/pricing.
3. Extract new input and pricing in separate validated commits.
4. Only share pure definitions where proven beneficial; otherwise leave separate.
5. Validate all suites/builds and actual extracted deployment archives, including transitive imports without source-repository fallback. Update packaging in the same commit as dependency moves.

After each move run goldens plus related tests, then commit before the next move. Test failures are investigated, never silenced by weaker validation. Stage 0 completion is reported before starting these moves.
