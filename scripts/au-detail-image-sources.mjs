// Read-only sources from the approved Desktop Pencil frames. Relative roots are
// resolved by the optimizer, never shipped as runtime filesystem paths.
const pencil = (name) => `pencil/au-site-redesign-assets/${name}`
const drive = (folder, name) => `drive/${folder}/${name}`
const sources = (folder, entries) => Object.fromEntries(Object.entries(entries).map(([role, name]) => [role, drive(folder, name)]))
export const detailImageSources = {
  'signature-gateau': {
    hero: pencil('signature-gateau-au-chocolat-sydney.webp'),
    ...sources('cake/pound-detail', { inside: 'pound-1.png', 'craft-01': 'in-the-box.png', 'craft-02': 'chocolate-cross.webp', 'craft-03': 'vainlla-cross.webp', 'video-poster': 'gateau-169.png', 'edition-01': 'pound-hole.png', 'edition-02': 'chocolate-on-top.png', 'edition-03': 'vanilla-on-top.png', 'occasion-01': 'gateau-3.webp', 'occasion-02': 'drop-chocolate.webp', 'occasion-03': 'eat-gateau.webp', 'occasion-04': 'party.png' }),
    packaging: drive('cake', 'KakaoTalk_Photo_2026-09-22-21-07-01-7.jpeg'),
  },
  cupcakes: {
    hero: pencil('chocolate-cupcakes-sydney.webp'),
    ...sources('cake/gateau-cupcake-detail', { inside: 'cupcake.png', 'craft-01': 'vanilla.png', 'craft-02': 'choco.png', 'craft-03': 'basic.png', 'edition-01': 'basic.png', 'edition-02': 'vanilla.png', 'edition-03': 'choco.png', 'occasion-01': 'party-01.webp', 'occasion-02': 'vanilla-party-02.webp', 'occasion-03': 'choco-scene.webp', packaging: 'cakes-package.png' }),
  },
  lemon: {
    hero: pencil('lemon-cake-sydney.webp'),
    ...sources('cake/lemon-detail', { inside: 'lemon-cake-03.png', 'craft-01': 'lemon-box.png', 'craft-02': 'lemon-cake-02.png', 'craft-03': 'lemon-choco-02.png', 'edition-01': 'lemon-cake-01.png', 'edition-02': 'lemon-choco-01.png', 'occasion-01': 'lemon-cake-04.png', 'occasion-02': 'lemon-party-01.webp', 'occasion-03': 'lemon-party-02.webp', packaging: 'magnific__img1-img2-__89889.png' }),
  },
  bento: { hero: pencil('bento-cake-sydney.webp') },
  'strawberry-vanilla': {
    hero: pencil('fresh-strawberry-vanilla-cream-cake-sydney.webp'),
    ...sources('cake/vanilla-cake', { inside: 'cross-section-v3.jpg', 'craft-01': 'hero-02.png', 'craft-02': 'Strawberries_closeup.jpg', 'craft-03': 'package.png', 'occasion-01': '45degree.png', 'occasion-02': 'vanilla-party-01.webp', 'occasion-03': 'vanilla-party-02.webp', 'occasion-04': 'vanilla-party-03.webp', packaging: 'boxes.png' }),
  },
  'brownie-cheesecake': {
    ...sources('cake/cheesecake', { hero: 'main-hero.webp', inside: 'cheese-detail-04.png', 'craft-01': 'cheese-detail-02.png', 'craft-02': 'cheese-deatail-01.png', 'craft-03': 'cheese-detail-03.png', 'edition-01': 'hero.png', 'edition-02': 'on-vanilla-hero.png', 'edition-03': 'on-chocolate-hero.png', 'occasion-01': 'cheese-party-04.png', 'occasion-02': 'cheese-party-02.png', 'occasion-03': 'cheese-party-03.png', 'occasion-04': 'cheese-party-01.jpg' }),
    packaging: drive('cake', 'KakaoTalk_Photo_2026-09-22-21-07-01-7.jpeg'),
  },
  almond: sources('chocolate/almond', { hero: 'hero.jpg', inside: 'cross-closeup.png', 'craft-01': 'cross-section-almond-01.jpg', 'craft-02': 'hand-on-almonds.png', 'craft-03': 'closeup.png', 'edition-01': 'hero-background.jpg', 'edition-02': 'black-canister-background.jpg', 'occasion-01': 'cross-section-almond-01.jpg', 'occasion-02': 'verit-almond-closeup.webp', 'occasion-03': 'bite-almond.webp', 'occasion-04': 'hand-on-almonds.png', packaging: 'black-canister.png' }),
  smore: {
    hero: pencil('smore-stick-sydney.webp'),
    ...sources("chocolate/s'more", { inside: 'detail.png', 'craft-01': 'bite-smore.jpg', 'craft-02': 'chocolate-cover.jpg', 'craft-03': 'hero.png' }),
    // The visible child covers the old Lemon photo fill in the Pencil frame.
    packaging: pencil('smore.png'),
  },
}
