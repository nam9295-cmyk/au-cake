import { ALMOND_GIFT_BOX_ID } from '../../appwrite-functions/reservation-api/src/au-renewal.js'

type AlmondPack = { en: string; ko: string; image: string; thumbnail?: string; sixPack?: boolean }
const pouch = '/products/chocolates/almond-chocoball.webp'
const triangle = '/products/almond/triangle-480.webp'
const gift = '/products/almond/gift-set-480.webp'

export const almondPacks: Readonly<Record<string, AlmondPack>> = {
  'almond-chocoball-80g': { en: 'Pouch · 80g', ko: '파우치 · 80g', image: pouch },
  'almond-triangle-60g': { en: 'Triangle box · 60g', ko: '삼각박스 · 60g', image: '/products/almond/triangle-960.webp', thumbnail: triangle },
  'almond-chocoball-6pack': { en: '5+1 pouches · 6 × 80g', ko: '파우치 5+1 · 80g × 6', image: pouch, sixPack: true },
  'almond-triangle-6pack': { en: '5+1 triangle boxes · 6 × 60g', ko: '삼각박스 5+1 · 60g × 6', image: '/products/almond/triangle-six-960.webp', thumbnail: '/products/almond/triangle-six-480.webp' },
  'almond-chocoball-black-tub-2x80g': { en: 'Black tub · 2 × 80g pouches', ko: '블랙 통 · 80g 파우치 2개', image: '/products/renewal-photos/almond-black-tub.webp' },
  [ALMOND_GIFT_BOX_ID]: { en: 'Gift box · 4 × 60g triangle boxes', ko: '선물 박스 · 60g 삼각박스 4개', image: '/products/almond/gift-set-960.webp', thumbnail: gift },
}
