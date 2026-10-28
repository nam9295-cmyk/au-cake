import { HALLOWEEN_MERINGUE_CARD } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { RENEWAL_OFFERS } from '../../appwrite-functions/reservation-api/src/au-renewal.js'
import type { Language } from '../lib/i18n'
import { useHalloweenAvailability } from '../lib/use-halloween-availability'

export function HalloweenMeringueSection({ language }: { language: Language }) {
  const available = useHalloweenAvailability()
  if (!available) return null
  const ko = language === 'ko'
  const card = HALLOWEEN_MERINGUE_CARD
  return <section className="au-meringue-season" aria-labelledby="halloween-title">
    <a className="au-meringue-season-photo" href={card.href} tabIndex={-1} aria-hidden="true">
      <img src={card.image} alt="" width={1080} height={1440} loading="lazy" decoding="async" />
    </a>
    <div className="au-meringue-season-copy">
      <p className="au-v02-eyebrow">HALLOWEEN SPECIAL · 2026</p>
      <h2 id="halloween-title">{ko ? card.ko : card.en}</h2>
      <p>{ko ? '작은 유령과 알록달록 몬스터로 준비한 할로윈 머랭쿠키. 함께 나눌 만큼 골라 담아보세요.' : 'Little ghosts and colourful monsters, made for Halloween. Choose a pack to share.'}</p>
      <ul className="au-meringue-season-prices" aria-label={ko ? '세트 가격' : 'Pack prices'}>
        {card.offers.map(id => {
          const offer = RENEWAL_OFFERS[id]
          return <li key={id}><span>{offer.pieces}{ko ? '개' : ' pieces'}</span><strong>${(offer.price! / 100).toFixed(0)}</strong></li>
        })}
      </ul>
      <p className="au-meringue-season-dates">{ko ? '수·금·토·일 픽업 · 마지막 픽업 11월 1일(일)' : 'Wed, Fri, Sat & Sun pickup · Final pickup Sun 1 November'}</p>
      <p className="au-meringue-season-deadline">{ko ? '픽업 최소 24시간 전 주문 · 최종 마감 10월 31일 오후 1시 (시드니)' : 'Order at least 24 hours ahead · Final orders Sat 31 October, 1pm (Sydney)'}</p>
      <a className="au-v02-button" href={card.href}>{ko ? '세트 선택하기' : 'CHOOSE YOUR PACK'} <span aria-hidden="true">↗</span></a>
    </div>
  </section>
}
