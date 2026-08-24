import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
const editorialSource = await readFile(new URL('../src/CakeEditorialDetail.tsx', import.meta.url), 'utf8').catch(() => '')
const reserveSource = await readFile(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const reviewSource = await readFile(new URL('../src/KoreanCakeReviewsSection.tsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

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
  assert.match(detailSource, /AUD 0\.50 per piece · FREE for 100\+ pieces/)
  assert.match(reserveSource, /isIndividualPackagingEligibleProduct\(selectedProduct\.id\)/)
  assert.match(reserveSource, /name="individualPackaging"/)
})

test('new cream-cake order forms hide retired flavour controls and share point colours with Buttercream', () => {
  assert.doesNotMatch(detailSource, /VANILLA_CAKE_FLAVOR_OPTIONS\.map/)
  assert.doesNotMatch(reserveSource, /name="vanillaCakeFlavor"/)
  assert.match(detailSource, /isCakePointColorProduct\(product\.id\)/)
  assert.match(reserveSource, /isCakePointColorProduct\(selectedProduct\.id\)/)
  assert.match(detailSource, /isButtercreamCakeProduct\(product\.id\)[\s\S]*?'케이크 컬러 선택'[\s\S]*?'Choose a cake colour'/)
  assert.match(reserveSource, /isButtercreamCakeProduct\(selectedProduct\.id\)[\s\S]*?'케이크 컬러 선택'[\s\S]*?'Choose a cake colour'/)
  assert.match(detailSource, /aria-label=\{language === 'ko'[\s\S]*?isButtercreamCakeProduct\(product\.id\)[\s\S]*?'케이크 컬러'[\s\S]*?isButtercreamCakeProduct\(product\.id\)[\s\S]*?'cake colour'/)
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
  assert.doesNotMatch(detailSource, /VanillaDetailPage|VanillaEditorialDetail/)
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

test('review carousel uses the approved bilingual heading and compact Daegu disclosure', () => {
  assert.match(reviewSource, /REVIEWS FROM OUR DAEGU STORE/)
  assert.match(reviewSource, /대구 매장 고객 후기/)
  assert.match(reviewSource, /Korean is shown as posted with an English translation/)
  assert.match(reviewSource, /products and availability may differ in Sydney/)
  assert.match(reviewSource, /한국어 원문은 게시된 그대로 표시하며 영어 번역을 함께 제공합니다/)
  assert.match(reviewSource, /시드니의 제품과 판매 여부는 다를 수 있습니다/)
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
  assert.match(reviewSource, /Daegu store, Korea/)
  assert.doesNotMatch(reviewSource, /PublicReviewCard|PublicReviewDialog|<img|username|platform|stars|rating|score|Verified order|Incentivised review/)
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
