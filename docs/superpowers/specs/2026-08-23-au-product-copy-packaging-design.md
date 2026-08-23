# AU product copy and individual packaging design

## Scope

Update the existing seven-product AU cake catalogue without changing product prices, product IDs, gallery assets, the Pencil.dev detail-page layout, or Father's Day content.

The change has four parts:

1. Replace the approved Vanilla Fresh Cream, Buttercream, and Lemon customer copy in the existing shared content sources.
2. Clarify Buttercream's existing `vanillaCakePointColor` selection as a whole-cake colour while preserving the stored field and enum.
3. Add per-line individual packaging selection for Chocolate Cupcakes and Lemon Cake, with server-authoritative aggregate pricing.
4. Standardize customer-visible AU currency through the existing currency formatter while keeping JSON-LD prices numeric.

## Individual packaging contract

- The order-line source of truth is `individualPackaging: boolean`.
- The selection is accepted only for `cupcake-half-dozen`, `cupcake-dozen`, and the active Lemon Cake pack IDs.
- Physical pieces equal the product pack size multiplied by line quantity.
- Pieces are summed across all eligible selected lines in the reservation.
- 1–99 selected pieces cost 50 cents per piece; 100 or more are free.
- Product discounts are calculated from product subtotals only. Packaging is added after discounts and is never discounted.
- The Reservation API ignores any client-supplied fee and derives `individualPackagingPieces` and `individualPackagingFeeCents` itself.
- Current order lines persist the selection and derived values in `orderLinesJson`. The single-line compatibility projection also stores optional `individualPackagingPieces` and `individualPackagingFeeCents` integer attributes, added by the idempotent `npm run ensure:individual-packaging-schema` migration. Existing documents are not rewritten.
- Historical lines without these keys normalize to `false`, zero pieces, and zero fee.
- Boundary unit tests cover 99/100/101 pieces. Valid product-line integration tests cover reachable totals 98/100/102.

## Compatibility

Current strict order-line parsing gains a new current shape while retaining every historical shape. Existing product IDs, cupcake finish fields, lemon finish fields, legacy cupcake count fields, and historical Basque IDs remain unchanged.

## Presentation

Eligible product detail pages expose one checkbox. Cart, reserve, complete, lookup, admin, calendar, CSV, and notifications show the selection, selected piece count, and fee. Whole cakes never show the option.

All AU customer-visible currency uses two fractional digits via shared formatting. KR display rules and raw numeric/server values remain unchanged.

## Deployment

After fresh full verification, run `npm run ensure:individual-packaging-schema`, deploy Reservation API and Reservation Notification, integrate through `main`, allow the configured frontend production workflow to deploy, then create and cancel one explicitly labelled six-piece production smoke order.
