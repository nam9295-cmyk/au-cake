export const renewalPhoto = (name: string) => name.startsWith("/") ? name : `/products/renewal-photos/${name}.webp`
export const mochiPhotos: Record<string, string> = {
  strawberry: 'mochi-straw', green_grape: 'mochi-grape', mandarin: 'mochi-mandarin',
  banana: 'mochi-banana', butter_redbean: 'mochi-butter', nama_chocolate: 'mochi-chocolate',
}
export function renewalPhotos(id: string) {
  if (id === 'pave-chocolate') return ['pave-heart-cutout', '/products/chocolates/pave-heart-100g.png']
  if (id === 'cookies') return ['cookies-hero_v2', 'cookies-lineup1', 'cookies-lineup2']
  if (id === 'brownie-loaf') return ['cheese-pound-hero', 'cheese-pound-cross-section-01', 'cheese-pound-cheese-pound-in-vanilla']
  if (id === 'brownie-cupcakes') return ['cheese-cupcake-hero', 'cheese-cupcake-cheese-cross-section01', 'cheese-cupcake-cheese-cup-on-vanilla']
  if (id === 'mochi') return ['mochi-hero-v2', 'mochi-mochi-6']
  return []
}
