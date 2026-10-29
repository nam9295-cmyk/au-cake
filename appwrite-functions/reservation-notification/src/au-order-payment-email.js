import { AU_CUSTOMER_EMAIL_CONTACT as CONTACT } from '../shared/customer-email-contact.js'

const MAP = 'https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw'
const INSTAGRAM = `https://www.instagram.com/${CONTACT.instagram}/`
const SUBJECTS = {
  received: '[Verygood] Order Received: Payment Required 🍫 | 주문이 접수되었습니다! 결제를 진행해 주세요',
  confirmed: '[Verygood] Payment Received: Booking Confirmed 🍫 | 결제가 확인되었습니다! 예약이 최종 확정되었습니다',
}
// Keep user-controlled values in a single text cell, never trusted HTML.
function cell(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/gu, ' ').replace(/\s+/gu, ' ').trim()
}
function escape(value) {
  return cell(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
const para = html => `<p style="margin:0 0 16px;">${html}</p>`
const link = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" style="color:#5b2417;text-decoration:underline;">${escape(label)}</a>`
const panel = (title, html) => `<div style="border:1px solid #e8ded5;border-radius:8px;overflow:hidden;margin:0 0 20px;"><div style="padding:12px;background:#5b2417;color:#fff;font-weight:700;">${escape(title)}</div>${html}</div>`
const table = rows => `<table role="presentation" style="border-collapse:collapse;width:100%;table-layout:fixed;"><tbody>${rows.map(([label, html]) => `<tr><th style="width:32%;padding:10px 12px;border-bottom:1px solid #e8ded5;background:#fbf6ef;text-align:left;vertical-align:top;font-weight:600;">${escape(label)}</th><td style="padding:10px 12px;border-bottom:1px solid #e8ded5;vertical-align:top;overflow-wrap:anywhere;">${html}</td></tr>`).join('')}</tbody></table>`

function section({ reservation, amount, detailRows, confirmed, ko }) {
  const name = cell(reservation.customerName)
  const language = ko ? '한국어' : 'English'
  const heading = confirmed
    ? ko ? '결제가 확인되었습니다' : 'Payment received'
    : ko ? '주문이 접수되었습니다' : 'Your order has been received'
  const greeting = ko ? `안녕하세요, ${name}님.` : `Hi ${name},`
  const intro = confirmed
    ? ko ? '입금이 확인되어 예약이 최종 확정되었습니다. 주문하신 상품을 준비해 둘게요. 픽업 때 뵙겠습니다!' : 'Your payment has been received and checked, and your booking is now confirmed. We look forward to seeing you at pickup!'
    : ko ? '베리굿 초콜릿을 찾아주셔서 감사합니다! 주문이 정상적으로 접수되었습니다. 최종 예약 확정을 위해 아래 방법으로 결제해 주세요.' : 'Thank you for choosing Very Good Chocolate! Your order has been received. Please complete your payment below to confirm your booking.'
  const paymentHeading = confirmed
    ? ko ? '✅ 결제 확인 · 예약 확정' : '✅ Payment checked · Booking confirmed'
    : ko ? '💳 결제 안내' : '💳 Payment details'
  const amountLabel = confirmed ? ko ? '결제 확인 금액' : 'Payment received' : ko ? '총 결제금액' : 'Amount due'
  const noFurtherPayment = ko ? '추가 결제는 필요하지 않습니다.' : 'No further payment is required.'
  const chooseMethod = ko ? 'PayID와 계좌이체 중 한 가지 방법으로 한 번만 결제해 주세요.' : 'Choose PayID or bank transfer and make one payment only.'
  const bank = ko ? '계좌이체' : 'Bank transfer'
  const reference = `${ko ? '송금 메모 / Reference' : 'Payment reference'}: ${name}`
  const referenceHelp = ko ? '예약자 성함을 반드시 적어 주세요.' : 'Please use the name on your booking.'
  const nextHeading = ko ? '✅ 다음 단계' : '✅ Next step'
  const next = ko ? '입금 확인 후 예약 최종 확정 메일을 보내드립니다.' : 'Once your payment has been checked, we’ll send your Booking Confirmed email.'
  const detailsHeading = ko ? '🛍️ 주문 및 픽업 안내' : '🛍️ Order & pickup details'
  const pickupTime = cell(reservation.pickupTime)
  const location = ['1 Bundil Blvd, Melrose Park', ko ? '인근 길가, 작은 놀이터 쪽' : 'Street pickup nearby, by the small playground']
  const rows = [
    [ko ? '예약 번호' : 'Booking number', cell(reservation.reservationNumber)],
    ...detailRows.map(([label, value]) => [cell(label), cell(value)]),
    [ko ? '픽업 날짜' : 'Pickup date', cell(reservation.pickupDate)],
    [ko ? '픽업 시간' : 'Pickup time', pickupTime ? `${pickupTime} — ${ko ? '시드니 시간' : 'Sydney time'}` : ko ? '시간 미정' : 'To be arranged'],
  ]
  const locationLabel = ko ? '픽업 장소' : 'Pickup location'
  const mapLabel = ko ? '지도' : 'Map'
  const arrive = ko ? '도착하시면 아래 제니 연락처로 전화나 문자를 주세요. 주문하신 상품을 가지고 내려갑니다.' : 'Please call or text Jenny when you arrive, and she will bring your order down to you.'
  const contactLabel = `${ko ? '문의' : 'Contact'}: ${CONTACT.name} · `
  const phone = ko ? CONTACT.local : CONTACT.international
  const signOff = ko ? '감사합니다.' : 'Thank you,'
  const notice = ko ? '본 메일은 발송 전용으로 회신을 확인하지 않습니다. 변경사항이나 문의는 제니에게 전화·문자 또는 인스타그램으로 부탁드립니다.' : 'This is a send-only email; replies are not monitored. For changes or enquiries, please contact Jenny by phone or Instagram.'
  const bankLines = ['BSB: 012263', 'Account: 324999682', 'Name: JEONGMIN CHEON']
  // PayID is the separately approved payment destination, not a support setting.
  const payId = 'PayID: 0421 567 776'
  const text = [
    `[${language}]`, heading, '', greeting, '', intro, '', paymentHeading, `${amountLabel}: ${amount}`,
    ...(confirmed ? [noFurtherPayment] : [chooseMethod, payId, bank, ...bankLines, reference, referenceHelp, '', nextHeading, next]),
    '', detailsHeading, ...rows.map(([label, value]) => `${label}: ${value}`),
    `${locationLabel}: ${location.join(' — ')}`, `${mapLabel}: ${MAP}`, '', arrive,
    '', `${contactLabel}${phone}`, `Instagram: @${CONTACT.instagram}`, '', signOff, 'Very Good Chocolate', '', notice,
  ].join('\n')
  const paymentHtml = `<div style="padding:16px;"><div style="font-size:13px;color:#6b4b3e;">${amountLabel}</div><div style="font-size:28px;font-weight:700;margin:3px 0 ${confirmed ? '8' : '12'}px;">${escape(amount)}</div>${confirmed ? noFurtherPayment : [
    para(ko ? 'PayID와 계좌이체 중 <strong>한 가지 방법으로 한 번만</strong> 결제해 주세요.' : 'Choose PayID or bank transfer and make <strong>one payment only</strong>.'),
    para(`<strong>${payId}</strong>`),
    para(`<strong>${bank}</strong><br>${bankLines.join('<br>')}`),
    `<strong>${escape(reference)}</strong><br><span style="font-size:13px;">${referenceHelp}</span>`,
  ].join('')}</div>`
  const html = `<section lang="${ko ? 'ko' : 'en'}"><p style="margin:0 0 8px;color:#6b4b3e;font-size:13px;font-weight:700;">[${language}]</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">${heading}</h1>${para(escape(greeting))}${para(intro)}${panel(paymentHeading, paymentHtml)}${confirmed ? '' : para(`<strong>${nextHeading}</strong><br>${ko ? '입금 확인 후 <strong>예약 최종 확정 메일</strong>을 보내드립니다.' : 'Once your payment has been checked, we’ll send your <strong>Booking Confirmed email</strong>.'}`)}${panel(detailsHeading, table([
    ...rows.map(([label, value]) => [label, escape(value)]),
    [locationLabel, location.map(escape).join('<br>')],
    [mapLabel, link(MAP, ko ? '픽업 위치 지도 열기 ↗' : 'Open pickup map ↗')],
  ]))}${para(arrive)}${para(`<strong>${escape(contactLabel)} ${link(CONTACT.telephoneUri, phone)}</strong><br>Instagram: ${link(INSTAGRAM, `@${CONTACT.instagram}`)}`)}${para(`${signOff}<br>Very Good Chocolate`)}<p style="margin:0;color:#6b4b3e;font-size:13px;">${notice}</p></section>`
  return { text, html }
}

// The caller supplies only canonical, customer-safe item rows and the stored total.
export function buildAuOrderPaymentEmail({ reservation, amount, detailRows, koreanDetailRows, confirmed = false }) {
  const english = section({ reservation, amount, detailRows, confirmed, ko: false })
  const korean = section({ reservation, amount, detailRows: koreanDetailRows, confirmed, ko: true })
  return {
    subject: SUBJECTS[confirmed ? 'confirmed' : 'received'],
    text: `${english.text}\n\n--------------------\n\n${korean.text}`,
    html: `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a1710;line-height:1.55;max-width:640px;margin:0 auto;">${english.html}<div style="border-top:1px solid #e8ded5;margin:28px 0;"></div>${korean.html}</div>`,
  }
}
