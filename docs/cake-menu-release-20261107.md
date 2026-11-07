# AU cake menu release — 2026-11-07

The user explicitly authorized production deployment after reviewing the local custom cake/private class and whole-cake changes. This supersedes the original local-only release boundary. The implementation record remains in [cake-mini-strawberry-implementation-20261107.md](cake-mini-strawberry-implementation-20261107.md); the supplied root `plan.md` remains unchanged.

## Preflight

- Fetched `origin/main` at `1d888a47bd596a1c202503c6319cd0ba4cdd36a6`; feature implementation through `bea0365ee1dbc5bc0b3c054ec4fe471283ab8cb7` is a fast-forward. The other active worktrees are preserved.
- `docs/journal-pending-release.md` records no pending releases or current deployment hold. Preserve all ten published articles. Cloudflare `au-cake-next` is the existing enabled production Git integration; the older `au-cake` project's production integration remains disabled. No integration/environment flags are changed.
- Fresh full `npm test` on Node 24: exit 0, 2,413 passed, 0 failed, 1 market-specific skip, across 80 test summaries (including repeated invocations). The skipped KR static account check passed separately against the KR build. `npm run lint`, `git diff --check`, and comparison of `plan.md` against the supplied Downloads file passed.
- Explicit Node 22.16.0 server checks: 22 passed across v3 pricing, historical v1/v2/Milk/retry, API and summary tests. The full test harness uses Node 24; attempting it under `npx -p node` encountered TypeScript stripping/nested-npx harness incompatibilities, so it is not claimed as a full Node 22 suite.
- Sequential Node 22.16.0 builds passed: KR emits 30 SEO pages, 12 sitemap URLs and no AU Journal articles; account-enabled AU emits 48 SEO pages, 26 sitemap URLs and all ten Journal articles. AU/KR static account artifact checks each passed. Existing large-chunk warnings remain. The final local `dist` is AU.
- The full suite exposed a stale source-string assertion requiring the old homepage URL. Homepage rendered-output tests already require tier-specific links and both categories. Removed the obsolete assertion and updated the existing manual browser order check to collection → custom menus → craft → reviews. No product behavior changed during release preparation.

## Function packages

Packages are produced by the repository's canonical archive builders. Function configuration and all existing variable values/secret classifications are fingerprinted and checked before upload/activation. Only deployment creation and activation are used; no schema, permissions, Auth/SMTP, schedule, environment or account flag mutation is included.

| Function | Previous active deployment | New active deployment | Runtime smoke |
|---|---|---|---|
| reservation-api | `6aec83734afcdcd31894` | `6aeeeb2c1cfd4657d083` | Linux Node 22.23.4; entry import, all 20 literal prices, new Milk rejection, historical Milk preservation, sharp PNG generation |
| reservation-notification | `6aec83720254dfeac718` | `6aeeeacc574a7bac74d9` | Linux Node 22.23.4; entry import, mini combo price and Milk rejection |
| booking-reminder | `6aec83726dc311ec5d69` | `6aeeeade00bdf8dc3094` | Linux Node 16.20.2; entry import, mini combo price and Milk rejection |

The API smoke is an additional archive-only build script, never a request handler. Its first inactive build (`6aeeeafa896cb61bd3ac`) exceeded Appwrite's 1,024-character command limit and failed before activation. Moving the same checks into an archive file produced the ready deployment above. Notification/reminder smoke commands fit the limit. Existing runtime choices are retained, including the reminder's Node 16 runtime. Existing variable counts are API 39, notification 27, reminder 9.

Activation order is notification → reminder → API, followed immediately by the normal fast-forward main push for the AU Pages build. API read-only `health` and `renewal-health` must pass. Historical orders remain readable on the v3 server. After accepting v3 orders, do not restore the old v2-only server or consumers; recovery must retain the v3-capable readers.

## Production result

Released successfully through the existing integration:

- Product release commit: `6131105e870297cca63ee48be3e8c6e03a1e8862`, pushed to `main` by ordinary fast-forward from `1d888a4`. No force push, deletion or checkout change in another worktree.
- Cloudflare production deployment: `481a46c0-c46b-4798-a8ed-a9285e71a288`, deploy stage **success**, completed `2026-11-07T09:14:31.134268Z` (18:14 KST). Immutable preview: <https://481a46c0.au-cake-next.pages.dev>. Production: <https://au.verygood-chocolate.com>.
- All three Function deployments in the table are active. Public API `health` returned HTTP 200 / `ready`; `renewal-health` returned HTTP 200, `au-renewal.2026-11.v3`, writes/preorders enabled, unchanged pickup policy and Mochi prices.
- Post-activation function configuration and all 39/27/9 variables matched their pre-release fingerprints. Project Auth/SMTP/service settings and Cloudflare source/build/deployment/environment/domain configuration also matched. Existing account flags remain enabled; the older Pages project remains disabled.
- Live homepage, hub, Pavé, Basque, account, sitemap and latest Journal article return HTTP 200 with appropriate HTML/XML MIME types. Account HTML retains `noindex`; sitemap retains ten Journal article URLs. Stage and immutable deployment hub URLs also return 200.
- Public structured offers match every approved whole-cake price: eight Pavé combinations and twelve Basque whole-cake combinations, plus the two unchanged Basque loaf offers, all AUD.
- Actual browser checks: homepage order is collection → custom menus → craft → reviews, with two categories and tier-specific links. Desktop two-tier and 390px single-tier class clicks land at the selected enquiry around 100px below the viewport top and focus its heading on the first click. The 2-tier custom link selects Double Tier / 4+6 inch; the expired public campaign is absent. No horizontal overflow in checked flows.
- Live option totals: Pavé mini strawberries AUD 55 / 6-inch strawberries AUD 93, no Milk button; Basque mini cream+strawberries AUD 64 / 8-inch cream+strawberries AUD 157. Option inspection did not add to or edit the existing member cart and did not submit a reservation.

The original local-only implementation report describes the pre-release stage; this record is the subsequent authorized production result. This evidence-only update uses `[skip ci]` so it does not rebuild the already verified product deployment.

No agent-created production order, payment, coupon redemption, customer-account session or email send is part of validation. Actual customer checkout submission and delivery remain external acceptance checks; class fees/schedules and mini servings/weight remain intentionally unspecified.
