import KoreanCakeReviewsSection from './KoreanCakeReviewsSection'
import type { CakeCatalogCard } from './lib/cake-catalog'
import type { CakeDetailData } from './lib/cake-detail'
import type {
  CakeEditorialContent,
  CakeEditorialImageKey,
} from './lib/cake-editorial'
import type { Language } from './lib/i18n'

type CakeEditorialImage = {
  src: string
  width: number
  height: number
}

type CakeEditorialDetailProps = {
  editorial: CakeEditorialContent
  language: Language
  slug: string
  selectedSizeLabel: string
  selectedUnitPrice: string
  estimatedTotal: string
  detailAccordions: CakeDetailData['accordions']
  relatedProducts: readonly CakeCatalogCard[]
  images: Record<CakeEditorialImageKey, CakeEditorialImage>
  addedToOrder: boolean
  onAddToOrder: () => void
  onViewOrder: () => void
  onBrowseCakes: () => void
  onOpenCake: (slug: string) => void
}

function EditorialHeading({
  eyebrow,
  title,
  intro,
  id,
}: {
  eyebrow: string
  title: string
  intro?: string
  id?: string
}) {
  return (
    <header className="cake-editorial-heading">
      <p className="cake-editorial-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {intro && <p>{intro}</p>}
    </header>
  )
}

export default function CakeEditorialDetail({
  editorial,
  language,
  slug,
  detailAccordions,
  relatedProducts,
  images,
  addedToOrder,
  onAddToOrder,
  onViewOrder,
  onBrowseCakes,
  onOpenCake,
}: CakeEditorialDetailProps) {
  const isKorean = language === 'ko'
  const lifestyleImage = editorial.lifestyle.lifestyleImage
  const hasGiftImages = editorial.giftPresentation.imageKeys.length > 0
  const canonicalOrdering = detailAccordions[0]?.body

  return (
    <div className="cake-editorial-detail">
      <section className="cake-editorial-facts" aria-label={isKorean ? '케이크 핵심 정보' : 'Cake quick facts'}>
        <div className="cake-editorial-fact-grid">
          {editorial.quickFacts.map((fact, index) => (
            <article key={fact.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{fact.title}</strong>
              <p>{fact.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={'cake-editorial-lifestyle' + (lifestyleImage ? ' has-image' : ' is-text-only')}>
        {lifestyleImage && (
          <img
            src={lifestyleImage}
            alt=""
            width="1280"
            height="720"
            loading="lazy"
            decoding="async"
          />
        )}
        <EditorialHeading
          eyebrow={editorial.lifestyle.eyebrow}
          title={editorial.lifestyle.title}
          intro={editorial.lifestyle.body}
        />
      </section>

      <section className="cake-editorial-moments" aria-labelledby="cake-editorial-moments-title">
        <EditorialHeading
          eyebrow={isKorean ? '이런 순간에' : 'Made for moments like these'}
          title={isKorean ? '함께 기억할 세 가지 순간' : 'Three reasons to gather'}
          id="cake-editorial-moments-title"
        />
        <div className="cake-editorial-moment-grid">
          {editorial.moments.map((moment, index) => (
            <article key={moment.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{moment.title}</h3>
              <p>{moment.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cake-editorial-inside" aria-labelledby="cake-editorial-inside-title">
        <div className="cake-editorial-inside-copy">
          <EditorialHeading
            eyebrow={editorial.insideCake.eyebrow}
            title={editorial.insideCake.title}
            intro={editorial.insideCake.intro}
            id="cake-editorial-inside-title"
          />
          <ol>
            {editorial.insideCake.items.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="cake-editorial-inside-images">
          {editorial.insideCake.imageKeys.map((imageKey) => {
            const image = images[imageKey]
            return (
              <img
                src={image.src}
                alt=""
                width={image.width}
                height={image.height}
                loading="lazy"
                decoding="async"
                key={imageKey}
              />
            )
          })}
        </div>
      </section>

      <section className="cake-editorial-taste" aria-labelledby="cake-editorial-taste-title">
        <EditorialHeading
          eyebrow={editorial.tasteProfile.eyebrow}
          title={editorial.tasteProfile.title}
          id="cake-editorial-taste-title"
        />
        <div className="cake-editorial-taste-list">
          {editorial.tasteProfile.items.map((item, index) => (
            <p key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </p>
          ))}
        </div>
      </section>

      <section className="cake-editorial-reviews" aria-label={isKorean ? '한국 고객 후기' : 'Korean customer reviews'}>
        <KoreanCakeReviewsSection slug={slug} language={language} />
      </section>

      <section className="cake-editorial-info" aria-labelledby="cake-editorial-info-title">
        <EditorialHeading
          eyebrow={editorial.ingredients.eyebrow}
          title={editorial.ingredients.title}
          id="cake-editorial-info-title"
        />
        <div className="cake-editorial-info-grid">
          <article>
            <span>01</span>
            <h3>{editorial.ingredients.ingredientsLabel}</h3>
            <p>{editorial.ingredients.ingredients}</p>
          </article>
          <article>
            <span>02</span>
            <h3>{editorial.ingredients.allergenLabel}</h3>
            <p>{editorial.ingredients.allergens}</p>
            <p>{editorial.ingredients.contact}</p>
          </article>
          {detailAccordions.slice(1, 3).map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 3).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cake-editorial-ordering" aria-labelledby="cake-editorial-ordering-title">
        <div className="cake-editorial-ordering-inner">
          <EditorialHeading
            eyebrow={editorial.ordering.eyebrow}
            title={editorial.ordering.title}
            intro={editorial.ordering.intro}
            id="cake-editorial-ordering-title"
          />
          <div className="cake-editorial-ordering-grid">
            {editorial.ordering.steps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          {canonicalOrdering && <p className="cake-editorial-canonical-ordering">{canonicalOrdering}</p>}
          <p className="cake-editorial-payment-note">{editorial.ordering.paymentNote}</p>
        </div>
      </section>

      <section className={'cake-editorial-gift' + (hasGiftImages ? '' : ' is-text-only')} aria-labelledby="cake-editorial-gift-title">
        <div className="cake-editorial-gift-copy">
          <EditorialHeading
            eyebrow={editorial.giftPresentation.eyebrow}
            title={editorial.giftPresentation.title}
            intro={editorial.giftPresentation.body}
            id="cake-editorial-gift-title"
          />
        </div>
        {hasGiftImages && (
          <div className="cake-editorial-gift-images">
            {editorial.giftPresentation.imageKeys.map((imageKey) => {
              const image = images[imageKey]
              return (
                <img
                  src={image.src}
                  alt=""
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  decoding="async"
                  key={imageKey}
                />
              )
            })}
          </div>
        )}
      </section>

      <section className="cake-editorial-related" aria-labelledby="cake-editorial-related-title">
        <div className="cake-editorial-related-header">
          <EditorialHeading
            eyebrow={isKorean ? '이어지는 초콜릿 컬렉션' : 'Continue the chocolate collection'}
            title={isKorean ? '함께 살펴볼 케이크' : 'Related products'}
            id="cake-editorial-related-title"
          />
          <button type="button" className="secondary-button" onClick={onBrowseCakes}>
            {isKorean ? '전체 케이크' : 'View all cakes'}
          </button>
        </div>
        <div className="cake-editorial-related-grid">
          {relatedProducts.map((product) => (
            <button type="button" onClick={() => onOpenCake(product.slug)} key={product.slug}>
              <img
                src={product.imagePath}
                alt=""
                width="1080"
                height="1012"
                loading="lazy"
                decoding="async"
              />
              <span>{product.name}</span>
              <strong>{product.priceLabel}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="cake-editorial-final" aria-labelledby="cake-editorial-final-title">
        <div>
          <p className="cake-editorial-eyebrow">{editorial.finalCta.eyebrow}</p>
          <h2 id="cake-editorial-final-title">{editorial.finalCta.title}</h2>
          <p>{editorial.finalCta.body}</p>
        </div>
        <div className="cake-editorial-final-actions">
          <button type="button" className="primary-button" onClick={onAddToOrder}>
            {isKorean ? '주문에 담기' : 'Add to order'}
          </button>
          {addedToOrder && (
            <button type="button" className="secondary-button" onClick={onViewOrder}>
              {isKorean ? '주문 보기' : 'View order'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
