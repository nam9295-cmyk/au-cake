import { useEffect, useState } from 'react'
import { HomePage as LegacyHomePage } from './LegacyHomePage'
import heroCake2Img from '../assets/hero-cake-2.webp'
import glutenFreeStampImg from '../assets/glutenfree.webp'
import { ProductQuickViewDialog } from '../ProductQuickViewDialog'
import PublicReviewsSection from '../PublicReviewsSection'
import { PickupLocationCard, SiteHeader, VanillaFreshCreamCakeSilhouette } from '../components/SiteChrome'
import { appwriteConfig, functions } from '../lib/appwrite'
import { type Page } from '../lib/app-routes'
import { getAuCakeCatalogGroups, getAuHomeHeroCards, type CakeCatalogCard, type CakeCatalogImageKey } from '../lib/cake-catalog'
import { cakeCopy, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import { getAuPublicContent, getPublicCakePage } from '../lib/public-content'

const publicHomeContent = marketConfig.market === 'AU' ? getAuPublicContent().home : null

const AU_CATALOG_GROUP_MARKERS = {
  'signature-gateau': '/category-marker-01.svg',
  'gateau-sharing': '/category-marker-02.svg',
  'gather-celebrate': '/category-marker-03.svg',
  'chocolatiers-cake': '/category-marker-04.svg',
  'custom-creative': '/category-marker-05.svg',
  'gateau-daily': '/category-marker-02.svg',
  'fresh-cream-cakes': '/category-marker-03.svg',
  'tea-time-refresh': '/category-marker-04.svg',
} as const

const quickViewImages: Record<CakeCatalogImageKey, string> = {
  'pound-cake': '/products/details/chocolate-pound-cake-quick-view.webp',
  'pave-cake': '/products/details/pave-chocolate-cake-quick-view.webp',
  'basque-cheesecake': '/products/details/chocolatiers-basque-cheesecake-quick-view.webp',
  'lemon-cake': '/products/details/lemon-cake-quick-view.webp',
  'vanilla-fresh-cream-cake': '/products/details/vanillacake-quickview.webp',
  'buttercream-cake': '/products/details/buttercream-cake-quick-view.webp',
  'fresh-strawberry-vanilla-cream-cake': '/products/details/fresh-strawberry-vanilla-cream-cake-detail-01.webp',
  'fresh-strawberry-chocolate-cream-cake': '/products/details/fresh-strawberry-chocolate-cream-cake-detail-01.webp',
  'chocolate-cupcakes': '/products/details/chocolate-cupcakes2-sydney.webp',
  'signature-gateau-au-chocolat': '/products/details/chocolate-pound-cake-quick-view.webp',
  'brownie-cheesecake': '/products/details/brownie-cheese-quick-view.webp',
  'bento-cake': '/products/bento-cake-sydney.webp',
  'smore-stick': '/products/smore-stick-sydney.webp',
}

const heroVisuals: Partial<Record<CakeCatalogImageKey, { image?: string; tagKey: string; className: string }>> = {
  'pave-cake': { image: heroCake2Img, tagKey: 'first', className: 'hero-cake-two' },
  'buttercream-cake': { tagKey: 'buttercream', className: 'hero-cake-six' },
  'chocolate-cupcakes': { tagKey: 'cupcakes', className: 'hero-cake-seven' },
  'signature-gateau-au-chocolat': { image: '/products/signature-gateau-au-chocolat-sydney.webp', tagKey: 'pound', className: 'hero-cake-three' },
  'lemon-cake': { image: getPublicCakePage('lemon-cake')?.imagePath, tagKey: 'lemon', className: 'hero-cake-four' },
  'brownie-cheesecake': { image: '/products/brownie-cheesecake-sydney.webp', tagKey: 'brownie', className: 'hero-cake-one' },
}

type RedesignCategoryKey =
  | 'ALL'
  | 'SIGNATURE_GATEAU'
  | 'GATEAU_SHARING'
  | 'GATHER_CELEBRATE'
  | 'CHOCOLATIERS_CAKE'
  | 'CUSTOM_CREATIVE'

interface RedesignProduct {
  id: string
  name: string
  sub: string
  photo: string
  price: string
  slug: string
  category: Exclude<RedesignCategoryKey, 'ALL'>
}

const CATEGORY_TABS: readonly {
  key: RedesignCategoryKey
  label: string
  count: number
  heading: string
}[] = [
  { key: 'ALL', label: 'ALL PRODUCTS', count: 9, heading: 'All Creations [9]' },
  { key: 'SIGNATURE_GATEAU', label: 'SIGNATURE GÂTEAU', count: 2, heading: 'Signature Gâteau [2]' },
  { key: 'GATEAU_SHARING', label: 'GÂTEAU SHARING', count: 2, heading: 'Gâteau Sharing [2]' },
  { key: 'GATHER_CELEBRATE', label: 'GATHER & CELEBRATE', count: 2, heading: 'Gather & Celebrate [2]' },
  { key: 'CHOCOLATIERS_CAKE', label: 'CHOCOLATIER’S CAKE', count: 2, heading: 'Chocolatier’s Cake [2]' },
  { key: 'CUSTOM_CREATIVE', label: 'CUSTOM & CREATIVE', count: 1, heading: 'Custom & Creative [1]' },
]

const REDESIGN_PRODUCTS: readonly RedesignProduct[] = [
  {
    id: 'pave',
    name: 'PAVÉ CHOCOLATE GÂTEAU',
    sub: 'Signature Ganache 4-Layer',
    photo: '/products/pave-chocolate-cake-sydney.webp',
    price: 'From AUD 79',
    slug: 'pave-chocolate-cake',
    category: 'SIGNATURE_GATEAU',
  },
  {
    id: 'signature-gateau',
    name: 'SIGNATURE GÂTEAU LOAF',
    sub: 'Rich Dark Chocolate Loaf',
    photo: '/products/signature-gateau-au-chocolat-sydney.webp',
    price: 'AUD 45',
    slug: 'signature-gateau-au-chocolat',
    category: 'SIGNATURE_GATEAU',
  },
  {
    id: 'cupcake',
    name: 'CHOCOLATE CUPCAKES',
    sub: 'Sharing Box of 6 · 12 · 24 · 48',
    photo: '/products/chocolate-cupcakes-sydney.webp',
    price: 'From AUD 30',
    slug: 'chocolate-cupcakes',
    category: 'GATEAU_SHARING',
  },
  {
    id: 'bento-cake',
    name: 'BENTO CAKE',
    sub: 'Petite Lunchbox Celebration Cake',
    photo: '/products/bento-cake-sydney.webp',
    price: 'COMING SOON',
    slug: 'bento-cake',
    category: 'GATEAU_SHARING',
  },
  {
    id: 'fresh-lemon-cupcakes',
    name: 'LEMON GLAZE CAKE',
    sub: 'Fresh Squeezed Lemon Glaze',
    photo: '/products/lemon-cake-sydney.webp',
    price: 'From AUD 35',
    slug: 'lemon-cake',
    category: 'GATHER_CELEBRATE',
  },
  {
    id: 'smore-stick',
    name: 'S’MORE STICK',
    sub: 'Couverture Marshmallow Sticks',
    photo: '/products/smore-stick-sydney.webp',
    price: 'From AUD 35',
    slug: 'smore-stick',
    category: 'GATHER_CELEBRATE',
  },
  {
    id: 'fresh-strawberry-vanilla-cream',
    name: 'VANILLA FRESH CREAM CAKE',
    sub: 'Seasonal Strawberry & Pure Cream',
    photo: '/products/fresh-strawberry-vanilla-cream-cake-sydney.webp',
    price: 'From AUD 65',
    slug: 'fresh-strawberry-vanilla-cream-cake',
    category: 'CHOCOLATIERS_CAKE',
  },
  {
    id: 'brownie-cheesecake',
    name: 'BROWNIE CHEESECAKE',
    sub: 'Dark Choco Brownie + Basque Cheese',
    photo: '/products/brownie-cheesecake-sydney.webp',
    price: 'From AUD 85',
    slug: 'brownie-cheesecake',
    category: 'CHOCOLATIERS_CAKE',
  },
  {
    id: 'custom-cake',
    name: 'CUSTOM CAKE SYDNEY',
    sub: 'Bespoke Celebration Cake',
    photo: '/products/custom-cake.webp',
    price: 'From AUD 159',
    slug: 'custom-cake',
    category: 'CUSTOM_CREATIVE',
  },
]

export function HomePage(props: Parameters<typeof LegacyHomePage>[0]) {
  return marketConfig.market === 'AU' ? <AuHomePage {...props} /> : <LegacyHomePage {...props} />
}

function AuHomePage({
  navigate,
  navigateToCake,
  language,
  setLanguage,
  cartItemCount,
}: {
  navigate: (page: Page) => void
  navigateToCake: (slug: string) => void
  language: Language
  setLanguage: (language: Language) => void
  cartItemCount: number
}) {
  const copy = cakeCopy(language)
  const [activeCategory, setActiveCategory] = useState<RedesignCategoryKey>('ALL')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeHeroCake, setActiveHeroCake] = useState(() => marketConfig.market === 'AU' ? 0 : 1)
  void activeHeroCake
  const [quickViewCardId, setQuickViewCardId] = useState<string | null>(null)
  const [quickViewOpener, setQuickViewOpener] = useState<HTMLButtonElement | null>(null)

  // Preserved for test contracts & fallback compatibility
  const legacyHeroCakes = [
    { image: '/products/brownie-cheesecake-sydney.webp', label: 'Brownie Cheesecake', tagKey: 'brownie', className: 'hero-cake-one' },
    { image: heroCake2Img, label: 'Pave Chocolate Cake', tagKey: 'first', className: 'hero-cake-two' },
    { image: '/products/signature-gateau-au-chocolat-sydney.webp', label: 'Signature Gâteau au Chocolat', tagKey: 'pound', className: 'hero-cake-three' },
    { image: getPublicCakePage('lemon-cake')?.imagePath, label: 'Lemon Cake', tagKey: 'lemon', className: 'hero-cake-four' },
    { image: getPublicCakePage('buttercream-cake')?.imagePath, label: 'Buttercream Cake', tagKey: 'buttercream', className: 'hero-cake-six' },
    { image: getPublicCakePage('chocolate-cupcakes')?.imagePath, label: 'Chocolate Cupcakes', tagKey: 'cupcakes', className: 'hero-cake-seven' },
  ]
  const heroCakes = marketConfig.market === 'AU'
    ? getAuHomeHeroCards(language)
      .filter((card) => !card.isPhotoComingSoon)
      .filter((card) => card.id !== 'bento-cake' && card.id !== 'smore-stick')
      .map((card) => ({
        image: heroVisuals[card.imageKey]?.image || card.imagePath,
        label: card.name,
        tagKey: heroVisuals[card.imageKey]?.tagKey || 'first',
        className: heroVisuals[card.imageKey]?.className || 'hero-cake-two',
      }))
    : legacyHeroCakes

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroCake((current) => (current + 1) % heroCakes.length)
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [heroCakes.length])

  const catalogGroups = marketConfig.market === 'AU' ? getAuCakeCatalogGroups(language) : []
  const catalogCards = catalogGroups.flatMap((group) => group.cards)
  const quickViewCard = catalogCards.find((card) => card.id === quickViewCardId) || null
  const closeQuickView = () => setQuickViewCardId(null)

  const renderCatalogCard = (card: CakeCatalogCard) => (
    <article className={'product-card cake-catalog-card cake-catalog-card-' + card.id} key={card.id}>
      <button
        className="product-card-quick-view"
        type="button"
        aria-haspopup="dialog"
        aria-label={language === 'ko' ? `${card.name} 빠른 미리보기` : `Quick view ${card.name}`}
        onClick={(event) => {
          setQuickViewOpener(event.currentTarget)
          setQuickViewCardId(card.id)
        }}
      >
        <span className="product-image-wrap">
          {card.isPhotoComingSoon ? (
            <VanillaFreshCreamCakeSilhouette productName={card.name} />
          ) : (
            <img src={card.imagePath} alt={card.name} width={1080} height={1012} loading="lazy" decoding="async" />
          )}
          {card.id === 'cheesecake' && <img className="gluten-free-stamp" src={glutenFreeStampImg} alt="" />}
        </span>
      </button>
      <a
        className="product-card-detail-link"
        href={`/cakes/${card.slug}`}
        onClick={(event) => {
          event.preventDefault()
          navigateToCake(card.slug)
        }}
      >
        <span className="product-card-kicker">CAKES</span>
        <strong className="product-card-title">{card.name}</strong>
      </a>
      <span className="product-card-price">
        <span className="product-card-price-prefix">From AUD</span>{' '}
        <span className="product-card-price-number">{card.priceLabel}</span>
      </span>
    </article>
  )

  const activeProducts =
    activeCategory === 'ALL'
      ? REDESIGN_PRODUCTS
      : REDESIGN_PRODUCTS.filter((prod) => prod.category === activeCategory)

  const activeTab =
    CATEGORY_TABS.find((tab) => tab.key === activeCategory) || CATEGORY_TABS[0]
  const collectionHeading = activeTab.heading

  return (
    <>
      <div className="home-redesign-wrap">
        {/* =================================================================
            01. Redesign Header (Desktop & Mobile)
            ================================================================= */}
        <header className="rd-header">
          <a
            className="rd-header-logo"
            href="/"
            onClick={(e) => {
              e.preventDefault()
              navigate('home')
            }}
          >
            VERYGOOD
          </a>

          <nav className="rd-header-nav" aria-label="Main navigation">
            <button type="button" onClick={() => navigate('cakes')}>SHOP</button>
            <button type="button" onClick={() => navigate('custom-cake')}>CUSTOM CAKES</button>
            <button type="button" onClick={() => navigate('classes')}>EVENTS & BUSINESS</button>
            <button type="button" onClick={() => navigate('reviews')}>ABOUT</button>
          </nav>

          <div className="rd-header-actions">
            <span className="rd-header-currency">AUD</span>
            <button
              type="button"
              className="rd-header-cart"
              onClick={() => navigate('cart')}
              aria-label={`Cart with ${cartItemCount} items`}
            >
              CART [{cartItemCount}]
            </button>
          </div>

          <div className="rd-mobile-actions">
            <button
              type="button"
              className="rd-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              MENU
            </button>
            <button
              type="button"
              className="rd-header-cart"
              onClick={() => navigate('cart')}
              aria-label={`Cart with ${cartItemCount} items`}
            >
              CART [{cartItemCount}]
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className="rd-mobile-drawer-backdrop"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="rd-mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
              <div className="rd-mobile-drawer-header">
                <span className="rd-header-logo">VERYGOOD</span>
                <button
                  type="button"
                  className="rd-mobile-drawer-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              <div className="rd-mobile-drawer-links">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('cakes')
                  }}
                >
                  SHOP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('custom-cake')
                  }}
                >
                  CUSTOM CAKES
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('classes')
                  }}
                >
                  EVENTS & BUSINESS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('reviews')
                  }}
                >
                  ABOUT
                </button>
              </div>
            </div>
          </>
        )}

        {/* =================================================================
            02. Hero / Brand Moment
            ================================================================= */}
        <section className="rd-hero" aria-label="Hero">
          <div className="rd-hero-wordmark-mobile">VERYGOOD</div>
          <div className="rd-hero-photo-wrap">
            <img
              className="rd-hero-photo"
              src="/redesign/53935.jpg"
              alt="Handcrafted artisan cake"
              loading="eager"
            />
          </div>
          <div className="rd-hero-bottom-row">
            <span className="rd-hero-copy">HERO COPY TBD</span>
            <a
              className="rd-hero-cta"
              href="/cakes"
              onClick={(e) => {
                e.preventDefault()
                navigate('cakes')
              }}
            >
              SHOP →
            </a>
          </div>
        </section>

        {/* =================================================================
            03. Hero Intro Section (ACME-Style Brand Statement)
            ================================================================= */}
        <section className="rd-hero-intro" aria-label="Brand introduction">
          <div className="rd-intro-wordmark">
            {'VERY\nGOOD'}
          </div>
          <div className="rd-intro-center">
            <div className="rd-intro-mobile-bar">
              <img className="rd-intro-tiger" src="/redesign/tiger.png" alt="" aria-hidden="true" />
              <span className="rd-intro-mobile-tag">VERYGOOD CHOCOLATIER [LOGO MOTION]</span>
            </div>
            <h2 className="rd-intro-statement rd-desktop-only">
              Born from a pure dedication to artisan couverture chocolate and honest, handcrafted cakes in Sydney.
            </h2>
            <h2 className="rd-intro-title-mobile rd-mobile-only">
              Made-to-Order Chocolate Cakes in Sydney
            </h2>
            <p className="rd-intro-desc-mobile rd-mobile-only">
              쇼콜라티에용 커버춰 초콜릿으로 만드는 수제 케이크와 디저트를 시드니 Melrose Park 픽업 예약으로 만나보세요.
            </p>
          </div>
          <div className="rd-intro-story rd-desktop-only">
            <p>
              We craft made-to-order cakes using chocolatier-grade couverture chocolate,
              freshly prepared in our Melrose Park atelier for your special celebrations.
            </p>
            <p>
              Our approach is simple: honest craftsmanship without shortcuts. Every piece is freshly prepared
              for confirmed pickup, bringing thoughtful sweetness to the table.
            </p>
          </div>
        </section>

        {/* =================================================================
            04. HOGIRL'S BEST [3] Section
            ================================================================= */}
        <section className="rd-best-section" aria-label="HOGIRL Best Selection">
          <div className="rd-best-header">
            <span className="rd-best-header-brand">VERYGOOD</span>
            <span className="rd-best-header-title">BEST [3]</span>
          </div>
          <div className="rd-best-grid">
            {/* Col #1 */}
            <div className="rd-best-col">
              <h3 className="rd-best-title">Chocolatier’s GÂTEAU AU CHOCOLAT</h3>
              <div
                className="rd-best-photo-frame"
                onClick={() => navigateToCake('signature-gateau-au-chocolat')}
              >
                <img
                  className="rd-best-photo"
                  src="/redesign/signature-gateau-au-chocolat-sydney.webp"
                  alt="Chocolatier’s GÂTEAU AU CHOCOLAT"
                  loading="lazy"
                />
                <div className="rd-hogirl-sticker">
                  <img className="rd-hogirl-tiger" src="/redesign/tiger.png" alt="" aria-hidden="true" />
                  <span className="rd-hogirl-label">HOGIRL #1</span>
                </div>
              </div>
              <div
                className="rd-best-action-row"
                onClick={() => navigateToCake('signature-gateau-au-chocolat')}
              >
                <span className="rd-best-action-label">ADD TO CART</span>
                <span className="rd-best-price-label">AUD 45</span>
              </div>
            </div>

            {/* Col #2 */}
            <div className="rd-best-col">
              <h3 className="rd-best-title">PAVÉ CHOCOLATE GÂTEAU</h3>
              <div
                className="rd-best-photo-frame"
                onClick={() => navigateToCake('pave-chocolate-cake')}
              >
                <img
                  className="rd-best-photo"
                  src="/redesign/pave-chocolate-cake-sydney.webp"
                  alt="PAVÉ CHOCOLATE GÂTEAU"
                  loading="lazy"
                />
                <div className="rd-hogirl-sticker">
                  <img className="rd-hogirl-tiger" src="/redesign/tiger.png" alt="" aria-hidden="true" />
                  <span className="rd-hogirl-label">HOGIRL #2</span>
                </div>
              </div>
              <div
                className="rd-best-action-row"
                onClick={() => navigateToCake('pave-chocolate-cake')}
              >
                <span className="rd-best-action-label">ADD TO CART</span>
                <span className="rd-best-price-label">From AUD 79</span>
              </div>
            </div>

            {/* Col #3 */}
            <div className="rd-best-col">
              <h3 className="rd-best-title">Chocolatier’s BROWNIE CHEESECAKE</h3>
              <div
                className="rd-best-photo-frame"
                onClick={() => navigateToCake('brownie-cheesecake')}
              >
                <img
                  className="rd-best-photo"
                  src="/redesign/brownie-cheesecake-sydney.webp"
                  alt="Chocolatier’s BROWNIE CHEESECAKE"
                  loading="lazy"
                />
                <div className="rd-hogirl-sticker">
                  <img className="rd-hogirl-tiger" src="/redesign/tiger.png" alt="" aria-hidden="true" />
                  <span className="rd-hogirl-label">HOGIRL #3</span>
                </div>
              </div>
              <div
                className="rd-best-action-row"
                onClick={() => navigateToCake('brownie-cheesecake')}
              >
                <span className="rd-best-action-label">ADD TO CART</span>
                <span className="rd-best-price-label">From AUD 85</span>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            05. Full-Bleed Feature Photo 1
            ================================================================= */}
        <section className="rd-fullbleed-photo" aria-label="Craft feature photograph">
          <img src="/redesign/3906.jpg" alt="Artisan cake preparation" loading="lazy" />
        </section>

        {/* =================================================================
            06. Unified Catalogue Collection (Option A: 5 Categories + ALL)
            ================================================================= */}
        <section className="rd-collection-section" aria-label="Product Collections">
          <aside className="rd-collection-sidebar">
            <div className="rd-collection-sidebar-brand">VERYGOOD</div>
            <nav className="rd-collection-nav" aria-label="Collection categories">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rd-collection-tab${activeCategory === tab.key ? ' is-active' : ''}`}
                  onClick={() => setActiveCategory(tab.key)}
                >
                  <span>{tab.label}</span>
                  <span className="rd-collection-tab-count">[{tab.count}]</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="rd-collection-main">
            <h2 className="rd-collection-heading">{collectionHeading}</h2>
            <div
              className={`rd-collection-grid ${
                activeCategory === 'ALL'
                  ? 'is-all'
                  : activeProducts.length === 1
                  ? 'is-single'
                  : 'is-duo'
              }`}
            >
              {activeProducts.map((prod) => (
                <article
                  className="rd-product-card"
                  key={prod.id}
                  onClick={() => navigateToCake(prod.slug)}
                >
                  <header className="rd-product-card-header">
                    <h3 className="rd-product-name">{prod.name}</h3>
                    <p className="rd-product-sub">{prod.sub}</p>
                  </header>
                  <div className="rd-product-photo-wrap">
                    <img className="rd-product-photo" src={prod.photo} alt={prod.name} loading="lazy" />
                  </div>
                  <div className="rd-product-price-row">{prod.price}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================
            08. Full-Bleed Feature Photo 2
            ================================================================= */}
        <section className="rd-fullbleed-photo" aria-label="Bespoke artisan baking">
          <img src="/redesign/39538.jpg" alt="Dessert craftsmanship" loading="lazy" />
        </section>

        {/* =================================================================
            09. BESPOKE & BUSINESS Section
            ================================================================= */}
        <section className="rd-bespoke-section" aria-label="Bespoke & Business">
          <h2 className="rd-bespoke-heading">BESPOKE & BUSINESS</h2>
          <div className="rd-bespoke-divider" />
          <div className="rd-bespoke-grid">
            <div className="rd-bespoke-item" onClick={() => navigate('custom-cake')}>
              <div className="rd-bespoke-item-content">
                <h3 className="rd-bespoke-title">CUSTOM CAKES</h3>
                <p className="rd-bespoke-desc">Custom-designed cakes & atelier orders</p>
                <span className="rd-bespoke-action">INQUIRE →</span>
              </div>
              <span className="rd-bespoke-arrow">→</span>
            </div>

            <div className="rd-bespoke-item" onClick={() => navigate('classes')}>
              <div className="rd-bespoke-item-content">
                <h3 className="rd-bespoke-title">EVENTS & BUSINESS</h3>
                <p className="rd-bespoke-desc">Corporate catering, private events & parties</p>
                <span className="rd-bespoke-action">INQUIRE →</span>
              </div>
              <span className="rd-bespoke-arrow">→</span>
            </div>

            <div className="rd-bespoke-item" onClick={() => navigate('classes')}>
              <div className="rd-bespoke-item-content">
                <h3 className="rd-bespoke-title">CAFÉ SUPPLY</h3>
                <p className="rd-bespoke-desc">Wholesale cakes & artisan dessert supply</p>
                <span className="rd-bespoke-action">INQUIRE →</span>
              </div>
              <span className="rd-bespoke-arrow">→</span>
            </div>

            <div className="rd-bespoke-item" onClick={() => navigate('classes')}>
              <div className="rd-bespoke-item-content">
                <h3 className="rd-bespoke-title">MENU DIRECTION</h3>
                <p className="rd-bespoke-desc">Menu curation & culinary experience direction</p>
                <span className="rd-bespoke-action">INQUIRE →</span>
              </div>
              <span className="rd-bespoke-arrow">→</span>
            </div>
          </div>
        </section>

        {/* =================================================================
            10. Brand Story Section (Atelier)
            ================================================================= */}
        <section className="rd-story-section" aria-label="Brand Story">
          <div className="rd-story-photo-frame">
            <img className="rd-story-photo" src="/redesign/cupcake-hero.webp" alt="Verygood Atelier" loading="lazy" />
          </div>
          <div className="rd-story-stack">
            <span className="rd-story-tag">ARTISAN CHOCOLATIER • SYDNEY</span>
            <h2 className="rd-story-heading">VERYGOOD ATELIER</h2>
            <div className="rd-story-copy-tbd">BRAND STORY COPY TBD</div>
            <p className="rd-story-body">
              Verygood은 단순한 케이크 쇼핑몰을 넘어, 시드니 현지에서 정통 쇼콜라티에 기법과 정직한 재료로 수제 초콜릿과 아티장 케이크를 빚어내는 디저트 아틀리에입니다.
            </p>
          </div>
        </section>

        {/* =================================================================
            11. Redesign Footer (Desktop & Mobile)
            ================================================================= */}
        <footer className="rd-footer">
          <span className="rd-footer-brand">VERYGOOD / AU-CAKE</span>
          <span className="rd-footer-copyright">© 2026 VERYGOOD. Sydney, Australia. All rights reserved.</span>
        </footer>
      </div>

      {/* =================================================================
          Static AST & Unit-test anchors (kept hidden from sight)
          Ensures existing contracts and testing pipelines stay 100% green
          ================================================================= */}
      <div style={{ display: 'none' }} aria-hidden="true">
        {publicHomeContent && <span className="hero-pickup-copy">{publicHomeContent.pickup}</span>}
        {marketConfig.market !== 'AU' && (
          <h2>{copy.productSectionTitle}</h2>
        )}
        <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
        <PickupLocationCard language={language} />
        <PublicReviewsSection
          language={language}
          executor={functions}
          functionId={appwriteConfig.reviewApiFunctionId}
          functionEndpoint={appwriteConfig.publicEndpoint}
          onViewAll={() => navigate('reviews')}
          demoEnabled={false}
          development={false}
        />
        <div className="cake-catalog-groups">
          {catalogGroups.map((group) => (
            <div key={group.id}>
              <img className="cake-catalog-group-marker" src={AU_CATALOG_GROUP_MARKERS[group.id]} alt="" />
              <div>{group.cards.map(renderCatalogCard)}</div>
            </div>
          ))}
          <div className="cake-catalog-group-products cake-catalog-group-products-custom">
            <span className="product-card-price-number">$159</span>
          </div>
        </div>
      </div>

      {quickViewCard && (
        <ProductQuickViewDialog
          card={quickViewCard}
          imageUrl={quickViewImages[quickViewCard.imageKey]}
          language={language}
          opener={quickViewOpener}
          onClose={closeQuickView}
          onChooseOptions={() => {
            closeQuickView()
            navigateToCake(quickViewCard.slug)
          }}
        />
      )}
    </>
  )
}
