import type { MouseEvent } from 'react'
import { getAuCakeCatalogGroups } from './lib/cake-catalog'
import type { Language } from './lib/i18n'
import { getPublicRoutePage } from './lib/public-content'

export default function CakesPage({
  language,
  onOpenCake,
}: {
  language: Language
  onOpenCake: (slug: string) => void
}) {
  const groups = getAuCakeCatalogGroups(language)
  const publicPage = getPublicRoutePage('/cakes')!

  const openCake = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    event.preventDefault()
    onOpenCake(slug)
  }

  return (
    <main className="cakes-index-page">
      <header className="cakes-index-header">
        <p className="summary-kicker">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
        <h1>{language === 'ko' ? '케이크를 골라보세요' : publicPage.h1}</h1>
        <p>{language === 'ko'
          ? '사진과 옵션, 가격을 확인한 뒤 원하는 케이크를 요청할 수 있어요.'
          : publicPage.intro}</p>
      </header>
      <div className="cakes-index-groups" aria-label={language === 'ko' ? '케이크 목록' : 'Cake catalogue'}>
        {groups.map((group, groupIndex) => {
          const headingId = `cakes-index-group-${group.id}`
          return (
            <section className="cakes-index-group" aria-labelledby={headingId} key={group.id}>
              <header className="cake-catalog-group-header cakes-index-group-header">
                <span className="cake-catalog-group-number" aria-hidden="true">{group.number}</span>
                <div>
                  <h2 id={headingId}>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
              </header>
              <div className="cake-catalog-group-products cakes-index-group-products">
                {group.cards.map((card, cardIndex) => {
                  const productNumber = groupIndex * 2 + cardIndex + 1

                  if (card.isComingSoonOnly) {
                    return (
                      <article className="cakes-index-card cakes-index-card-coming-soon" key={card.slug}>
                        <div className="cakes-index-image">
                          {card.imagePath ? (
                            <img
                              src={card.imagePath}
                              alt={card.name}
                              loading="lazy"
                              decoding="async"
                              width={1080}
                              height={1012}
                              className="cakes-index-img"
                            />
                          ) : (
                            <span className="cakes-index-coming-soon">
                              <b>COMING SOON</b>
                              <small>{language === 'ko' ? '출시 준비 중' : 'Coming soon'}</small>
                            </span>
                          )}
                          <span className="cakes-index-number">{String(productNumber).padStart(2, '0')}</span>
                        </div>
                        <div className="cakes-index-copy">
                          <h3>{card.name}</h3>
                          <p className="cakes-index-card-description">{card.description}</p>
                          <div className="cakes-index-card-price">
                            <strong>COMING SOON</strong>
                          </div>
                        </div>
                      </article>
                    )
                  }

                  return (
                    <article className="cakes-index-card" key={card.slug}>
                      <a
                        href={`/cakes/${card.slug}`}
                        className="cakes-index-image"
                        onClick={(event) => openCake(event, card.slug)}
                      >
                        {card.isPhotoComingSoon ? (
                          <span className="cakes-index-coming-soon">
                            <b>COMING SOON</b>
                            <small>{language === 'ko' ? '사진 준비 중' : 'Photo pending'}</small>
                          </span>
                        ) : (
                          <img
                            src={card.imagePath}
                            alt={card.name}
                            width={1080}
                            height={1012}
                            loading={productNumber === 1 ? 'eager' : 'lazy'}
                            decoding="async"
                          />
                        )}
                        <span className="cakes-index-number">{String(productNumber).padStart(2, '0')}</span>
                      </a>
                      <div className="cakes-index-copy">
                        <h3>
                          <a href={`/cakes/${card.slug}`} onClick={(event) => openCake(event, card.slug)}>
                            {card.name}
                          </a>
                        </h3>
                        <p className="cakes-index-card-description">{card.description}</p>
                        <div className="cakes-index-card-price">
                          <strong>{card.priceLabel}</strong>
                          <span className="cakes-index-card-option">{card.optionLabel}</span>
                        </div>
                        <a
                          href={`/cakes/${card.slug}`}
                          className="secondary-button"
                          onClick={(event) => openCake(event, card.slug)}
                        >
                          {language === 'ko' ? '상세 보기' : 'View details'}
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}

        <section className="cakes-index-group" aria-labelledby="cakes-index-group-custom-creative">
          <header className="cake-catalog-group-header cakes-index-group-header">
            <span className="cake-catalog-group-number" aria-hidden="true">05</span>
            <div>
              <h2 id="cakes-index-group-custom-creative">
                {language === 'ko' ? '커스텀 & 크리에이티브' : 'CUSTOM & CREATIVE'}
              </h2>
              <p>
                {language === 'ko'
                  ? '원하는 디자인과 구성으로 완성하는 맞춤형 기념 케이크.'
                  : 'Bespoke cakes tailored to your unique celebration and design.'}
              </p>
            </div>
          </header>
          <div className="cake-catalog-group-products cakes-index-group-products">
            <article className="cakes-index-card">
              <a
                href="/cakes/custom-cake"
                className="cakes-index-image"
                onClick={(event) => openCake(event, 'custom-cake')}
              >
                <img
                  src="/products/buttercream-cake-sydney.webp"
                  alt={language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}
                  width={1080}
                  height={1012}
                  loading="lazy"
                  decoding="async"
                />
                <span className="cakes-index-number">09</span>
              </a>
              <div className="cakes-index-copy">
                <h3>
                  <a href="/cakes/custom-cake" onClick={(event) => openCake(event, 'custom-cake')}>
                    {language === 'ko' ? '커스텀 케이크' : 'CUSTOM CAKE'}
                  </a>
                </h3>
                <p className="cakes-index-card-description">
                  {language === 'ko' ? '원하는 디자인으로 완성하는 특별한 기념 케이크.' : 'Your celebration, made your way.'}
                </p>
                <div className="cakes-index-card-price">
                  <strong>From AUD $155</strong>
                  <span className="cakes-index-card-option">
                    {language === 'ko' ? '1단 / 2단 · 6가지 사이즈' : 'Single & Double Tier · 6 sizes'}
                  </span>
                </div>
                <a
                  href="/cakes/custom-cake"
                  className="secondary-button"
                  onClick={(event) => openCake(event, 'custom-cake')}
                >
                  {language === 'ko' ? '상세 보기' : 'View details'}
                </a>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}
