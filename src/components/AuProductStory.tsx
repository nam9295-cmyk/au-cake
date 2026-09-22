import KoreanCakeReviewsSection from '../KoreanCakeReviewsSection'
import { AuProductCard } from './AuRedesignChrome'
import { auEditorialImages, getAuOrderableCakeCards } from '../lib/au-catalog'
import type { CakeDetailData } from '../lib/cake-detail'
import type { CakeEditorialContent } from '../lib/cake-editorial'
import type { Language } from '../lib/i18n'

export function AuProductStory({ detail, editorial, party, language, onOpenCake }: {
  detail: CakeDetailData
  editorial: CakeEditorialContent | null
  party: boolean
  language: Language
  onOpenCake: (slug: string) => void
}) {
  const compact = editorial?.layout === 'compact' ? editorial : null
  const highlights = compact?.highlights || detail.features.slice(0, 3).map((title) => ({ title }))
  const ingredients = compact?.ingredientsAndAllergens
  const related = getAuOrderableCakeCards(language).filter((card) => card.slug !== detail.slug)
  const suggested = related.filter((card) => editorial?.relatedProductSlugs.includes(card.slug))
  return <div className="au-redesign-product-story">
    <section className="au-redesign-highlights" aria-label="Cake highlights">
      {highlights.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h2>{item.title}</h2>{'body' in item && item.body && <p>{item.body}</p>}</article>)}
    </section>
    {party ? <section className="au-redesign-party"><h2>PARTY, CELEBRATION & CORPORATE CATERING</h2><div>
      <article><img src={auEditorialImages.celebration} alt="A celebration table — editorial reference" loading="lazy" width={700} height={380} /><h3>BIRTHDAYS & FAMILY GATHERINGS</h3><p>Made for sharing, from intimate gatherings to a full celebration table.</p></article>
      <article><img src={auEditorialImages.craft} alt="Preparing chocolate desserts in the atelier" loading="lazy" width={700} height={380} /><h3>CORPORATE EVENTS & CLIENT GIFTS</h3><p>Choose your pack and the available packaging above. Our team confirms availability and pick-up with your order.</p></article>
    </div></section> : <figure className="au-redesign-occasion"><img src={auEditorialImages.celebration} alt="A celebration table — editorial reference" loading="lazy" width={1440} height={560} /><figcaption><strong>CRAFTED FOR YOUR CELEBRATIONS</strong><p>Made to order for your confirmed collection date in Sydney.</p></figcaption></figure>}
    <section className="au-redesign-specifications" aria-label="Product information">
      <h2>CAKE DETAILS & ALLERGENS</h2>
      <dl>
        {compact && <><dt>{compact.details.title}</dt><dd>{compact.details.items.map((item) => <p key={item}>{item}</p>)}</dd></>}
        {ingredients && <><dt>{ingredients.ingredientsLabel}</dt><dd>{ingredients.ingredients}</dd><dt>{ingredients.allergenLabel}</dt><dd>{ingredients.allergens}<p>{ingredients.contact}</p></dd></>}
        {compact?.storageAndServing && <><dt>{compact.storageAndServing.title}</dt><dd>{compact.storageAndServing.items.map((item) => <p key={item}>{item}</p>)}</dd></>}
        {detail.accordions.map((item) => <div className="au-redesign-spec-row" key={item.title}><dt>{item.title}</dt><dd>{item.body}</dd></div>)}
      </dl>
    </section>
    <KoreanCakeReviewsSection slug={detail.slug} language={language} />
    <section className="au-redesign-related"><h2>MORE FROM THE ATELIER</h2><div className="au-redesign-product-grid">
      {(suggested.length ? suggested : related).slice(0, 2).map((card) => <AuProductCard key={card.slug} slug={card.slug}
        href={`/cakes/${card.slug}`} name={card.name} image={card.imagePath} description={card.optionLabel}
        price={card.priceLabel} onOpen={() => onOpenCake(card.slug)} />)}
    </div></section>
  </div>
}
