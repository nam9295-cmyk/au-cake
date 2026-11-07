# AU cake menu and whole cake options — local implementation

Date: 2026-11-07. Branch: `feat/cake-mini-strawberry-20261107`.
Base: `1d888a47bd596a1c202503c6319cd0ba4cdd36a6` (equal to fetched `origin/main` when work started).
Scope: implement the root `plan.md`, preserved byte-for-byte against the user's Downloads copy. No main merge, push, production deployment, live order, payment or email send.

## Implemented

- Four independent image cards on `/custom-cakes`: single/two-tier custom cakes and single/two-tier private cake classes. Cake links select the correct existing quote form. Private classes show the selected class, enquiry pricing, copyable enquiry text and the existing official Instagram link. No invented fee, eligibility, duration, capacity or schedule; the past Kids Class archive remains separate.
- AU's expired September custom cake campaign field/FAQ removed. The server still rejects the expired campaign using its original receipt/pickup windows. Historical discount calculation and idempotent responses remain available; valid review/manual coupons and unrelated discounts remain intact.
- Current policy `au-renewal.2026-11.v3`; stored JSON format remains version 2. Historical v1/v2 sizes, toppings, Milk choices, confirmed/provisional pricing and Mochi compatibility remain versioned on read and replay.
- New Pavé orders accept dark chocolate only. Missing chocolate choice normalizes to dark; explicit Milk is rejected. Old Milk cart snapshots and event records are retained for explicit reselection/removal, preserving valid companion items. Reorder links keep Milk visible and require the customer to choose Dark before adding a new cake.
- Whole cake detail, sticky total, cart identity/editing, server validation, stored reader, lookup, admin/calendar/CSV/SMS, account detail/reselection, confirmation email and reminder share option names and pricing. A menu-upgrade refresh preserves the form and original request ID in the existing session draft mechanism when storage is available.
- Static HTML, metadata, structured offers and `llms.txt` show the current mini/decoration configurations. Existing class photographs are exposed through two public asset copies for static rendering; source assets are unchanged. No strawberry-finish photo was fabricated.

All amounts below are AUD per cake. Existing 6/8/10-inch base prices are unchanged.

| Size | Pavé basic | Pavé + strawberries | Basque basic | Basque + cream | Basque + cream & strawberries |
|---|---:|---:|---:|---:|---:|
| Mini 4 inch (~10cm) | 45 | 55 | 49 | 54 | 64 |
| 6 inch | 75 | 93 | 82 | 92 | 107 |
| 8 inch | 107 | 137 | 117 | 132 | 157 |
| 10 inch | 159 | 204 | 168 | 188 | 228 |

The combined Basque finish includes the cream charge. Independent cream boxes retain their existing separate-product price/discount. Brownie loaf and cupcake options are unchanged.

## Local verification

- `npm run test:renewal`: passed, including the 20 literal price combinations, invalid options, v1/v2 history/retry, UI/cart/account reselection, static offers and refresh draft cases.
- `npm run test:custom-cake-integration`: 21 integration + 21 UI tests passed.
- `npm run test:customer-account`: 422 passed; normal review/manual coupon and owner/idempotency cases remain covered.
- `npm run test:class`: 37 passed. `npm run test:cloudflare-pages`: 2 passed.
- KR/Home/Phase 1 market checkpoint: 21 passed; default KR rendered output is unchanged. Tier URL handling is scoped to AU.
- `npm run lint`: passed. `git diff --check`: passed.
- Notification and reminder staging archives match the final canonical core, reader and SEO modules byte-for-byte. Local archive/transitive dependency tests passed.
- Final `npm test`: exit 0 across 59 script invocations; summed test executions: 2,409 passed, 0 failed, 1 environment-specific skip (KR production static access during the AU build). Counts include checks invoked by multiple scripts.
- `VITE_MARKET=KR npm run build`: passed; KR emits 30 SEO pages and no AU Journal articles.
- `VITE_MARKET=AU VITE_CUSTOMER_ACCOUNT_ENABLED=true npm run build`: passed; AU emits 48 SEO pages and preserves the 10 approved Journal articles.
- The environment-specific KR static access check was also run separately against the KR build. The final local `dist` is the account-enabled AU build.

A separate read-only branch review found two Important editing defects: initialization before account restoration could lose attached extras, and a successful edit retained a consumed URL ID. Both were reproduced by failing tests and fixed. Editing now mounts after cart readiness and returns to the cart after a successful update. Two additional compatibility findings were also fixed: historical Milk notices follow deletion/completion events, and account reselection links are limited to the four cake configurations the UI fully restores. Final UI regressions: 10 passed; no deferred review findings.

Implementation decisions: helpers remain in the existing pricing module so current runtime dependency lists suffice; historical cart removals and unsupported reselect links were treated as compatibility requirements because they could mislead returning customers or change requested configuration.

Browser checks use a loopback AU Vite server without production API configuration. At 390, 768 and 1440px: menu layout and cake selectors have no horizontal overflow. Verified tier deep links, refresh, language switch, private class enquiry, topping/size changes, quantity, cart editing, Milk notice/reselection, explicit Dark confirmation, browser Back and notice dismissal after reload. Browser examples: Pavé 6-inch strawberries ×2 = AUD 186.00; Basque 8-inch cream+strawberries ×2 = AUD 314.00; editing that Basque to 6-inch retains the finish and yields AUD 214.00.

## Preview and future release

From this worktree:

```sh
VITE_MARKET=AU npm run dev -- --host 127.0.0.1 --port 4198 --strictPort
```

Open `/custom-cakes`, `/cakes/custom-cake?tier=double`, `/custom-cakes?service=private-class&tier=double#private-class-enquiry`, `/cakes/pave-chocolate-cake`, `/cakes/brownie-cheesecake`, and `/cart`. The existing local preview server runs on port 4198; use it directly if that port is occupied. The loopback preview allows pickup inspection and prevents reservation submission without an API configuration. Use `VITE_CUSTOMER_ACCOUNT_ENABLED=true` if inspecting the account-enabled frontend; real account login requires a configured environment.

Local feature commits before the final review/verification follow-up:

- `ec3e638`: tier-specific cake/private class menus; preserves the supplied plan.
- `3520048`: retires the public AU campaign entry.
- `644b51b`: versions mini/topping prices and historical compatibility.
- `fe48df8`: carries options through cart, consumers and SEO.

A separately authorized release will require the matching reservation-api, reservation-notification and booking-reminder packages and the AU frontend. The existing runtime builders stage the canonical parsers and their dependencies; no new schema, environment setting or hosting flag is required by this implementation. Deployment order/cutover should retain the existing version capability gate. No deployment was performed.

Unverified externally: deployed Appwrite runtime and identity sessions, real coupon redemption/email delivery/payment, provider configuration and a live Cloudflare deployment. These were exercised with local adapters/fixtures and staging archives only. New mini physical height, weight, servings, strawberry photographs and private class operating details remain unconfirmed and are not promised in the UI. Local Node is 24; Appwrite package engine targets Node 22, so the exact deployed Node 22 runtime was not exercised here. Build retains existing large-chunk warnings.
