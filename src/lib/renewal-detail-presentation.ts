import miniImages from './mini-cake-images.json'
import type { RenewalCard } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { getAuDetailPresentation } from './au-detail-presentation'

// Presentation only: leave the historical catalog and its order contracts intact.
export function renewalDetailPresentation(card: RenewalCard, size?: string, finish?: string) {
  if (!['lemon', 'gateau-loaf', 'brownie-whole', 'gateau-cupcakes', 'almond', 'smore'].includes(card.id)) return null
  const original = getAuDetailPresentation(card.href.split('?')[0].split('/').at(-1)!)
  if (!original) return null
  if (card.id === 'brownie-whole') return {
    ...original,
    title: card.en,
    ...(size === '4in' ? {
      gallery: [...(finish === 'vanilla-fresh-cream' ? ['mini-cream', 'mini-basic'] : ['mini-basic', 'mini-cream']), ...original.gallery],
      imageOverrides: { 'mini-basic': miniImages['basque-mini'], 'mini-cream': miniImages['basque-on-cream-mini'] },
    } : {}),
    editionTitle: 'Basic, Vanilla Fresh Cream Or Cream + Strawberries',
    editions: original.editions?.slice(0, 2).map((edition, index) => index === 1
      ? { ...edition, title: 'Vanilla Fresh Cream', body: 'Choose vanilla fresh cream or cream + strawberries using the options above. The surcharge depends on cake size.' }
      : edition),
    packagingNote: 'Your cake is prepared for pre-arranged collection in Melrose Park, Sydney.',
  }
  return {
    ...original,
    title: card.en,
    ...(card.id === 'gateau-loaf' ? { packagingNote: 'Your loaf is prepared for pre-arranged collection in Melrose Park, Sydney.' } : {}),
  }
}
