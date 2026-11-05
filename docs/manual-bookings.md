# Administrator-only manual bookings

`appwrite-functions/reservation-api/src/manual-order.js` is the canonical pure storage builder/reader. It has no SDK or network access. No public create action or public catalog product is added. Existing v1/v2 order contracts and their pricing validation are unchanged.

## Contract and builder

```js
buildManualOrderData({
  version: 'manual-order.v1',
  source: 'admin',
  currency: 'AUD',
  reason: 'owner-approved-off-menu',
  audit: {
    operatorId: 'synthetic-admin', // actual opaque operator ID, never customer PII
    reference: 'synthetic-approval', // opaque approval reference, not free text
    createdAt: '2099-07-01T00:00:00.000Z', // actual UTC audit instant
  },
  lines: [
    { item: 'gateau-cupcake-basic', quantity: 5 },
    { item: 'smore-stick', quantity: 5 },
  ],
  totalPriceCents: 5000,
})
```

Exact keys only. Item vocabulary is deliberately limited to these two physical products (not catalog packs). One or two unique lines, 1–1000 physical pieces each; total 1–100,000,000 safe integer cents. AUD only, fixed **aggregate** total, no invented line prices. Audit IDs are 1–64 alphanumeric/underscore/hyphen characters starting alphanumeric; timestamp is canonical UTC ISO milliseconds. No contact fields or free-text labels inside the JSON. No coupon, packaging surcharge, review reward, customer-account ownership, or automatic outbound email/SMS.

Returns existing storage columns: `orderLinesJson`, internal `productId: 'manual-order'`, inert legacy option defaults, aggregate physical `quantity`/`orderItemCount`, `orderLineCount`, cent amounts and zero discount/packaging fields. Legacy integer `totalPrice` is rounded; cents remain authoritative. The sentinel is never added to a public catalog. Browser projections have explicit `manualOrder` metadata and display-only manual lines with no prices.

## Operational write recipe (not executed by this change)

1. Deploy and verify readers and suppressors **before creating a row**: `reservation-api`, `reservation-notification`, `booking-reminder`, **`review-api`**, and AU frontend. Preserve active runtime/environment/permission settings; this document does not authorize config changes or execute deployment scripts. Review API is included because completion must not make manual bookings eligible for a reward invite.
2. Verify existing `orderLinesJson` and projection column types/availability, private collection permissions and disabled public writes. No migration is required when these existing columns are available. Do not change schema or permissions to make this work.
3. In a separately approved authenticated server-SDK script, check exact normalized customer phone + local Sydney date/time for duplicates, and check agreed availability. Use the customer's real supplied contact only in the reservation's private contact columns. Do not invent an email; omit `customerEmail` if absent. Do not set `customerUserId`.
4. Build immutable monetary fields with `buildManualOrderData(payload)`. Add real unique `reservationNumber`, deterministic or uniquely reserved document ID, `customerName`, normalized `customerPhone`, `pickupDate` (`YYYY-MM-DD`), `pickupTime` (`HH:mm`, Sydney local), explicit `status`, `paymentStatus`, `requestNote`, `adminMemo`, `createdAt`, and `updatedAt`. Booking confirmation does **not** mean payment received. `예약확정` with `입금대기` is available for an approved unpaid booking.
5. Call `readManualOrder(data)` before a write. Do not overwrite any builder output or transform physical quantities into packs. Use explicitly private document permissions (e.g. `permissions: []` where the existing collection grants the intended administrators access); never grant guest/customer read/update.
6. Recheck duplicates immediately before `databases.createDocument({ databaseId, collectionId, documentId, data, permissions })`. Create only the separately approved rows. No public create request, no coupon redemption, no synthetic production smoke bookings.
7. Read the exact saved document back, run `readManualOrder(saved)`, compare all immutable projections, and verify exactly one matching customer/date/time row. Verify admin list/drawer, private calendar and the absence of delivery/reward side effects. Redact contact from logs/reports.

Expected private-calendar label for the example:

`Gâteau Cupcakes · Basic ×5 + S’more Sticks ×5 · AUD 50.00`

Public lookup, create replay and customer-account readers explicitly reject manual records rather than returning a catalog-shaped success. Manual emails (including confirmation/retry/status actions) are disabled; scheduled reminders skip before recipient/delivery handling. Malformed manual rows cannot fall back to catalog labels. Administrator updates allow only pickup date/time, booking/payment status, and memo; changed pricing/line/coupon metadata is rejected before the repository SDK write.

## Verification

```sh
node --test tests/manual-order.test.mjs tests/manual-order-archives.test.mjs
VITE_MARKET=AU node tests/run-custom-cake-ui.mjs tests/manual-order-consumers.test.tsx
# Repository SDK integration also lives in admin-reservation-appwrite-update.test.ts
npm run test:admin-reservation
npm run lint
VITE_MARKET=AU npm run build
```

Archive tests extract the actual tarballs, compare canonical manual source, recursively verify local imports cannot escape the archive, then import each entrypoint using already installed local dependencies (no install/network). Notification/reminder parser lists also include renewal catalog/SEO/pickup transitive files, previously missing from their explicit manifests. Source-tree shared files are forwarding shims; archive builders replace them with canonical implementations.
