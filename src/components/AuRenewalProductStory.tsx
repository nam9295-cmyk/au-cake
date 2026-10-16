import { RENEWAL_CARDS, type RenewalCard } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { RENEWAL_OFFERS } from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import { renewalPickupCopy } from '../../appwrite-functions/reservation-api/src/au-renewal-pickup-policy.js'
import { renewalDetailPresentation } from '../lib/renewal-detail-presentation'
import { getCakeEditorialBySlug, type CompactCakeEditorialContent } from '../lib/cake-editorial'
import type { Language } from '../lib/i18n'
import { AuDetailStory, DetailHeading } from './AuDetailStory'
import { AuPaveProductStory } from './AuPaveProductStory'
import { ProductPhoto } from './ProductOptionControls'

function renewalEditorial(card: RenewalCard, language: Language): CompactCakeEditorialContent | null {
  const editorial = getCakeEditorialBySlug(card.href.split('?')[0].split('/').at(-1)!, language)
  if (!editorial) return null
  if (editorial.layout !== 'compact') return {
    layout: 'compact',
    highlights: editorial.quickFacts,
    orderingNotice: { title: editorial.ordering.title, body: editorial.ordering.intro },
    details: { title: editorial.insideCake.title, items: editorial.insideCake.items },
    ingredientsAndAllergens: editorial.ingredients,
    pickupAndConfirmation: { title: editorial.ordering.title },
    relatedProductSlugs: [],
  }
  if (card.id === 'brownie-whole' || card.id === 'brownie-loaf') return {
    ...editorial,
    details: { ...editorial.details, items: [
      ...editorial.details.items.slice(0, 4),
      language === 'ko' ? '바닐라 생크림 — AUD 10을 추가해 선택할 수 있습니다.' : 'Vanilla Fresh Cream — Available for an additional AUD 10.',
    ] },
  }
  return editorial
}

function RenewalRelated({ card, language }: { card: RenewalCard; language: Language }) {
  const ko = language === 'ko'
  const cards = Object.values(RENEWAL_CARDS).flat()
    .filter(c => c.id !== card.id && ['pave', 'gateau-loaf', 'brownie-whole', 'almond'].includes(c.id)).slice(0, 3)
  return <section className="au-pave-related" data-detail-section="related">
    <DetailHeading eyebrow={ko ? '다른 상품도 살펴보세요' : 'EXPLORE MORE'} title={ko ? '함께 살펴볼 상품' : 'You May Also Enjoy'} />
    <div className="au-pave-related-grid">{cards.map(c => <a key={c.id} href={c.href}>
      <div><ProductPhoto src={c.image} label={ko ? c.ko : c.en} /></div>
      <h3>{ko ? c.ko : c.en}</h3><p>AUD {(RENEWAL_OFFERS[c.offers[0]].price! / 100).toFixed(2)}</p>
    </a>)}</div>
  </section>
}

export function AuRenewalProductStory({ card, language }: { card: RenewalCard; language: Language }) {
  const ko = language === 'ko'
  const editorial = renewalEditorial(card, language)
  const features = card.id === 'almond' ? (ko
    ? ['통아몬드', '초콜릿 코팅', '80g 파우치 · 5+1 · 블랙 통 80g × 2']
    : ['A whole almond centre', 'Chocolate coating', '80g pouch · 5+1 packs · Black Tub 2 × 80g'])
    : card.id === 'smore' ? (ko
      ? ['스틱 마시멜로 디저트', '커버춰 초콜릿 코팅', '6개 또는 12개 팩']
      : ['Marshmallow on a stick', 'Couverture chocolate coating', 'Packs of 6 or 12']) : []
  const detail = {
    description: editorial?.highlights[0]?.body || (ko ? card.ko : card.en),
    features: editorial?.highlights.map(h => h.title) || features,
    accordions: [
      { title: ko ? '주문 방법' : 'How ordering works', body: ko
        ? '위에서 구성과 수량을 선택해 장바구니에 담고 예약을 요청해주세요. 베리굿 팀이 가능 여부를 확인한 뒤 결제 정보를 안내합니다.'
        : 'Choose your options and quantity above, add to your bag and request a reservation. Our team checks availability before sending payment details.' },
      { title: ko ? '픽업' : 'Pick-up', body: renewalPickupCopy(language).hours },
      { title: ko ? '주문 확정' : 'Order confirmation', body: ko
        ? '예약 요청만으로 주문이 확정되지는 않습니다. 제작 가능 여부 확인과 결제가 끝난 뒤 최종 확정됩니다.'
        : 'Submitting a request does not confirm the order. Your order is confirmed after availability is checked and payment is received.' },
    ],
  }
  const related = <RenewalRelated card={card} language={language} />
  if (card.id === 'pave') return <AuPaveProductStory detail={detail} editorial={editorial} language={language} relatedContent={related} />
  const presentation = renewalDetailPresentation(card)
  if (presentation) return <AuDetailStory presentation={presentation} detail={detail} editorial={editorial} language={language} relatedContent={related}
    packagingPhoto={['gateau-loaf', 'brownie-whole'].includes(card.id) ? <ProductPhoto label={ko ? `${card.ko} 포장` : `${card.en} packaging`} /> : undefined} />
  return <div className="au-pave-story">
    <section className="au-pave-practical" data-detail-section="practical">
      <DetailHeading eyebrow={ko ? '상품 안내' : 'DETAILS & CARE'} title={ko ? '상품 상세 및 알레르기 안내' : 'Product Details & Allergens'} />
      <div className="au-pave-specs">
        {editorial && <>
          <details open><summary>{editorial.details.title}</summary><div>{editorial.details.items.map(item => <p key={item}>{item}</p>)}</div></details>
          <details open><summary>{editorial.ingredientsAndAllergens.ingredientsLabel}</summary><div><p>{editorial.ingredientsAndAllergens.ingredients}</p></div></details>
          <details open><summary>{editorial.ingredientsAndAllergens.allergenLabel}</summary><div><p>{editorial.ingredientsAndAllergens.allergens}</p><p>{editorial.ingredientsAndAllergens.contact}</p></div></details>
        </>}
        {detail.accordions.map(item => <details open key={item.title}><summary>{item.title}</summary><div><p>{item.body}</p></div></details>)}
        {!editorial && <details open><summary>{ko ? '원재료 및 알레르기' : 'Ingredients & allergens'}</summary><div><p>{ko ? '원재료와 알레르기는 주문 전 문의해주세요.' : 'Please contact us about ingredients and allergies before ordering.'}</p></div></details>}
      </div>
    </section>
    {related}
  </div>
}
