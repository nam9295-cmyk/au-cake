# Stage 4 — optional sharing review

Decision: **no new server/browser sharing**. Stage 3 head: `637e0dc`. No runtime or policy changes.

| Candidate | Observed boundary | Decision |
| --- | --- | --- |
| Coupon code normalization/grammar | Server rejects with ReservationApiError/PROMO_CODE_INVALID; browser returns null and derives UI entry states. Similar literals alone do not justify a new cross-runtime package and build/archive dependency. | Keep separate. |
| Phone normalization | Server accepts unknown values and returns an empty string for non-strings; browser takes strings and selects AU/KR behavior using market config. | Keep separate. |
| Packaging fee calculation | Browser validates safe-integer subtotal and defaults it to zero; server operates after order validation and compares the supplied subtotal directly. For (1, Infinity), browser returns 50 cents while server helper returns 0. | Inputs/behavior are not identical; keep separate, do not change either. |
| S’more bulk calculation | Shared threshold arithmetic is only a fragment: client response interpretation also checks safe integers and throws a response-contract error; current pricing and stored policy have deliberately independent lifecycles. | Keep separate. |
| Health contracts | Server checks private schema/readiness; browser validates exact plain data snapshots, supports legacy/current capability shapes, and returns its existing projection. | Producer and consumer validation remain separate. |
| Order identities, field sets, enums | Current request acceptance, creation response, public lookup and historical stored shapes differ. Shared names are not evidence of identical contracts. | Keep separate. |
| Catalog/price snapshots | Current policy must evolve independently of historical permitted prices/options. Browser snapshot also retains AU/KR presentation/default context. | Keep separate. |

Existing shared `active-cake-products.js` request taxonomy and server-only input primitives are retained; this stage introduces no new sharing and does not redirect stored readers to current taxonomy/pricing. Existing export facades remain compatibility promises, not candidates for removal solely because the implementation moved.

Stage 5 will verify all suites/builds, unchanged goldens and canonical fingerprints, actual extracted archives, public exports/imports, remaining bridges/dead-code candidates and the full diff against main. Main merge and production deployment remain prohibited.
