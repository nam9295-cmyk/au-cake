import { CUSTOM_CAKE_BASE_PRICES, formatCents } from './custom-cake-ui'
import type { Language } from './i18n'

export const CUSTOM_CAKE_MENU = [
  { id: 'custom-single', kind: 'custom-cake', tier: 'single', nameEn: 'Custom Cake · Single Tier', nameKo: '커스텀 케이크 · 1단', href: '/cakes/custom-cake?tier=single' },
  { id: 'custom-double', kind: 'custom-cake', tier: 'double', nameEn: 'Custom Cake · Two Tiers', nameKo: '커스텀 케이크 · 2단', href: '/cakes/custom-cake?tier=double' },
  { id: 'private-class-single', kind: 'private-class', tier: 'single', nameEn: 'Private Cake Class · Single Tier', nameKo: '프라이빗 케이크 클래스 · 1단', href: '/custom-cakes?service=private-class&tier=single#private-class-enquiry' },
  { id: 'private-class-double', kind: 'private-class', tier: 'double', nameEn: 'Private Cake Class · Two Tiers', nameKo: '프라이빗 케이크 클래스 · 2단', href: '/custom-cakes?service=private-class&tier=double#private-class-enquiry' },
] as const

export function getCustomCakeInitialTier(search: string): 'single' | 'double' {
  return new URLSearchParams(search).get('tier') === 'double' ? 'double' : 'single'
}

export function getCustomCakeMenuCards(language: Language) {
  const ko = language === 'ko'
  return CUSTOM_CAKE_MENU.map(menu => {
    const cake = menu.kind === 'custom-cake'
    const name = ko ? menu.nameKo : menu.nameEn
    const from = menu.tier === 'single' ? CUSTOM_CAKE_BASE_PRICES.single['6in'] : CUSTOM_CAKE_BASE_PRICES.double['4in+6in']
    return {
      ...menu,
      name,
      image: cake ? `/portfolio/04-custom-cakes-${menu.tier === 'single' ? '3' : '2'}-640.webp` : `/services/private-class-${menu.tier === 'single' ? 'process' : 'finished'}.webp`,
      imageAlt: cake ? name : ko ? '기존 클래스의 준비 재료와 완성 케이크' : 'Previous class materials and finished cakes',
      description: cake
        ? ko ? '특별한 날을 위한 맞춤 디자인 케이크. 검토 후 최종 견적을 안내합니다.' : 'An original cake designed for your celebration. Final quote after review.'
        : ko ? '프라이빗 케이크 수업을 문의하세요. 수업 내용과 가능 일정은 상담 후 안내합니다.' : 'Discuss a private cake class with us. Details and availability are confirmed by enquiry.',
      price: cake ? `${ko ? '기본가' : 'From'} ${formatCents(from)}` : ko ? '수업료 문의' : 'Enquire for pricing',
      action: cake ? ko ? '케이크 문의' : 'Request a cake' : ko ? '이 클래스 문의' : 'Enquire about this class',
    }
  })
}
