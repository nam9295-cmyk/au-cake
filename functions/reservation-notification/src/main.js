import https from 'node:https'

const PRODUCT_LABELS = {
  'pave-cake': '생초콜릿 파베 케이크',
  'pound-cake': '초코 파운드 케이크',
}

function parseRecipients(value = '') {
  return value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function getProductName(productId) {
  return PRODUCT_LABELS[productId] || PRODUCT_LABELS['pave-cake']
}

function getCacaoText(reservation) {
  if (reservation.productId === 'pound-cake') return '-'
  return reservation.cacaoPercent === '기본' ? '기본 옵션' : `${reservation.cacaoPercent}%`
}

function getCakeSizeText(reservation) {
  if (reservation.productId === 'pound-cake') return '-'
  return reservation.cakeSize === 'size-1' ? '1호사이즈' : '미니케이크'
}

function getQuantity(reservation) {
  const quantity = Number(reservation.quantity || 1)
  if (!Number.isFinite(quantity)) return 1
  return Math.min(5, Math.max(1, Math.floor(quantity)))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCreatedAt(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function readReservation(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson
  if (!req.bodyRaw) return null

  try {
    return JSON.parse(req.bodyRaw)
  } catch {
    return null
  }
}

function buildText(reservation) {
  return [
    '[베리굿초콜릿] 새 예약 신청',
    '',
    `예약번호: ${reservation.reservationNumber}`,
    `제품명: ${getProductName(reservation.productId)}`,
    `사이즈: ${getCakeSizeText(reservation)}`,
    `카카오 옵션: ${getCacaoText(reservation)}`,
    `수량: ${getQuantity(reservation)}개`,
    `예약자명: ${reservation.customerName}`,
    `연락처: ${reservation.customerPhone}`,
    `픽업일: ${reservation.pickupDate}`,
    `픽업시간: ${reservation.pickupTime}`,
    `총 금액: ${formatCurrency(reservation.totalPrice)}`,
    `요청사항: ${reservation.requestNote || '없음'}`,
    `신청일시: ${formatCreatedAt(reservation.createdAt || reservation.$createdAt)}`,
  ].join('\n')
}

function buildHtml(reservation) {
  const rows = [
    ['예약번호', reservation.reservationNumber],
    ['제품명', getProductName(reservation.productId)],
    ['사이즈', getCakeSizeText(reservation)],
    ['카카오 옵션', getCacaoText(reservation)],
    ['수량', `${getQuantity(reservation)}개`],
    ['예약자명', reservation.customerName],
    ['연락처', reservation.customerPhone],
    ['픽업일', reservation.pickupDate],
    ['픽업시간', reservation.pickupTime],
    ['총 금액', formatCurrency(reservation.totalPrice)],
    ['요청사항', reservation.requestNote || '없음'],
    ['신청일시', formatCreatedAt(reservation.createdAt || reservation.$createdAt)],
  ]

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2a1710; line-height: 1.55;">
      <h2 style="margin: 0 0 16px;">새 예약 신청</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="width: 120px; padding: 10px 12px; border: 1px solid #e8ded5; background: #fbf6ef; text-align: left;">${escapeHtml(label)}</th>
                  <td style="padding: 10px 12px; border: 1px solid #e8ded5;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

async function postJson(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          responseBody += chunk
        })
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody))
            } catch {
              resolve({})
            }
            return
          }

          reject(new Error(`Resend API failed: ${response.statusCode} ${responseBody}`))
        })
      },
    )

    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

async function sendResendEmail({ reservation, to, from, apiKey }) {
  return postJson(
    'https://api.resend.com/emails',
    {
      from,
      to,
      subject: `[베리굿초콜릿] 새 예약 신청 ${reservation.reservationNumber}`,
      text: buildText(reservation),
      html: buildHtml(reservation),
    },
    {
      Authorization: `Bearer ${apiKey}`,
    },
  )
}

export default async ({ req, res, log, error }) => {
  const reservation = readReservation(req)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = parseRecipients(process.env.RESEND_TO_EMAILS)

  if (!reservation?.reservationNumber) {
    error('예약 알림 메일 발송 실패: 예약 데이터가 없습니다.')
    return res.json({ ok: false, reason: 'missing_reservation' })
  }

  if (!apiKey || !from || to.length === 0) {
    error('예약 알림 메일 발송 실패: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TO_EMAILS 설정을 확인하세요.')
    return res.json({ ok: false, reason: 'missing_config', reservationNumber: reservation.reservationNumber })
  }

  try {
    const result = await sendResendEmail({ reservation, to, from, apiKey })
    log(`예약 알림 메일 발송 완료: ${reservation.reservationNumber} -> ${to.join(', ')}`)
    return res.json({ ok: true, id: result.id, reservationNumber: reservation.reservationNumber })
  } catch (sendError) {
    error(`예약 알림 메일 발송 실패: ${reservation.reservationNumber}`)
    error(sendError?.message || String(sendError))
    return res.json({ ok: false, reason: 'send_failed', reservationNumber: reservation.reservationNumber })
  }
}
