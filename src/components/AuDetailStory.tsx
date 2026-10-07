import { useEffect, useRef } from 'react'
import { getAuChocolateCollectionCards, getAuOrderableCakeCards } from '../lib/au-catalog'
import { getDetailImage, type DetailPresentation } from '../lib/au-detail-presentation'
import type { CakeDetailData } from '../lib/cake-detail'
import type { CakeEditorialContent } from '../lib/cake-editorial'
import type { Language } from '../lib/i18n'
import { DetailPhoto } from './AuDetailGallery'

export function DetailHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <header className="au-pave-heading"><p>{eyebrow}</p><h2>{title}</h2></header>
}

function useDetailReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!root.current || !('IntersectionObserver' in window)) return
    const nodes = Array.from(root.current.querySelectorAll<HTMLElement>('[data-detail-reveal]'))
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove('au-pave-awaiting')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08 })
    if (!media.matches) for (const node of nodes) {
      if (node.getBoundingClientRect().top > window.innerHeight) { node.classList.add('au-pave-awaiting'); observer.observe(node) }
    }
    const reveal = () => { if (media.matches) { observer.disconnect(); nodes.forEach((node) => node.classList.remove('au-pave-awaiting')) } }
    media.addEventListener('change', reveal)
    return () => { observer.disconnect(); media.removeEventListener('change', reveal); nodes.forEach((node) => node.classList.remove('au-pave-awaiting')) }
  }, [])
  return root
}

// The poster occupies the final video layout; supplying videoSrc enables only
// viewport-near, muted playback. No policy workaround, public fallback or retries.
export function DetailVideoMoment({ presentation }: { presentation: DetailPresentation }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || !('IntersectionObserver' in window)) return
    let near = false
    let blocked = false
    let pending = false
    let disposed = false
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    video.defaultMuted = true
    video.muted = true
    const allowed = () => !disposed && near && !document.hidden && !motion.matches
    const sync = () => {
      if (!allowed()) { video.pause(); return }
      if (blocked || pending || !video.paused) return
      pending = true
      void video.play().then(() => { if (!allowed()) video.pause() }).catch(() => { if (!disposed) blocked = true }).finally(() => { pending = false })
    }
    const observer = new IntersectionObserver(([entry]) => { near = entry.isIntersecting; sync() }, { rootMargin: '100px 0px' })
    observer.observe(video)
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    return () => { disposed = true; observer.disconnect(); document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync); video.pause() }
  }, [presentation.videoSrc])
  return <section className="au-pave-video" data-detail-section="video" aria-label={`${presentation.title} close-up`}>
    <div className="au-pave-video-media">{presentation.videoSrc
      ? <video ref={ref} src={presentation.videoSrc} poster={getDetailImage(presentation, presentation.videoPoster).src} muted loop playsInline preload="none" />
      : <DetailPhoto image={getDetailImage(presentation, presentation.videoPoster)} alt={`${presentation.title}, a closer look`} sizes="(max-width: 767px) calc(100vw - 40px), 100vw" />}
    </div>
  </section>
}

export function DetailRelated({ presentation, language, onOpenCake }: { presentation: DetailPresentation; language: Language; onOpenCake?: (slug: string) => void }) {
  const cakes = getAuOrderableCakeCards(language)
  const chocolates = getAuChocolateCollectionCards(language)
  const related = presentation.related.flatMap((slug) => {
    const cake = cakes.find((item) => item.slug === slug)
    if (cake) return [{ slug, name: cake.name, price: cake.priceLabel, image: cake.imagePath, href: `/cakes/${slug}`, cake: true }]
    const chocolate = chocolates.find((item) => item.slug === slug)
    return chocolate ? [{ slug, name: chocolate.name, price: chocolate.price, image: chocolate.image, href: chocolate.href, cake: false }] : []
  })
  return <section className="au-pave-related" data-detail-section="related" data-detail-reveal>
    <DetailHeading eyebrow="EXPLORE MORE" title={presentation.key === 'bento' ? 'Explore Our Available Cakes' : 'You May Also Enjoy'} />
    <div className="au-pave-related-grid">{related.map((card) => <a key={card.slug} href={card.href} onClick={(event) => {
      if (card.cake && onOpenCake && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpenCake(card.slug) }
    }}><div><img src={card.image} alt={card.name} width={1080} height={1012} loading="lazy" decoding="async" /></div><h3>{card.name}</h3><p>{card.price}</p></a>)}</div>
  </section>
}

export function AuDetailStory({ presentation, detail, editorial, language = 'en', onOpenCake }: {
  presentation: DetailPresentation; detail?: CakeDetailData; editorial?: CakeEditorialContent | null; language?: Language; onOpenCake?: (slug: string) => void
}) {
  const root = useDetailReveal()
  const compact = editorial?.layout === 'compact' ? editorial : null
  const description = detail?.description || 'Almonds & chocolate, ready to share. Choose your pack above.'
  const highlights: readonly { title: string; body?: string }[] = compact?.highlights || detail?.features.map((title) => ({ title })) || [
    { title: 'THE ALMOND CENTRE', body: 'A whole almond, seen in cross-section.' },
    { title: 'THE CHOCOLATE COATING', body: 'Chocolate around the almond centre.' },
    { title: 'CHOOSE YOUR PACK', body: 'Choose a single 80g pouch, a six-pack or Black Tub.' },
  ]
  const photo = (role: string, alt: string, sizes: string, position?: string) => <DetailPhoto image={getDetailImage(presentation, role)} alt={alt} sizes={sizes} position={position} />
  return <div ref={root} className="au-pave-story">
    <section className="au-pave-hook" data-detail-section="hook" data-detail-reveal>
      <p className="au-pave-eyebrow">VERYGOOD ATELIER</p><h2>{presentation.hook}</h2><p>{description}</p>
    </section>
    <section className="au-pave-inside" data-detail-section="inside" data-detail-reveal>
      <div className="au-pave-inside-photo">{photo('inside', `${presentation.title}, inside`, '(max-width: 767px) calc(100vw - 40px), 55vw', presentation.insidePosition)}</div>
      <DetailHeading eyebrow="A CLOSER LOOK" title={`Inside The ${presentation.title}`} />
      <div className="au-pave-layers">{highlights.slice(0, 3).map((item, index) => <article key={item.title}><h3>{String(index + 1).padStart(2, '0')} / {item.title}</h3>{item.body && <p>{item.body}</p>}</article>)}</div>
    </section>
    <section className="au-pave-texture" data-detail-section="craft" data-detail-reveal>
      <DetailHeading eyebrow="CRAFT & TEXTURE" title="A Closer Look At Every Detail" />
      <div className="au-pave-texture-grid">{presentation.craftCaptions.map((caption, index) => <figure key={caption}><div>{photo(`craft-0${index + 1}`, caption, '(max-width: 767px) calc(100vw - 40px), (max-width: 1099px) 45vw, 43vw')}</div><figcaption>{caption}</figcaption></figure>)}</div>
    </section>
    <DetailVideoMoment presentation={presentation} />
    {presentation.editions && <section className="au-detail-editions" data-detail-section="editions" data-detail-reveal>
      <DetailHeading eyebrow="THE FINISHING TOUCH" title={presentation.editionTitle!} />
      <div>{presentation.editions.map((edition, index) => <article key={edition.image}>
        <div className="au-detail-edition-photo">{photo(edition.image, `${presentation.title} · ${edition.title}`, '(max-width: 767px) calc(100vw - 40px), 48vw')}</div>
        <div><p className="au-pave-eyebrow">{String(index + 1).padStart(2, '0')}</p><h3>{edition.title}</h3><p>{edition.body}</p></div>
      </article>)}</div>
    </section>}
    {presentation.occasions.length > 0 && <section className="au-pave-occasions" data-detail-section="occasion" data-detail-reveal>
      <DetailHeading eyebrow="CELEBRATIONS & SHARING" title="Made For Your Moments" />
      <div className="au-pave-occasion-grid" style={{ '--occasion-count': presentation.occasions.length } as React.CSSProperties}>{presentation.occasions.map((role, index) => <figure key={role}><div>{photo(role, `${presentation.title} · ${presentation.occasionCaptions[index]}`, '(max-width: 767px) 44vw, (max-width: 1099px) 45vw, 30vw')}</div><figcaption>{presentation.occasionCaptions[index]}</figcaption></figure>)}</div>
    </section>}
    <section className="au-pave-packaging" data-detail-section="packaging" data-detail-reveal>
      <div className="au-pave-packaging-photo">{photo('packaging', `${presentation.title} packaging reference`, '(max-width: 767px) calc(100vw - 40px), 50vw')}</div>
      <DetailHeading eyebrow="PRESENTATION & COLLECTION" title="READY TO TAKE HOME." />
      <div className="au-pave-packaging-copy"><p>{presentation.packagingNote || 'Collection in Melrose Park, Sydney. Confirm your requirements and availability with our team.'}</p>
      </div>
    </section>
    <section className="au-pave-practical" data-detail-section="practical" data-detail-reveal>
      <DetailHeading eyebrow="DETAILS & CARE" title="PRODUCT DETAILS & ALLERGENS" />
      <div className="au-pave-specs">
        {compact && <>
          <details open><summary>{compact.details.title}</summary><div>{compact.details.items.map((item) => <p key={item}>{item}</p>)}</div></details>
          <details open><summary>{compact.ingredientsAndAllergens.ingredientsLabel}</summary><div><p>{compact.ingredientsAndAllergens.ingredients}</p></div></details>
          <details open><summary>{compact.ingredientsAndAllergens.allergenLabel}</summary><div><p>{compact.ingredientsAndAllergens.allergens}</p><p>{compact.ingredientsAndAllergens.contact}</p></div></details>
          {compact.storageAndServing && <details open><summary>{compact.storageAndServing.title}</summary><div>{compact.storageAndServing.items.map((item) => <p key={item}>{item}</p>)}</div></details>}
        </>}
        {detail?.accordions.map((item) => <details key={item.title} open><summary>{item.title}</summary><div><p>{item.body}</p></div></details>)}
        {!detail && <details open><summary>Collection & product information</summary><div><p>Melrose Park pick-up by arrangement. Availability and payment details are confirmed after your request.</p><p>Please contact us before ordering for current ingredient and allergen information.</p></div></details>}
      </div>
    </section>
    <DetailRelated presentation={presentation} language={language} onOpenCake={onOpenCake} />
  </div>
}
