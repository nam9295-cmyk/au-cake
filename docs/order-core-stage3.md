# Stage 3 — current Cake order core

Base: `75a265d` (Stage 2). Worktree: `/home/john/workspace/au-cake/.worktrees/order-core-refactor`; branch: `refactor/order-core`.

## Module boundaries

- `reservation-input-policy.js`: the existing server-only text/contact/date and coupon-code input primitives. Class and Cake retain the same shared primitives; no new browser sharing.
- `cake-order-catalog.js`: current request catalog, option prices, promotion constants and catalog completeness invariant.
- `cake-order-input.js`: request validation, line normalization, pickup validation, canonical payload/line identity. Current `compat` request sizes and aliases remain supported. Unreachable stored-only switches were removed; this does not change which new requests are accepted.
- `cake-order-pricing.js`: unit prices, surcharges, promo/review eligibility, existing S’more 10%/20% bulk calculation, discount allocation and individual packaging, preserving integer cents and rounding order.
- `cake-order-data.js`: pure `buildCakeOrderData`, promo note and `orderLinesJson` serialization. Time and reservation identity are caller inputs.
- `business.js`: existing export facade, default time/random reservation-number wrapper, class rules, review-coupon record validation/hash wrapper, lookup/response facades. No new Cake price arithmetic or payload assembly remains here.

`main.js` is unchanged: createCake still calls the existing business entry point, which delegates to the new pure core. Request idempotency, coupon transactions, commit reconciliation, permissions and error mapping remain at their existing boundary.

Dependency direction: data → input + pricing; pricing → current catalog + canonical line identity + server input primitives. No new-order module imports business, main, stored-order-reader or stored-order-policy. Stored readers and policies are unchanged and do not import the new pricing. The shared error class retains its identity.

## Incremental commits and checks

Each responsibility was verified before committing and proceeding. Targeted command covered reservation-api, review-coupon, email-cutover, rollback compatibility, Stage 0 golden and the four actual extracted artifacts; lint also passed each time.

| Commit | Responsibility | Targeted result |
| --- | --- | --- |
| `05027f2` | Server input primitives; artifact creation/canonical/fingerprint assertions | 159/159 |
| `1ba8005` | Current catalog constants | 159/159 |
| `b7d95c5` | Line normalization and canonical requests | 159/159 |
| `538abdd` | Current cents pricing | 159/159 |
| `0005970` | Creation input validation | 159/159 |
| `0b52ac9` | Pure storage payload generation | 159/159 |
| `acd9000` | Remove unreachable stored-only branches; add core boundary tests | 163/163 |
| `e02d530` | Catalog invariant ownership and import formatting | 163/163 |

The first input extraction run caught a missing import for the top-level catalog invariant. The import was restored and the unchanged tests rerun before that commit. The new dependency-boundary test was confirmed failing before removal of unreachable stored-only branches, then passed without weakening assertions.

## Final verification

- Stage 0 golden: 17/17, fixture file unchanged from `b06a3dd`.
- Targeted/core/golden/artifact suite: 163/163.
- Full `npm test`: 1,210 passed, 0 failed, 0 skipped (includes the new four core boundary tests).
- `VITE_MARKET=AU npm run build`, `VITE_MARKET=KR npm run build`, `npm run lint`: passed. Existing >500 kB chunk warning remains.
- Dedicated final golden/artifact/deploy-packaging suite: 40/40.
- Additional offline differential against Stage 2: 1,968 input variations across catalog modes, sizes, finish/count fields, cream aliases, quantities, chocolate extras, packaging and promo codes. Creation values/errors, canonical object and JSON bytes, request fingerprints, public export names and constants were identical.
- Read-only independent review: no critical/important issues; independent core + golden run 21/21. Minor orphaned comment and EOF whitespace findings were corrected.

Actual `reservation-api` compatibility/full, notification and reminder archives are extracted into temporary directories. Their entry points and complete relative-source dependency graphs are checked inside the extracted root, then a fresh subprocess compares new-order, canonical JSON, fingerprint, stored-reader and response golden results. Only installed third-party dependencies are supplied via node_modules; application source must come from the archive. Both notification/reminder manifests explicitly include all five new transitive modules. This is offline artifact validation, not an operational deployment.

Reproduce the targeted suite:

```sh
node --test tests/cake-order-core.test.mjs tests/order-core-golden.test.mjs tests/order-contract-artifacts.test.mjs tests/reservation-api.test.mjs tests/reservation-review-coupon.test.mjs tests/reservation-api-customer-email-cutover.test.mjs tests/reservation-api-rollback-compatibility.test.mjs
```

The full suite and builds were run after all functional moves. The final documentation/comment/EOF-only cleanup was followed by the targeted suite and lint again. `git diff --check 75a265d` and unchanged-file checks cover the complete Stage 3 diff, not only pending edits.

No policy, API action/field/error, fingerprint rule, stored format/version, existing data, schema, secret, production environment, transaction flow or deployment was changed. No Custom Cake, S’more 30%, bulk-discount removal, P2 stored-format repair or main merge was performed. Main remains `6d8288701d7539dfc8760b2806a0b5ca368bfc6e`.
