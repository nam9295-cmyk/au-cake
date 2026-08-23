# AU product copy and packaging implementation plan

1. Establish the isolated worktree, install dependencies, and run the baseline suite.
2. Add failing copy, Buttercream colour-label, and two-decimal AU currency tests; confirm RED; update only shared content/formatting sources; confirm GREEN.
3. Add failing client order-line, cart, detail, reserve, complete, lookup, admin, calendar, CSV, and notification tests for individual packaging; confirm RED; add the smallest compatible client implementation; confirm GREEN.
4. Add failing Reservation API tests for eligibility, tampering, aggregate piece counts, discount exclusion, 99/100/101 pure boundaries, and 98/100/102 valid orders; confirm RED; implement server-authoritative pricing and strict compatible parsing; confirm GREEN.
5. Write `docs/au-cake-pencil-detail-handoff.md` with the seven-product data, image, option, server-validation, CTA, localization, history, and canonical contracts. Do not modify images or the Pencil layout.
6. Search for forbidden stale copy, one-decimal/whole-dollar AU presentation bypasses, old image-path inconsistencies, and Father's Day changes. Review the complete diff for scope.
7. Run fresh `npm run test:cake`, `npm run test:reservation-api`, `npm run build`, `npm run lint`, `npm test`, and `git diff --check`.
8. Commit and push the feature branch, safely update `main`, run the idempotent `npm run ensure:individual-packaging-schema` migration, deploy Reservation API and Reservation Notification, verify frontend production, run the labelled six-piece smoke order, inspect the stored/lookup/admin/notification result, and cancel it.
