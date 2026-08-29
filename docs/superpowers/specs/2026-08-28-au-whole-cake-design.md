# AU Whole Cake Frontend Design

## Goal

Rebuild the AU current Whole Cake lineup as four products while preserving all
historical cake records and their original size and serving display.

## Scope

The current catalogue contains eight products in this exact order:

1. Pave Chocolate Cake
2. Buttercream Cake
3. Fresh Strawberry Vanilla Cream Cake
4. Fresh Strawberry Chocolate Cream Cake
5. Chocolate Cupcakes
6. Signature Gâteau au Chocolat
7. Lemon Cake
8. Brownie Cheesecake

The first four are grouped as `WHOLE CAKES`; the remaining four are grouped as
`MORE CAKES` on `/cakes`.

## Product Contract

| Product ID | Slug | Profile | 6in | 8in | 10in |
| --- | --- | --- | ---: | ---: | ---: |
| `pave-cake` | `pave-chocolate-cake` | `gateau` | AUD 79.00 | AUD 109.00 | AUD 159.00 |
| `buttercream-cake` | `buttercream-cake` | `gateau` | AUD 75.00 | AUD 99.00 | AUD 145.00 |
| `fresh-strawberry-vanilla-cream-cake` | `fresh-strawberry-vanilla-cream-cake` | `genoise` | AUD 69.00 | AUD 89.00 | AUD 129.00 |
| `fresh-strawberry-chocolate-cream-cake` | `fresh-strawberry-chocolate-cream-cake` | `genoise` | AUD 72.00 | AUD 95.00 | AUD 135.00 |

Serving profiles are a single frontend source of truth:

- `gateau`: 6in → `6" | serves approx. 8–10`; 8in → `8" | serves approx. 14–18`; 10in → `10" | serves approx. 24–28`.
- `genoise`: 6in → `6" | serves approx. 6–8`; 8in → `8" | serves approx. 10–14`; 10in → `10" | serves approx. 16–20`.

Current Whole Cake selectors only expose `6in`, `8in`, and `10in`. Product
prices remain in `src/lib/market.ts` `sizePrices`; no view duplicates price
strings.

## Current vs Historical Size Boundary

New current selections are product-aware and formatted from the active
product's serving profile. Stored records are product- and raw-value-aware:

- `15cm` stays `6" | serves 8`.
- `19cm` stays `7.5" | serves 14`.
- `22cm` stays `9" | serves 22`.

Historical formatting must never pass a stored cm value through a current
Whole Cake profile. Stored parsing preserves valid legacy values, while current
selection normalization falls back only within the selected product's active
size options.

## Options and Payloads

Fresh Strawberry Vanilla and Fresh Strawberry Chocolate order lines send only
`productId`, `cakeSize`, and `quantity`. Their legacy Vanilla sheet, flavour,
point-colour, and unrelated defaults are omitted.

Buttercream retains its cake-colour choice. Pave retains only its real
dark-chocolate selection contract. Existing Cupcake, Lemon, Signature Gâteau,
and Brownie option serialization is unchanged.

The client projects detail/cart selections into product-aware order-line
payloads before reservation submission. Current product IDs and size keys are
checked in a frontend/backend parity assertion where the present frontend test
boundary can exercise the deployed-server contract source without modifying
the backend worktree.

## Content and Detail Pages

Pave and Buttercream keep their compact detail layouts and approved editorial
claims. Strawberry products use the existing shared compact renderer and
`KoreanCakeReviewsSection`; no product-specific React renderer is added.

The Strawberry Vanilla page uses the approved bilingual hero and three
highlights, with key ingredients limited to fresh strawberries, vanilla fresh
cream, real vanilla bean, and genoise cake. Strawberry Chocolate uses only the
approved strawberry, chocolate fresh cream, and genoise claims. Neither page
adds unverified recipe, percentage, health, or allergen claims.

Size selection adds a compact native disclosure explaining why gateau and
genoise serving guides vary. It does not create a new long-form content
section.

There are no Strawberry product images in the repository. Catalogue, Quick
View, reservation selection, and detail use the established photo-pending
placeholder; no image URL or SEO image metadata is invented.

## Legacy Vanilla

`vanilla-fresh-cream-cake` remains a typed historical product and stored-order
reader target. It is removed from all current catalogue sources. Its direct
route remains a noindex, webpage-only compatibility page with no price,
Product Offer JSON-LD, or ordering CTA. It links only to the current catalogue
and does not redirect or nominate a Strawberry replacement canonical.

## SEO

The two Strawberry slugs are canonical `cakePages`, current Product JSON-LD
entries, static detail pages, sitemap entries, and `llms.txt` items. Current
runtime and static ItemLists contain the same eight products in catalogue
order. Legacy Vanilla moves to `legacyCakePages`, is generated as noindex, and
does not appear in the sitemap or current Product catalogue.

## Non-goals
