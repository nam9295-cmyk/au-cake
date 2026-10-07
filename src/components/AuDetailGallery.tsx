import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDetailImage, type DetailImage, type DetailPresentation } from '../lib/au-detail-presentation'

export function DetailPhoto({ image, alt, sizes, priority = false, position }: {
  image: DetailImage; alt: string; sizes: string; priority?: boolean; position?: string
}) {
  return <img src={image.src} srcSet={image.variants.map((item) => `${item.src} ${item.width}w`).join(', ')}
    width={image.width} height={image.height} alt={alt} sizes={sizes}
    style={position ? { objectPosition: position } : undefined}
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
}

export function AuDetailGallery({ presentation }: { presentation: DetailPresentation }) {
  const [active, setActive] = useState(0)
  const touch = useRef<number | null>(null)
  const gallery = presentation.gallery
  const rotate = (step: number) => setActive((index) => (index + step + gallery.length) % gallery.length)
  return <div className="au-pave-gallery" aria-label={`${presentation.title} product photographs`}>
    <div className="au-pave-gallery-main" onTouchStart={(event) => { touch.current = event.touches[0]?.clientX ?? null }}
      onTouchCancel={() => { touch.current = null }} onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX
        if (touch.current !== null && end !== undefined && Math.abs(touch.current - end) > 45) rotate(touch.current > end ? 1 : -1)
        touch.current = null
      }}>
      <DetailPhoto image={getDetailImage(presentation, gallery[active])} alt={`${presentation.title} · ${active + 1} of ${gallery.length}`}
        sizes="(max-width: 767px) 100vw, (max-width: 1099px) calc(100vw - 64px), 50vw" priority={active === 0} />
      {gallery.length > 1 && <>
        <button className="au-pave-prev" type="button" aria-label="Previous product photo" onClick={() => rotate(-1)}><ChevronLeft size={18} /></button>
        <button className="au-pave-next" type="button" aria-label="Next product photo" onClick={() => rotate(1)}><ChevronRight size={18} /></button>
      </>}
    </div>
    {gallery.length > 1 && <div className="au-pave-thumbnails" aria-label="Choose a product photo">
      {gallery.map((role, index) => <button key={role} type="button" aria-label={`Photo ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}>
        <DetailPhoto image={getDetailImage(presentation, role)} alt="" sizes="120px" />
      </button>)}
    </div>}
    <span className="au-pave-image-status" aria-live="polite">Photo {active + 1} of {gallery.length}</span>
  </div>
}
