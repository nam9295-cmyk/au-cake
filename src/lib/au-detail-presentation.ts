import imageManifest from './au-detail-image-manifest.json'

export type DetailImage = {
  src: string; width: number; height: number
  variants: { src: string; width: number; bytes: number }[]
}
export type DetailEdition = { image: string; title: string; body: string }
export type DetailPresentation = {
  slug: string; key: keyof typeof imageManifest; title: string; hook: string
  gallery: string[]; craftCaptions: string[]; occasions: string[]; occasionCaptions: string[]
  editions?: DetailEdition[]; editionTitle?: string
  related: string[]; videoPoster: string; videoSrc?: string
  packagingNote?: string; insidePosition?: string
}

const common = {
  gallery: ['hero', 'inside', 'craft-01', 'craft-02', 'craft-03'],
  videoPoster: 'craft-01',
  craftCaptions: ['A closer look.', 'Made for the moment.', 'The finishing detail.'],
  occasions: ['occasion-01', 'occasion-02', 'occasion-03', 'occasion-04'],
  occasionCaptions: ['For the table.', 'Time to celebrate.', 'A moment to share.', 'Something to enjoy together.'],
  related: ['signature-gateau-au-chocolat', 'brownie-cheesecake', 'almond-chocoball'],
}
const packagingReference = 'Atelier packaging reference, shown with a Pavé cake. Confirm your collection arrangements with our team.'

export const auDetailPresentations: Record<string, DetailPresentation> = {
  'signature-gateau-au-chocolat': {
    ...common, key: 'signature-gateau', slug: 'signature-gateau-au-chocolat', title: 'Signature Gâteau au Chocolat',
    hook: 'DENSE. CHOCOLATE-FORWARD. MADE TO SLICE.', videoPoster: 'video-poster',
    craftCaptions: ['The loaf, ready to share.', 'Extra Chocolate, up close.', 'Vanilla Fresh Cream, up close.'],
    editionTitle: 'One Signature Loaf, Three Finishes',
    editions: [
      { image: 'edition-01', title: 'Basic Finish', body: 'The signature chocolate gâteau in its simplest form.' },
      { image: 'edition-02', title: 'Extra Chocolate', body: 'Finished with melted chocolate. Choose your finish in the options above.' },
      { image: 'edition-03', title: 'Vanilla Fresh Cream', body: 'Fresh cream with real vanilla bean, over our signature gâteau.' },
    ],
    packagingNote: packagingReference, related: ['pave-chocolate-cake', 'fresh-strawberry-vanilla-cream-cake', 'chocolate-cupcakes'],
  },
  'chocolate-cupcakes': {
    ...common, key: 'cupcakes', slug: 'chocolate-cupcakes', title: 'Chocolate Cupcakes',
    hook: 'A BOX OF CHOCOLATE CUPCAKES, FINISHED YOUR WAY.',
    craftCaptions: ['Vanilla Fresh Cream.', 'Chocolate Buttercream.', 'Basic Finish.'],
    occasions: common.occasions.slice(0, 3),
    occasionCaptions: ['PARTY, CELEBRATION & SHARING', 'A box for the table.', 'Chocolate for the occasion.'],
    editionTitle: 'One Signature Base, Three Finishes',
    editions: [
      { image: 'edition-01', title: 'Basic Finish', body: 'Our signature chocolate cupcake, without an added cream finish.' },
      { image: 'edition-02', title: 'Vanilla Fresh Cream', body: 'Fresh cream made with real vanilla bean.' },
      { image: 'edition-03', title: 'Chocolate Buttercream', body: 'Italian meringue buttercream made with real butter and cocoa powder.' },
    ],
    packagingNote: 'Choose Individual Packaging in the options above when you need cupcakes prepared separately.',
    related: ['lemon-cake', 'signature-gateau-au-chocolat', 'pave-chocolate-cake'],
  },
  'lemon-cake': {
    ...common, key: 'lemon', slug: 'lemon-cake', title: 'Lemon Cake', hook: 'FRESH LEMON. TWO WAYS TO FINISH.',
    craftCaptions: ['A box of Lemon Cakes.', 'Lemon cake, up close.', 'The dark chocolate finish.'],
    occasions: common.occasions.slice(0, 3), editionTitle: 'Fresh Lemon Cake, Two Finishes',
    editions: [
      { image: 'edition-01', title: 'Lemon Zest Icing', body: 'Fresh lemon glaze over our lemon cake.' },
      { image: 'edition-02', title: 'Dark Chocolate Finish', body: 'Use the options above to choose the number of dark chocolate finish pieces in your box.' },
    ],
  },
  'bento-cake': {
    ...common, key: 'bento', slug: 'bento-cake', title: 'Bento Cake', hook: '', gallery: ['hero'], occasions: [],
    related: ['signature-gateau-au-chocolat', 'chocolate-cupcakes', 'lemon-cake'],
  },
  'fresh-strawberry-vanilla-cream-cake': {
    ...common, key: 'strawberry-vanilla', slug: 'fresh-strawberry-vanilla-cream-cake', title: 'Fresh Strawberry Vanilla Cream Cake',
    hook: 'SOFT GENOISE. VANILLA CREAM. FRESH STRAWBERRIES.',
    craftCaptions: ['Fresh strawberries on top.', 'A closer look at the strawberries.', 'The presentation, ready for collection.'],
    related: ['signature-gateau-au-chocolat', 'brownie-cheesecake', 'almond-chocoball'],
  },
  'brownie-cheesecake': {
    ...common, key: 'brownie-cheesecake', slug: 'brownie-cheesecake', title: 'Brownie Cheesecake',
    hook: 'DARK CHOCOLATE BROWNIE MEETS BASQUE CHEESECAKE.',
    craftCaptions: ['Two textures in one slice.', 'The cheesecake layer.', 'The brownie base, up close.'],
    editionTitle: 'One Brownie Cheesecake, Three Finishes',
    editions: [
      { image: 'edition-01', title: 'Brownie Cheesecake', body: 'The dark chocolate brownie base and cheesecake layer, without an added finish.' },
      { image: 'edition-02', title: 'Fresh Cream', body: 'Add a fresh cream finish using the options above.' },
      { image: 'edition-03', title: 'Pavé Brownie Cheesecake', body: 'Brownie cheesecake finished with Pavé chocolate.' },
    ],
    packagingNote: packagingReference, related: ['signature-gateau-au-chocolat', 'pave-chocolate-cake', 'almond-chocoball'],
  },
  'almond-chocoball': {
    ...common, key: 'almond', slug: 'almond-chocoball', title: 'Almond Chocoball', hook: 'ALMONDS & CHOCOLATE. A CLOSER LOOK.',
    craftCaptions: ['The almond centre.', 'A handful to share.', 'The chocolate coating, up close.'],
    editionTitle: 'From Everyday Pouch To Black Tub',
    editions: [
      { image: 'edition-01', title: '80g Pouch', body: 'Choose a single 80g pouch or a six-pack for sharing.' },
      { image: 'edition-02', title: 'Black Tub · 80g × 2', body: 'Choose Black Tub for the 80g × 2 option.' },
    ],
    related: ['signature-gateau-au-chocolat', 'pave-chocolate-cake', 'brownie-cheesecake'],
  },
  'smore-stick': {
    ...common, key: 'smore', slug: 'smore-stick', title: 'S’more Stick', hook: 'CHOCOLATE. MARSHMALLOW. MADE TO SHARE.',
    craftCaptions: ['A bite of S’more.', 'The chocolate coating.', 'Ready to enjoy.'], occasions: [],
    packagingNote: 'Packaging reference. Confirm your event and collection requirements with our team.',
  },
}

export function getAuDetailPresentation(slug: string) { return auDetailPresentations[slug] || null }

export function getDetailImage(presentation: DetailPresentation, role: string): DetailImage {
  const images = imageManifest[presentation.key] as Record<string, DetailImage>
  const image = images[role]
  if (!image) throw new Error(`Missing approved detail image: ${presentation.key}/${role}`)
  return image
}
