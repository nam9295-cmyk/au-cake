import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const cakesSource = await readFile(new URL('../src/CakesPage.tsx', import.meta.url), 'utf8')

test('Home and cakes page render the same four groups from the shared AU cake catalogue', () => {
  assert.match(homeSource, /getAuCakeCatalogGroups\(language\)/)
  assert.match(cakesSource, /getAuCakeCatalogGroups\(language\)/)
  assert.doesNotMatch(homeSource, /const catalogCards = \[/)
  assert.doesNotMatch(homeSource, /\['pave',\s*'buttercream'/)
  assert.doesNotMatch(cakesSource, /\['pave',\s*'buttercream'/)
})

test('AU Home starts with the numbered cake groups while the Korean market keeps its section heading', () => {
  assert.match(
    homeSource,
    /\{marketConfig\.market !== 'AU' && \(\s*<h2>\{copy\.productSectionTitle\}<\/h2>\s*\)\}/,
  )
})

test('catalogue cards render their canonical image paths', () => {
  assert.match(homeSource, /src=\{card\.imagePath\}/)
  assert.match(cakesSource, /src=\{card\.imagePath\}/)
  assert.doesNotMatch(cakesSource, /cakeListImages/)
  assert.match(homeSource, /card\.isPhotoComingSoon/)
})

test('Home photo-pending catalogue cards render a visible placeholder without an image request', () => {
  assert.match(homeSource, /card\.isPhotoComingSoon \? \([\s\S]*<VanillaFreshCreamCakeSilhouette productName=\{card\.name\} \/>/s)
  assert.doesNotMatch(homeSource, /card\.isPhotoComingSoon \? null/)
})

test('photo-pending silhouettes use the actual product name in their accessible label', async () => {
  const chromeSource = await readFile(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
  const dialogSource = await readFile(new URL('../src/ProductQuickViewDialog.tsx', import.meta.url), 'utf8')
  const reserveSource = await readFile(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')

  assert.match(chromeSource, /function VanillaFreshCreamCakeSilhouette\(\{ productName \}/)
  assert.match(chromeSource, /aria-label=\{`\$\{productName\} photo coming soon`\}/)
  assert.match(dialogSource, /<VanillaFreshCreamCakeSilhouette productName=\{card\.name\} \/>/)
  assert.match(reserveSource, /<VanillaFreshCreamCakeSilhouette productName=\{selectedProductText\.name\} \/>/)
})

test('cake catalogue renders canonical English route copy', () => {
  assert.match(cakesSource, /getPublicRoutePage\('\/cakes'\)/)
  assert.match(cakesSource, /publicPage\.h1/)
  assert.match(cakesSource, /publicPage\.intro/)
})

test('new Lemon Cake catalogue photo is also used in the home hero', () => {
  assert.match(homeSource, /image:\s*getPublicCakePage\('lemon-cake'\)\?\.imagePath/)
  assert.doesNotMatch(homeSource, /import freshLemonCupcakesHeroImg/)
})

test('home hero uses the current canonical Signature and Brownie product photographs', () => {
  assert.match(homeSource, /getAuHomeHeroCards\(language\)\n\s*\.filter\(\(card\) => !card\.isPhotoComingSoon\)/)
  assert.match(homeSource, /const \[activeHeroCake, setActiveHeroCake\] = useState\(\(\) => marketConfig\.market === 'AU' \? 0 : 1\)/)
  assert.match(homeSource, /\.map\(\(card\) => \(\{[\s\S]*?label: card\.name/)
  assert.match(homeSource, /heroVisuals\[card\.imageKey\]\?\.image \|\| card\.imagePath/)
  assert.match(homeSource, /'pave-cake': \{ image: heroCake2Img/)
  assert.match(homeSource, /'signature-gateau-au-chocolat': \{ image: '\/products\/signature-gateau-au-chocolat-sydney\.webp'/)
  assert.match(homeSource, /'brownie-cheesecake': \{ image: '\/products\/brownie-cheesecake-sydney\.webp'/)
  assert.match(homeSource, /image: '\/products\/signature-gateau-au-chocolat-sydney\.webp', label: 'Signature Gâteau au Chocolat'/)
  assert.match(homeSource, /image: '\/products\/brownie-cheesecake-sydney\.webp', label: 'Brownie Cheesecake'/)
  assert.doesNotMatch(homeSource, /heroCake3Img|brownie-cheese-sydney\.webp/)
  assert.doesNotMatch(homeSource, /label: 'Vanilla Fresh Cream Cake'|vanillacake-hero/)
  assert.match(homeSource, /window\.setInterval\([\s\S]*?\}, 3000\)/)
})

test('quick view uses dedicated replaceable detail-shot files', () => {
  assert.match(homeSource, /'pound-cake':\s*'\/products\/details\/chocolate-pound-cake-quick-view\.webp'/)
  assert.match(homeSource, /'pave-cake':\s*'\/products\/details\/pave-chocolate-cake-quick-view\.webp'/)
  assert.match(homeSource, /'basque-cheesecake':\s*'\/products\/details\/chocolatiers-basque-cheesecake-quick-view\.webp'/)
  assert.match(homeSource, /'lemon-cake':\s*'\/products\/details\/lemon-cake-quick-view\.webp'/)
  assert.match(homeSource, /'vanilla-fresh-cream-cake':\s*'\/products\/details\/vanillacake-quickview\.webp'/)
  assert.match(homeSource, /'buttercream-cake':\s*'\/products\/details\/buttercream-cake-quick-view\.webp'/)
  assert.match(homeSource, /'fresh-strawberry-vanilla-cream-cake':\s*'\/products\/details\/fresh-strawberry-vanilla-cream-cake-detail-01\.webp'/)
  assert.match(homeSource, /'fresh-strawberry-chocolate-cream-cake':\s*'\/products\/details\/fresh-strawberry-chocolate-cream-cake-detail-01\.webp'/)
  assert.match(homeSource, /'chocolate-cupcakes':\s*'\/products\/details\/chocolate-cupcakes2-sydney\.webp'/)
  assert.match(homeSource, /'brownie-cheesecake':\s*'\/products\/details\/brownie-cheese-quick-view\.webp'/)
  assert.match(homeSource, /imageUrl=\{quickViewImages\[quickViewCard\.imageKey\]\}/)
})

test('new catalogue photos and previous detail photos use descriptive canonical files', async () => {
  const catalogSource = await readFile(new URL('../src/lib/cake-catalog.ts', import.meta.url), 'utf8')
  const cakeDetailSource = await readFile(new URL('../src/lib/cake-detail.ts', import.meta.url), 'utf8')
  const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
  const publicContent = await readFile(new URL('../src/content/au-public-pages.json', import.meta.url), 'utf8')

  assert.match(catalogSource, /id: 'brownie-cheesecake',[\s\S]*?isPhotoComingSoon: false/)
  assert.match(catalogSource, /id: 'buttercream',[\s\S]*?isPhotoComingSoon: false/)
  assert.match(cakeDetailSource, /buttercream: \['buttercream-side', 'buttercream-detail', 'buttercream-quick-view'\]/)
  assert.match(detailSource, /'buttercream-side': '\/products\/buttercream-cake-sydney\.webp'/)
  assert.match(detailSource, /'buttercream-detail': '\/products\/details\/buttercream-cake-detail-01\.webp'/)
  assert.match(detailSource, /'buttercream-quick-view': '\/products\/details\/buttercream-cake-quick-view\.webp'/)
  assert.match(publicContent, /"buttercream-cake": \{[\s\S]*?"imagePath": "\/products\/buttercream-cake-sydney\.webp"/)
  assert.match(detailSource, /'cupcake-detail': '\/products\/details\/chocolate-cupcakes-detail-01\.webp'/)
  assert.match(detailSource, /'signature-gateau-side': '\/products\/signature-gateau-au-chocolat-sydney\.webp'/)
  assert.match(detailSource, /'signature-gateau-detail': '\/products\/details\/signature-gateau-au-chocolat-detail-01\.webp'/)
  assert.match(detailSource, /'signature-gateau-previous': '\/products\/details\/signature-gateau-au-chocolat-previous-main\.webp'/)
  assert.match(detailSource, /'brownie-side': '\/products\/brownie-cheesecake-sydney\.webp'/)
  assert.match(detailSource, /'brownie-detail': '\/products\/details\/brownie-cheesecake-detail-01\.webp'/)
  assert.match(detailSource, /'brownie-quick-view': '\/products\/details\/brownie-cheese-quick-view\.webp'/)
  assert.match(detailSource, /'brownie-side': \{ width: 1080, height: 1012 \}/)
  assert.match(detailSource, /'brownie-quick-view': \{ width: 1080, height: 1012 \}/)
  assert.match(publicContent, /"signature-gateau-au-chocolat": \{[\s\S]*?"imagePath": "\/products\/signature-gateau-au-chocolat-sydney\.webp"/)
  assert.match(publicContent, /"brownie-cheesecake": \{[\s\S]*?"imagePath": "\/products\/brownie-cheesecake-sydney\.webp"/)
})

test('new catalogue and preserved detail WebPs are present in this worktree', async () => {
  for (const path of [
    '../public/products/signature-gateau-au-chocolat-sydney.webp',
    '../public/products/chocolate-cupcakes-sydney.webp',
    '../public/products/buttercream-cake-sydney.webp',
    '../public/products/brownie-cheesecake-sydney.webp',
    '../public/products/details/signature-gateau-au-chocolat-detail-01.webp',
    '../public/products/details/signature-gateau-au-chocolat-previous-main.webp',
    '../public/products/details/chocolate-cupcakes-detail-01.webp',
    '../public/products/details/buttercream-cake-detail-01.webp',
    '../public/products/details/brownie-cheesecake-detail-01.webp',
  ]) {
    const image = await stat(new URL(path, import.meta.url))
    assert.ok(image.size > 0, path)
  }

  await assert.rejects(stat(new URL('../public/products/brownie-cheese-sydney.webp', import.meta.url)))
})

test('every catalogue category keeps its two products in a flexible two-column grid', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.cake-catalog-group-products\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.cake-catalog-group-products\s*\{[^}]*gap:\s*1[02]px/s)
  assert.doesNotMatch(css, /\.cake-catalog-group-products\s*\{[^}]*width:\s*\d+px/s)
})

test('home catalogue cards show only image, title, price, and one action', async () => {
  assert.match(homeSource, /className="product-card-quick-view"/)
  assert.match(homeSource, /aria-haspopup="dialog"/)
  assert.match(homeSource, /className="product-card-title"/)
  assert.match(homeSource, /className="product-card-price"/)
  assert.match(homeSource, /className="product-card-detail-link"/)
  assert.match(homeSource, /href={\`\/cakes\/\${card\.slug}\`}/)
  assert.doesNotMatch(homeSource, /className="secondary-button full-width"/)
  assert.doesNotMatch(homeSource, /card\.features\.map/)
  assert.doesNotMatch(homeSource, /<dt>\{copy\.options\}<\/dt>/)
})

test('AU homepage catalogue keeps its matched desktop and mobile card-to-cake proportions', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(homeSource, /const AU_CATALOG_GROUP_MARKERS/)
  assert.match(homeSource, /className="cake-catalog-group-marker"/)
  assert.match(homeSource, /src={AU_CATALOG_GROUP_MARKERS\[group\.id\]}/)
  assert.match(homeSource, /className=\{'product-card cake-catalog-card cake-catalog-card-' \+ card\.id\}/)
  assert.match(css, /\.cake-catalog-card-pave\s*\{[^}]*--catalogue-card-color:\s*#F19FA8/s)
  assert.match(css, /\.cake-catalog-card-buttercream\s*\{[^}]*--catalogue-card-color:\s*#B9D2A8/s)
  assert.match(css, /\.product-section \.cake-catalog-groups\s*\{[^}]*gap:\s*clamp\(210px, 28vw, 300px\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-header\s*\{[^}]*margin-bottom:\s*clamp\(48px, 5vw, 64px\)/s)
  assert.match(css, /\.product-section \.cake-catalog-group-products \.product-image-wrap\s*\{[^}]*height:\s*clamp\(380px, 46vw, 641px\)/s)
  assert.match(css, /\.product-section \.cake-catalog-group-products \.product-image-wrap\s*\{[^}]*background:\s*transparent/s)
  assert.match(css, /\.product-section \.cake-catalog-group-products \.cake-catalog-card \.product-image-wrap::before\s*\{[^}]*width:\s*min\(92%, 40vw, 560px\)[^}]*aspect-ratio:\s*427 \/ 489[^}]*background:\s*var\(--catalogue-card-color\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-image-wrap\s*\{[^}]*height:\s*clamp\(330px, 34\.4vw, 481px\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.cake-catalog-card \.product-image-wrap::before\s*\{[^}]*width:\s*min\(92%, clamp\(288px, 30vw, 420px\)\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-image-wrap img:not\(\.gluten-free-stamp\)\s*\{[^}]*top:\s*60px[^}]*width:\s*min\(72%, 375px\)[^}]*max-height:\s*315px[^}]*transform:\s*scale\(1\.15\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.cake-catalog-card-cupcake \.product-image-wrap img:not\(\.gluten-free-stamp\)\s*\{[^}]*top:\s*84px/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-image-wrap\s*\{[^}]*aspect-ratio:\s*427 \/ 489[^}]*background:\s*var\(--catalogue-card-color\)/s)
  assert.match(css, /\.product-section \.cake-catalog-group-header\s*>\s*div\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/s)
  assert.match(css, /\.cake-catalog-group-marker\s*\{[^}]*z-index:\s*0[^}]*animation:\s*cake-catalog-marker-wiggle\s+7s/s)
  assert.match(css, /\.cake-catalog-group-marker\s*\{[^}]*margin-top:\s*-25px/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.cake-catalog-group-marker\s*\{[^}]*margin-top:\s*-18px/s)
  assert.match(css, /@keyframes cake-catalog-marker-wiggle\s*\{[\s\S]*?transform:\s*rotate\(-3\.5deg\)[\s\S]*?transform:\s*rotate\(3\.5deg\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-detail-link,\s*\.product-section \.cake-catalog-group-products \.product-card-price\s*\{[^}]*width:\s*min\(92%, 40vw, 560px\)[^}]*margin-inline:\s*auto/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card\s*\{[^}]*gap:\s*6px/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-quick-view\s*\{[^}]*margin-bottom:\s*8px/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-detail-link\s*\{[^}]*gap:\s*2px/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-kicker\s*\{[^}]*font-size:\s*13px/s)
  assert.match(css, /\.product-card \.product-card-title\s*\{[^}]*font-family:\s*var\(--font-sans\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-title\s*\{[^}]*min-height:\s*2\.2em[^}]*font-size:\s*clamp\(18px, 2vw, 22px\)[^}]*line-height:\s*1\.1/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-card-price\s*\{[^}]*margin-top:\s*0[^}]*font-size:\s*clamp\(20px, 2vw, 24px\)/s)
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-header p\s*\{[^}]*max-width:\s*none[^}]*white-space:\s*nowrap/s)
  assert.match(css, /@media \(hover: hover\)[\s\S]*?\.product-card-detail-link:hover\s*\{[^}]*color:\s*var\(--berry-emphasis\)/s)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.cake-catalog-group-marker\s*\{[^}]*animation-duration:\s*0\.01ms/s)
})

test('cake quick view is an accessible portal dialog with concise content and detail handoff', async () => {
  const dialogSource = await readFile(new URL('../src/ProductQuickViewDialog.tsx', import.meta.url), 'utf8')

  assert.match(homeSource, /<ProductQuickViewDialog/)
  assert.match(dialogSource, /createPortal/)
  assert.match(dialogSource, /role="dialog"/)
  assert.match(dialogSource, /aria-modal="true"/)
  assert.match(dialogSource, /aria-labelledby/)
  assert.match(dialogSource, /aria-describedby/)
  assert.match(dialogSource, /event\.key === 'Escape'/)
  assert.match(dialogSource, /event\.key === 'Tab'/)
  assert.match(dialogSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(dialogSource, /opener\?\.focus/)
  assert.match(dialogSource, /card\.description/)
  assert.match(dialogSource, /card\.features\.slice\(0, 3\)/)
  assert.match(dialogSource, /onChooseOptions/)
})

test('cake quick view floats as a compact animated product card on desktop and mobile', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.product-quick-view-backdrop/)
  assert.match(css, /\.product-quick-view-dialog/)
  assert.match(css, /\.product-quick-view-layout/)
  assert.match(css, /\.product-card-quick-view/)
  assert.match(css, /\.product-quick-view-dialog\s*\{[^}]*width:\s*min\(720px,\s*calc\(100% - 40px\)\)/s)
  assert.match(css, /animation:\s*product-quick-view-backdrop-in\s+420ms/)
  assert.match(css, /animation:\s*product-quick-view-card-in\s+620ms/)
  assert.match(css, /@keyframes product-quick-view-card-in/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-dialog\s*\{[^}]*width:\s*calc\(100% - 28px\)[^}]*max-height:\s*calc\(100dvh - 24px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.product-quick-view-backdrop,[\s\S]*\.product-quick-view-dialog\s*\{[^}]*animation-duration:\s*0\.01ms/)

  const backdropRules = [...css.matchAll(/\.product-quick-view-backdrop\s*\{([^}]*)\}/g)].map((match) => match[1])
  assert.ok(backdropRules.length >= 2, 'desktop and mobile quick view backdrops must both be explicit')
  assert.ok(backdropRules.every((rule) => !rule.includes('rgba(22, 67, 52')), 'quick view backdrop must not tint the page green')
  assert.match(backdropRules[0], /background:\s*rgba\(54, 54, 54, 0\.16\)/)
  assert.match(backdropRules[1], /background:\s*rgba\(54, 54, 54, 0\.14\)/)

  const desktopContent = css.match(/\.product-quick-view-content\s*\{[^}]*padding:\s*(\d+)px\s+\d+px\s+(\d+)px;/)
  assert.ok(desktopContent, 'desktop quick view content needs explicit compact vertical padding')
  assert.ok(Number(desktopContent[1]) <= 40, 'floating card needs compact desktop top padding')
  assert.ok(Number(desktopContent[2]) <= 28, 'floating card needs compact desktop bottom padding')
})

test('quick view photography fills its frame and mobile copy stays compact', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.product-quick-view-image-wrap\s*>\s*img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*max-height:\s*none[^}]*object-fit:\s*cover/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-image-wrap\s*\{[^}]*height:\s*min\(42dvh,\s*320px\)[^}]*min-height:\s*240px[^}]*max-height:\s*320px/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-content\s*\{[^}]*padding:\s*16px 14px calc\(16px \+ env\(safe-area-inset-bottom\)\)/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-description\s*\{[^}]*font-size:\s*12px[^}]*line-height:\s*1\.35/s)
  assert.doesNotMatch(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-image-wrap > img\s*\{[^}]*width:\s*min\(76%,\s*280px\)/s)
})

test('mobile cake catalogue cards reduce copy without changing the public source', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.cakes-index-card-description,\s*\.cakes-index-card-option\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.cakes-index-copy h3\s*\{[^}]*overflow-wrap:\s*anywhere/s)
})

test('mobile Home and cakes catalogue photography keeps a balanced cutout size in each two-column card', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-image-wrap img\s*\{[^}]*width:\s*115%[^}]*max-width:\s*none[^}]*max-height:\s*166px/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.cakes-index-image img\s*\{[^}]*padding:\s*0/s)
})

test('Home catalogue gives its price prefix and amount separate visual emphasis', () => {
  assert.match(homeSource, /className="product-card-price-prefix"/)
  assert.match(homeSource, /className="product-card-price-number"/)
})

test('desktop catalogue photography sits lower with the larger Daily Gâteau product scale', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.product-section \.cake-catalog-group-products \.product-image-wrap img:not\(\.gluten-free-stamp\)\s*\{[^}]*top:\s*\d+px[^}]*transform:\s*scale\([\d.]+\)/s)
  assert.match(css, /\.product-section \.cake-catalog-group-products \.cake-catalog-card-signature-gateau \.product-image-wrap img:not\(\.gluten-free-stamp\),\s*\.product-section \.cake-catalog-group-products \.cake-catalog-card-cupcake \.product-image-wrap img:not\(\.gluten-free-stamp\)\s*\{[^}]*transform:\s*scale\(1\.22\)/s)
  assert.match(css, /\.product-section \.cake-catalog-group-products \.cake-catalog-card-cupcake \.product-image-wrap img:not\(\.gluten-free-stamp\)\s*\{[^}]*top:\s*\d+px/s)
})
