import { AuProductCard } from '../components/AuRedesignChrome'
import { auEditorialImages, getAuChocolateCollectionCards, getAuOrderableCakeCards } from '../lib/au-catalog'
import type { Language } from '../lib/i18n'
import { marketConfig } from '../lib/market'

export function AuCategoryPage({ category, language, onOpenCake }: {
  category: 'cakes' | 'chocolates'
  language: Language
  onOpenCake?: (slug: string) => void
}) {
  if (marketConfig.market !== 'AU') return null
  const t = (en: string, ko: string) => language === 'ko' ? ko : en
  const cakes = getAuOrderableCakeCards(language)
  const chocolates = getAuChocolateCollectionCards(language)
  const isCake = category === 'cakes'
  return <main className="au-redesign-category" data-au-category={category}>
    <header className="au-redesign-category-heading">
      <h1>{isCake ? t('CAKES', '케이크') : t('CHOCOLATES', '초콜릿')} <span>[{isCake ? cakes.length : chocolates.length}]</span></h1>
      <p>{isCake
        ? t('Handcrafted cakes, made to order for your celebrations. Pre-arranged pick-up in Melrose Park, Sydney.', '축하의 순간을 위해 주문 제작하는 수제 케이크. 시드니 Melrose Park에서 사전 예약 후 픽업하실 수 있습니다.')
        : t('Explore our artisan chocolates and choose a pack for pre-arranged pick-up in Melrose Park, Sydney.', '수제 초콜릿과 원하는 구성을 골라보세요. 시드니 Melrose Park에서 사전 예약 후 픽업하실 수 있습니다.')}</p>
    </header>
    <div className="au-redesign-category-layout">
      <aside className="au-redesign-category-rail">
        <strong>VERYGOOD</strong>
        <nav aria-label="Product categories">
          <a href="/#au-collection">{t('ALL CREATIONS', '전체 상품')}</a>
          <a href="/cakes" aria-current={isCake ? 'page' : undefined}>{t('CAKES', '케이크')} [{cakes.length}]</a>
          <a href="/chocolates" aria-current={!isCake ? 'page' : undefined}>{t('CHOCOLATES', '초콜릿')} [{chocolates.length}]</a>
          <a href="/cakes/custom-cake">{t('CUSTOM CAKES', '커스텀 케이크')}</a>
        </nav>
        <div className="au-redesign-atelier-note"><strong>MELROSE PARK ATELIER</strong><p>{isCake
          ? t('Pre-arranged pick-up only. Availability is confirmed after your request.', '사전 예약 픽업만 가능합니다. 주문 요청 후 가능 여부를 확인해드립니다.')
          : t('Choose your chocolates and pack, then add them to your order.', '원하는 초콜릿과 구성을 선택하여 주문에 담아주세요.')}</p></div>
      </aside>
      <div className="au-redesign-product-grid">
        {isCake ? cakes.map((card) => <AuProductCard key={card.slug} slug={card.slug}
          href={`/cakes/${card.slug}`} name={card.name} image={card.imagePath}
          description={card.optionLabel} price={card.priceLabel}
          onOpen={onOpenCake ? () => onOpenCake(card.slug) : undefined} />)
          : chocolates.map((card) => <AuProductCard key={card.slug} slug={card.slug}
            href={card.href} name={card.name} image={card.image} imageAlt={card.imageAlt}
            description={card.description} price={card.price} />)}
      </div>
    </div>
    <figure className="au-redesign-wide-photo"><img src={isCake ? auEditorialImages.making : auEditorialImages.craft} alt="Chocolate and cake making in the atelier" loading="lazy" width={1440} height={480} /></figure>
  </main>
}
