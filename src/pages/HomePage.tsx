import { MochiLaunchNotice } from "../components/MochiLaunchNotice"
import { renewalPickupCopy } from '../../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js'
import { RENEWAL_NAV } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { HomeCustomerStories } from '../components/CustomerStories'
import { AuRedesignHeader } from '../components/AuRedesignChrome'
import { AuHeroVideo } from '../components/AuHeroVideo'
import { HomePage as LegacyHomePage } from './LegacyHomePage'
import serviceAssets from '../content/au-service-assets.json'
import homeCopy from '../content/au-home-v02.json'
import {
  getAuHomeBest,
  getAuHomeCollections,
  type HomeCollectionId,
  type HomeProduct,
} from '../lib/au-home'
import { marketConfig } from '../lib/market'

export function HomePage(props: Parameters<typeof LegacyHomePage>[0]) {
  return marketConfig.market === 'AU' ? (
    <AuHomePage {...props} />
  ) : (
    <LegacyHomePage {...props} />
  )
}

function ServicePhoto({ asset }: { asset: keyof typeof serviceAssets }) {
  const image = serviceAssets[asset]
  return (
    <img
      src={image.variants[0].src}
      srcSet={image.variants.map((v) => `${v.src} ${v.width}w`).join(', ')}
      sizes="(max-width: 767px) 100vw, 40vw"
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
    />
  )
}

function CollectionCard({ product }: { product: HomeProduct }) {
  const body = (
    <>
      <div className="au-v02-product-heading">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
      </div>
      {product.image && <img
        src={product.image}
        alt={product.imageAlt}
        width={1080}
        height={1012}
        loading="lazy"
        decoding="async"
      />
      }<div className="au-v02-product-price">
        <strong>
          {product.comingSoon ? product.description : product.price}
        </strong>
        {product.href && <ArrowUpRight size={16} aria-hidden="true" />}
      </div>
    </>
  )
  return (
    <article className="au-v02-product" data-home-product={product.id}>
      {product.href ? (
        <a href={product.href}>{body}</a>
      ) : (
        <div className="au-v02-coming-soon">{body}</div>
      )}
    </article>
  )
}

function visibleBestIndex(track: HTMLDivElement) {
  const maximum = track.scrollWidth - track.clientWidth
  if (maximum <= 2) return 0
  const lastIndex = track.children.length - 1
  if (track.scrollLeft >= maximum - 2) return lastIndex
  const first = track.children[0] as HTMLElement
  const second = track.children[1] as HTMLElement
  return Math.min(
    lastIndex,
    Math.round(track.scrollLeft / (second.offsetLeft - first.offsetLeft)),
  )
}

function AuHomePage({
  language,
  cartItemCount,
}: Parameters<typeof LegacyHomePage>[0]) {
  const t = (en: string, ko: string) => (language === 'ko' ? ko : en)
  const collections = getAuHomeCollections(language)
  const [activeCategory, setActiveCategory] =
    useState<HomeCollectionId>('whole')
  const active = collections.find((category) => category.id === activeCategory)!
  const best = getAuHomeBest(language)
  const bestTrack = useRef<HTMLDivElement>(null)
  const [bestIndex, setBestIndex] = useState(0)
  useEffect(() => {
    let frame = 0
    const revealHash = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const id = window.location.hash.slice(1)
        if (['story', 'au-collection', 'business'].includes(id))
          document.getElementById(id)?.scrollIntoView({ block: 'start' })
      })
    }
    revealHash()
    window.addEventListener('hashchange', revealHash)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', revealHash)
    }
  }, [])
  const scrollBest = (index: number) => {
    const track = bestTrack.current
    if (track)
      track.scrollTo({
        left:
          (track.children[index] as HTMLElement).offsetLeft -
          (track.children[0] as HTMLElement).offsetLeft,
        behavior: 'instant',
      })
  }
  const services = [
    {
      slug: 'events',
      title: t('Corporate & Events', '기업 행사 & 이벤트'),
      status: t('Event enquiries', '행사 문의'),
      text: t(
        'Cakes, cupcakes and chocolate gifts for office milestones, weddings, birthdays and gatherings.',
        '사무실 행사, 웨딩, 생일과 모임을 위한 케이크, 컵케이크와 초콜릿 선물.',
      ),
      asset: 'events-hero' as const,
      action: t('EVENT ENQUIRIES', '행사 문의'),
    },
    {
      slug: 'cafe-supply',
      title: t('Café Supply / Wholesale', '카페 공급 / 도매'),
      status: t('Coming Soon · Enquiries', '준비 중 · 문의'),
      text: t(
        'Explore our cakes and chocolate creations for your café. Supply arrangements are discussed by enquiry.',
        '카페를 위한 케이크와 초콜릿을 소개합니다. 공급 관련 내용은 문의를 통해 안내합니다.',
      ),
      asset: 'sharing' as const,
      action: t('WHOLESALE ENQUIRIES', '카페 공급 문의'),
    },
    {
      slug: 'consulting',
      title: t('Menu & Experience Consulting', '메뉴 & 경험 컨설팅'),
      status: t('Introduction · Enquiries', '서비스 소개 · 문의'),
      text: t(
        'Start a conversation about menu, display, packaging and customer experience for your venue.',
        '메뉴, 디스플레이, 포장과 고객 경험에 관해 이야기 나눠보세요.',
      ),
      action: t('CONSULTING ENQUIRIES', '컨설팅 문의'),
    },
  ]
  return (
    <div className="home-redesign-wrap au-home-v02">
      <AuRedesignHeader cartItemCount={cartItemCount} home />
      <MochiLaunchNotice language={language} />
      <section className="rd-hero" aria-labelledby="au-home-title">
        <AuHeroVideo />
        <div className="au-v02-hero-copy">
          <p className="au-v02-eyebrow">VERYGOOD · SYDNEY</p>
          <h1 tabIndex={-1} id="au-home-title" className="rd-hero-copy">
            {t(homeCopy.headline, '초콜릿, 케이크, 그리고 축하의 순간.')}
          </h1>
          <p className="au-v02-hero-description">
            {t(
              homeCopy.description,
              '시드니에서 주문 제작하는 케이크와 초콜릿. 메뉴, 커스텀 케이크와 비즈니스 서비스를 만나보세요.',
            )}
          </p>
          <div className="au-v02-hero-actions">
            <a className="au-v02-button" href="/#au-collection">
              {t('EXPLORE THE MENU', '메뉴 둘러보기')}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a
              className="au-v02-button au-v02-button-outline"
              href="/#business"
            >
              {t('BUSINESS ENQUIRIES', '비즈니스 문의')}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <section
        id="best"
        className="au-v02-best"
        aria-labelledby="au-best-title"
      >
        <div className="au-v02-section-heading">
          <p className="au-v02-eyebrow">
            {t(`SIGNATURE FAVOURITES · BEST [${best.length}]`, `시그니처 베스트 · BEST [${best.length}]`)}
          </p>
          <h2 id="au-best-title">
            {t('OUR MOST REQUESTED CREATIONS', '가장 사랑받는 디저트')}
          </h2>
          <p>
            {t(
              'Cakes and chocolate favourites from our Sydney atelier.',
              '베리굿에서 사랑받는 케이크와 초콜릿.',
            )}
          </p>
        </div>
        <div
          className="au-v02-best-track"
          ref={bestTrack}
          role="region"
          aria-label={t('Best cakes and chocolate', '베스트 케이크와 초콜릿')}
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.target !== event.currentTarget ||
              !['ArrowLeft', 'ArrowRight'].includes(event.key)
            )
              return
            event.preventDefault()
            scrollBest(
              Math.max(
                0,
                Math.min(
                  best.length - 1,
                  visibleBestIndex(event.currentTarget) +
                    (event.key === 'ArrowRight' ? 1 : -1),
                ),
              ),
            )
          }}
          onScroll={(event) => {
            setBestIndex(visibleBestIndex(event.currentTarget))
          }}
        >
          {best.map((product, index) => (
            <article className="au-v02-best-card" key={product.id} data-best-product={product.id}>
              <a
                className="au-v02-best-image"
                href={product.href!}
                tabIndex={-1}
                aria-hidden="true"
              >
                <img
                  src={product.image}
                  alt=""
                  width={1080}
                  height={1012}
                  loading="lazy"
                  decoding="async"
                />
              </a>
              <div className="au-v02-best-body">
                <span className="au-v02-best-rank">
                  BEST {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <a className="au-v02-best-action" href={product.href!} aria-label={t(`Choose options for ${product.name}, ${product.price}`, `${product.name} 옵션 선택, ${product.price}`)}>
                  <strong>{product.price}</strong>
                  <span>
                    {t('CHOOSE OPTIONS', '옵션 선택')}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </a>
              </div>
            </article>
          ))}
        </div>
        <div
          className="au-v02-best-indicators"
          aria-label={t('Best product position', '베스트 카드 위치')}
        >
          {best.map((product, index) => (
            <button
              key={product.id}
              type="button"
              aria-label={t(`Show ${product.name}`, `${product.name} 보기`)}
              aria-pressed={bestIndex === index}
              onClick={() => scrollBest(index)}
            >
              <span />
            </button>
          ))}
        </div>
      </section>
      <section
        id="au-collection"
        className="rd-collection-section au-v02-collection"
        aria-label={t('The AU collection', 'AU 컬렉션')}
      >
        <aside className="au-v02-collection-sidebar">
          <p className="au-v02-collection-brand">VERYGOOD</p>
          <div
            className="au-v02-tabs"
            role="tablist"
            aria-label={t('Collection categories', '상품 카테고리')}
          >
            {collections.map((category, index) => (
              <button
                key={category.id}
                id={`home-tab-${category.id}`}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.id}
                aria-controls="home-collection-panel"
                tabIndex={activeCategory === category.id ? 0 : -1}
                onClick={() => setActiveCategory(category.id)}
                onKeyDown={(event) => {
                  if (
                    ![
                      'ArrowRight',
                      'ArrowDown',
                      'ArrowLeft',
                      'ArrowUp',
                      'Home',
                      'End',
                    ].includes(event.key)
                  )
                    return
                  event.preventDefault()
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 2
                        : (index +
                            (['ArrowRight', 'ArrowDown'].includes(event.key)
                              ? 1
                              : 2)) %
                          3
                  setActiveCategory(collections[next].id)
                  document
                    .getElementById(`home-tab-${collections[next].id}`)
                    ?.focus()
                }}
              >
                {category.label}
                <span>[{category.products.length}]</span>
              </button>
            ))}
          </div>
          <div className="au-v02-atelier-note">
            <p className="au-v02-eyebrow">MELROSE PARK ATELIER</p>
            <p>
              {t(
                'Made to order with thoughtful ingredients and chocolatier-grade couverture.',
                '쇼콜라티에급 커버춰와 정성껏 고른 재료로 주문 제작합니다.',
              )}
            </p>
          </div>
        </aside>
        <div
          id="home-collection-panel"
          className="au-v02-collection-main"
          role="tabpanel"
          aria-labelledby={`home-tab-${activeCategory}`}
        >
          <div className="au-v02-collection-heading">
            <h2>
              {t(
                activeCategory === 'whole'
                  ? 'Cake & Bake'
                  : activeCategory === 'sharing'
                    ? 'Celebrate'
                    : 'Chocolate',
                active.label,
              )}
            </h2>
            <span>
              {active.products.length} {t('ATELIER CREATIONS', '개의 상품')}
            </span>
          </div>
          <div className="au-v02-product-grid">
            {active.products.map((product) => (
              <CollectionCard key={product.id} product={product} />
            ))}
          </div>
          <div className="au-v02-collection-links">
            <a href="/cakes">
              {t('ALL CAKES', '케이크 전체 보기')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="/celebrate">{t('CELEBRATE','Celebrate 전체 보기')}</a>
            <a href="/chocolates">
              {t('ALL CHOCOLATES', '초콜릿 전체 보기')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <section
        className="au-v02-craft"
        aria-label={t(
          'Chocolate cake craftsmanship',
          '초콜릿 케이크 제작 과정',
        )}
      >
        <img
          src="/redesign/3906.jpg"
          alt={t(
            'Chocolate cake layers being assembled by hand',
            '손으로 초콜릿 케이크를 만드는 과정',
          )}
          width={1920}
          height={1080}
          loading="lazy"
          decoding="async"
        />
      </section>
      <HomeCustomerStories />
      <section
        id="custom-cakes"
        className="au-v02-custom"
        aria-labelledby="au-custom-title"
      >
        <div className="au-v02-custom-banner">
          <img
            src="/products/custom-cake.webp"
            alt={t(
              'Colourful custom celebration cakes',
              '다채로운 커스텀 케이크',
            )}
            width={1080}
            height={1012}
            loading="lazy"
            decoding="async"
          />
          <div>
            <p className="au-v02-eyebrow">
              {t('BESPOKE CELEBRATION PIECES', '특별한 날을 위한 맞춤 제작')}
            </p>
            <h2 id="au-custom-title">
              {t(
                'A CAKE MADE FOR YOUR OCCASION.',
                '당신의 특별한 날을 위한 케이크.',
              )}
            </h2>
            <p>
              {t(
                'Share your date, servings, design ideas and budget. Explore our custom cake portfolio and discuss a cake made for your occasion.',
                '날짜, 인원, 디자인 아이디어와 예산을 알려주세요. 특별한 날을 위한 케이크를 문의하세요.',
              )}
            </p>
            <a className="au-v02-button" href="/cakes/custom-cake">
              {t('EXPLORE CUSTOM CAKES', '커스텀 케이크 둘러보기')}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <section
        id="business"
        className="au-v02-business"
        aria-labelledby="au-business-title"
      >
        <div className="au-v02-section-heading">
          <p className="au-v02-eyebrow">
            {t('COMMERCIAL & PARTNERSHIPS', '비즈니스 & 파트너십')}
          </p>
          <h2 id="au-business-title">
            {t(
              'FOR EVENTS, CAFÉS & BUSINESSES.',
              '이벤트, 카페와 비즈니스를 위해.',
            )}
          </h2>
          <p>
            {t(
              'Explore our event, café supply and consulting services.',
              '행사, 카페 공급 및 컨설팅 서비스를 소개합니다.',
            )}
          </p>
        </div>
        <div className="au-v02-business-grid">
          {services.map((service) => (
            <article key={service.slug}>
              {service.asset ? (
                <ServicePhoto asset={service.asset} />
              ) : (
                <img
                  src="/home/consulting-gift-box-480.webp"
                  srcSet="/home/consulting-gift-box-480.webp 480w, /home/consulting-gift-box-960.webp 960w"
                  sizes="(max-width: 767px) 100vw, 33vw"
                  alt={t(
                    'Strawberry cream cake with a candle beside white flowers',
                    '흰 꽃 옆에 초를 꽂은 딸기 크림 케이크',
                  )}
                  width={2048}
                  height={1152}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div>
                <span className="au-v02-service-status">{service.status}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <a href={`/business/${service.slug}`}>
                  {service.action}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section
        id="story"
        className="au-v02-story"
        aria-labelledby="au-story-title"
      >
        <div>
          <p className="au-v02-eyebrow">VERYGOOD ATELIER · SYDNEY</p>
          <h2 id="au-story-title">{t('OUR STORY.', '우리의 이야기.')}</h2>
          <p>
            {t(
              'Handcrafted cakes and chocolate creations, made to order in our Sydney atelier. Chocolatier-grade couverture chocolate and thoughtful ingredients, with pre-arranged pickup in Melrose Park.',
              '시드니 아틀리에에서 케이크와 초콜릿을 정성껏 주문 제작합니다. 쇼콜라티에급 커버춰와 엄선한 재료를 사용하며, 멜로즈 파크에서 사전 약속 후 픽업합니다.',
            )}
          </p>
          <a className="au-v02-button au-v02-button-outline" href="/portfolio">
            {t('EXPLORE ATELIER PORTFOLIO', '아틀리에 포트폴리오 보기')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
        <ServicePhoto asset="worktable" />
      </section>
      <footer className="rd-footer au-v02-footer">
        <p>{t(renewalPickupCopy('en').hours,renewalPickupCopy('ko').hours)}</p>
        <div className="au-v02-footer-links">
          <div>
            <a href="/classes">
              {t('KIDS CLASSES', '키즈 클래스')}{' '}
              <span>{t('TEMPORARILY PAUSED', '일시 휴강')}</span>
            </a>
            <p>
              {t(
                'Currently paused. Next school holiday dates will be announced once confirmed.',
                '현재 휴강 중입니다. 다음 방학 일정은 확정 후 안내합니다.',
              )}
            </p>
          </div>
          <nav aria-label="Footer navigation">
            {RENEWAL_NAV.map(item=><a key={item.href} href={item.href}>{item.en}</a>)}
            <a href="/classes">{t('VIEW CLASS ARCHIVE', '클래스 아카이브 보기')}</a>
            <a href="/reviews">{t('REVIEWS', '후기')}</a>
            <a href="/lookup">{t('ORDER LOOKUP', '주문 조회')}</a>
          </nav>
        </div>
        <div className="au-v02-footer-bottom">
          <a href="/">VERYGOOD CHOCOLATE ATELIER · SYDNEY</a>
          <a
            href="https://www.instagram.com/verygood_syd/"
            target="_blank"
            rel="noreferrer"
          >
            INSTAGRAM @verygood_syd
          </a>
          <small>© 2026 VERYGOOD</small>
        </div>
      </footer>
    </div>
  )
}
