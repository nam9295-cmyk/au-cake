export const renewalPhoto = (name: string) => `/products/renewal-photos/${name}.webp`
export const mochiPhotos: Record<string, string> = {
  strawberry: 'mochi-straw', green_grape: 'mochi-grape', mandarin: 'mochi-mandarin',
  banana: 'mochi-banana', butter_redbean: 'mochi-butter', nama_chocolate: 'mochi-chocolate',
}
export function renewalPhotos(id: string) {
  if (id === 'brownie-loaf') return ['cheese-pound-hero', 'cheese-pound-cross-section-01', 'cheese-pound-cheese-pound-in-vanilla']
  if (id === 'brownie-cupcakes') return ['cheese-cupcake-hero', 'cheese-cupcake-cheese-cross-section01', 'cheese-cupcake-cheese-cup-on-vanilla']
  if (id === 'mochi') return ['mochi-mochi-hero', 'mochi-mochi-6']
  return []
}
