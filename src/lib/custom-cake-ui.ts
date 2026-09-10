import type { CustomCakeStatus } from './custom-cake-contract.js'
import type { Cents } from './cake-wire-types.js'
import type { Language } from './i18n.js'

export const CUSTOM_CAKE_BASE_PRICES = {
  single: {
    '6in': 15500,
    '8in': 20000,
    '10in': 25000,
  },
  double: {
    '4in+6in': 25500,
    '6in+8in': 36500,
    '8in+10in': 47500,
  },
} as const

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '-'
  return `AUD $${(cents / 100).toFixed(2)}`
}

export function formatExtraCents(cents: Cents | null, language: Language = 'en'): string {
  if (cents === null) {
    return language === 'ko' ? '협의 예정 (To be confirmed)' : 'To be confirmed'
  }
  if (cents === 0) {
    return language === 'ko' ? '추가금 없음 (No extra charge)' : 'No extra charge (AUD $0.00)'
  }
  return `+AUD $${(cents / 100).toFixed(2)}`
}

export function getStatusInfo(status: CustomCakeStatus, language: Language = 'en'): { label: string; description: string; className: string } {
  switch (status) {
    case 'requested':
      return {
        label: language === 'ko' ? '접수 검토 중' : 'Request Received',
        description: language === 'ko'
          ? '접수가 완료되어 제작 가능 여부와 디자인을 검토 중입니다. (예약 확정 전)'
          : 'Your request has been received and is being reviewed. (Not confirmed yet)',
        className: 'status-badge status-requested',
      }
    case 'quoted':
      return {
        label: language === 'ko' ? '견적 안내' : 'Quote Ready',
        description: language === 'ko'
          ? '디자인/피규어 견적이 산출되었습니다. 내용을 확인하시고 동의해 주세요.'
          : 'Your customized quote is ready. Please review the breakdown.',
        className: 'status-badge status-quoted',
      }
    case 'confirmed':
      return {
        label: language === 'ko' ? '예약 확정' : 'Confirmed',
        description: language === 'ko'
          ? '견적 동의 및 예약이 확정되었습니다. 약속된 날짜에 픽업해 주세요.'
          : 'Your custom cake order is confirmed. See you at pickup!',
        className: 'status-badge status-confirmed',
      }
    case 'completed':
      return {
        label: language === 'ko' ? '픽업 완료' : 'Completed',
        description: language === 'ko'
          ? '케이크 픽업이 완료되었습니다. 특별한 날 되시길 바랍니다.'
          : 'Cake picked up. Thank you for celebrating with us!',
        className: 'status-badge status-completed',
      }
    case 'cancelled':
      return {
        label: language === 'ko' ? '주문 취소' : 'Cancelled',
        description: language === 'ko'
          ? '요청이 취소되었습니다.'
          : 'This request has been cancelled.',
        className: 'status-badge status-cancelled',
      }
    default:
      return {
        label: status,
        description: '',
        className: 'status-badge',
      }
  }
}
