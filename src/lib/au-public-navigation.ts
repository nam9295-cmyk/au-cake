import { RENEWAL_NAV } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import home from '../content/au-home-v02.json'

// Frontend navigation only. Keep order/backend catalogue data unchanged.
export const AU_PUBLIC_NAV = [...RENEWAL_NAV, { en: home.links.journal.label, ko: '저널', href: home.links.journal.href }]
