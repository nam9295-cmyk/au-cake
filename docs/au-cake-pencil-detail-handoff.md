# AU Cake Pencil Detail Page Handoff

This document is the functional contract for applying a future Pencil.dev detail-page design. It does not prescribe a new layout. The implementation must continue to read product copy and options from the existing data modules instead of duplicating them in page components.

## Shared data and flow contract

- Canonical English product data and prices: `src/lib/market.ts`
- Korean names, descriptions, features, and option text: `src/lib/i18n.ts`
- Seven-product catalogue order, slugs, product groups, and representative image lookup: `src/lib/cake-catalog.ts`
- Detail galleries, initial selection, selection normalization, and estimated totals: `src/lib/cake-detail.ts`
- AU public/SEO content: `src/content/au-public-pages.json`, read through `src/lib/public-content.ts`
- Client authoritative price helpers and option enums: `src/lib/constants.ts`
- Server active products and authoritative validation/pricing: `appwrite-functions/reservation-api/src/active-cake-products.js` and `appwrite-functions/reservation-api/src/business.js`
- Detail UI integration point: `src/CakeDetailPage.tsx`; quick view integration point: `src/pages/HomePage.tsx` and `src/ProductQuickViewDialog.tsx`

Every redesign must preserve: Add to order, cart, quantity, computed total, reservation submission, English/Korean copy, canonical product URL, and historical order parsing. The page CTA must keep passing the complete normalized `CakeDetailSelection` into the existing cart/reservation flow.

## Product contracts

| Product | Product ID(s) | Canonical slug | Customer order fields | Server validation |
| --- | --- | --- | --- | --- |
| Pave Chocolate Cake | `pave-cake` | `/cakes/pave-chocolate-cake` | `cakeSize`, dark `chocolateType`, `quantity` | Active ID; size price 79/99/137; dark chocolate only |
| Vanilla Fresh Cream Cake | `vanilla-fresh-cream-cake` | `/cakes/vanilla-fresh-cream-cake` | `cakeSize`, existing `vanillaCakePointColor`, `quantity` | Active ID; size price 69/89/119; unsupported options normalized by the existing contract |
| Buttercream Cake | `buttercream-cake` | `/cakes/buttercream-cake` | `cakeSize`, `vanillaCakePointColor` displayed as Cake colour, `quantity` | Active ID; size price 74/94/128; no flavour or finish surcharge |
| Chocolate Cupcakes | `cupcake-half-dozen`, `cupcake-dozen` | `/cakes/chocolate-cupcakes` | pack Product ID, `cupcakeFinish`, `individualPackaging`, `quantity` | Active IDs; six exact pack/finish prices; packaging eligibility and piece count recalculated server-side |
| Signature Gâteau au Chocolat | `pound-cake` | `/cakes/signature-gateau-au-chocolat` | `poundAddon`, conditional `chocolateType`, `quantity` | Historical ID retained; existing Basic/Extra chocolate/Vanilla cream pricing |
| Lemon Cake | `fresh-lemon-cupcakes-6`, `-8`, `-12`, `-16` | `/cakes/lemon-cake` | pack Product ID, `chocolateIcingCount`, `individualPackaging`, `quantity` | Only the listed active packs; icing mix and packaging piece count recalculated server-side |
| Brownie Cheesecake | `brownie-cheesecake`, `pave-brownie-cheesecake`, `eiffel-tower-brownie-cheesecake` | `/cakes/brownie-cheesecake` | finish Product ID, fixed 15cm presentation, `quantity` | Separate active IDs with authoritative prices 55/65/70 |

The internal legacy fields `vanillaCakeSheet`, `vanillaCakeFlavor`, `vanillaCreamCount`, and `partyDecorationCount` remain part of historical-data compatibility. A Pencil page must not reintroduce retired customer controls merely because those fields still exist.

Individual packaging stores the customer choice as `individualPackaging` on each eligible order line. The Reservation API derives `individualPackagingPieces` and `individualPackagingFeeCents`; their optional Appwrite integer attributes are installed idempotently with `npm run ensure:individual-packaging-schema` before deploying the Reservation API. Existing documents remain valid and default to no packaging.

### Pave Chocolate Cake images

- Representative: `public/products/pave-chocolate-cake-sydney.webp`
- Quick View: `public/products/details/pave-chocolate-cake-quick-view.webp`
- Detail gallery: the two paths above, `public/products/details/pave-chocolate-cake-previous.webp`, plus the imported assets `src/assets/hero-cake-2.webp`, `src/assets/pave-cake-card.jpg`, `src/assets/chocolate-cake-slice.jpg`, and `src/assets/chocolate-cake-eight-slices.jpg`

### Vanilla Fresh Cream Cake images

- Representative: `public/products/vanilla-cake-sydney.webp`
- Quick View: `public/products/details/vanillacake-quickview.webp`
- Detail gallery: those two existing paths

### Buttercream Cake images

- Representative: `public/products/buttercream-cake-sydney.webp`
- Quick View: `public/products/details/buttercream-cake-quick-view.webp`
- Detail gallery: those two paths plus the previous representative at `public/products/details/buttercream-cake-detail-01.webp`
- Replacement brief: use a slightly lower camera angle so the cake height and volume are clearer, and change the sprinkle colours. Replace the files in place; do not change the paths.

### Chocolate Cupcakes images

- Representative: `public/products/chocolate-cupcakes-sydney.webp`
- Quick View: `public/products/details/chocolate-cupcakes2-sydney.webp`
- Detail gallery: the representative path, the previous representative at `public/products/details/chocolate-cupcakes-detail-01.webp`, and imported `src/assets/cupcake-hero.webp`
- Replacement brief: one image should clearly show three cupcakes, one each of Basic, Vanilla Fresh Cream, and Chocolate Buttercream. Replace the files in place; do not change the paths.

### Signature Gâteau au Chocolat images

- Representative: `public/products/signature-gateau-au-chocolat-sydney.webp`
- Quick View: `public/products/details/chocolate-pound-cake-quick-view.webp`
- Detail gallery: those two paths, the previous representative at `public/products/details/signature-gateau-au-chocolat-detail-01.webp`, `public/products/details/chocolate-pound-cake-previous.webp`, and imported `src/assets/hero-cake-3.webp`

### Lemon Cake images

- Representative: `public/products/lemon-cake-sydney.webp`
- Quick View: `public/products/details/lemon-cake-quick-view.webp`
- Detail gallery: those two paths, `public/products/details/lemon-cake-previous.webp`, and imported `src/assets/lemoncake.webp`

### Brownie Cheesecake images

- Representative: `public/products/brownie-cheesecake-sydney.webp`
- Quick View: `public/products/details/brownie-cheese-quick-view.webp`
- Detail gallery: those two paths plus the previous representative at `public/products/details/brownie-cheesecake-detail-01.webp`
- Replacement brief: clearly show the brownie layer and cheesecake layer in cross-section so the product structure is immediately understandable. Replace the files in place; do not change the paths.

## Individual packaging contract

Only current Chocolate Cupcakes and Lemon Cake order lines may set `individualPackaging: true`. Piece counts come from the Product ID and line quantity. The reservation server sums all selected eligible lines, charges 50 cents per piece for 1–99 pieces, and charges zero for 100 or more pieces. Packaging is a separate service fee added after product discounts and is never part of the discount basis. Stored aggregate fields are `individualPackagingPieces` and `individualPackagingFeeCents`; older orders without them remain valid and read as no packaging.

## Required Pencil integration checks

Before replacing the current detail DOM/CSS, verify each product can still select every field listed above, adjust quantity, show the same total as the cart, and use Add to order. Verify cupcake pack/finish, Buttercream Cake colour, Lemon finishing mix, Brownie finish, and eligible individual packaging. Then verify cart, reserve, completion, lookup, admin, calendar, CSV, SMS/email, Korean/English, historical orders, and the seven canonical URLs.
