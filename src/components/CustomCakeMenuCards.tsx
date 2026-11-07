import { CUSTOM_CAKE_MENU } from '../lib/custom-cake-menu'
import { CUSTOM_CAKE_BASE_PRICES, formatCents } from '../lib/custom-cake-ui'
import { useAuLanguage } from '../lib/au-language'
const classProcess = '/services/private-class-process.webp'
const classFinished = '/services/private-class-finished.webp'

export function CustomCakeMenuCards() {
  const { language, t } = useAuLanguage()
  return <section className="au-custom-menu-grid" aria-label={t('Cake and private class menus', '케이크와 프라이빗 클래스 메뉴')}>
    {CUSTOM_CAKE_MENU.map(menu => {
      const cake = menu.kind === 'custom-cake'
      const image = cake ? `/portfolio/04-custom-cakes-${menu.tier === 'single' ? '3' : '2'}-640.webp` : menu.tier === 'single' ? classProcess : classFinished
      const name = language === 'ko' ? menu.nameKo : menu.nameEn
      const from = menu.tier === 'single' ? CUSTOM_CAKE_BASE_PRICES.single['6in'] : CUSTOM_CAKE_BASE_PRICES.double['4in+6in']
      return <article key={menu.id} data-menu-id={menu.id}>
        <img src={image} alt={cake ? name : t('Previous class materials and finished cakes', '기존 클래스의 준비 재료와 완성 케이크')} width={640} height={480} loading="lazy" decoding="async" />
        <div>
          <h2>{name}</h2>
          <p>{cake ? t('An original cake designed for your celebration. Final quote after review.', '특별한 날을 위한 맞춤 디자인 케이크. 검토 후 최종 견적을 안내합니다.') : t('Discuss a private cake class with us. Details and availability are confirmed by enquiry.', '프라이빗 케이크 수업을 문의하세요. 수업 내용과 가능 일정은 상담 후 안내합니다.')}</p>
          <p>{cake ? `${t('From', '기본가')} ${formatCents(from)}` : t('Enquire for pricing', '수업료 문의')}</p>
          <a className="au-service-button" href={menu.href}>{cake ? t('Request a cake', '케이크 문의') : t('Enquire about this class', '이 클래스 문의')}</a>
        </div>
      </article>
    })}
  </section>
}
