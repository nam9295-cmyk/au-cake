import {
  buildEmailDeliveryEventKey,
  normalizeRecipientEmail,
  payloadHashForEmail,
  recipientHashForEmail,
  resendIdempotencyKeyForEvent,
} from '../shared/email-delivery/email-delivery.js'
import { deliverEmail } from '../shared/email-delivery/email-delivery-sender.js'
import { escapeHtml, plainTextCell } from '../shared/email-template-safety.js'
import { parseStoredOrderLines } from '../shared/reservation-api/business.js'
import {
  addSydneyCalendarDays,
  formatSydneyDateKey,
  isSydneyReminderWindow,
} from '../shared/sydney-calendar.js'

export const BOOKING_REMINDER_TEMPLATE = 'booking-reminder-d1-customer'
export const BOOKING_REMINDER_PAGE_SIZE = 50
export const BOOKING_REMINDER_CONCURRENCY = 3
export const BOOKING_REMINDER_MODE_DRY_RUN = 'dry-run'
export const BOOKING_REMINDER_MODE_SEND = 'send'

const CAKE_CONFIRMED_STATUS = '예약확정'
const CLASS_CONFIRMED_STATUS = 'Confirmed'
const CAKE_PICKUP_MAP_URL = 'https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw'
const CAKE_PRODUCT_LABELS = Object.freeze({
  'pave-cake': 'Pave Chocolate Cake',
  'vanilla-fresh-cream-cake': 'Vanilla Fresh Cream Cake',
  'buttercream-cake': 'Buttercream Cake',
  'fresh-strawberry-vanilla-cream-cake': 'Fresh Strawberry Vanilla Cream Cake',
  'fresh-strawberry-chocolate-cream-cake': 'Fresh Strawberry Chocolate Cream Cake',
  'pound-cake': 'Signature Gâteau au Chocolat',
  'cupcake-half-dozen': 'Chocolate Cupcakes (Half Dozen)',
  'cupcake-dozen': 'Chocolate Cupcakes (Dozen)',
})
const CAKE_SIZE_LABELS = Object.freeze({
  '15cm': '6\" | serves 8',
  '19cm': '7.5\" | serves 14',
  '22cm': '9\" | serves 22',
  '6in': '6\"',
  '8in': '8\"',
  '10in': '10\"',
})
const CLASS_TYPE_LABELS = Object.freeze({
  'school-holiday-private-cake-class': 'Basic Cake Class',
  'cupcake-chocolate-class': 'Basic Cupcakes & Chocolate Class',
  'advanced-2-tier-cake-class': 'Advanced 2-Tier Cake Class',
})

export function buildBookingReminderEventKey({ sourceType, reservationId, sessionKind, scheduledDate } = {}) {
  const occurrence = sourceType === 'cake'
    ? scheduledDate
    : `${sessionKind || ''}:${scheduledDate || ''}`
  try {
    return buildEmailDeliveryEventKey({
      template: BOOKING_REMINDER_TEMPLATE,
      sourceType,
      sourceId: reservationId,
      occurrence,
    })
  } catch {
    throw new Error('INVALID_BOOKING_REMINDER_EVENT')
  }
}

function sourceIdForReservation(reservation) {
  return reservation?.$id || reservation?.$rowId || reservation?.id
}

function safeHeaderValue(value, field) {
  const normalized = plainTextCell(value)
  if (!normalized) throw new Error(`INVALID_${field}`)
  return normalized
}

function optionalReplyTo(value) {
  if (value === undefined || value === null || !String(value).trim()) return null
  return normalizeRecipientEmail(value)
}

function compactCakeLineSummary(line) {
  const product = CAKE_PRODUCT_LABELS[line?.productId] || plainTextCell(line?.productId) || 'Cake order'
  const size = CAKE_SIZE_LABELS[line?.cakeSize] || plainTextCell(line?.cakeSize)
  const quantity = Number.isInteger(Number(line?.quantity)) && Number(line.quantity) > 0
    ? Math.min(99, Math.floor(Number(line.quantity)))
    : 1
  return [product, size, `× ${quantity}`].filter(Boolean).join(' · ')
}

function compactCakeOrderSummary(reservation) {
  const storedLines = parseStoredOrderLines(reservation)
  const lines = storedLines?.lines?.length ? storedLines.lines : [reservation]
  return lines.map(compactCakeLineSummary).join(' / ')
}

function classCourseLabel(reservation) {
  return CLASS_TYPE_LABELS[reservation?.classType] || plainTextCell(reservation?.classType) || 'Kids Class'
}

function sessionProjection(reservation, sessionKind) {
  if (sessionKind === 'first') {
    return {
      date: plainTextCell(reservation?.classDate),
      time: plainTextCell(reservation?.classTime),
      koreanKind: '첫 수업',
      englishKind: 'First session',
    }
  }
  if (sessionKind === 'advanced') {
    return {
      date: plainTextCell(reservation?.advancedClassDate),
      time: plainTextCell(reservation?.advancedClassTime),
      koreanKind: 'Advanced 세션',
      englishKind: 'Advanced session',
    }
  }
  throw new Error('INVALID_BOOKING_REMINDER_EVENT')
}

function bilingualText({ korean, english }) {
  return [`[한국어]`, ...korean, '', '--------------------', '', '[English]', ...english].join('\n')
}

function rowText(rows) {
  return rows.map(([label, value]) => `${plainTextCell(label)}: ${plainTextCell(value)}`).join('\n')
}

function rowsHtml(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <th style="width:42%;padding:10px 12px;border:1px solid #e8ded5;background:#fbf6ef;text-align:left;vertical-align:top;">${escapeHtml(plainTextCell(label))}</th>
      <td style="padding:10px 12px;border:1px solid #e8ded5;vertical-align:top;">${escapeHtml(plainTextCell(value))}</td>
    </tr>`).join('')
}

function bilingualSectionHtml({ language, greeting, heading, intro, rows, followUp, mapUrl = null, mapLabel = null, signOff }) {
  return `
    <section>
      <p style="margin:0 0 8px;color:#6b4b3e;font-size:13px;font-weight:700;">[${escapeHtml(language)}]</p>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;">${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 16px;"><tbody>${rowsHtml(rows)}</tbody></table>
      ${mapUrl ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(mapUrl)}" style="color:#5b2417;">${escapeHtml(mapLabel)}</a></p>` : ''}
      <p style="margin:0 0 16px;">${escapeHtml(followUp)}</p>
      <p style="margin:0;">${signOff.map((line) => escapeHtml(plainTextCell(line))).join('<br />')}</p>
    </section>`
}

function bilingualHtml(sections) {
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a1710;line-height:1.55;max-width:640px;margin:0 auto;">
    ${bilingualSectionHtml(sections.korean)}
    <div style="border-top:1px solid #e8ded5;margin:28px 0;"></div>
    ${bilingualSectionHtml(sections.english)}
  </div>`
}

function completePayload({ sourceType, sourceId, occurrence, recipient, from, replyTo, subject, text, html, templateVersion }) {
  const normalizedFrom = safeHeaderValue(from, 'RESEND_FROM_EMAIL')
  const normalizedRecipient = normalizeRecipientEmail(recipient)
  const normalizedReplyTo = optionalReplyTo(replyTo)
  const eventKey = buildEmailDeliveryEventKey({
    template: BOOKING_REMINDER_TEMPLATE, sourceType, sourceId, occurrence,
  })
  return {
    from: normalizedFrom,
    to: [normalizedRecipient],
    replyTo: normalizedReplyTo,
    subject,
    text,
    html,
    template: BOOKING_REMINDER_TEMPLATE,
    templateVersion,
    eventKey,
    sourceType,
    sourceId,
    occurrence,
    recipientHash: recipientHashForEmail(normalizedRecipient),
    payloadHash: payloadHashForEmail({
      from: normalizedFrom, recipientEmail: normalizedRecipient, replyTo: normalizedReplyTo,
      subject, text, html, template: BOOKING_REMINDER_TEMPLATE, templateVersion,
    }),
    idempotencyKey: resendIdempotencyKeyForEvent(eventKey),
  }
}

export function buildCakeReminderPayload({ reservation, from, replyTo = null } = {}) {
  const sourceId = sourceIdForReservation(reservation)
  const name = plainTextCell(reservation?.customerName)
  const rows = [
    ['예약번호', reservation?.reservationNumber],
    ['픽업 일시', [reservation?.pickupDate, reservation?.pickupTime].filter(Boolean).join(' ')],
    ['픽업 장소', 'Melrose Park, Sydney'],
    ['주문', compactCakeOrderSummary(reservation)],
  ]
  const englishRows = [
    ['Booking number', reservation?.reservationNumber],
    ['Pickup', [reservation?.pickupDate, reservation?.pickupTime].filter(Boolean).join(' ')],
    ['Location', 'Melrose Park, Sydney'],
    ['Order', compactCakeOrderSummary(reservation)],
  ]
  const korean = {
    language: '한국어', greeting: `안녕하세요, ${name}님.`, heading: '내일은 베리굿 케이크 픽업 예정일이에요.',
    intro: '예약하신 케이크 픽업 일정을 안내드립니다.', rows,
    followUp: '변경사항이나 문의가 있으시면 연락해주세요. 내일 뵐게요 :)', mapUrl: CAKE_PICKUP_MAP_URL, mapLabel: '지도 보기',
    signOff: ['Verygood Chocolate Sydney'],
  }
  const english = {
    language: 'English', greeting: `Hi ${name},`, heading: 'Your Verygood cake pickup is tomorrow.',
    intro: 'Here is a reminder of your collection details.', rows: englishRows,
    followUp: 'If you need any help or changes, please contact us. See you tomorrow.', mapUrl: CAKE_PICKUP_MAP_URL, mapLabel: 'View map',
    signOff: ['Verygood Chocolate Sydney'],
  }
  const text = bilingualText({
    korean: [korean.greeting, '', korean.heading, '', rowText(rows), '', `지도 보기: ${CAKE_PICKUP_MAP_URL}`, '', korean.followUp, '', ...korean.signOff],
    english: [english.greeting, '', english.heading, '', rowText(englishRows), '', `View map: ${CAKE_PICKUP_MAP_URL}`, '', english.followUp, '', ...english.signOff],
  })
  return completePayload({
    sourceType: 'cake', sourceId, occurrence: plainTextCell(reservation?.pickupDate), recipient: reservation?.customerEmail,
    from, replyTo, subject: '[Verygood] 내일 픽업 예정이에요 | Your cake pickup is tomorrow', text,
    html: bilingualHtml({ korean, english }), templateVersion: 'booking-reminder-d1-customer-cake-v1',
  })
}

export function buildClassReminderPayload({ reservation, sessionKind, from, replyTo = null } = {}) {
  const sourceId = sourceIdForReservation(reservation)
  const session = sessionProjection(reservation, sessionKind)
  const parentName = plainTextCell(reservation?.parentName)
  const childName = plainTextCell(reservation?.childName)
  const course = classCourseLabel(reservation)
  const rows = [
    ['예약번호', reservation?.reservationNumber], ['클래스', course], ['세션', session.koreanKind],
    ['일시', `${session.date} ${session.time}`], ['장소', '1 Bundil Blvd, Melrose Park, Sydney'],
  ]
  const englishRows = [
    ['Booking number', reservation?.reservationNumber], ['Class', course], ['Session', session.englishKind],
    ['Date and time', `${session.date} ${session.time}`], ['Location', '1 Bundil Blvd, Melrose Park, Sydney'],
  ]
  const korean = {
    language: '한국어', greeting: `안녕하세요, ${parentName}님.`, heading: `내일 ${childName}님의 베리굿 키즈 클래스가 예정되어 있어요.`,
    intro: '수업 일정을 안내드립니다.', rows,
    followUp: '수업 전에 필요한 준비사항을 한 번 더 확인해주세요. 사전에 알려주신 알러지 정보가 있다면 수업 전 다시 확인해주세요.',
    signOff: ['감사합니다.', 'Verygood Chocolate Sydney'],
  }
  const english = {
    language: 'English', greeting: `Hi ${parentName},`, heading: `${childName}'s Verygood Kids Class is tomorrow.`,
    intro: 'Here is a reminder of the class details.', rows: englishRows,
    followUp: 'Please review any preparation instructions before class and reconfirm any allergy information you previously provided.',
    signOff: ['Thank you,', 'Verygood Chocolate Sydney'],
  }
  const text = bilingualText({
    korean: [korean.greeting, '', korean.heading, '', rowText(rows), '', korean.followUp, '', ...korean.signOff],
    english: [english.greeting, '', english.heading, '', rowText(englishRows), '', english.followUp, '', ...english.signOff],
  })
  return completePayload({
    sourceType: 'class', sourceId, occurrence: `${sessionKind}:${session.date}`, recipient: reservation?.parentEmail,
    from, replyTo, subject: '[Verygood] 내일 키즈 클래스가 있어요 | Your Kids Class is tomorrow', text,
    html: bilingualHtml({ korean, english }), templateVersion: 'booking-reminder-d1-customer-class-v1',
  })
}

export function resolveBookingReminderMode(value) {
  if (value === undefined || value === null || value === '') return BOOKING_REMINDER_MODE_DRY_RUN
  if (value === BOOKING_REMINDER_MODE_DRY_RUN || value === BOOKING_REMINDER_MODE_SEND) return value
  throw new Error('INVALID_BOOKING_REMINDER_MODE')
}

function summaryForDelivery(summary, status) {
  if (status === 'sent') summary.sent += 1
  else if (status === 'already_sent') summary.alreadySent += 1
  else if (status === 'failed') summary.failed += 1
  else if (status === 'uncertain') summary.uncertain += 1
  else if (status === 'ledger_error') summary.ledgerErrors += 1
  else summary.skipped += 1
}

async function listPages(list, targetDate) {
  const documents = []
  let cursor = null
  const seen = new Set()
  while (true) {
    const page = await list({ targetDate, cursor, limit: BOOKING_REMINDER_PAGE_SIZE })
    const rows = Array.isArray(page) ? page : page?.documents
    if (!Array.isArray(rows)) throw new Error('INVALID_BOOKING_REMINDER_PAGE')
    documents.push(...rows)
    if (rows.length < BOOKING_REMINDER_PAGE_SIZE) return documents
    const next = rows.at(-1)?.$id || rows.at(-1)?.$rowId || rows.at(-1)?.id
    if (!next || seen.has(next)) throw new Error('INVALID_BOOKING_REMINDER_CURSOR')
    seen.add(next)
    cursor = next
  }
}

function candidateIdentity(candidate) {
  return `${candidate.sourceType}:${candidate.reservationId}:${candidate.sessionKind || ''}:${candidate.scheduledDate}`
}

function candidatesFor(targetDate, cakeRows, firstRows, advancedRows) {
  const candidates = [
    ...cakeRows.map((row) => ({ sourceType: 'cake', reservationId: sourceIdForReservation(row), scheduledDate: targetDate })),
    ...firstRows.map((row) => ({ sourceType: 'class', reservationId: sourceIdForReservation(row), sessionKind: 'first', scheduledDate: targetDate })),
    ...advancedRows.map((row) => ({ sourceType: 'class', reservationId: sourceIdForReservation(row), sessionKind: 'advanced', scheduledDate: targetDate })),
  ].filter((candidate) => Boolean(candidate.reservationId))
  const seen = new Set()
  return candidates.filter((candidate) => {
    const identity = candidateIdentity(candidate)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

async function runWorkers(candidates, handler, concurrency) {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex]
      nextIndex += 1
      await handler(candidate)
    }
  })
  await Promise.allSettled(workers)
}

export function createBookingReminderRunner({
  now = () => new Date(), repository, deliveryRepository, transport, mode, from, replyTo = null,
  deliver = deliverEmail, log = () => {}, error = () => {}, concurrency = BOOKING_REMINDER_CONCURRENCY,
} = {}) {
  return {
    async run() {
      const current = now()
      if (!isSydneyReminderWindow(current)) return { ok: true, skipped: 'outside_sydney_reminder_window' }
      const targetDate = formatSydneyDateKey(addSydneyCalendarDays(current, 1))
      const [cakeRows, firstRows, advancedRows] = await Promise.all([
        listPages(repository.listCakeCandidates, targetDate),
        listPages(repository.listClassFirstCandidates, targetDate),
        listPages(repository.listClassAdvancedCandidates, targetDate),
      ])
      const reminderMode = resolveBookingReminderMode(mode)
      const summary = {
        ok: true, targetDate, cakeCandidates: cakeRows.length, classSessionCandidates: firstRows.length + advancedRows.length,
        ...(reminderMode === BOOKING_REMINDER_MODE_DRY_RUN ? { wouldSend: 0 } : { sent: 0, alreadySent: 0 }),
        skipped: 0, failed: 0, uncertain: 0, ledgerErrors: 0,
      }
      await runWorkers(candidatesFor(targetDate, cakeRows, firstRows, advancedRows), async (candidate) => {
        try {
          const reservation = candidate.sourceType === 'cake'
            ? await repository.getCakeReservation(candidate.reservationId)
            : await repository.getClassReservation(candidate.reservationId)
          const payload = candidate.sourceType === 'cake'
            ? (reservation?.status === CAKE_CONFIRMED_STATUS && reservation?.pickupDate === candidate.scheduledDate && plainTextCell(reservation?.pickupTime)
                ? buildCakeReminderPayload({ reservation, from, replyTo }) : null)
            : (() => {
                const session = sessionProjection(reservation, candidate.sessionKind)
                return reservation?.status === CLASS_CONFIRMED_STATUS && session.date === candidate.scheduledDate && session.time
                  ? buildClassReminderPayload({ reservation, sessionKind: candidate.sessionKind, from, replyTo })
                  : null
              })()
          if (!payload) {
            summary.skipped += 1
            return
          }
          if (reminderMode === BOOKING_REMINDER_MODE_DRY_RUN) {
            summary.wouldSend += 1
            return
          }
          summaryForDelivery(summary, (await deliver({
            payload, repository: deliveryRepository, transport, now: current, log, error, logLabel: 'Booking reminder',
          })).status)
        } catch {
          summary.skipped += 1
        }
      }, concurrency)
      return summary
    },
  }
}
