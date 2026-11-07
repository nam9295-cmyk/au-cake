export const CUSTOM_CAKE_MENU = [
  { id: 'custom-single', kind: 'custom-cake', tier: 'single', nameEn: 'Custom Cake · Single Tier', nameKo: '커스텀 케이크 · 1단', href: '/cakes/custom-cake?tier=single' },
  { id: 'custom-double', kind: 'custom-cake', tier: 'double', nameEn: 'Custom Cake · Two Tiers', nameKo: '커스텀 케이크 · 2단', href: '/cakes/custom-cake?tier=double' },
  { id: 'private-class-single', kind: 'private-class', tier: 'single', nameEn: 'Private Cake Class · Single Tier', nameKo: '프라이빗 케이크 클래스 · 1단', href: '/custom-cakes?service=private-class&tier=single#private-class-enquiry' },
  { id: 'private-class-double', kind: 'private-class', tier: 'double', nameEn: 'Private Cake Class · Two Tiers', nameKo: '프라이빗 케이크 클래스 · 2단', href: '/custom-cakes?service=private-class&tier=double#private-class-enquiry' },
] as const

export function getCustomCakeInitialTier(search: string): 'single' | 'double' {
  return new URLSearchParams(search).get('tier') === 'double' ? 'double' : 'single'
}
