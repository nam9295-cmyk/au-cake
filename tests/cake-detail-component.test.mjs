import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
const editorialSource = await readFile(new URL('../src/CakeEditorialDetail.tsx', import.meta.url), 'utf8').catch(() => '')
const editorialDataSource = await readFile(new URL('../src/lib/cake-editorial.ts', import.meta.url), 'utf8')
const reserveSource = await readFile(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const reviewSource = await readFile(new URL('../src/KoreanCakeReviewsSection.tsx', import.meta.url), 'utf8')
const reviewDataSource = await readFile(new URL('../src/lib/korean-cake-reviews.ts', import.meta.url), 'utf8')
const cakeDetailDataSource = await readFile(new URL('../src/lib/cake-detail.ts', import.meta.url), 'utf8')
const cartSource = await readFile(new URL('../src/CartPage.tsx', import.meta.url), 'utf8')
const i18nSource = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8')
const marketSource = await readFile(new URL('../src/lib/market.ts', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const chocolateExtrasSource = await readFile(new URL('../src/lib/chocolate-extras.ts', import.meta.url), 'utf8').catch(() => '')
const optionPreviewAssetPaths = [
  '../src/assets/options/gateau-basic.webp',
  '../src/assets/options/gateau-onchocolate.webp',
  '../src/assets/options/gateau-vanilla.webp',
  '../src/assets/options/extra-eff.webp',
  '../src/assets/options/extra-pave.webp',
  '../src/assets/options/extra-2set.webp',
]
const optionPreviewAssets = await Promise.all(optionPreviewAssetPaths.map((path) => (
  readFile(new URL(path, import.meta.url)).catch(() => null)
)))
const sizePreviewAssetPaths = [
  '../src/assets/options/cake-size-buttercream.webp',
  '../src/assets/options/cake-size-pave.webp',
  '../src/assets/options/cake-size-strawberry-chocolate.webp',
  '../src/assets/options/cake-size-strawberry-vanilla.webp',
]
const sizePreviewAssets = await Promise.all(sizePreviewAssetPaths.map((path) => (
  readFile(new URL(path, import.meta.url)).catch(() => null)
)))
const cupcakePreviewAssetPaths = [
  '../src/assets/options/cupcake-6-basic.webp',
  '../src/assets/options/cupcake-6-chocolate.webp',
  '../src/assets/options/cupcake-6-vanilla.webp',
  '../src/assets/options/cupcake-12-basic.webp',
  '../src/assets/options/cupcake-12-chocolate.webp',
  '../src/assets/options/cupcake-12-vanilla.webp',
]
const cupcakePreviewAssets = await Promise.all(cupcakePreviewAssetPaths.map((path) => (
  readFile(new URL(path, import.meta.url)).catch(() => null)
)))
const individualPackagingPreviewAssets = await Promise.all([
  '../src/assets/options/individual-packaging.webp',
  '../src/assets/options/individual-packaging-cupcake.webp',
].map((path) => readFile(new URL(path, import.meta.url)).catch(() => null)))

test('home catalogue opens shared cake detail routes instead of skipping to the request form', () => {
  assert.match(homeSource, /navigateToCake\(card\.slug\)/)
  assert.match(appSource, /<CakeDetailPage/)
  assert.match(appSource, /<CakesPage/)
})

test('direct navigation between cake slugs remounts the detail state for the new product', () => {
  assert.match(appSource, /<CakeDetailPage[\s\S]*?key=\{currentCakeSlug\}/)
})

test('shared detail template contains gallery, purchase panel and verified information sections', () => {
  assert.match(detailSource, /cake-detail-gallery/)
  assert.match(detailSource, /cake-detail-purchase/)
  assert.match(detailSource, /cake-detail-trust/)
  assert.match(detailSource, /cake-detail-accordion/)
  assert.doesNotMatch(detailSource, /Free delivery|Delivery tomorrow|Look & taste guarantee/)
})

test('Chocolate Cupcakes use Pack Size then one whole-box Finish without per-cupcake count controls', () => {
  assert.match(detailSource, /language === 'ko' \? '구성' : 'Pack Size'/)
  assert.match(detailSource, /language === 'ko' \? '마감' : 'Finish'/)
  assert.match(detailSource, /CUPCAKE_FINISH_OPTIONS\.map/)
  assert.doesNotMatch(detailSource, /vanillaCreamCount|partyDecorationCount|Party decoration/)
  assert.match(reserveSource, /name="cupcakeFinish"/)
  assert.doesNotMatch(reserveSource, /Remove one vanilla cream finish|Party decoration is \+AUD 1\.00 each/)
})

test('only Cupcakes and Lemon Cake expose the bilingual individual packaging choice', () => {
  assert.match(detailSource, /isIndividualPackagingEligibleProduct\(product\.id\)/)
  assert.match(detailSource, /Individual packaging/)
  assert.match(detailSource, /개별 포장/)
  assert.match(detailSource, /AUD 0\.50 per piece · FREE with AUD 100\.00\+ of individually packaged cupcakes or Lemon Cake/)
  assert.match(reserveSource, /isIndividualPackagingEligibleProduct\(selectedProduct\.id\)/)
  assert.match(reserveSource, /name="individualPackaging"/)
})

test('cake detail makes a free individual-packaging discount visible as a negative AUD amount before the final total', () => {
  assert.match(detailSource, /individualPackagingDiscountCents/)
  assert.match(detailSource, /Packaging discount/)
  assert.match(detailSource, /포장 할인/)
  assert.match(detailSource, /-\{formatCurrency\(individualPackagingDiscount/)
})

test('new cream-cake order forms hide retired flavour controls and call Buttercream colours point colours', () => {
  assert.doesNotMatch(detailSource, /VANILLA_CAKE_FLAVOR_OPTIONS\.map/)
  assert.doesNotMatch(reserveSource, /name="vanillaCakeFlavor"/)
  assert.match(detailSource, /isCakePointColorProduct\(product\.id\)/)
  assert.match(reserveSource, /isCakePointColorProduct\(selectedProduct\.id\)/)
  assert.match(detailSource, /isButtercreamCakeProduct\(product\.id\)[\s\S]*?'케이크 포인트 컬러 선택'[\s\S]*?'Choose a point colour'/)
  assert.match(reserveSource, /isButtercreamCakeProduct\(selectedProduct\.id\)[\s\S]*?'케이크 포인트 컬러 선택'[\s\S]*?'Choose a point colour'/)
  assert.match(detailSource, /aria-label=\{language === 'ko'[\s\S]*?'포인트 컬러'[\s\S]*?'point colour'/)
})

test('AU detail option prices use the shared two-decimal currency formatter', () => {
  assert.match(detailSource, /\+\$\{formatCurrency\(option\.extraPrice\)\}/)
  assert.doesNotMatch(detailSource, /\+AUD \$\{/)
  assert.match(reserveSource, /formatCurrency\(getReservationUnitPrice/)
})

test('English cake service notes use the canonical lowercase brand', () => {
  assert.match(detailSource, /aria-label=\{language === 'ko' \? '베리굿 제작 방식' : 'verygood chocolate service notes'\}/)
  assert.doesNotMatch(detailSource, /Verygood service notes/)
})

test('editorial-enabled cakes use the shared detail after the protected Hero while other cakes keep the existing post-Hero sections', () => {
  assert.match(detailSource, /getCakeEditorialBySlug\(slug, language\)/)
  assert.match(detailSource, /editorial \? \([\s\S]*<CakeEditorialDetail/)
  assert.match(detailSource, /cake-detail-trust[\s\S]*cake-detail-story[\s\S]*KoreanCakeReviewsSection[\s\S]*cake-detail-accordion[\s\S]*cake-detail-other/)
  assert.match(editorialSource, /import KoreanCakeReviewsSection from '.\/KoreanCakeReviewsSection'/)
  assert.match(editorialSource, /<KoreanCakeReviewsSection slug=\{slug\} language=\{language\} \/>/)
  assert.match(editorialDataSource, /buttercream-cake/)
  assert.match(editorialDataSource, /chocolate-cupcakes/)
  assert.match(editorialDataSource, /lemon-cake/)
  assert.match(editorialDataSource, /signature-gateau-au-chocolat/)
  assert.match(editorialDataSource, /if \(slug === 'brownie-cheesecake'\)/)
  assert.doesNotMatch(detailSource, /VanillaDetailPage|VanillaEditorialDetail|ButtercreamDetailPage|ButtercreamEditorialDetail|CupcakeDetailPage|CupcakeEditorialDetail|LemonDetailPage|LemonEditorialDetail|SignatureGateauDetailPage|SignatureGateauEditorialDetail|BrownieDetailPage|BrownieEditorialDetail/)
})

test('Brownie Cheesecake uses the shared compact editorial with two current finish choices and a visible Pave surcharge', () => {
  assert.match(editorialDataSource, /BROWNIE_CHEESECAKE_EDITORIAL/)
  assert.match(detailSource, /detail\.id === 'brownie-cheesecake'[\s\S]*?'Choose a finish'/)
  assert.match(reserveSource, /selectedProductGroup\.id === 'brownie-cheesecake'[\s\S]*?'Choose a finish'/)
  assert.match(detailSource, /detail\.id === 'brownie-cheesecake'[\s\S]*?extraFromBase/)
})

test('Brownie Cheesecake exposes the Fresh cream AUD 20 option in both detail and reserve flows', () => {
  assert.match(detailSource, /isBrownieFreshCreamEligibleProduct\(product\.id\)/)
  assert.match(detailSource, /BROWNIE_CREAM_OPTIONS\.map/)
  assert.match(detailSource, /brownieCreamOption: option\.value/)
  assert.match(reserveSource, /name="brownieCreamOption"/)
  assert.match(reserveSource, /brownieCreamOption: form\.brownieCreamOption/)
  assert.match(reserveSource, /brownieCreamOption: selection\.brownieCreamOption/)
  assert.match(detailSource, /Fresh cream/)
  assert.match(detailSource, /생크림/)
})

test('Signature Gâteau au Chocolat uses the shared compact editorial while retaining its current finish and chocolate controls', () => {
  assert.match(editorialDataSource, /'signature-gateau-au-chocolat'/)
  assert.match(detailSource, /product\.usesPoundAddonOptions/)
  assert.match(detailSource, /POUND_ADDON_OPTIONS\.map/)
  assert.match(detailSource, /usesReservationChocolateType\(product\.id, selection\.poundAddon\)/)
  assert.match(detailSource, /Choose a finish/)
  assert.match(detailSource, /Choose chocolate/)
})

test('all current sale cakes use the approved three-column desktop purchase layout', () => {
  assert.match(detailSource, /const showsSignatureOrderOptions = detail\.id === 'signature-gateau'/)
  assert.match(detailSource, /cake-detail-gallery[\s\S]*cake-detail-configurator[\s\S]*cake-detail-checkout/)
  assert.match(detailSource, /cake-detail-hero is-desktop-three-column/)
  assert.doesNotMatch(detailSource, /is-signature-three-column/)
  assert.match(detailSource, /cake-detail-order-product/)
  assert.match(detailSource, /renderProductIntro\('cake-detail-intro is-desktop-gallery-intro'\)[\s\S]*cake-detail-main-image/)
  assert.match(detailSource, /cake-detail-configurator[\s\S]*renderProductIntro\('cake-detail-intro is-standard-intro'\)/)

  const desktopCss = cssSource.slice(cssSource.indexOf('@media (min-width: 1200px)'))
  assert.match(desktopCss, /\.cake-detail-hero\.is-desktop-three-column\s*\{[^}]*grid-template-columns:[^}]*minmax\(0, 1fr\)[^}]*minmax\(380px, 0\.82fr\)[^}]*minmax\(300px, 0\.62fr\)/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-thumbnails\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-options\.is-stacked\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-checkout\s*\{[^}]*position:\s*sticky[^}]*top:\s*72px/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-configurator h1\s*\{[^}]*font-size:\s*clamp\(36px, 2\.8vw, 40px\)/s)
  assert.match(desktopCss, /\.is-desktop-three-column\.has-compact-option-summary \.cake-detail-order-product\s*\{[^}]*display:\s*none/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-request\s*\{[^}]*border-radius:\s*0/s)
  assert.match(cssSource, /\.is-desktop-gallery-intro\s*\{[^}]*display:\s*none/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.is-desktop-gallery-intro\s*\{[^}]*display:\s*block[^}]*grid-column:\s*1 \/ -1/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.is-standard-intro\s*\{[^}]*display:\s*none/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-main-image\s*\{[^}]*grid-row:\s*2/s)
  assert.match(desktopCss, /\.is-desktop-three-column \.cake-detail-image-count\s*\{[^}]*grid-row:\s*3/s)
})

test('finish and Chocolate Extra selections expose compact responsive photo previews without replacing the gallery', () => {
  assert.match(detailSource, /const poundFinishPreviewImages: Record<PoundAddon, OptionPreviewImage>/)
  assert.match(detailSource, /const chocolateExtraPreviewImages: Partial<Record<ChocolateExtra, OptionPreviewImage>>/)
  assert.match(detailSource, /selectedFinishPreview = poundFinishPreviewImages\[selection\.poundAddon\]/)
  assert.match(detailSource, /selectedChocolateExtraPreview = chocolateExtraPreviewImages\[selection\.chocolateExtra\]/)
  assert.match(detailSource, /function OptionPhotoPreview[\s\S]*width=\{112\}[\s\S]*height=\{88\}/)
  assert.match(detailSource, /<OptionPhotoPreview/)
  assert.match(detailSource, /selection\.chocolateExtra !== 'none'/)
  assert.match(detailSource, /cake-detail-extra-help/)

  assert.match(cssSource, /\.cake-detail-option-preview\s*\{[^}]*grid-template-columns:\s*112px minmax\(0, 1fr\)/s)
  assert.match(cssSource, /\.cake-detail-option-preview img\s*\{[^}]*width:\s*112px[^}]*height:\s*88px/s)
  assert.match(cssSource, /\.cake-detail-options \+ \.cake-detail-option-preview\s*\{[^}]*margin-top:\s*10px/s)
  assert.match(cssSource, /@keyframes cake-detail-option-preview-enter/)

  const mobileCss = cssSource.slice(cssSource.lastIndexOf('@media (max-width: 760px)'))
  assert.match(mobileCss, /\.cake-detail-option-preview\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\)/s)
  assert.match(mobileCss, /\.cake-detail-option-preview img\s*\{[^}]*width:\s*88px[^}]*height:\s*69px/s)
})

test('customer-supplied photography maps every Gâteau finish and paid Chocolate Extra to its matching preview', () => {
  assert.deepEqual(optionPreviewAssets.map((asset) => Boolean(asset?.length)), [true, true, true, true, true, true])

  assert.match(detailSource, /import gateauBasicFinishImg from '\.\/assets\/options\/gateau-basic\.webp'/)
  assert.match(detailSource, /import gateauOnChocolateFinishImg from '\.\/assets\/options\/gateau-onchocolate\.webp'/)
  assert.match(detailSource, /import gateauVanillaFinishImg from '\.\/assets\/options\/gateau-vanilla\.webp'/)
  assert.match(detailSource, /none:\s*\{[^}]*src:\s*gateauBasicFinishImg/s)
  assert.match(detailSource, /'extra-chocolate':\s*\{[^}]*src:\s*gateauOnChocolateFinishImg/s)
  assert.match(detailSource, /'vanilla-cream':\s*\{[^}]*src:\s*gateauVanillaFinishImg/s)

  assert.match(detailSource, /import eiffelExtraImg from '\.\/assets\/options\/extra-eff\.webp'/)
  assert.match(detailSource, /import paveExtraImg from '\.\/assets\/options\/extra-pave\.webp'/)
  assert.match(detailSource, /import chocolateExtraSetImg from '\.\/assets\/options\/extra-2set\.webp'/)
  assert.match(detailSource, /'eiffel-6':\s*\{[^}]*src:\s*eiffelExtraImg/s)
  assert.match(detailSource, /'pave-100g':\s*\{[^}]*src:\s*paveExtraImg/s)
  assert.match(detailSource, /combo:\s*\{[^}]*src:\s*chocolateExtraSetImg/s)
})

test('current whole-cake sizes map every supplied cut-out to the matching product', () => {
  assert.deepEqual(sizePreviewAssets.map((asset) => Boolean(asset?.length)), [true, true, true, true])

  assert.match(detailSource, /import buttercreamSizePreviewImg from '\.\/assets\/options\/cake-size-buttercream\.webp'/)
  assert.match(detailSource, /import paveSizePreviewImg from '\.\/assets\/options\/cake-size-pave\.webp'/)
  assert.match(detailSource, /import strawberryChocolateSizePreviewImg from '\.\/assets\/options\/cake-size-strawberry-chocolate\.webp'/)
  assert.match(detailSource, /import strawberryVanillaSizePreviewImg from '\.\/assets\/options\/cake-size-strawberry-vanilla\.webp'/)
  assert.match(detailSource, /const cakeSizePreviewImages/)
  assert.match(detailSource, /getCakeSizePreviewKey\(product\.id\)/)
})

test('Cupcake pack and finish selections show the matching supplied photograph', () => {
  assert.deepEqual(cupcakePreviewAssets.map((asset) => Boolean(asset?.length)), [true, true, true, true, true, true])

  assert.match(detailSource, /import cupcake6BasicPreviewImg from '\.\/assets\/options\/cupcake-6-basic\.webp'/)
  assert.match(detailSource, /import cupcake6ChocolatePreviewImg from '\.\/assets\/options\/cupcake-6-chocolate\.webp'/)
  assert.match(detailSource, /import cupcake6VanillaPreviewImg from '\.\/assets\/options\/cupcake-6-vanilla\.webp'/)
  assert.match(detailSource, /import cupcake12BasicPreviewImg from '\.\/assets\/options\/cupcake-12-basic\.webp'/)
  assert.match(detailSource, /import cupcake12ChocolatePreviewImg from '\.\/assets\/options\/cupcake-12-chocolate\.webp'/)
  assert.match(detailSource, /import cupcake12VanillaPreviewImg from '\.\/assets\/options\/cupcake-12-vanilla\.webp'/)
  assert.match(detailSource, /const cupcakePreviewImages/)
  assert.match(detailSource, /getCupcakePreviewKey\(product\.id, selection\.cupcakeFinish\)/)
  assert.match(detailSource, /eyebrow=\{language === 'ko' \? '선택한 컵케이크' : 'Selected cupcakes'\}/)
})

test('Cupcake preview appears before Pack Size and Finish controls', () => {
  const previewIndex = detailSource.indexOf('{selectedCupcakePreview && selectedCupcakePackSize && (')
  const packSizeIndex = detailSource.indexOf('{detail.productIds.length > 1 && (')
  const finishIndex = detailSource.indexOf('{isCupcakeProduct(product.id) && (')

  assert.ok(previewIndex >= 0)
  assert.ok(previewIndex < packSizeIndex)
  assert.ok(packSizeIndex < finishIndex)
})

test('current whole-cake previews keep one frame while size and Buttercream point colour change', () => {
  assert.match(detailSource, /getCakeSizePreviewScale\(selection\.cakeSize\)/)
  assert.match(detailSource, /getCakeSizePreviewTransformOrigin\(cakeSizePreviewKey\)/)
  assert.match(detailSource, /getCakePointColorPreviewBackground\(selection\.vanillaCakePointColor\)/)
  assert.match(detailSource, /eyebrow=\{language === 'ko' \? '선택한 사이즈' : 'Selected size'\}/)
  assert.match(detailSource, /fit="contain"/)

  assert.match(cssSource, /\.cake-detail-option-preview-media\s*\{[^}]*width:\s*112px[^}]*height:\s*88px[^}]*overflow:\s*hidden/s)
  assert.match(cssSource, /\.cake-detail-option-preview-media\.is-contained img\s*\{[^}]*object-fit:\s*contain[^}]*transform:\s*scale\(var\(--cake-option-preview-scale, 1\)\)[^}]*transform-origin:\s*var\(--cake-option-preview-origin, center bottom\)/s)
  const mobileCss = cssSource.slice(cssSource.lastIndexOf('@media (max-width: 760px)'))
  assert.match(mobileCss, /\.cake-detail-option-preview-media\s*\{[^}]*width:\s*88px[^}]*height:\s*69px/s)
})

test('Lemon uses the shared compact editorial while retaining its current pack, finishing, and individual packaging controls', () => {
  assert.match(editorialDataSource, /'lemon-cake'/)
  assert.match(detailSource, /isFreshLemonCupcakeProduct\(product\.id\)/)
  assert.match(detailSource, /Dark chocolate finish pieces/)
  assert.match(detailSource, /Individual packaging/)
  assert.doesNotMatch(homeSource, /Lemon-shaped cakes filled with fresh lemon cream/)
  assert.doesNotMatch(homeSource, /레몬 모양 케이크에 상큼한 레몬 크림을 채우고/)
  assert.doesNotMatch(marketSource, /fresh lemon cream|레몬 크림/i)
  assert.doesNotMatch(i18nSource, /fresh lemon cream|레몬 크림/i)
  assert.doesNotMatch(reserveSource, /Lemon cream and floral decoration included|레몬 크림과 꽃무늬 장식 포함/)
})

test('Lemon finish quantity visually outranks its finish label', () => {
  assert.match(cssSource, /family=Work\+Sans:wght@400;700;800/)
  assert.match(cssSource, /\.cake-detail-lemon-finish-item strong\s*\{[^}]*font-size:\s*12px/s)
  assert.match(cssSource, /\.cake-detail-lemon-finish-item span\s*\{[^}]*color:\s*var\(--forest-deep\)[^}]*font-size:\s*16px[^}]*font-weight:\s*800/s)
})

test('Lemon Cake and Chocolate Cupcakes use their matching individual packaging photos', () => {
  assert.deepEqual(individualPackagingPreviewAssets.map((asset) => Boolean(asset?.length)), [true, true])
  assert.match(detailSource, /import lemonIndividualPackagingPreviewImg from '\.\/assets\/options\/individual-packaging\.webp'/)
  assert.match(detailSource, /import cupcakeIndividualPackagingPreviewImg from '\.\/assets\/options\/individual-packaging-cupcake\.webp'/)
  assert.match(detailSource, /isCupcakeProduct\(product\.id\)[\s\S]*?cupcakeIndividualPackagingPreview[\s\S]*?isFreshLemonCupcakeProduct\(product\.id\)[\s\S]*?lemonIndividualPackagingPreview/)
  assert.match(detailSource, /image=\{selectedIndividualPackagingPreview\.image\}[\s\S]*?muted=\{!selection\.individualPackaging\}/)

  const previewIndex = detailSource.indexOf('image={selectedIndividualPackagingPreview.image}')
  const checkboxIndex = detailSource.indexOf('name="individualPackaging"')
  assert.ok(previewIndex >= 0)
  assert.ok(previewIndex < checkboxIndex)
  const mutedPreviewStyle = cssSource.match(/\.cake-detail-option-preview\.is-muted img\s*\{([^}]*)\}/s)?.[1]
  assert.ok(mutedPreviewStyle)
  assert.match(mutedPreviewStyle, /filter:\s*grayscale\(1\)/)
  assert.doesNotMatch(mutedPreviewStyle, /opacity:/)
})

test('Pave editorial reuses live catalogue cards and the existing add-to-order callbacks', () => {
  assert.match(detailSource, /getAuCakeCatalogCards\(language\)/)
  assert.match(detailSource, /candidate\.slug !== slug/)
  assert.match(detailSource, /slice\(0, 2\)/)
  assert.match(detailSource, /onAddToOrder=\{addToOrder\}/)
  assert.match(editorialSource, /relatedProducts\.map/)
  assert.match(editorialSource, /product\.imagePath/)
  assert.match(editorialSource, /onAddToOrder/)
  assert.match(editorialSource, /onViewOrder/)
  assert.doesNotMatch(editorialSource, /createRoot|BrowserRouter|<html|<!doctype/i)
})

test('compact Pave uses native disclosures and does not render the retired long-form sections or a second CTA', () => {
  const disclosureStart = editorialSource.indexOf('function CompactDisclosure')
  const compactStart = editorialSource.indexOf('function CompactCakeEditorialDetail')
  const longFormStart = editorialSource.indexOf('function LongFormCakeEditorialDetail')

  assert.notEqual(disclosureStart, -1)
  assert.notEqual(compactStart, -1)
  assert.notEqual(longFormStart, -1)

  const compactSource = editorialSource.slice(disclosureStart, longFormStart)
  assert.match(compactSource, /<details>/)
  assert.match(compactSource, /<summary>/)
  assert.match(compactSource, /cake-editorial-compact-highlights/)
  assert.match(compactSource, /cake-editorial-compact-disclosures/)
  assert.match(compactSource, /<KoreanCakeReviewsSection slug=\{slug\} language=\{language\} \/>/)
  assert.match(compactSource, /relatedProducts\.map/)
  assert.doesNotMatch(compactSource, /cake-editorial-(?:lifestyle|moments|inside|taste|ordering|gift|final)/)
  assert.doesNotMatch(compactSource, /onAddToOrder|onViewOrder/)
})

test('compact Pave places its ordering and pick-up notice below Add to order instead of below the highlights', () => {
  const requestStart = detailSource.indexOf('cake-detail-request')
  const orderingNoticeStart = detailSource.indexOf('cake-detail-ordering-notice')

  assert.notEqual(requestStart, -1)
  assert.notEqual(orderingNoticeStart, -1)
  assert.ok(orderingNoticeStart > requestStart)
  assert.match(detailSource, /ORDERING & PICK-UP/)
  assert.match(detailSource, /주문 및 픽업 안내/)
  assert.doesNotMatch(editorialSource, /cake-editorial-compact-notice/)
})

test('compact Pave ordering and pick-up notice uses the mint surface with only a forest left rail', () => {
  assert.match(cssSource, /\.cake-detail-ordering-notice\s*\{[^}]*border:\s*0/s)
  assert.match(cssSource, /\.cake-detail-ordering-notice\s*\{[^}]*border-left:\s*4px solid var\(--forest\)/s)
  assert.match(cssSource, /\.cake-detail-ordering-notice\s*\{[^}]*background:\s*var\(--cream-teal\)/s)
  assert.match(cssSource, /\.cake-detail-ordering-notice-label\s*\{[^}]*color:\s*var\(--forest\)/s)
  assert.match(cssSource, /\.cake-detail-ordering-notice\s+strong\s*\{[^}]*font-size:\s*16px/s)
})

test('compact Pave keeps all three Quick Facts in columns on narrow screens', () => {
  const mobileCss = cssSource.slice(cssSource.lastIndexOf('@media (max-width: 760px)'))

  assert.match(mobileCss, /\.cake-editorial-compact-highlights\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s)
  assert.match(mobileCss, /\.cake-editorial-compact-highlights article\s*\{[^}]*border-right:\s*1px solid var\(--border\)/s)
  assert.match(mobileCss, /\.cake-editorial-compact-highlights article:last-child\s*\{[^}]*border-right:\s*0/s)
  assert.doesNotMatch(mobileCss, /\.cake-editorial-compact-highlights article\s*\{[^}]*border-bottom:\s*1px solid var\(--border\)/s)
})

test('editorial styles remain isolated from protected detail and operational controls', () => {
  assert.match(cssSource, /\.cake-editorial-/)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.cake-editorial-/)
  assert.match(editorialSource, /const hasGiftImages = editorial\.giftPresentation\.imageKeys\.length > 0/)
  assert.match(editorialSource, /cake-editorial-gift' \+ \(hasGiftImages \? '' : ' is-text-only'\)/)
  assert.match(cssSource, /\.cake-editorial-gift\.is-text-only\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s)
  assert.match(cssSource, /\.cake-editorial-gift-images img\s*\{[^}]*height:\s*auto/s)
  assert.match(cssSource, /\.cake-editorial-related-grid img\s*\{[^}]*height:\s*auto/s)
  assert.doesNotMatch(editorialSource, /isIndividualPackagingEligibleProduct|getCakeDetailSelectionEstimatedTotal|useCart/)
})

test('review carousel identifies the source as our store in Korea without naming Daegu', () => {
  assert.match(reviewSource, /REVIEWS FROM OUR STORE IN KOREA/)
  assert.match(reviewSource, /한국 매장 고객 후기/)
  assert.match(reviewSource, /Reviews from our store in Korea/)
  assert.match(reviewSource, /Korean is shown as posted with an English translation/)
  assert.match(reviewSource, /products and availability may differ in Sydney/)
  assert.match(reviewSource, /한국어 원문은 게시된 그대로 표시하며 영어 번역을 함께 제공합니다/)
  assert.match(reviewSource, /시드니의 제품과 판매 여부는 다를 수 있습니다/)
  assert.doesNotMatch(reviewSource, /Daegu|대구/)
  assert.match(reviewDataSource, /source: 'Store in Korea'/)
  assert.doesNotMatch(reviewDataSource, /translationEn:[^\n]*Daegu/)
})

test('each compact card discloses bilingual order context before complete Korean and English text', () => {
  assert.match(reviewSource, /korean-cake-review-context/)
  assert.match(reviewSource, /lang="ko"[^>]*>\{review\.orderContextKo\}/)
  assert.match(reviewSource, /lang="en-AU"[^>]*>\{review\.orderContextEn\}/)
  assert.match(reviewSource, /lang="ko"[^>]*>\{review\.originalKo\}/)
  assert.match(reviewSource, /korean-cake-review-divider/)
  assert.match(reviewSource, /lang="en-AU"[^>]*>\{review\.translationEn\}/)
  assert.match(reviewSource, /<time dateTime=\{review\.reviewDate\}/)
  assert.match(reviewSource, /aria-label=\{`\$\{language === 'ko' \? '후기' : 'Review'\} \$\{index \+ 1\} \/ \$\{reviews\.length\}`\}/)
  assert.match(reviewSource, /Store in Korea/)
  assert.doesNotMatch(reviewSource, /PublicReviewCard|PublicReviewDialog|<img|username|platform|stars|rating|score|Verified order|Incentivised review/)
})

test('customer-facing order and class copy assigns confirmation and handoff to our team', () => {
  const customerCopy = [
    detailSource,
    editorialDataSource,
    cakeDetailDataSource,
    cartSource,
    homeSource,
    i18nSource,
    marketSource,
  ].join('\n')

  assert.match(customerCopy, /our team/)
  assert.match(customerCopy, /베리굿 팀/)
  assert.doesNotMatch(customerCopy, /\bJenny\b|Jenny가/)
})

test('compact review cards keep restrained type, padding, and hidden scrollbars', () => {
  assert.match(cssSource, /\.korean-cake-reviews-track\s*\{[^}]*scrollbar-width:\s*none/s)
  assert.match(cssSource, /\.korean-cake-reviews-track::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
  assert.match(cssSource, /\.korean-cake-review blockquote\s*\{[^}]*padding:\s*16px 14px/s)
  assert.match(cssSource, /\.korean-cake-review blockquote\[lang='ko'\]\s*\{[^}]*font-size:\s*14px[^}]*line-height:\s*1\.55/s)
  assert.match(cssSource, /\.korean-cake-review blockquote\[lang='en-AU'\]\s*\{[^}]*font-size:\s*16px[^}]*line-height:\s*1\.36/s)
  assert.doesNotMatch(cssSource, /@media \(max-width: 760px\)[\s\S]*\.korean-cake-review blockquote\[lang='en-AU'\]\s*\{[^}]*font-size:\s*19px/s)
})

test('carousel has accessible 44px previous and next controls with boundary state', () => {
  assert.match(reviewSource, /aria-label="Previous Korean review"/)
  assert.match(reviewSource, /aria-label="Next Korean review"/)
  assert.match(reviewSource, /disabled=\{start === 0\}/)
  assert.match(reviewSource, /disabled=\{start >= maxStart\}/)
  assert.match(reviewSource, /getReviewRangeLabel\(start, reviews\.length, visibleCount\)/)
  assert.match(cssSource, /\.korean-cake-reviews-control[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s)
  assert.match(cssSource, /\.korean-cake-reviews-control:focus-visible/)
})

test('desktop carousel shows three columns in 1040px with 16px gaps and scroll snap', () => {
  assert.match(cssSource, /\.korean-cake-reviews\s*\{[^}]*max-width:\s*1040px/s)
  assert.match(cssSource, /\.korean-cake-reviews-track\s*\{[^}]*display:\s*grid[^}]*grid-auto-flow:\s*column[^}]*grid-auto-columns:\s*calc\(\(100% - 32px\) \/ 3\)[^}]*gap:\s*16px[^}]*overflow-x:\s*auto[^}]*scroll-snap-type:\s*x mandatory/s)
  assert.match(cssSource, /\.korean-cake-review\s*\{[^}]*scroll-snap-align:\s*start/s)
  assert.match(cssSource, /\.korean-cake-reviews-header-controls\.is-static\s*\{[^}]*display:\s*none/s)
})

test('mobile carousel shows one card, keeps controls below, and cannot widen the document', () => {
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.korean-cake-reviews\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s)
  assert.match(cssSource, /\.korean-cake-reviews-heading h2\s*\{[^}]*scroll-margin-top:\s*52px/s)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.korean-cake-reviews-track\s*\{[^}]*grid-auto-columns:\s*100%/s)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.korean-cake-reviews-header-controls\s*\{[^}]*display:\s*none/s)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.korean-cake-reviews-mobile-controls\s*\{[^}]*display:\s*flex/s)
  assert.match(cssSource, /\.korean-cake-reviews-viewport\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/s)
})

test('carousel uses track-relative card coordinates for controls and native swipe state', () => {
  assert.match(reviewSource, /function getTrackRelativeLeft\(track: HTMLElement, card: HTMLElement\)/)
  assert.match(reviewSource, /card\.getBoundingClientRect\(\)\.left - track\.getBoundingClientRect\(\)\.left \+ track\.scrollLeft/)
  assert.match(reviewSource, /track\.scrollTo\(\{ left: getTrackRelativeLeft\(track, target\)/)
  assert.match(reviewSource, /Math\.abs\(getTrackRelativeLeft\(track, card\) - track\.scrollLeft\)/)
  assert.doesNotMatch(reviewSource, /\.offsetLeft/)
})

test('carousel has native swipe without autoplay or decorative review claims and respects reduced motion', () => {
  assert.match(reviewSource, /onScroll=\{handleScroll\}/)
  assert.match(reviewSource, /scrollTo\(/)
  assert.doesNotMatch(reviewSource, /setInterval|setTimeout|autoplay|carousel-dot|Verified|aggregate|rating|score/)
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.korean-cake-reviews-track\s*\{[^}]*scroll-behavior:\s*auto/s)
})

test('detail add-to-order contract is controlled by App and never reaches into cart context', () => {
  assert.match(detailSource, /onAddToOrder: \(selection: CakeDetailSelection\) => void/)
  assert.match(detailSource, /onViewOrder: \(\) => void/)
  assert.doesNotMatch(detailSource, /\bonRequest\b/)
  assert.doesNotMatch(detailSource, /\buseCart\b/)
  assert.match(appSource, /add: addCartLine/)
  assert.match(appSource, /<CakeDetailPage[\s\S]*onAddToOrder=\{addCartLine\}[\s\S]*onViewOrder=\{\(\) => navigate\(['"]cart['"]\)\}/)
  assert.doesNotMatch(appSource, /requestCakeSelection/)
})

test('adding shows exact bilingual status and View order action', () => {
  assert.match(detailSource, /const \[addedToOrder, setAddedToOrder\] = useState\(false\)/)
  assert.match(detailSource, /function addToOrder\(\) \{[\s\S]*onAddToOrder\(selection\)[\s\S]*setAddedToOrder\(true\)[\s\S]*\}/)
  assert.match(detailSource, /Add to order/)
  assert.match(detailSource, /주문에 담기/)
  assert.match(detailSource, /Added to your order\./)
  assert.match(detailSource, /주문에 담았어요\./)
  assert.match(detailSource, /View order/)
  assert.match(detailSource, /주문 보기/)
  assert.match(detailSource, /className="cake-detail-added"[\s\S]*role="status"[\s\S]*onClick=\{onViewOrder\}/)
})

test('added feedback resets whenever options, quantity, or product variant changes', () => {
  assert.match(detailSource, /function updateSelection\([\s\S]*setAddedToOrder\(false\)[\s\S]*setSelection/)
  assert.match(detailSource, /function chooseProduct\([\s\S]*setAddedToOrder\(false\)[\s\S]*setSelection/)
  assert.match(detailSource, /onClick=\{\(\) => updateSelection\(\{ quantity: selection\.quantity - 1 \}\)\}/)
  assert.match(detailSource, /onClick=\{\(\) => updateSelection\(\{ quantity: selection\.quantity \+ 1 \}\)\}/)
})

test('detail template has explicit narrow-screen layout and accessible controls', () => {
  assert.match(detailSource, /aria-live="polite"/)
  assert.match(detailSource, /aria-pressed=/)
  assert.match(detailSource, /aria-label=/)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.cake-detail-hero/)
  assert.match(cssSource, /\.cake-detail-option:focus-visible/)
})

test('Chocolate Extras are separate compact purchase controls, not cake toppings or retired Eiffel finishes', () => {
  assert.match(chocolateExtrasSource, /'eiffel-6'/)
  assert.match(chocolateExtrasSource, /'pave-100g'/)
  assert.match(chocolateExtrasSource, /'combo'/)
  assert.match(chocolateExtrasSource, /Rich, smooth pavé chocolate to enjoy by the spoonful/)
  assert.match(chocolateExtrasSource, /부드럽고 진한 파베 초콜릿을 그대로 떠먹거나/)
  assert.doesNotMatch(chocolateExtrasSource, /topping|cake decoration|on top of the cake/i)
  assert.match(detailSource, /CHOCOLATE_EXTRA_OPTIONS\.map/)
  assert.doesNotMatch(chocolateExtrasSource, /eiffel-tower-brownie-cheesecake/)
  assert.match(detailSource, /CHOCOLATE EXTRAS/)
  assert.match(detailSource, /초콜릿 추가 구성/)
  assert.match(reserveSource, /CHOCOLATE_EXTRA_OPTIONS\.map/)
  assert.match(reserveSource, /chocolateExtra: form\.chocolateExtra/)
  assert.match(reserveSource, /chocolateExtra: selection\.chocolateExtra/)
  assert.match(cartSource, /formatChocolateExtra/)
})
