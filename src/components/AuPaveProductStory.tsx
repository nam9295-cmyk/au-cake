import { useEffect, useRef } from 'react'
import { getAuChocolateCollectionCards, getAuOrderableCakeCards } from '../lib/au-catalog'
import { paveImageSource, paveOccasions, paveTexture } from '../lib/au-pave-presentation'
import type { CakeDetailData } from '../lib/cake-detail'
import type { CakeEditorialContent } from '../lib/cake-editorial'
import type { Language } from '../lib/i18n'
import { PavePhoto } from './AuPaveGallery'
import { DetailHeading } from './AuDetailStory'

function StoryHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <DetailHeading eyebrow={eyebrow} title={title} />
}

export function PaveVideoMoment({ videoSrc }: { videoSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !('IntersectionObserver' in window)) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    let disposed = false
    let pending = false
    let blocked = false
    video.defaultMuted = true
    video.muted = true
    const allowed = () => !disposed && inView && !document.hidden && !motion.matches
    const sync = () => {
      if (!allowed()) { video.pause(); return }
      if (pending || blocked || !video.paused) return
      pending = true
      void video.play().then(() => {
        if (!disposed && !allowed()) video.pause()
      }).catch(() => {
        // Keep the poster when autoplay is denied; never retry a policy rejection in a loop.
        if (!disposed && allowed()) blocked = true
      }).finally(() => { pending = false })
    }
    const observer = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting && entry.intersectionRatio >= 0.2
      if (next !== inView) { inView = next; sync() }
    }, { threshold: [0, 0.2] })
    observer.observe(video)
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    return () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      video.pause()
    }
  }, [videoSrc])
  return <section className="au-pave-video" aria-label="Pavé chocolate texture">
    <div className="au-pave-video-media">
      {videoSrc ? <video ref={videoRef} aria-label="Pavé celebration video" src={videoSrc} poster={paveImageSource('angle').src} muted loop playsInline preload="none" />
        : <PavePhoto image="angle" sizes="(max-width: 767px) calc(100vw - 40px), 100vw" />}
    </div>
  </section>
}

export function AuPaveProductStory({ detail, editorial, language, onOpenCake }: {
  detail: CakeDetailData; editorial: CakeEditorialContent | null; language: Language; onOpenCake: (slug: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!root.current || !('IntersectionObserver' in window)) return
    const nodes = Array.from(root.current.querySelectorAll<HTMLElement>('[data-pave-reveal]'))
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove('au-pave-awaiting')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08 })
    const reveal = () => { if (media.matches) { observer.disconnect(); nodes.forEach((node) => node.classList.remove('au-pave-awaiting')) } }
    if (!media.matches) for (const node of nodes) {
      if (node.getBoundingClientRect().top > window.innerHeight) { node.classList.add('au-pave-awaiting'); observer.observe(node) }
    }
    media.addEventListener('change', reveal)
    return () => { observer.disconnect(); media.removeEventListener('change', reveal); nodes.forEach((node) => node.classList.remove('au-pave-awaiting')) }
  }, [])
  const compact = editorial?.layout === 'compact' ? editorial : null
  const cakes = getAuOrderableCakeCards(language)
  const related = [
    { slug: 'signature-gateau-au-chocolat', label: 'Signature Gâteau au Chocolat' },
    { slug: 'brownie-cheesecake', label: 'Brownie Cheesecake' },
  ].flatMap(({ slug, label }) => {
    const card = cakes.find((item) => item.slug === slug)
    return card ? [{ slug, name: label, price: card.priceLabel, image: card.imagePath, href: `/cakes/${slug}`, cake: true }] : []
  })
  const almond = getAuChocolateCollectionCards(language).find((item) => item.slug === 'almond-chocoball')
  if (almond) related.push({ slug: almond.slug, name: almond.name, price: almond.price, image: almond.image, href: almond.href, cake: false })
  const textureCaptions = ['Cut for sharing.', 'Chocolate gâteau layers. Smooth pavé ganache.', 'Find your size in the options above.']
  const occasionCaptions = ['Celebration Party & Sharing', 'Wedding & Milestone Celebrations', '60th Birthday Celebration', 'Corporate Event & Gifting']
  return <div ref={root} className="au-pave-story">
    <section className="au-pave-hook" data-pave-reveal>
      <p className="au-pave-eyebrow">THE PHILOSOPHY</p><h2>MORE CHOCOLATE. LESS DISTRACTION.</h2>
      <p>57.9% dark couverture chocolate. Smooth pavé ganache. Chocolate gâteau layers.</p>
    </section>
    <section className="au-pave-inside" data-pave-reveal>
      <div className="au-pave-inside-photo"><PavePhoto image="inside" sizes="(max-width: 767px) calc(100vw - 40px), 55vw" /></div>
      <StoryHeading eyebrow="CROSS SECTION ANATOMY" title="Inside The Pavé Gâteau" />
      <div className="au-pave-layers">
        <article><h3>01 / CHOCOLATE GÂTEAU LAYERS</h3><p>Four rich chocolate cake layers.</p></article>
        <article><h3>02 / SMOOTH PAVÉ GANACHE</h3><p>Smooth pavé ganache between each layer and around the entire cake.</p></article>
        <article><h3>03 / DARK COUVERTURE CHOCOLATE</h3><p>Made with 57.9% dark couverture chocolate and fresh cream.</p></article>
      </div>
    </section>
    <section className="au-pave-texture" data-pave-reveal>
      <StoryHeading eyebrow="CRAFT & TEXTURE" title="Handcrafted In Sydney" />
      <div className="au-pave-texture-grid">{paveTexture.map((image, index) => <figure key={image}>
        <div><PavePhoto image={image} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1099px) 45vw, 43vw" /></div><figcaption>{textureCaptions[index]}</figcaption>
      </figure>)}</div>
    </section>
    <PaveVideoMoment videoSrc="/products/pave-detail/cake-party-zoom.mp4" />
    <section className="au-pave-occasions" data-pave-reveal>
      <StoryHeading eyebrow="CELEBRATIONS & SHARING" title="Made For Your Moments" />
      <div className="au-pave-occasion-grid">{paveOccasions.map((image, index) => <figure key={image}>
        <div><PavePhoto image={image} sizes="(max-width: 767px) 44vw, (max-width: 1099px) 45vw, 23vw" /></div><figcaption>{occasionCaptions[index]}</figcaption>
      </figure>)}</div>
    </section>
    <section className="au-pave-packaging" data-pave-reveal>
      <div className="au-pave-packaging-photo"><PavePhoto image="packaging" sizes="(max-width: 767px) calc(100vw - 40px), 50vw" /></div>
      <StoryHeading eyebrow="PRESENTATION & TRAVEL" title="READY TO TAKE HOME." />
      <div className="au-pave-packaging-copy"><p>Your cake, ready for collection in Melrose Park, Sydney.</p><p>Arrange your pick-up with our team after availability is confirmed.</p></div>
    </section>
    <section className="au-pave-practical" data-pave-reveal>
      <StoryHeading eyebrow="SPECIFICATIONS & CARE" title="CAKE DETAILS & ALLERGENS" />
      <div className="au-pave-specs">
        {compact && <>
          <details open><summary>{compact.details.title}</summary><div>{compact.details.items.map((item) => <p key={item}>{item}</p>)}</div></details>
          <details open><summary>{compact.ingredientsAndAllergens.ingredientsLabel}</summary><div><p>{compact.ingredientsAndAllergens.ingredients}</p></div></details>
          <details open><summary>{compact.ingredientsAndAllergens.allergenLabel}</summary><div><p>{compact.ingredientsAndAllergens.allergens}</p><p className="au-pave-allergy">{compact.ingredientsAndAllergens.contact}</p></div></details>
        </>}
        {detail.accordions.map((item) => <details key={item.title} open><summary>{item.title}</summary><div><p>{item.body}</p></div></details>)}
      </div>
    </section>
    <section className="au-pave-related" data-pave-reveal>
      <StoryHeading eyebrow="EXPLORE MORE" title="You May Also Enjoy" />
      <div className="au-pave-related-grid">{related.map((card) => <a key={card.slug} href={card.href} onClick={(event) => {
        if (card.cake && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpenCake(card.slug) }
      }}><div><img src={card.image} alt={card.name} width={1080} height={1012} loading="lazy" decoding="async" /></div><h3>{card.name}</h3><p>{card.price}</p></a>)}</div>
    </section>
  </div>
}
