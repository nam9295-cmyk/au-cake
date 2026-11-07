import { getCustomCakeMenuCards } from '../lib/custom-cake-menu'
import { useAuLanguage } from '../lib/au-language'

export function CustomCakeMenuCards() {
  const { language, t } = useAuLanguage()
  return <section className="au-custom-menu-grid" aria-label={t('Cake and private class menus', '케이크와 프라이빗 클래스 메뉴')}>
    {getCustomCakeMenuCards(language).map(menu => <article key={menu.id} data-menu-id={menu.id}>
      <img src={menu.image} alt={menu.imageAlt} width={640} height={480} loading="lazy" decoding="async" />
      <div>
        <h2>{menu.name}</h2>
        <p>{menu.description}</p>
        <p>{menu.price}</p>
        <a className="au-service-button" href={menu.href}>{menu.action}</a>
      </div>
    </article>)}
  </section>
}
