import { marketConfig } from './market.js'

// Display-only previews, deliberately not ProductIds or cart/order data.
// Independent chocolate sales are not supported by the current order contract.
const chocolatePreviews = [
  { slug: 'almond-chocoball', name: 'Almond Chocoball', description: 'Almonds & chocolate', weight: '80g', price: 'AUD 12.00', image: '/redesign/pave-chocolate-cake-sydney.webp' },
  { slug: 'pave-chocolate', name: 'Pavé Chocolate', description: 'Signature chocolate ganache', weight: null, price: null, image: '/redesign/pave-cake-card.jpg' },
  { slug: 'eiffel-tower-chocolate', name: 'Eiffel Tower Chocolate', description: 'An artisan chocolate creation', weight: null, price: null, image: '/redesign/hero-cake-1.webp' },
] as const

export function getAuChocolatePreviews() {
  return marketConfig.market === 'AU' ? chocolatePreviews : []
}

export function getAuChocolatePreview(slug: string) {
  return getAuChocolatePreviews().find((item) => item.slug === slug) || null
}
