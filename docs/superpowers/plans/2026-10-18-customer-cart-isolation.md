# Customer cart isolation implementation

User supplied and approved the scope and requested direct local implementation without further questions. Mac Codex executes inline in feat/customer-account only. B5 remains DEFERRED — RELEASE BLOCKER; historical AU raw fingerprint remains UNVERIFIED.

- [x] Test and implement UID-scoped Guest/verified-member cart persistence. Keep the original shared keys exclusively as Guest base data. Use append-only, uniquely keyed cart mutations to prevent cross-tab read/modify/write overwrites without introducing a DB or changing product/price rules. Reuse existing cart normalizers and mutations. Retain retired mochi data.
- [x] Place CustomerAccountProvider outside CartProvider; synchronously hide/lock member data during auth checks, fence stale callbacks and auth notices across tabs. Add explicit Guest import only; preserve each source cart.
- [x] Scope Checkout signatures/drafts to the cart owner, preserve Guest OAuth form/contact/requestId without silently importing products, reject another member's draft. Keep callback routing independent of Function readiness.
- [x] Test real provider G/add/logout/H/add/logout/G, Guest refresh/migration, concurrent tab mutations, auth errors/races, explicit import, OAuth draft and callback behavior. Run full npm test, TypeScript, ESLint and AU build. Review diff and commit verified feature changes.
- [x] Reuse current test-site status/evidence. Current OPEN14 is active, CLOSED15 is reserved; there is no approved new OPEN deployment. Do not spend the recovery slot on a new build. Report local completion and stop without a deployment if that budget remains unchanged. No Account/Function/production/schema/payment/email changes.

Validation: [local results](../../customer-cart-isolation-validation.md). Full suite 2,128 PASS / 0 FAIL / existing SKIP1; TypeScript, full ESLint and AU build PASS. The feature is locally complete; deployment is NOT RUN because no new OPEN slot is approved.
