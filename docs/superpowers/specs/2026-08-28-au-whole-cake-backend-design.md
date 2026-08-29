# AU Whole Cake Backend Design

## Goal

Add the four current AU Whole Cake contracts without changing Appwrite schema, historical reservations, secondary product ordering, or the customer-email delivery system.

## Current production data flow traced in this worktree

`src/lib/cart.ts` holds the selected lines. `src/lib/review-coupon-client.ts` allowlists each request through `buildCakeOrderRequest` or `buildCakeReservationRequest`, and `src/lib/repository.ts` sends it to the Reservation API with `createCakeOrder` / `create-cake`.

Reservation API `src/main.js` passes the request to `canonicalCakeRequestPayload` and `buildCakeReservation` in `src/business.js`. That normalizes product fields, derives authoritative cents, writes the top-line projection plus versioned `orderLinesJson` to the existing reservations collection, and uses the same canonical input for idempotency. Lookup, admin hydration, CSV, and calendar consume those stored documents through `publicCakeReservation`, `toReservation`, `parseStoredOrderLines`, and `listCalendarEvents`; they keep the stored price rather than repricing history.

The reservation-notification function parses the authoritative stored lines before building the operator receipt, customer booking receipt, and administrator-triggered final confirmation. The booking-reminder function parses the same stored lines to build its D-1 customer reminder. Both retain the existing delivery ledger, recipient validation, retry handling, and Sydney schedule.

## Contract partitions

`CURRENT_ACTIVE_CAKE_ORDER_PRODUCT_IDS` contains the four current Whole Cakes plus the unchanged current secondary products. `COMPAT_CAKE_ORDER_PRODUCT_IDS` adds only `vanilla-fresh-cream-cake` for legacy production submissions. `STORED_CAKE_ORDER_PRODUCT_IDS` adds the existing historical Basque IDs. The old Vanilla ID is never renamed.

`CAKE_CATALOG_MODE` is a server-only Reservation API variable. It resolves only the exact value `compat` to compatibility mode. Omitted, empty, malformed, and `required` values resolve to `required`. In `required`, only legacy Whole Cake submissions are rejected; cupcake, lemon, Signature Gateau, and Brownie Cheesecake submission behavior remains unchanged.

## Pricing and historical reads

Whole Cake price tables are keyed separately by current inch sizes and legacy centimetre sizes. New Pave, Buttercream, and Strawberry orders use `6in`, `8in`, or `10in`; compat-mode legacy Pave, Buttercream, and Vanilla orders use `15cm`, `19cm`, or `22cm` and their existing production prices. Stored-order validation accepts the price assigned to its stored size plus the already-approved older unit-price exceptions. It never recalculates historical centimetre orders from the new inch table.

## Input, storage, and rendering

Strawberry lines accept the existing generic payload shape only for known order-line keys. Their meaningful choices are `productId`, `cakeSize`, and `quantity`; known legacy option fields are normalized to non-price-affecting values and neither unlock a product option nor affect email rendering. Unknown fields and price/totals/serving claims remain rejected by multi-line validation or ignored only by the existing single-line legacy contract; neither affects server price.

Existing `productId` and `cakeSize` Appwrite string attributes store the new values, so no schema resource is added. Notification, confirmation, and reminder renderers gain the two customer-facing Strawberry names and `6\"`, `8\"`, `10\"` labels while retaining historical Vanilla and centimetre labels.

## Rollout

An Appwrite Function variable is applied with a Reservation API deployment; changing it through the current deploy script also creates a new deployment. The intended later rollout is: deploy backend with `CAKE_CATALOG_MODE=compat`, deploy the frontend, complete smoke tests, then redeploy Reservation API with `CAKE_CATALOG_MODE=required`. No deployment occurs in this branch.
