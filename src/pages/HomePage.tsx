import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clipboard, MessageCircleCheck, Wallet } from 'lucide-react'
import heroCake2Img from '../assets/hero-cake-2.webp'
import heroCake3Img from '../assets/hero-cake-3.webp'
import glutenFreeStampImg from '../assets/glutenfree.webp'
import { ProductQuickViewDialog } from '../ProductQuickViewDialog'
import PublicReviewsSection from '../PublicReviewsSection'
import { SpringClassCampaignDialog } from '../components/SpringClassCampaignDialog'
import { PickupLocationCard, SiteHeader, VanillaFreshCreamCakeSilhouette } from '../components/SiteChrome'
import { appwriteConfig, functions } from '../lib/appwrite'
import { type Page } from '../lib/app-routes'
import { getAuCakeCatalogCards, type CakeCatalogCard, type CakeCatalogImageKey } from '../lib/cake-catalog'
import { DEFAULT_CAKE_SIZE, PRODUCTS, formatCakeSizeLabel } from '../lib/constants'
import { cakeCopy, getProductFeatures, getProductText, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import type { ProductId, StoreSettings } from '../lib/types'
import { formatCurrency } from '../lib/utils'
import { getAuPublicContent, getPublicCakePage } from '../lib/public-content'

const publicHomeContent = marketConfig.market === 'AU' ? getAuPublicContent().home : null

const quickViewImages: Record<CakeCatalogImageKey, string> = {
  'pound-cake': '/products/details/chocolate-pound-cake-quick-view.webp',
  'pave-cake': '/products/details/pave-chocolate-cake-quick-view.webp',
  'basque-cheesecake': '/products/details/chocolatiers-basque-cheesecake-quick-view.webp',
  'lemon-cake': '/products/details/lemon-cake-quick-view.webp',
  'vanilla-fresh-cream-cake': '/products/details/vanillacake-quickview.webp',
  'buttercream-cake': '/products/details/buttercream-cake-quick-view.webp',
  'chocolate-cupcakes': '/products/details/chocolate-cupcakes2-sydney.webp',
  'signature-gateau-au-chocolat': '/products/details/chocolate-pound-cake-quick-view.webp',
  'brownie-cheesecake': '/products/details/brownie-cheese-quick-view.webp',
}

export function HomePage({
  navigate,
  settings,
  navigateToCake,
  language,
  setLanguage,
  cartItemCount,
}: {
  navigate: (page: Page) => void
  settings: StoreSettings
  navigateToCake: (slug: string) => void
  language: Language
  setLanguage: (language: Language) => void
  cartItemCount: number
}) {
  const copy = cakeCopy(language)
  const orderingSteps = publicHomeContent?.orderingSteps ?? null
  const [activeHeroCake, setActiveHeroCake] = useState(1)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [heroDragX, setHeroDragX] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const [quickViewCardId, setQuickViewCardId] = useState<string | null>(null)
  const [quickViewOpener, setQuickViewOpener] = useState<HTMLButtonElement | null>(null)
  const heroCakes = [
    { image: '/products/brownie-cheese-sydney.webp', label: 'Brownie Cheesecake', tagKey: 'brownie', className: 'hero-cake-one' },
    { image: heroCake2Img, label: 'Pave Chocolate Cake', tagKey: 'first', className: 'hero-cake-two' },
    { image: heroCake3Img, label: 'Signature Gâteau au Chocolat', tagKey: 'pound', className: 'hero-cake-three' },
    { image: getPublicCakePage('lemon-cake')?.imagePath, label: 'Lemon Cake', tagKey: 'lemon', className: 'hero-cake-four' },
    { image: getPublicCakePage('vanilla-fresh-cream-cake')?.imagePath, label: 'Vanilla Fresh Cream Cake', tagKey: 'vanilla', className: 'hero-cake-five' },
    { image: getPublicCakePage('buttercream-cake')?.imagePath, label: 'Buttercream Cake', tagKey: 'buttercream', className: 'hero-cake-six' },
    { image: getPublicCakePage('chocolate-cupcakes')?.imagePath, label: 'Chocolate Cupcakes', tagKey: 'cupcakes', className: 'hero-cake-seven' },
  ]

  useEffect(() => {
    if (heroPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intervalId = window.setInterval(() => {
      setActiveHeroCake((current) => (current + 1) % heroCakes.length)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [heroCakes.length, heroPaused])
  const legacyKrCatalogCards: CakeCatalogCard[] = [
    {
      id: 'pound-cupcake',
      slug: 'chocolate-pound-cake-and-cupcakes',
      productId: 'pound-cake' as ProductId,
      imageKey: 'pound-cake' as const,
      imagePath: '/products/chocolate-pound-cake-sydney.webp',
      isPhotoComingSoon: false,
      name: language === 'ko' ? '초코 파운드케이크 & 컵케이크' : 'Chocolate Pound Cake & Cupcakes',
      description: language === 'ko'
        ? '파운드케이크를 기본으로 선택하고 10달러를 추가하면 컵케이크 1다스로 변경할 수 있어요.'
        : 'Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.',
      features: language === 'ko'
        ? ['파운드케이크 AUD 45', '컵케이크 1다스 +AUD 10', '기존 마감 옵션 선택 가능']
        : ['Pound cake AUD 45', 'Cupcakes · 1 dozen +AUD 10', 'Keep your choice of finish'],
      priceLabel: `${language === 'ko' ? 'AUD 45부터' : 'From AUD 45'}`,
      optionLabel: language === 'ko' ? '파운드 / 컵케이크와 마감 선택' : 'Choose pound or cupcakes, then a finish',
    },
    {
      id: 'pave',
      slug: 'pave-chocolate-cake',
      productId: 'pave-cake' as ProductId,
      imageKey: 'pave-cake' as const,
      imagePath: '/products/pave-chocolate-cake-sydney.webp',
      isPhotoComingSoon: false,
      name: getProductText('pave-cake', language).name,
      description: getProductText('pave-cake', language).description,
      features: getProductFeatures('pave-cake', language),
      priceLabel: formatCurrency(PRODUCTS['pave-cake']!.price),
      optionLabel: getProductText('pave-cake', language).priceNote,
    },
    {
      id: 'cheesecake',
      slug: 'chocolatiers-basque-cheesecake',
      productId: 'choco-basque-cheesecake' as ProductId,
      imageKey: 'basque-cheesecake' as const,
      imagePath: '/products/chocolatiers-basque-cheesecake-sydney.webp',
      isPhotoComingSoon: false,
      name: language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake",
      description: language === 'ko'
        ? `기본, 파베 초콜릿 on top, 에펠탑 초콜릿 마감 중에서 선택할 수 있는 ${formatCakeSizeLabel(DEFAULT_CAKE_SIZE)} 치즈케이크예요.`
        : 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
      features: language === 'ko'
        ? ['글루텐 프리', formatCakeSizeLabel(DEFAULT_CAKE_SIZE), '기본 AUD 55', '파베 on top +AUD 10', '에펠탑 마감 +AUD 15']
        : ['Gluten-free', formatCakeSizeLabel(DEFAULT_CAKE_SIZE), 'Classic AUD 55', 'Pave chocolate on top +AUD 10', 'Eiffel Tower finish +AUD 15'],
      priceLabel: `${language === 'ko' ? 'AUD 55부터' : 'From AUD 55'}`,
      optionLabel: language === 'ko' ? '세 가지 마감 선택' : 'Three finishing options',
    },
    {
      id: 'fresh-lemon-cupcakes',
      slug: 'lemon-cake',
      productId: 'fresh-lemon-cupcakes-12' as ProductId,
      imageKey: 'lemon-cake' as const,
      imagePath: '/products/lemon-cake-sydney.webp',
      isPhotoComingSoon: false,
      name: language === 'ko' ? '레몬 케이크' : 'Lemon Cake',
      description: language === 'ko'
        ? '신선한 레몬즙과 레몬 제스트로 만든 레몬 모양 케이크에 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리해요.'
        : 'Lemon-shaped cakes made with freshly squeezed lemon juice and fresh lemon zest, finished with lemon syrup and a fresh lemon glaze.',
      features: language === 'ko'
        ? ['6, 8, 12, 16개 구성', '12개 · Most Popular', '기본 또는 스페셜 마감 선택']
        : ['Boxes of 6, 8, 12 or 16', '12 pieces · Most Popular', 'Choose basic or special finishing'],
      priceLabel: language === 'ko' ? 'AUD 36부터' : 'From AUD 36',
      optionLabel: language === 'ko' ? '구성 수량만 선택' : 'Choose a pack size',
    },
  ]
  const catalogCards = marketConfig.market === 'AU'
    ? getAuCakeCatalogCards(language)
    : legacyKrCatalogCards
  const quickViewCard = catalogCards.find((card) => card.id === quickViewCardId) || null
  const closeQuickView = useCallback(() => setQuickViewCardId(null), [])

  const rotateHeroCake = useCallback((direction: 1 | -1) => {
    setActiveHeroCake((current) => (current + direction + heroCakes.length) % heroCakes.length)
  }, [heroCakes.length])

  function heroCakePosition(index: number) {
    const offset = (index - activeHeroCake + heroCakes.length) % heroCakes.length
    if (offset === 0) return 'center'
    if (offset === 1) return 'right'
    if (offset === heroCakes.length - 1) return 'left'
    return 'hidden'
  }

  function handleHeroPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setHeroPaused(true)
    setSwipeStartX(event.clientX)
    setHeroDragX(0)
  }

  function handleHeroPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    setHeroDragX(Math.max(-120, Math.min(120, deltaX)))
  }

  function handleHeroPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX === null) return
    const deltaX = event.clientX - swipeStartX
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setSwipeStartX(null)
    setHeroDragX(0)
    setHeroPaused(false)
    if (Math.abs(deltaX) < 34) return
    rotateHeroCake(deltaX < 0 ? 1 : -1)
  }

  const heroDragStyle = { '--hero-drag': `${heroDragX}px` } as CSSProperties

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main>
        <section className="hero-section">
          <span className="featured-seal" aria-hidden="true">
            <span>LIMITED</span>
            <b>VCC</b>
          </span>
          <div className="billboard-word hero-display-word" aria-hidden="true">
            <span>gâteau</span>
            <span>au</span>
            <span>chocolat</span>
          </div>
          <div className="hero-copy">
            <h1 className="hero-title">{language === 'en' && publicHomeContent ? publicHomeContent.h1 : copy.homeTitle}</h1>
            <p className="hero-description">
              {language === 'ko' ? (
                <><strong>verygood chocolate</strong>이 쇼콜라티에용 커버춰 초콜릿으로 만드는 케이크를 Melrose Park 픽업 예약으로 만나보세요.</>
              ) : publicHomeContent ? (
                <>{publicHomeContent.hero}<br /><span>{publicHomeContent.pickup}</span></>
              ) : (
                <>Cakes made with chocolatier-grade couverture chocolate by <strong>verygood chocolate</strong>,<br className="hero-description-break" /> available by pre-order for confirmed Melrose Park pick-up.</>
              )}
            </p>
            <div className="hero-actions">
              {publicHomeContent ? publicHomeContent.ctas.map((cta, index) => (
                <a
                  className={index === 0 ? 'primary-button' : 'secondary-button'}
                  href={cta.href}
                  key={cta.href}
                  onClick={(event) => {
                    if (cta.href === '/cakes') {
                      event.preventDefault()
                      navigate('cakes')
                    }
                  }}
                >
                  {cta.label}
                </a>
              )) : (
                <a className="primary-button" href="/cakes/pave-chocolate-cake" onClick={(event) => {
                  event.preventDefault()
                  navigateToCake('pave-chocolate-cake')
                }}>
                  {language === 'ko' ? '파베 케이크 보기' : 'View Pave cake'}
                </a>
              )}
            </div>
          </div>
          <div
            className={`hero-image-wrap${swipeStartX !== null ? ' is-dragging' : ''}`}
            style={heroDragStyle}
            aria-label={copy.homeTitle}
            onPointerDown={handleHeroPointerDown}
            onPointerMove={handleHeroPointerMove}
            onPointerUp={handleHeroPointerUp}
            onPointerEnter={() => setHeroPaused(true)}
            onPointerLeave={() => setHeroPaused(false)}
            onFocusCapture={() => setHeroPaused(true)}
            onBlurCapture={() => setHeroPaused(false)}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              setSwipeStartX(null)
              setHeroDragX(0)
              setHeroPaused(false)
            }}
          >
            <div className="hero-cake-cluster" aria-hidden="true">
              {heroCakes.map((cake, index) => {
                const position = heroCakePosition(index)
                return (
                  <div
                    className={`hero-cake-slide${cake.className === 'hero-cake-four' ? ' hero-cake-slide-lemon' : ''}${cake.className === 'hero-cake-five' ? ' hero-cake-slide-vanilla' : ''}${cake.className === 'hero-cake-six' ? ' hero-cake-slide-buttercream' : ''}${cake.className === 'hero-cake-seven' ? ' hero-cake-slide-cupcakes' : ''}`}
                    data-position={position}
                    key={cake.label}
                  >
                    <img
                      src={cake.image}
                      alt=""
                      width={1080}
                      height={1012}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className={`hero-cake ${cake.className}`}
                      draggable="false"
                    />
                    <span className={`hero-size-tag hero-size-tag-${cake.tagKey}`}>
                      {cake.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-previous"
              aria-label="Show previous cake"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => rotateHeroCake(-1)}
            >
              <ChevronLeft size={24} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-next"
              aria-label="Show next cake"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => rotateHeroCake(1)}
            >
              <ChevronRight size={24} strokeWidth={1.8} />
            </button>
            <div className="hero-carousel-dots" aria-label="Choose featured cake">
              {heroCakes.map((cake, index) => (
                <button
                  type="button"
                  className={index === activeHeroCake ? 'is-active' : ''}
                  key={cake.label}
                  aria-label={`Show ${cake.label}`}
                  aria-pressed={index === activeHeroCake}
                  onClick={() => setActiveHeroCake(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="content-section product-section">
          <h2>{copy.productSectionTitle}</h2>
          <div className="product-grid">
            {catalogCards.map((card) => (
              <article className="product-card" key={card.id}>
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
                      <img
                        src={card.imagePath}
                        alt={card.name}
                        width={1080}
                        height={1012}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {card.id === 'cheesecake' && (
                      <img
                        className="gluten-free-stamp"
                        src={glutenFreeStampImg}
                        alt=""
                      />
                    )}
                  </span>
                  <strong className="product-card-title">{card.name}</strong>
                  <span className="product-card-price">{card.priceLabel}</span>
                </button>
                <a
                  className="secondary-button full-width"
                  href={`/cakes/${card.slug}`}
                  onClick={(event) => {
                    event.preventDefault()
                    navigateToCake(card.slug)
                  }}
                >
                  {language === 'ko' ? '옵션 선택' : 'Choose options'}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section policy-section" id={publicHomeContent ? 'how-ordering-works' : 'reservation-guide'}>
          <h2>{copy.reservationGuideTitle}</h2>
          <div className="policy-manual">
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>01</span>
                <Clipboard size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{orderingSteps ? 'Choose a cake and options' : copy.guideSteps[0].title}</strong>
                <p>{orderingSteps ? orderingSteps[0] : copy.guideSteps[0].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>02</span>
                <MessageCircleCheck size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{orderingSteps ? 'Send a request' : copy.guideSteps[1].title}</strong>
                <p>{orderingSteps ? orderingSteps[1] : copy.guideSteps[1].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>03</span>
                <Wallet size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{orderingSteps ? 'Receive payment details' : copy.guideSteps[2].title}</strong>
                <p>{orderingSteps ? orderingSteps[2] : copy.guideSteps[2].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>04</span>
                <CalendarDays size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{orderingSteps ? 'Pre-arranged pickup' : copy.guideSteps[3].title}</strong>
                {orderingSteps ? (
                  <p>{orderingSteps[3]}</p>
                ) : marketConfig.market === 'AU' ? (
                  <p>
                    {copy.pickupHours[0]}
                    <br />
                    {copy.pickupHours[1]}
                  </p>
                ) : (
                  <p>
                    평일 {settings.weekdayOpen}-{settings.weekdayClose}, 주말 {settings.weekendOpen}-{settings.weekendClose}
                  </p>
                )}
              </div>
            </article>
          </div>
          {settings.pickupNotice.trim() && <p className="policy-note">{settings.pickupNotice}</p>}
        </section>

        <section className="content-section cake-information-section" aria-labelledby="sydney-cake-info-title">
          <p className="summary-kicker">{language === 'ko' ? '시드니에서 직접 제작' : 'Made in Sydney'}</p>
          <h2 id="sydney-cake-info-title">
            {language === 'ko' ? '쇼콜라티에용 커버춰 초콜릿으로 만드는 주문 제작 케이크' : 'Chocolate cakes made with chocolatier-grade couverture chocolate'}
          </h2>
          <div className="cake-information-grid">
            <article>
              <h3>{language === 'ko' ? '초콜릿이 중심인 레시피' : 'Chocolate-first recipes'}</h3>
              <p>{language === 'ko' ? '파베, 바닐라 생크림, 버터크림, 초콜릿 컵케이크, 시그니처 갸또 쇼콜라, 레몬 케이크, 브라우니 치즈케이크를 주문할 수 있어요. 모든 주문은 쇼콜라티에용 커버춰 초콜릿을 사용해 준비합니다.' : 'Choose from Pave, Vanilla Fresh Cream, Buttercream, Chocolate Cupcakes, Signature Gâteau au Chocolat, Lemon Cake and Brownie Cheesecake. Every order is made with chocolatier-grade couverture chocolate.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? '원하는 옵션 선택' : 'Choose your finish'}</h3>
              <p>{language === 'ko' ? '케이크에 따라 사이즈, 다크 초콜릿, 초콜릿 추가, 바닐라 크림 마감을 선택할 수 있어요.' : 'Available options vary by cake and include multiple sizes, dark chocolate, extra chocolate, and vanilla cream finishes.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? 'Melrose Park 사전 약속 픽업' : 'Pre-arranged Melrose Park pick-up'}</h3>
              <p>{language === 'ko' ? '방문 매장 없이 운영하는 홈베이킹 서비스입니다. 신청 후 베리굿 팀이 가능 여부, 결제 정보, 정확한 Melrose Park 전달 장소를 안내해 드려요.' : 'This is a home-baking service without a walk-in shop. Our team confirms availability, payment details, and the exact Melrose Park handoff point after your request.'}</p>
            </article>
          </div>
        </section>

        <section className="content-section cake-faq-section" aria-labelledby="cake-faq-title">
          <h2 id="cake-faq-title">{language === 'ko' ? '시드니 케이크 주문 FAQ' : 'Sydney cake order FAQ'}</h2>
          <div className="cake-faq-list">
            {publicHomeContent ? publicHomeContent.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            )) : (
              <>
                <details>
                  <summary>{language === 'ko' ? '케이크는 어디서 픽업하나요?' : 'Where do I pick up my cake?'}</summary>
                  <p>{language === 'ko' ? 'Sydney Melrose Park에서 사전 약속 픽업으로 진행됩니다. 방문 매장은 없으며 주문 확정 후 베리굿 팀이 정확한 전달 방법을 안내해 드려요.' : 'Pick-up is arranged in Melrose Park, Sydney. There is no walk-in shop, so our team sends the exact meeting details after confirming your order.'}</p>
                </details>
                <details>
                  <summary>{language === 'ko' ? '신청서를 보내면 바로 주문이 확정되나요?' : 'Is submitting the form a confirmed order?'}</summary>
                  <p>{language === 'ko' ? '아니요. 베리굿 팀이 먼저 가능 여부를 확인하고 결제 정보를 보내드립니다. 입금이 확인되면 주문이 최종 확정됩니다.' : 'No. Our team first checks availability and sends payment details. Your order is confirmed after payment is received.'}</p>
                </details>
                <details>
                  <summary>{language === 'ko' ? '어떤 초콜릿 케이크를 주문할 수 있나요?' : 'Which chocolate cakes can I order?'}</summary>
                  <p>{language === 'ko' ? '파베 초콜릿 케이크, 바닐라 생크림 케이크, 버터크림 케이크, 초콜릿 컵케이크, 시그니처 갸또 쇼콜라, 레몬 케이크, 브라우니 치즈케이크를 신청할 수 있습니다.' : 'You can request Pave Chocolate Cake, Vanilla Fresh Cream Cake, Buttercream Cake, Chocolate Cupcakes, Signature Gâteau au Chocolat, Lemon Cake or Brownie Cheesecake.'}</p>
                </details>
                <details>
                  <summary>{language === 'ko' ? '시드니 배송이나 방문 구매가 가능한가요?' : 'Do you offer Sydney delivery or walk-in sales?'}</summary>
                  <p>{language === 'ko' ? '현재는 제공하지 않습니다. Melrose Park 사전 약속 픽업 주문만 받고 있습니다.' : 'Not currently. Orders are made for pre-arranged pick-up in Melrose Park only.'}</p>
                </details>
              </>
            )}
          </div>
        </section>

        <PublicReviewsSection
          language={language}
          executor={functions}
          functionId={appwriteConfig.reviewApiFunctionId}
          functionEndpoint={appwriteConfig.publicEndpoint}
          onViewAll={() => navigate('reviews')}
          demoEnabled={import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          development={import.meta.env.DEV}
        />

        {marketConfig.market === 'AU' && <PickupLocationCard language={language} />}
      </main>
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
      <a
        className="sticky-cta"
        href="/cakes/pave-chocolate-cake"
        onClick={(event) => {
          event.preventDefault()
          navigateToCake('pave-chocolate-cake')
        }}
      >
        {language === 'ko' ? '케이크 자세히 보기' : 'View cake details'}
      </a>
      {marketConfig.market === 'AU' && (
        <SpringClassCampaignDialog language={language} onBook={() => navigate('class-reserve')} />
      )}
    </>
  )
}
