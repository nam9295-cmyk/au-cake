import { marketConfig } from './market.js'
import { CHOCOLATE_PRODUCTS } from '../../appwrite-functions/reservation-api/src/chocolate-products.js'

const chocolatePreviews = [
  { slug: 'almond-chocoball', description: 'Almonds & chocolate' },
  { slug: 'pave-chocolate', description: 'Signature chocolate ganache' },
  { slug: 'eiffel-tower-chocolate', description: 'An artisan chocolate creation' },
] as const

export function getAuChocolatePreviews() {
  return marketConfig.market === 'AU' ? chocolatePreviews.map((family) => {
    const variants = Object.values(CHOCOLATE_PRODUCTS).filter((product) => product.family === family.slug)
    const first = variants[0]
    return { ...family, variants, name: first.name, packLabel: first.saleUnit, price: `AUD ${(first.unitPriceCents / 100).toFixed(2)}` }
  }) : []
}

export function getAuChocolatePreview(slug: string) {
  return getAuChocolatePreviews().find((item) => item.slug === slug) || null
}
