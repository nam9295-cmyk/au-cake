# AU Chocolate Commerce — verification

Verification: 2026-09-26 UTC / 2026-09-27 KST. Branch: `feat/au-redesign-ui`. Starting HEAD: `977b34d00cfe101f6821f037dbec7f88e304191d`.

## Automated checks

- Full `npm test`: 1,549 passed, zero failed/skipped (58 test-run summaries), including `test:cake`, market boundaries, historical order fixtures, client/server round trips, coupon allocation, operational consumers and extracted function artifacts.
- `npm run lint`, `VITE_MARKET=AU npm run build`, `VITE_MARKET=KR npm run build`, `git diff --check`: passed.
- Builds retain existing chunk-size and ineffective dynamic Appwrite import warnings; no build errors.
- Review-API dependencies were supplied by the previously approved external `/tmp/au-chocolates-review-deps.562KDl/test-dependency-hook.mjs`. No dependency or lock-file changes. `package.json` changes are limited to test commands.
- Logs: `/tmp/chocolate-full-final.log`, `/tmp/chocolate-lint-final.log`, `/tmp/chocolate-build-au-final.log`, `/tmp/chocolate-build-kr-final.log` (local temporary evidence, not deployment artifacts).
- Controller independently reran the complete suite (same 1,549/1,549, exit0), lint, both market builds and diff check after the task reports. Final suite log: `/tmp/au-chocolate-commerce.DNWcR5/final-npm-test.log`.
- Independent task reviews and final whole-checkpoint review approved the implementation with no critical/important findings. Minor follow-ups: existing unknown-percent coupon hint below, and replacing the UI test's restored private React dispatcher with a supported harness when test infrastructure is revisited.

## Browser evidence

Playwright CLI, local AU demo on 5183, KR on 5184 and AU fixture on 5185. Fixture health/settings reads only; other API operations are blocked. No orders, email, SMS or external writes submitted.

- AU Home inline Chocolate filter: desktop1440/mobile390, three products, correct photo/price/detail links, keyboard navigation and cake filters preserved.
- `/chocolates` plus `/chocolates/almond-chocoball`, `/chocolates/pave-chocolate`, `/chocolates/eiffel-tower-chocolate`: desktop1440/mobile390, photos loaded, purchase controls present, no horizontal overflow or fake Cake Size.
- Almond Single qty5 + 6-pack qty2 + Black Tub qty1: three distinct cart lines, AUD205, reload persistence. Single qty5 stays five bags. Other-pack photos explicitly marked as reference photos.
- Legacy server: single chocolate and mixed orders blocked; Cake-only allowed. Supported fixture: mixed cart proceeds to reservation. Demo cannot confirm chocolate orders.
- Six-pack first (AUD60) + Cake (AUD79) + Combo extra (AUD20): subtotal159; manual5% estimate4.95 on eligible99, not7.95 on159. Payable amount stays159 pending server validation.
- KR Home, `/cakes` and existing `/cakes/chocolate-pound-cake-and-cupcakes`: no AU wrapper, footer and announcement visible. Automated KR markup matches the checkpoint exactly.
- Preserved prior hero work: 7-second desktop/mobile video passes six widths (1920,1440,769,768,390,320), pause/resume, pause across resizing, offscreen pause, reduced-motion and failed-video poster fallback.

Screenshots: `/tmp/au-chocolate-commerce.DNWcR5/chocolates-1440-category.png`, `chocolates-390-category.png`, `chocolates-1440/*.png`, `chocolates-390/*.png`, `kr-home.png`, `kr-cakes.png`, `kr-cakes-chocolate-pound-cake-and-cupcakes.png`.

## Boundaries and remaining work

- No Appwrite schema migration, integration merge, push, production deploy, PayPal or Login.
- Offline notification/reminder packaging manifests include the shared product module; no deploy command was executed.
- Existing approved Chocolate photos, Home inline filter and hero-video work are retained in this checkpoint. User Pencil changes are not edited or staged; SHA256 remains `2daf4fcbf2120d228ebd31c7562fb64a8c35ad654e589369a239a3de3680f6b7`.
- Integration and the two protected worktrees retain their starting HEAD/status, including untracked `docs/menu-direction/`.
- Chocolate ordering requires a separately approved backend deployment that reports `chocolateOrderLines: 1`; this local implementation does not establish production availability. Existing chocolate `noindex`/no structured purchasable offer remain pending an explicit indexing decision.
- Existing unrelated coupon hint: manually entered review code with unknown reward percentage can display `estimated null% (-AUD0)`. This unchanged hint is recorded, not fixed as part of chocolate pricing. Known5%/10% eligibility and server validation are covered.
- KR `/cakes/pave-chocolate-cake` remains its pre-existing not-found result (AU catalogue lookup is market gated); no KR routing changes were made. KR legacy-detail smoke uses the existing pound/cupcake route instead.
