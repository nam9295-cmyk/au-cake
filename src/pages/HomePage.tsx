import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clipboard, MessageCircleCheck, Wallet } from 'lucide-react'
import heroCake2Img from '../assets/hero-cake-2.webp'
import heroCake3Img from '../assets/hero-cake-3.webp'
import paveCakeCardImg from '../assets/pave-side.webp'
import poundCakeCardImg from '../assets/pound-side.webp'
import basqueCheesecakeHeroImg from '../assets/basquecheesecake.webp'
import basqueCheesecakeCardImg from '../assets/basquecheesecake-side.webp'
import glutenFreeStampImg from '../assets/glutenfree.webp'
import freshLemonCupcakesHeroImg from '../assets/lemoncake.webp'
import freshLemonCupcakesCardImg from '../assets/lemoncake-side.webp'
import PublicReviewsSection from '../PublicReviewsSection'
import { PickupLocationCard, SiteHeader, VanillaFreshCreamCakeSilhouette } from '../components/SiteChrome'
import { appwriteConfig, functions } from '../lib/appwrite'
import { type Page } from '../lib/app-routes'
import { getAuCakeCatalogCards, type CakeCatalogImageKey } from '../lib/cake-catalog'
import { DEFAULT_CAKE_SIZE, PRODUCTS, formatCakeSizeLabel } from '../lib/constants'
import { cakeCopy, getProductFeatures, getProductText, type Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'
import type { ProductId, StoreSettings } from '../lib/types'
import { formatCurrency } from '../lib/utils'

const catalogImages: Record<CakeCatalogImageKey, string> = {
  'pound-cake': poundCakeCardImg,
  'pave-cake': paveCakeCardImg,
  'basque-cheesecake': basqueCheesecakeCardImg,
  'lemon-cake': freshLemonCupcakesCardImg,
  'vanilla-fresh-cream-cake': '',
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
  const [activeHeroCake, setActiveHeroCake] = useState(1)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [heroDragX, setHeroDragX] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const heroCakes = [
    { image: basqueCheesecakeHeroImg, label: "Chocolatier's Basque", tagKey: 'mini', className: 'hero-cake-one' },
    { image: heroCake2Img, label: 'Pave Chocolate Cake', tagKey: 'first', className: 'hero-cake-two' },
    { image: heroCake3Img, label: 'Chocolate Pound Cake', tagKey: 'pound', className: 'hero-cake-three' },
    { image: freshLemonCupcakesHeroImg, label: 'Lemon Cake', tagKey: 'lemon', className: 'hero-cake-four' },
  ]

  useEffect(() => {
    if (heroPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intervalId = window.setInterval(() => {
      setActiveHeroCake((current) => (current + 1) % 4)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [heroPaused])
  const legacyKrCatalogCards = [
    {
      id: 'pound-cupcake',
      slug: 'chocolate-pound-cake-and-cupcakes',
      productId: 'pound-cake' as ProductId,
      imageKey: 'pound-cake' as const,
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
      isPhotoComingSoon: false,
      name: getProductText('pave-cake', language).name,
      description: getProductText('pave-cake', language).description,
      features: getProductFeatures('pave-cake', language),
      priceLabel: formatCurrency(PRODUCTS['pave-cake'].price),
      optionLabel: getProductText('pave-cake', language).priceNote,
    },
    {
      id: 'cheesecake',
      slug: 'chocolatiers-basque-cheesecake',
      productId: 'choco-basque-cheesecake' as ProductId,
      imageKey: 'basque-cheesecake' as const,
      isPhotoComingSoon: false,
      name: language === 'ko' ? '쇼콜라티에 바스크 치즈케이크' : "Chocolatier's Basque Cheesecake",
      description: language === 'ko'
        ? `기본, 파베 초콜릿 on top, 에펠탑 초콜릿 마감 중에서 선택할 수 있는 ${formatCakeSizeLabel(DEFAULT_CAKE_SIZE)} 치즈케이크예요.`
        : 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
      features: language === 'ko'
        ? ['글루텐 프리', formatCakeSizeLabel(DEFAULT_CAKE_SIZE), '기본 AUD 55', '파베 on top +AUD 10', '에펠탑 마감 +AUD 20']
        : ['Gluten-free', formatCakeSizeLabel(DEFAULT_CAKE_SIZE), 'Classic AUD 55', 'Pave chocolate on top +AUD 10', 'Eiffel Tower finish +AUD 20'],
      priceLabel: `${language === 'ko' ? 'AUD 55부터' : 'From AUD 55'}`,
      optionLabel: language === 'ko' ? '세 가지 마감 선택' : 'Three finishing options',
    },
    {
      id: 'fresh-lemon-cupcakes',
      slug: 'lemon-cake',
      productId: 'fresh-lemon-cupcakes-12' as ProductId,
      imageKey: 'lemon-cake' as const,
      isPhotoComingSoon: false,
      name: language === 'ko' ? '레몬 케이크' : 'Lemon Cake',
      description: language === 'ko'
        ? '레몬 모양 케이크에 상큼한 레몬 크림을 채우고 꽃무늬 장식으로 마무리해요.'
        : 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
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
            <h1 className="hero-title">{copy.homeTitle}</h1>
            <p className="hero-description">
              {language === 'ko' ? (
                <><strong>Very Good Chocolate</strong>이 만드는 소량 생산 케이크를 Melrose Park 픽업 예약으로 만나보세요.</>
              ) : (
                <>Small-batch cakes made by <strong>Very Good Chocolate</strong>,<br className="hero-description-break" /> available by pre-order for confirmed Melrose Park pick-up.</>
              )}
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => navigateToCake('pave-chocolate-cake')}>
                {language === 'ko' ? '파베 케이크 보기' : 'View Pave cake'}
              </button>
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
                    className={`hero-cake-slide${cake.className === 'hero-cake-four' ? ' hero-cake-slide-lemon' : ''}`}
                    data-position={position}
                    key={cake.label}
                  >
                    <img src={cake.image} alt="" className={`hero-cake ${cake.className}`} draggable="false" />
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
                <div className="product-image-wrap">
                  {card.isPhotoComingSoon ? <VanillaFreshCreamCakeSilhouette /> : <img src={catalogImages[card.imageKey]} alt={card.name} />}
                  {card.id === 'cheesecake' && (
                    <img
                      className="gluten-free-stamp"
                      src={glutenFreeStampImg}
                      alt={language === 'ko' ? '글루텐 프리' : 'Gluten-free'}
                    />
                  )}
                </div>
                <div>
                  <strong>{card.name}</strong>
                  <p>{card.description}</p>
                </div>
                <ul>
                  {card.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <dl>
                  <div>
                    <dt>{copy.price}</dt>
                    <dd>{card.priceLabel}</dd>
                  </div>
                  <div>
                    <dt>{copy.options}</dt>
                    <dd>{card.optionLabel}</dd>
                  </div>
                </dl>
                <button className="secondary-button full-width" type="button" onClick={() => navigateToCake(card.slug)}>
                  {language === 'ko' ? '상세 보기' : 'View details'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section policy-section" id="reservation-guide">
          <h2>{copy.reservationGuideTitle}</h2>
          <div className="policy-manual">
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>01</span>
                <Clipboard size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[0].title}</strong>
                <p>{copy.guideSteps[0].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>02</span>
                <MessageCircleCheck size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[1].title}</strong>
                <p>{copy.guideSteps[1].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>03</span>
                <Wallet size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[2].title}</strong>
                <p>{copy.guideSteps[2].text}</p>
              </div>
            </article>
            <article className="policy-step">
              <div className="policy-step-figure">
                <span>04</span>
                <CalendarDays size={28} strokeWidth={1.7} />
              </div>
              <div>
                <strong>{copy.guideSteps[3].title}</strong>
                {marketConfig.market === 'AU' ? (
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
            {language === 'ko' ? '예약 주문으로 준비하는 소량 제작 초콜릿 케이크' : 'Small-batch chocolate cakes for pre-order'}
          </h2>
          <div className="cake-information-grid">
            <article>
              <h3>{language === 'ko' ? '초콜릿이 중심인 레시피' : 'Chocolate-first recipes'}</h3>
              <p>{language === 'ko' ? '파베 초콜릿 케이크, 파운드케이크와 컵케이크, 두 가지 초코 바스크 치즈케이크 중 선택할 수 있어요. 확정된 주문에 맞춰 소량으로 준비합니다.' : 'Choose from pave chocolate cake, pound cake or cupcakes, and two chocolate Basque cheesecake finishes. Each order is made in a small batch.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? '원하는 옵션 선택' : 'Choose your finish'}</h3>
              <p>{language === 'ko' ? '케이크에 따라 사이즈, 다크 또는 밀크 초콜릿, 초콜릿 추가, 바닐라 크림 마감을 선택할 수 있어요.' : 'Available options vary by cake and include multiple sizes, dark or milk chocolate, extra chocolate, and vanilla cream finishes.'}</p>
            </article>
            <article>
              <h3>{language === 'ko' ? 'Melrose Park 사전 약속 픽업' : 'Pre-arranged Melrose Park pick-up'}</h3>
              <p>{language === 'ko' ? '방문 매장 없이 운영하는 홈베이킹 서비스입니다. 신청 후 Jenny가 가능 여부, 결제 정보, 정확한 Melrose Park 전달 장소를 안내해 드려요.' : 'This is a home-baking service without a walk-in shop. Jenny confirms availability, payment details, and the exact Melrose Park handoff point after your request.'}</p>
            </article>
          </div>
        </section>

        <section className="content-section cake-faq-section" aria-labelledby="cake-faq-title">
          <h2 id="cake-faq-title">{language === 'ko' ? '시드니 케이크 주문 FAQ' : 'Sydney cake order FAQ'}</h2>
          <div className="cake-faq-list">
            <details>
              <summary>{language === 'ko' ? '케이크는 어디서 픽업하나요?' : 'Where do I pick up my cake?'}</summary>
              <p>{language === 'ko' ? 'Sydney Melrose Park에서 사전 약속 픽업으로 진행됩니다. 방문 매장은 없으며 주문 확정 후 Jenny가 정확한 전달 방법을 안내해 드려요.' : 'Pick-up is arranged in Melrose Park, Sydney. There is no walk-in shop, so Jenny sends the exact meeting details after confirming your order.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '신청서를 보내면 바로 주문이 확정되나요?' : 'Is submitting the form a confirmed order?'}</summary>
              <p>{language === 'ko' ? '아니요. Jenny가 먼저 가능 여부를 확인하고 결제 정보를 보내드립니다. 입금이 확인되면 주문이 최종 확정됩니다.' : 'No. Jenny first checks availability and sends payment details. Your order is confirmed after payment is received.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '어떤 초콜릿 케이크를 주문할 수 있나요?' : 'Which chocolate cakes can I order?'}</summary>
              <p>{language === 'ko' ? '파베 초콜릿 케이크, 파운드케이크 또는 컵케이크 1다스, 초코 바스크와 파베초코 바스크 치즈케이크를 신청할 수 있습니다.' : 'You can request pave chocolate cake, pound cake or a dozen cupcakes, and chocolate Basque cheesecake with either a classic or pave chocolate finish.'}</p>
            </details>
            <details>
              <summary>{language === 'ko' ? '시드니 배송이나 방문 구매가 가능한가요?' : 'Do you offer Sydney delivery or walk-in sales?'}</summary>
              <p>{language === 'ko' ? '현재는 제공하지 않습니다. Melrose Park 사전 약속 픽업 주문만 받고 있습니다.' : 'Not currently. Orders are made for pre-arranged pick-up in Melrose Park only.'}</p>
            </details>
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
      <button className="sticky-cta" type="button" onClick={() => navigateToCake('pave-chocolate-cake')}>
        {language === 'ko' ? '케이크 자세히 보기' : 'View cake details'}
      </button>
    </>
  )
}
