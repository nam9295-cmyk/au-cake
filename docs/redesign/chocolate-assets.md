# AU chocolate photography mapping

Home collection, category, detail and related cards share `src/lib/au-chocolate-assets.ts`.
John supplied the approved transparent WebP hero photographs on 2026-09-26.
Each entry's `src`, `alt` and `caption` now describes the actual photo. Adding
an image does not enable orders or change product pricing.

| Product | Original filename | Active repo path |
| --- | --- | --- |
| Almond Chocoball | `almond.webp` | `public/products/chocolates/almond-chocoball.webp` |
| Pavé Chocolate | `pave-chocolate.webp` | `public/products/chocolates/pave-chocolate.webp` |
| Eiffel Tower Chocolate | `effel-chocolate.webp` | `public/products/chocolates/eiffel-tower-chocolate.webp` |

All three files are 1080×1012 WebP with a real alpha channel, copied byte-for-byte
from the control folder's `image/` directory. Original files remain untouched.
They require no further compression: Almond is 97,502 bytes, Pavé 96,574 bytes,
and Eiffel 193,120 bytes. Existing `object-fit: contain` preserves the cutouts
without cropping in the Home collection, category, detail Hero and related cards.
Browser paths omit `public`, for example `/products/chocolates/almond-chocoball.webp`.
No Mac absolute paths or external stock URLs are used by the frontend.

Source/destination SHA-256:

- Almond: `cd5746abd5a43fa24cceb87446c1165c868cfed7ac86385faa5c5b1fc175c34c`
- Pavé: `ee00552de9f5743866c51e40e41dc05614f0bf0b572fa0874addb0d32098789a`
- Eiffel: `1b06b2c0624ca11cab3b302867955304c9e534e8a0280c6ec20ee7a7efc4a452`

Approved standalone sale units and prices (John, 2026-09-26):

- Almond Chocoball: **80g / AUD 12**.
- Almond Chocoball 6 Pack: **80g × 6 / AUD 60** (explicit SKU, not an automatic cart promotion).
- Almond Chocoball Black Tub: **80g × 2 / AUD 25**.
- Pavé Chocolate: **100g tub / AUD 12**.
- Eiffel Tower Chocolate: **6 pieces / AUD 10**.

The approved implementation contract is recorded in `chocolate-commerce-plan.md`.
Current prices and coupon eligibility come from the shared chocolate domain;
only the Almond 6 Pack is excluded from coupons. Checkout must verify the
server's `chocolateOrderLines: 1` capability. This repository work does not
deploy or enable a production backend.

The Almond image shows a single 80g pouch, not the six-pack or Black Tub.
Those variants reuse it only as a clearly captioned product reference until
their actual packaging photographs are supplied. Existing cake Chocolate
Extras keep their AUD12/AUD10/AUD20 once-per-row policy. Previous placeholder
assets are retained but are no longer used by this AU chocolate mapping.
