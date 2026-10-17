import type {CustomerOrderDetail as Detail} from '../lib/customer-account-types'
import type {Language} from '../lib/i18n'
import type {PublicReservation} from '../lib/types'
import {OrderDetailRows} from './ProductDetailRows'
import {renewalLineSummary} from '../../appwrite-functions/reservation-api/src/au-renewal'
import {customerOrderStatusLabel} from '../lib/customer-account-copy'
export function CustomerOrderDetail({detail,language,onClose}:{detail:Detail;language:Language;onClose:()=>void}) {
  const t=(en:string,ko:string)=>language==='ko'?ko:en
  return <section className="customer-order-detail" aria-label={t('Order details','주문 상세')}>
    <button type="button" onClick={onClose}>{t('Close details','상세 닫기')}</button><h3>{detail.reservationNumber}</h3>
    <p>{detail.pickupDate} {detail.pickupTime} · Australia/Sydney</p>
    <dl>{detail.view.format==='renewal'?detail.view.orderLines.map((line,index)=><div key={index}><dt>{renewalLineSummary(line,{lines:detail.view.format==='renewal'?detail.view.orderLines:[],language})}</dt><dd>{new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(line.totalPriceCents/100)}</dd></div>):<OrderDetailRows reservation={{...detail.view,reservationNumber:detail.reservationNumber,pickupDate:detail.pickupDate,pickupTime:detail.pickupTime,status:detail.status,paymentStatus:detail.paymentStatus} as unknown as PublicReservation} language={language}/>}
      <div><dt>{t('Order status','주문 상태')}</dt><dd>{customerOrderStatusLabel(detail.status,language)}</dd></div><div><dt>{t('Payment status','결제 상태')}</dt><dd>{customerOrderStatusLabel(detail.paymentStatus,language)}</dd></div>
      <div><dt>{t('Total','총액')}</dt><dd>{detail.totalPriceCents===null?t('To be confirmed','확인 예정'):new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(detail.totalPriceCents/100)}</dd></div>
      <div><dt>{t('Order contact','주문 연락처')}</dt><dd>{detail.contact.name}<br/>{detail.contact.phone}<br/>{detail.contact.email}</dd></div>
      {detail.requestNote&&<div><dt>{t('Note','요청사항')}</dt><dd>{detail.requestNote}</dd></div>}
    </dl>
  </section>
}
