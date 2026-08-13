import { getAuCakeCatalogCards } from './lib/cake-catalog'
import type { Language } from './lib/i18n'

export default function CakesPage({
  language,
  onOpenCake,
}: {
  language: Language
  onOpenCake: (slug: string) => void
}) {
  const cards = getAuCakeCatalogCards(language)

  return (
    <main className="cakes-index-page">
      <header className="cakes-index-header">
        <p className="summary-kicker">{language === 'ko' ? 'Sydney · 주문 제작' : 'Sydney · Made to order'}</p>
        <h1>{language === 'ko' ? '케이크를 골라보세요' : 'Choose your cake'}</h1>
        <p>{language === 'ko'
          ? '사진과 옵션, 가격을 확인한 뒤 원하는 케이크를 요청할 수 있어요.'
          : 'Explore the photos, options and prices before sending your cake request.'}</p>
      </header>
      <section className="cakes-index-grid" aria-label={language === 'ko' ? '케이크 목록' : 'Cake catalogue'}>
        {cards.map((card, index) => (
          <article className="cakes-index-card" key={card.slug}>
            <a
              href={`/cakes/${card.slug}`}
              className="cakes-index-image"
              onClick={(event) => {
                event.preventDefault()
                onOpenCake(card.slug)
              }}
            >
              {card.isPhotoComingSoon ? (
                <span className="cakes-index-coming-soon">
                  <b>COMING SOON</b>
                  <small>{language === 'ko' ? '사진 준비 중 · 주문 가능' : 'Photo pending · Available to request'}</small>
                </span>
              ) : (
                <img
                  src={card.imagePath}
                  alt={card.name}
                  width={1080}
                  height={1012}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              )}
              <span className="cakes-index-number">0{index + 1}</span>
            </a>
            <div className="cakes-index-copy">
              <h2>{card.name}</h2>
              <p>{card.description}</p>
              <div>
                <strong>{card.priceLabel}</strong>
                <span>{card.optionLabel}</span>
              </div>
              <a
                href={`/cakes/${card.slug}`}
                className="secondary-button"
                onClick={(event) => {
                  event.preventDefault()
                  onOpenCake(card.slug)
                }}
              >
                {language === 'ko' ? '상세 보기' : 'View details'}
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
