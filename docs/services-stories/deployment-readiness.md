# AU services / Customer Stories deployment readiness

Read-only check: 2026-10-11. This is a prepared rollout plan, not deployment authorization.

## Confirmed current production

- Fresh origin/main: `a20fe810307e1e8468a7d1ed88d0f2a1c33e8892`.
- Cloudflare Pages project: `au-cake`; Git repository: `nam9295-cmyk/au-cake`.
- Production branch: `main`; automatic deployments: **Enabled**.
- Build command: `npm run build`; output directory: `dist`; root directory is blank (repository root); build system version 3.
- Public market setting shown in Pages: `VITE_MARKET=AU`. No credential values are recorded here.
- Current successful production deployment: `b08278ae-5326-4a53-9ea8-1da56462373e`, source commit `a20fe810307e1e8468a7d1ed88d0f2a1c33e8892`.
- Successful deployment log timestamp: `2026-10-07T08:21:00.863244Z`; duration 52 seconds; URL `https://b08278ae.au-cake.pages.dev`; production domain `https://au.verygood-chocolate.com`.
- Read-only production HTTP checks: Home, `/cakes/custom-cake`, `/reviews` return 200. `/business/events` and `/customer-stories/korea` return 404 as expected before this unpublished release. HTTP 200 for `/reviews` does not prove live review API retrieval.

The production deployment details and Pages Settings were inspected in the logged-in dashboard. No Edit/Save/Deploy/Rollback action was taken. There is no need for a Cloudflare API token, Wrangler or Direct Upload.

## Publication blockers — approval pending

1. John must finally approve the implemented neutral descriptions on all three service pages and the replacements recorded in `CONTENT_APPROVAL_REQUIRED.md`. Unconfirmed numerical service promises remain excluded.
2. John must finally approve enquiry CTAs opening `https://www.instagram.com/verygood_syd/` rather than a new email/form/booking flow.
3. John should review the local visual result. Logging in to Cloudflare and confirming Git automatic deployment does **not** grant content approval or permission to push.

Customer-photo reuse and preserving the five customer quotations mentioning Daegu were separately approved already. They do not imply approval of the service claims or contact destination.

## Ready locally

- Readability fix: badges 11px, rating/language notes 12px, compact body 14px, archive disclosure/filter explanations 14px.
- Browser 360/390px, both languages: two-card scroll-snap windows, complete review dialog, no page overflow; screenshots actually inspected.
- Service/stories browser suite: 1440/834/390/360, filters/search/Load More, photo modal/keyboard/ESC.
- Custom Cake body DOM/control geometry unchanged versus exported production main at 1440/390. Its earlier approved shared-header navigation/language additions remain intentional.
- Full npm test, lint, AU/KR builds, AU/KR static direct-access tests, data/route/language tests and diff check pass. Existing build warnings remain.
- Review JSON, featured review data, originals, Custom Cake source, backend, pricing, contracts and package files were not modified by this readability correction.

## Rollout after explicit approval — not executed

1. Fetch origin again, record the exact approved release SHA and confirm remote main is still the expected ancestor. Stop on unexpected main changes; inspect the entire release range rather than publishing only the final CSS commit.
2. Confirm the main checkout is clean, then integrate the reviewed branch using fast-forward only. No force push and no changes in protected worktrees.
3. Push main normally. Let the existing Cloudflare Pages Git integration build and deploy; verify the production deployment's source SHA and success status, not just an old green deployment.
4. Before any customer interaction, request each new extensionless URL directly and require HTTP 200: `/business/events`, `/business/cafe-supply`, `/business/consulting`, `/customer-stories/korea`.
5. Smoke Desktop 1440 and Mobile 360/390: Home stories / 1+2→2+3 / full review, archive filters/search/Load More/photos/ESC, service enquiries, language state, existing `/reviews` live retrieval, Cakes/detail/Cart and Custom Cake UI. Do not submit live orders/quotes without separate authorization.
6. Confirm KR public behavior is unchanged. No Function deployment, Appwrite/schema change or server checkout operation is required.

## Rollback

Known-good frontend target is the current production `a20fe810307e1e8468a7d1ed88d0f2a1c33e8892` / Pages deployment `b08278ae-5326-4a53-9ea8-1da56462373e`.

Primary workflow after an approved release: revert the exact published services/stories release commits on main, inspect the resulting tree/diff, commit the revert and push main normally. Cloudflare then automatically deploys the rollback commit. Record the actual published SHA/range before rollout; do not reset or force-push main, and do not revert unrelated later commits. Existing backend deployments are not rolled back.

Cloudflare also supports selecting a previous successful **production** deployment via Deployments → More actions → Rollback to this deployment; preview deployments are not eligible. This is an emergency alternative requiring explicit approval, not an action performed here. A dashboard rollback does not replace Git reconciliation.

References: [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [production branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
