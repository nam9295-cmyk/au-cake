const base = '/products/pave-detail'

export const paveImages = {
  hero: { file: 'hero', alt: 'Pavé Chocolate Cake with its chocolate Eiffel Tower finish', width: 1080, height: 1012 },
  angle: { file: 'angle', alt: 'Pavé cake from a three-quarter angle, showing the chocolate layers', width: 1328, height: 1760 },
  slice: { file: 'slice', alt: 'A slice of Pavé Chocolate Cake', width: 1122, height: 1402 },
  sharing: { file: 'sharing', alt: 'Pavé cake cut into eight slices for sharing', width: 1536, height: 2048 },
  party: { file: 'party', alt: 'Pavé cake served at a celebration table', width: 2048, height: 1152 },
  sizes: { file: 'sizes', alt: 'Three Pavé cake sizes shown together', width: 1344, height: 752 },
  inside: { file: 'inside', alt: 'A cut Pavé cake showing chocolate gâteau layers and smooth ganache', width: 1328, height: 1760 },
  occasion: { file: 'occasion', alt: 'A whole Pavé cake presented for a special occasion', width: 1328, height: 1760 },
  birthday: { file: 'birthday', alt: 'A birthday celebration around a cake', width: 1000, height: 667 },
  gathering: { file: 'gathering', alt: 'Friends sharing cake around a celebration table', width: 1000, height: 709 },
  packaging: { file: 'packaging', alt: 'An actual Verygood cake order packed for collection', width: 1081, height: 1440 },
} as const

export type PaveImageKey = keyof typeof paveImages
export const paveGallery: readonly PaveImageKey[] = ['hero', 'angle', 'slice', 'sharing', 'party', 'sizes']
export const paveTexture: readonly PaveImageKey[] = ['sharing', 'angle', 'sizes']
export const paveOccasions: readonly PaveImageKey[] = ['party', 'occasion', 'birthday', 'gathering']

export function paveImageSource(key: PaveImageKey) {
  const image = paveImages[key]
  return {
    src: `${base}/${image.file}-960.webp`,
    srcSet: `${base}/${image.file}-480.webp 480w, ${base}/${image.file}-960.webp 960w`,
    alt: image.alt,
    width: image.width,
    height: image.height,
  }
}
