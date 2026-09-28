import { AuProductCard } from '../components/AuRedesignChrome'
import { auEditorialImages, getAuOrderableCakeCards } from '../lib/au-catalog'
import { getAuChocolatePreviews } from '../lib/au-chocolate-preview'
import { auChocolateAssets } from '../lib/au-chocolate-assets'
import type { Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'

export function AuCategoryPage({ category, language, onOpenCake }: {
  category: 'cakes' | 'chocolates'
  language: Language
  onOpenCake?: (slug: string) => void
}) {
  if (marketConfig.market !== 'AU') return null
  const cakes = getAuOrderableCakeCards(language)
  const chocolates = getAuChocolatePreviews()
  const isCake = category === 'cakes'
  return <main className="au-redesign-category" data-au-category={category}>
    <header className="au-redesign-category-heading">
      <h1>{isCake ? 'CAKES' : 'CHOCOLATES'} <span>[{isCake ? cakes.length : chocolates.length}]</span></h1>
      <p>{isCake
        ? 'Handcrafted cakes, made to order for your celebrations. Pre-arranged pick-up in Melrose Park, Sydney.'
        : 'Explore our artisan chocolates and choose a pack for pre-arranged pick-up in Melrose Park, Sydney.'}</p>
    </header>
    <div className="au-redesign-category-layout">
      <aside className="au-redesign-category-rail">
        <strong>VERYGOOD</strong>
        <nav aria-label="Product categories">
          <a href="/#au-collection">ALL CREATIONS</a>
          <a href="/cakes" aria-current={isCake ? 'page' : undefined}>CAKES [{cakes.length}]</a>
          <a href="/chocolates" aria-current={!isCake ? 'page' : undefined}>CHOCOLATES [{chocolates.length}]</a>
          <a href="/cakes/custom-cake">CUSTOM CAKES</a>
        </nav>
        <div className="au-redesign-atelier-note"><strong>MELROSE PARK ATELIER</strong><p>{isCake
          ? 'Pre-arranged pick-up only. Availability is confirmed after your request.'
          : 'Choose your chocolates and pack, then add them to your order.'}</p></div>
      </aside>
      <div className="au-redesign-product-grid">
        {isCake ? cakes.map((card) => <AuProductCard key={card.slug} slug={card.slug}
          href={`/cakes/${card.slug}`} name={card.name} image={card.imagePath}
          description={card.optionLabel} price={card.priceLabel}
          onOpen={onOpenCake ? () => onOpenCake(card.slug) : undefined} />)
          : chocolates.map((card) => <AuProductCard key={card.slug} slug={card.slug}
            href={`/chocolates/${card.slug}`} name={card.name} image={auChocolateAssets[card.slug].src} imageAlt={auChocolateAssets[card.slug].alt}
            description={card.packLabel} price={card.price} />)}
      </div>
    </div>
    <figure className="au-redesign-wide-photo"><img src={isCake ? auEditorialImages.making : auEditorialImages.craft} alt="Chocolate and cake making in the atelier" loading="lazy" width={1440} height={480} /></figure>
  </main>
}
