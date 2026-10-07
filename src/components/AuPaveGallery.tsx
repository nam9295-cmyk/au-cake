import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { paveGallery, paveImageSource, type PaveImageKey } from '../lib/au-pave-presentation'
import { DetailPhoto } from './AuDetailGallery'

export function PavePhoto({ image, sizes, priority = false }: { image: PaveImageKey; sizes: string; priority?: boolean }) {
  const source = paveImageSource(image)
  return <DetailPhoto image={{ ...source, variants: [480, 960].map((width) => ({ src: source.src.replace('-960.webp', `-${width}.webp`), width, bytes: 0 })) }}
    alt={source.alt} sizes={sizes} priority={priority} />
}

export function AuPaveGallery() {
  const [active, setActive] = useState(0)
  const touchStart = useRef<number | null>(null)
  const rotate = (step: number) => setActive((index) => (index + step + paveGallery.length) % paveGallery.length)
  return <div className="au-pave-gallery" aria-label="Pavé product photographs">
    <div className="au-pave-gallery-main"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
      onTouchCancel={() => { touchStart.current = null }}
      onTouchEnd={(event) => {
        if (touchStart.current !== null) {
          const distance = touchStart.current - event.changedTouches[0].clientX
          if (Math.abs(distance) > 45) rotate(distance > 0 ? 1 : -1)
        }
        touchStart.current = null
      }}>
      <PavePhoto image={paveGallery[active]} sizes="(max-width: 767px) 100vw, (max-width: 1099px) calc(100vw - 64px), 50vw" priority />
      <div className="au-pave-photo-labels"><span>SIGNATURE GÂTEAU</span><span>SYDNEY PICKUP</span></div>
      <button className="au-pave-prev" type="button" aria-label="Previous product photo" onClick={() => rotate(-1)}><ChevronLeft size={18} /></button>
      <button className="au-pave-next" type="button" aria-label="Next product photo" onClick={() => rotate(1)}><ChevronRight size={18} /></button>
    </div>
    <div className="au-pave-thumbnails" aria-label="Choose a product photo">
      {paveGallery.map((image, index) => <button key={image} type="button" aria-label={`Photo ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}>
        <PavePhoto image={image} sizes="120px" />
      </button>)}
    </div>
    <span className="au-pave-image-status" aria-live="polite">Photo {active + 1} of {paveGallery.length}</span>
  </div>
}
