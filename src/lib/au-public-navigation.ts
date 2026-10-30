import { RENEWAL_NAV } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'

// Frontend navigation only. Keep order/backend catalogue data unchanged.
export const AU_PUBLIC_NAV = [...RENEWAL_NAV, { en: 'Journal', ko: '저널', href: '/journal' }]
