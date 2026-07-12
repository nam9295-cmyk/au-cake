import { createHmac, timingSafeEqual } from 'node:crypto'

const CALENDAR_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function secureTextEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function createCalendarToken(secret, now = new Date()) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('CALENDAR_TOKEN_SECRET_INVALID')
  const payload = base64Url(JSON.stringify({
    scope: 'calendar:read',
    exp: Math.floor(now.getTime() / 1000) + CALENDAR_TOKEN_TTL_SECONDS,
  }))
  return `${payload}.${signature(payload, secret)}`
}

export function verifyCalendarToken(token, secret, now = new Date()) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length < 32) return false
  const parts = token.split('.')
  if (parts.length !== 2 || !secureTextEqual(parts[1], signature(parts[0], secret))) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    return payload.scope === 'calendar:read'
      && Number.isInteger(payload.exp)
      && payload.exp >= Math.floor(now.getTime() / 1000)
  } catch {
    return false
  }
}

function cakeLabel(productId, quantity) {
  const labels = {
    'pave-cake': 'Pave cake',
    'pound-cake': 'Pound cake',
    'cupcake-dozen': 'Cupcakes',
  }
  const label = labels[productId] || 'Cake'
  const count = Math.max(1, Number(quantity) || 1)
  return `${label} ×${count}`
}

function cakeStatus(status) {
  const labels = {
    예약신청: 'Requested',
    예약확정: 'Confirmed',
    픽업완료: 'Completed',
    취소: 'Cancelled',
  }
  return labels[status] || 'Requested'
}

export function sanitizeCakeCalendarEvent(document) {
  return {
    id: `cake:${document.$id}`,
    kind: 'cake',
    date: document.pickupDate,
    time: document.pickupTime,
    label: cakeLabel(document.productId, document.quantity),
    status: cakeStatus(document.status),
    isCancelled: document.status === '취소',
  }
}

export function sanitizeClassCalendarEvent(document) {
  return {
    id: `class:${document.$id}`,
    kind: 'class',
    date: document.classDate,
    time: document.classTime,
    label: 'Kids class',
    status: document.status || 'Requested',
    isCancelled: document.status === 'Cancelled',
  }
}
