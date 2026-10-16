import { useState } from 'react'
import type { Language } from '../lib/i18n'
import { ProductPhoto } from './ProductOptionControls'
import { renewalPhoto, renewalPhotos } from "../lib/renewal-photos"
export function RenewalPhotoGallery({ id, title }: { id: string; title: string }) {
  const [active, setActive] = useState(0)
  const photos = renewalPhotos(id)
  return <div className="au-pave-gallery renewal-upload-gallery">
    <ProductPhoto src={renewalPhoto(photos[active])} label={`${title} · ${active + 1}`} />
    <div className="au-pave-thumbnails">{photos.map((photo, index) => <button key={photo} type="button" aria-label={`Photo ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}>
      <img src={renewalPhoto(photo)} alt="" width="100" height="100" />
    </button>)}</div>
  </div>
}
export function RenewalPhotoStory({ id, language }: { id: string; language: Language }) {
  const ko = language === 'ko'
  const photos = renewalPhotos(id)
  if (!photos.length || !['brownie-loaf', 'brownie-cupcakes'].includes(id)) return null
  const loaf = id === 'brownie-loaf'
  return <section className="renewal-short-story au-pave-story" data-detail-section="product-introduction">
    <h2>{ko ? '브라우니와 바스크 치즈케이크를 함께' : 'Brownie meets Basque cheesecake'}</h2>
    <p>{ko ? (loaf ? '진한 브라우니 위에 부드러운 바스크 치즈케이크. 원하는 두께로 잘라 나누는 로프 케이크입니다.' : '브라우니와 바스크 치즈케이크를 하나씩 즐기는 컵케이크. 6개 또는 12개 박스로 선택하세요.') : (loaf ? 'A brownie base beneath smooth Basque cheesecake, in a loaf to slice and share.' : 'Brownie and Basque cheesecake in individual cupcakes. Choose a box of six or twelve.')}</p>
    <div className="renewal-short-story-grid">
      <figure><ProductPhoto src={renewalPhoto(photos[1])} label={ko ? '브라우니와 치즈케이크 단면' : 'Brownie and cheesecake layers'} /><figcaption>{ko ? '두 가지 층을 한 입에' : 'Two layers in every bite'}</figcaption></figure>
      <figure><ProductPhoto src={renewalPhoto(photos[2])} label={ko ? '바닐라 생크림 옵션' : 'Vanilla fresh cream finish'} /><figcaption>{ko ? '취향에 따라 바닐라 생크림을 더하세요.' : 'Choose vanilla fresh cream for a finishing touch.'}</figcaption></figure>
    </div>
  </section>
}

export function SixPackPhoto({ src, label }: { src: string; label: string }) {
  return <div className="renewal-option-photo renewal-six-pack" role="img" aria-label={label}>
    {Array.from({ length: 6 }, (_, index) => <img key={index} src={src} alt="" aria-hidden="true" className={`renewal-pack-copy renewal-pack-copy-${index}`} loading="lazy" />)}
  </div>
}
