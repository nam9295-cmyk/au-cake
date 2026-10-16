import type { RenewalCard } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { getAuDetailPresentation } from './au-detail-presentation'

// Presentation only: leave the historical catalog and its order contracts intact.
export function renewalDetailPresentation(card: RenewalCard) {
  if (!['gateau-loaf', 'brownie-whole', 'gateau-cupcakes', 'almond', 'smore'].includes(card.id)) return null
  const original = getAuDetailPresentation(card.href.split('?')[0].split('/').at(-1)!)
  if (!original) return null
  if (card.id === 'brownie-whole') return {
    ...original,
    title: card.en,
    editionTitle: 'Basic Or Vanilla Fresh Cream',
    editions: original.editions?.slice(0, 2).map((edition, index) => index === 1
      ? { ...edition, title: 'Vanilla Fresh Cream', body: 'Add vanilla fresh cream for AUD 10 using the options above.' }
      : edition),
    packagingNote: 'Your cake is prepared for pre-arranged collection in Melrose Park, Sydney.',
  }
  return {
    ...original,
    title: card.en,
    ...(card.id === 'gateau-loaf' ? { packagingNote: 'Your loaf is prepared for pre-arranged collection in Melrose Park, Sydney.' } : {}),
  }
}
