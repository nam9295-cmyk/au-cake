# AU Product Detail — local implementation review, 2026-10-07

Worktree: `au-cake-pave-detail`. Branch: `feat/au-pave-detail-implementation`.
Starting and current committed HEAD: `e367d33eecc4895446ff98f884a86ceb233f0cdc`.
Implementation remains uncommitted for John's local visual review; no merge, push or deployment.

## Implementation

- Existing Pavé master retained. Shared responsive photographs, headings, editorial CSS and motion are reused.
- `AuDetailGallery`: responsive photographs, thumbnail buttons, swipe/arrow navigation.
- `AuDetailStory`: hook, inside, craft, poster/video, optional finish editions, occasion, packaging, practical information and catalogue-derived related products.
- `AuDetailPurchaseBar`: mobile presentation delegates to the existing Cake/Chocolate purchase callbacks.
- `au-detail-presentation.ts`: eight product-specific presentation configurations. No prices, SKU definitions or new order contracts.
- CakeDetailPage keeps the existing selection, pricing and cart handlers. Almond keeps the existing chocolate variants/quantity/promotion behavior. Bento remains unavailable.
- AU roots only. Headings use Work Sans; descriptive copy uses SUIT. The pre-existing Home thumbnail SUIT change is retained.

## Routes

| Product | Existing route |
|---|---|
| Pavé | /cakes/pave-chocolate-cake |
| Signature | /cakes/signature-gateau-au-chocolat |
| Cupcakes | /cakes/chocolate-cupcakes |
| Lemon | /cakes/lemon-cake |
| Bento | /cakes/bento-cake |
| Strawberry Vanilla | /cakes/fresh-strawberry-vanilla-cream-cake |
| Brownie Cheesecake | /cakes/brownie-cheesecake |
| Almond | /chocolates/almond-chocoball |
| S’more | /cakes/smore-stick |

## Asset optimization

Eight new product sets: 73 distinct source images, 158 generated responsive WebP files.
Distinct original bytes: 157,030,963 (~157 MB). All generated variants: 7,650,512 (~7.65 MB), about 95.1% smaller.
These are asset-set totals, not first-load transfer size; the browser selects a srcset candidate and supporting images are lazy-loaded.
Pavé retains its previous optimized photographs and supplied eight-second film (~2.8 MiB together).

| Product | Referenced source bytes | Generated variant bytes |
|---|---:|---:|
| Signature | 28,598,909 | 1,745,940 |
| Cupcakes | 16,886,737 | 1,162,908 |
| Lemon | 26,799,252 | 779,322 |
| Bento | 126,484 | 164,310 |
| Strawberry Vanilla | 12,250,472 | 994,118 |
| Brownie Cheesecake | 32,923,346 | 1,375,420 |
| Almond | 27,620,478 | 889,222 |
| S’more | 12,321,658 | 539,272 |

Per-product source totals include shared source photographs; the overall original total deduplicates them. Bento's original was already WebP; its two responsive variants together are larger than that single original.

No Drive or Pencil source was edited. Used Drive files were readable, and matching source copies were checked by SHA-256. Unused intermediate generated files were moved outside the repository to recoverable temporary backup folders.

## Photo and copy decisions

- Desktop photographs/order drive both layouts; stale Mobile Pavé photographs were replaced. Mobile retains stacked sections, supporting grids and two-column related cards.
- Cupcake Inside uses the actual Pencil rotation/crop. S’more Packaging uses the foreground `smore.png`, not the old Lemon photo fill underneath.
- Signature: existing basic/extra chocolate/vanilla fresh cream definitions; real product finish photos.
- Cupcakes: existing basic/vanilla/chocolate buttercream descriptions and pack options; party photos retained.
- Lemon: existing glaze/dark chocolate finish facts. No made-up flavour or pricing.
- Strawberry: existing genoise/vanilla cream/strawberry information.
- Brownie: the customer-facing finish selector is unified as Basic / Vanilla Cream +AUD 20 / Pavé Chocolate +AUD 10. The existing `fresh-cream` order field remains the authoritative internal value for Vanilla Cream, so pricing and persisted order contracts are unchanged.
- Almond: three production selling units; no fictional 80g A$16 gift tin. Black Tub wording states 80g × 2 without claiming an unverified internal pouch arrangement.
- S’more: chocolate/marshmallow wording and photographed packaging; no new origin/toasting claims.
- Bento: existing Coming Soon; no invented size, release date, free candles or packaging promises.
- Signature/Brownie packaging photographs show a Pavé order in the approved Desktop frame. The caption identifies this as an atelier packaging reference.
- Related products use catalogue names/prices/images/routes. The stale Brownie self-recommendation is replaced by Pavé.
- Existing product/allergen/order information remains authoritative even where its text length differs from Pencil.

## Video and remaining content

New product Video Moment areas currently use finished still images. Their optional `videoSrc` enables muted, inline, looped, viewport-near playback with reduced-motion support. No development placeholder labels are shown.
Pavé's previously supplied eight-second video remains.
Next input from John: final video URLs/files. Final visual polish can follow local review.
Almond's precise ingredient/allergen claims are not invented; customers are directed to confirm current information.

## Evidence

Preview: http://100.112.93.113:5184
Screenshots: `/tmp/au-product-details-20261007/`.
Every route uses `<slug>-1440-full.png`, `<slug>-834-full.png`, `<slug>-390-full.png`, plus first-viewport `-hero.png` versions.
Side-by-side Pencil/web comparisons and focused regions: `comparisons/`.
Final QA findings and verification are recorded in project-root `design-qa.md`.

## Complete source-to-production mapping

`drive/` is relative to the approved Google Drive image root. `pencil/` is relative to the protected worktree's design folder.
Original SHA-256, dimensions, crop transforms and variant byte counts are retained in `src/lib/au-detail-image-manifest.json`.
The generator reads source roots through `AU_DETAIL_DRIVE_ROOT` and `AU_DETAIL_PENCIL_ROOT`; no absolute source path is needed at runtime.
Existing Pavé mapping remains in `src/lib/au-pave-presentation.ts`.

| Product | Role | Read-only source | Production image | Width variants |
|---|---|---|---|---|
| signature-gateau | hero | `pencil/au-site-redesign-assets/signature-gateau-au-chocolat-sydney.webp` | `/products/details/signature-gateau/hero-1080.webp` | 480/1080 |
| signature-gateau | inside | `drive/cake/pound-detail/pound-1.png` | `/products/details/signature-gateau/inside-1440.webp` | 480/1440 |
| signature-gateau | craft-01 | `drive/cake/pound-detail/in-the-box.png` | `/products/details/signature-gateau/craft-01-960.webp` | 480/960 |
| signature-gateau | craft-02 | `drive/cake/pound-detail/chocolate-cross.webp` | `/products/details/signature-gateau/craft-02-620.webp` | 480/620 |
| signature-gateau | craft-03 | `drive/cake/pound-detail/vainlla-cross.webp` | `/products/details/signature-gateau/craft-03-620.webp` | 480/620 |
| signature-gateau | video-poster | `drive/cake/pound-detail/gateau-169.png` | `/products/details/signature-gateau/video-poster-1440.webp` | 480/1440 |
| signature-gateau | edition-01 | `drive/cake/pound-detail/pound-hole.png` | `/products/details/signature-gateau/edition-01-880.webp` | 480/880 |
| signature-gateau | edition-02 | `drive/cake/pound-detail/chocolate-on-top.png` | `/products/details/signature-gateau/edition-02-880.webp` | 480/880 |
| signature-gateau | edition-03 | `drive/cake/pound-detail/vanilla-on-top.png` | `/products/details/signature-gateau/edition-03-880.webp` | 480/880 |
| signature-gateau | occasion-01 | `drive/cake/pound-detail/gateau-3.webp` | `/products/details/signature-gateau/occasion-01-960.webp` | 480/960 |
| signature-gateau | occasion-02 | `drive/cake/pound-detail/drop-chocolate.webp` | `/products/details/signature-gateau/occasion-02-960.webp` | 480/960 |
| signature-gateau | occasion-03 | `drive/cake/pound-detail/eat-gateau.webp` | `/products/details/signature-gateau/occasion-03-960.webp` | 480/960 |
| signature-gateau | occasion-04 | `drive/cake/pound-detail/party.png` | `/products/details/signature-gateau/occasion-04-960.webp` | 480/960 |
| signature-gateau | packaging | `drive/cake/KakaoTalk_Photo_2026-09-22-21-07-01-7.jpeg` | `/products/details/signature-gateau/packaging-960.webp` | 480/960 |
| cupcakes | hero | `pencil/au-site-redesign-assets/chocolate-cupcakes-sydney.webp` | `/products/details/cupcakes/hero-1080.webp` | 480/1080 |
| cupcakes | inside | `drive/cake/gateau-cupcake-detail/cupcake.png` | `/products/details/cupcakes/inside-1440.webp` | 480/1440 |
| cupcakes | craft-01 | `drive/cake/gateau-cupcake-detail/vanilla.png` | `/products/details/cupcakes/craft-01-960.webp` | 480/960 |
| cupcakes | craft-02 | `drive/cake/gateau-cupcake-detail/choco.png` | `/products/details/cupcakes/craft-02-620.webp` | 480/620 |
| cupcakes | craft-03 | `drive/cake/gateau-cupcake-detail/basic.png` | `/products/details/cupcakes/craft-03-620.webp` | 480/620 |
| cupcakes | edition-01 | `drive/cake/gateau-cupcake-detail/basic.png` | `/products/details/cupcakes/edition-01-880.webp` | 480/880 |
| cupcakes | edition-02 | `drive/cake/gateau-cupcake-detail/vanilla.png` | `/products/details/cupcakes/edition-02-880.webp` | 480/880 |
| cupcakes | edition-03 | `drive/cake/gateau-cupcake-detail/choco.png` | `/products/details/cupcakes/edition-03-880.webp` | 480/880 |
| cupcakes | occasion-01 | `drive/cake/gateau-cupcake-detail/party-01.webp` | `/products/details/cupcakes/occasion-01-960.webp` | 480/960 |
| cupcakes | occasion-02 | `drive/cake/gateau-cupcake-detail/vanilla-party-02.webp` | `/products/details/cupcakes/occasion-02-960.webp` | 480/960 |
| cupcakes | occasion-03 | `drive/cake/gateau-cupcake-detail/choco-scene.webp` | `/products/details/cupcakes/occasion-03-960.webp` | 480/960 |
| cupcakes | packaging | `drive/cake/gateau-cupcake-detail/cakes-package.png` | `/products/details/cupcakes/packaging-960.webp` | 480/960 |
| lemon | hero | `pencil/au-site-redesign-assets/lemon-cake-sydney.webp` | `/products/details/lemon/hero-1080.webp` | 480/1080 |
| lemon | inside | `drive/cake/lemon-detail/lemon-cake-03.png` | `/products/details/lemon/inside-1440.webp` | 480/1440 |
| lemon | craft-01 | `drive/cake/lemon-detail/lemon-box.png` | `/products/details/lemon/craft-01-960.webp` | 480/960 |
| lemon | craft-02 | `drive/cake/lemon-detail/lemon-cake-02.png` | `/products/details/lemon/craft-02-620.webp` | 480/620 |
| lemon | craft-03 | `drive/cake/lemon-detail/lemon-choco-02.png` | `/products/details/lemon/craft-03-620.webp` | 480/620 |
| lemon | edition-01 | `drive/cake/lemon-detail/lemon-cake-01.png` | `/products/details/lemon/edition-01-960.webp` | 480/960 |
| lemon | edition-02 | `drive/cake/lemon-detail/lemon-choco-01.png` | `/products/details/lemon/edition-02-880.webp` | 480/880 |
| lemon | occasion-01 | `drive/cake/lemon-detail/lemon-cake-04.png` | `/products/details/lemon/occasion-01-960.webp` | 480/960 |
| lemon | occasion-02 | `drive/cake/lemon-detail/lemon-party-01.webp` | `/products/details/lemon/occasion-02-610.webp` | 480/610 |
| lemon | occasion-03 | `drive/cake/lemon-detail/lemon-party-02.webp` | `/products/details/lemon/occasion-03-610.webp` | 480/610 |
| lemon | packaging | `drive/cake/lemon-detail/magnific__img1-img2-__89889.png` | `/products/details/lemon/packaging-960.webp` | 480/960 |
| bento | hero | `pencil/au-site-redesign-assets/bento-cake-sydney.webp` | `/products/details/bento/hero-1080.webp` | 480/1080 |
| strawberry-vanilla | hero | `pencil/au-site-redesign-assets/fresh-strawberry-vanilla-cream-cake-sydney.webp` | `/products/details/strawberry-vanilla/hero-1080.webp` | 480/1080 |
| strawberry-vanilla | inside | `drive/cake/vanilla-cake/cross-section-v3.jpg` | `/products/details/strawberry-vanilla/inside-1440.webp` | 480/1440 |
| strawberry-vanilla | craft-01 | `drive/cake/vanilla-cake/hero-02.png` | `/products/details/strawberry-vanilla/craft-01-960.webp` | 480/960 |
| strawberry-vanilla | craft-02 | `drive/cake/vanilla-cake/Strawberries_closeup.jpg` | `/products/details/strawberry-vanilla/craft-02-896.webp` | 480/896 |
| strawberry-vanilla | craft-03 | `drive/cake/vanilla-cake/package.png` | `/products/details/strawberry-vanilla/craft-03-625.webp` | 480/625 |
| strawberry-vanilla | occasion-01 | `drive/cake/vanilla-cake/45degree.png` | `/products/details/strawberry-vanilla/occasion-01-610.webp` | 480/610 |
| strawberry-vanilla | occasion-02 | `drive/cake/vanilla-cake/vanilla-party-01.webp` | `/products/details/strawberry-vanilla/occasion-02-960.webp` | 480/960 |
| strawberry-vanilla | occasion-03 | `drive/cake/vanilla-cake/vanilla-party-02.webp` | `/products/details/strawberry-vanilla/occasion-03-960.webp` | 480/960 |
| strawberry-vanilla | occasion-04 | `drive/cake/vanilla-cake/vanilla-party-03.webp` | `/products/details/strawberry-vanilla/occasion-04-610.webp` | 480/610 |
| strawberry-vanilla | packaging | `drive/cake/vanilla-cake/boxes.png` | `/products/details/strawberry-vanilla/packaging-960.webp` | 480/960 |
| brownie-cheesecake | hero | `drive/cake/cheesecake/main-hero.webp` | `/products/details/brownie-cheesecake/hero-1080.webp` | 480/1080 |
| brownie-cheesecake | inside | `drive/cake/cheesecake/cheese-detail-04.png` | `/products/details/brownie-cheesecake/inside-1440.webp` | 480/1440 |
| brownie-cheesecake | craft-01 | `drive/cake/cheesecake/cheese-detail-02.png` | `/products/details/brownie-cheesecake/craft-01-960.webp` | 480/960 |
| brownie-cheesecake | craft-02 | `drive/cake/cheesecake/cheese-deatail-01.png` | `/products/details/brownie-cheesecake/craft-02-620.webp` | 480/620 |
| brownie-cheesecake | craft-03 | `drive/cake/cheesecake/cheese-detail-03.png` | `/products/details/brownie-cheesecake/craft-03-620.webp` | 480/620 |
| brownie-cheesecake | edition-01 | `drive/cake/cheesecake/hero.png` | `/products/details/brownie-cheesecake/edition-01-960.webp` | 480/960 |
| brownie-cheesecake | edition-02 | `drive/cake/cheesecake/on-vanilla-hero.png` | `/products/details/brownie-cheesecake/edition-02-880.webp` | 480/880 |
| brownie-cheesecake | edition-03 | `drive/cake/cheesecake/on-chocolate-hero.png` | `/products/details/brownie-cheesecake/edition-03-880.webp` | 480/880 |
| brownie-cheesecake | occasion-01 | `drive/cake/cheesecake/cheese-party-04.png` | `/products/details/brownie-cheesecake/occasion-01-960.webp` | 480/960 |
| brownie-cheesecake | occasion-02 | `drive/cake/cheesecake/cheese-party-02.png` | `/products/details/brownie-cheesecake/occasion-02-768.webp` | 480/768 |
| brownie-cheesecake | occasion-03 | `drive/cake/cheesecake/cheese-party-03.png` | `/products/details/brownie-cheesecake/occasion-03-960.webp` | 480/960 |
| brownie-cheesecake | occasion-04 | `drive/cake/cheesecake/cheese-party-01.jpg` | `/products/details/brownie-cheesecake/occasion-04-610.webp` | 480/610 |
| brownie-cheesecake | packaging | `drive/cake/KakaoTalk_Photo_2026-09-22-21-07-01-7.jpeg` | `/products/details/brownie-cheesecake/packaging-960.webp` | 480/960 |
| almond | hero | `drive/chocolate/almond/hero.jpg` | `/products/details/almond/hero-1294.webp` | 480/1294 |
| almond | inside | `drive/chocolate/almond/cross-closeup.png` | `/products/details/almond/inside-1440.webp` | 480/1440 |
| almond | craft-01 | `drive/chocolate/almond/cross-section-almond-01.jpg` | `/products/details/almond/craft-01-960.webp` | 480/960 |
| almond | craft-02 | `drive/chocolate/almond/hand-on-almonds.png` | `/products/details/almond/craft-02-620.webp` | 480/620 |
| almond | craft-03 | `drive/chocolate/almond/closeup.png` | `/products/details/almond/craft-03-620.webp` | 480/620 |
| almond | edition-01 | `drive/chocolate/almond/hero-background.jpg` | `/products/details/almond/edition-01-880.webp` | 480/880 |
| almond | edition-02 | `drive/chocolate/almond/black-canister-background.jpg` | `/products/details/almond/edition-02-880.webp` | 480/880 |
| almond | occasion-01 | `drive/chocolate/almond/cross-section-almond-01.jpg` | `/products/details/almond/occasion-01-610.webp` | 480/610 |
| almond | occasion-02 | `drive/chocolate/almond/verit-almond-closeup.webp` | `/products/details/almond/occasion-02-960.webp` | 480/960 |
| almond | occasion-03 | `drive/chocolate/almond/bite-almond.webp` | `/products/details/almond/occasion-03-960.webp` | 480/960 |
| almond | occasion-04 | `drive/chocolate/almond/hand-on-almonds.png` | `/products/details/almond/occasion-04-610.webp` | 480/610 |
| almond | packaging | `drive/chocolate/almond/black-canister.png` | `/products/details/almond/packaging-960.webp` | 480/960 |
| smore | hero | `pencil/au-site-redesign-assets/smore-stick-sydney.webp` | `/products/details/smore/hero-1080.webp` | 480/1080 |
| smore | inside | `drive/chocolate/s'more/detail.png` | `/products/details/smore/inside-1440.webp` | 480/1440 |
| smore | craft-01 | `drive/chocolate/s'more/bite-smore.jpg` | `/products/details/smore/craft-01-960.webp` | 480/960 |
| smore | craft-02 | `drive/chocolate/s'more/chocolate-cover.jpg` | `/products/details/smore/craft-02-960.webp` | 480/960 |
| smore | craft-03 | `drive/chocolate/s'more/hero.png` | `/products/details/smore/craft-03-960.webp` | 480/960 |
| smore | packaging | `pencil/au-site-redesign-assets/smore.png` | `/products/details/smore/packaging-960.webp` | 480/960 |

