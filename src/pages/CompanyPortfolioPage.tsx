import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import portfolio from '../content/au-company-portfolio.json' with { type: 'json' }
import copy from '../content/au-portfolio-v03.json' with { type: 'json' }

type Photo = (typeof portfolio.boards)[number]['images'][number]
const boardFor = (slug: string) => portfolio.boards.find(board => board.slug === slug)!

function PortfolioPhoto({ photo, role = 'feature', first = false }: {
  photo: Photo; role?: 'hero' | 'feature' | 'supporting' | 'business'; first?: boolean
}) {
  const variants = photo.web.variants
  const fallback = variants.find(variant => variant.width >= 640) || variants.at(-1)!
  const sizes = role === 'business' ? '(max-width: 650px) 90px, 150px'
    : role === 'supporting' ? '(max-width: 650px) calc((100vw - 50px) / 2), (max-width: 1180px) calc((100vw - 90px) / 2), 545px'
      : '(max-width: 650px) calc(100vw - 40px), (max-width: 1180px) calc((100vw - 128px) / 2), 526px'
  return <figure className={`portfolio-photo portfolio-photo-${role}`}>
    <img src={fallback.src} srcSet={variants.map(variant => `${variant.src} ${variant.width}w`).join(', ')} sizes={sizes}
      width={photo.web.width} height={photo.web.height} alt={photo.web.alt}
      loading={first ? 'eager' : 'lazy'} fetchPriority={first ? 'high' : 'auto'} decoding="async" />
  </figure>
}

function PortfolioAction({ href, children, variant = 'solid' }: {
  href: string; children: ReactNode; variant?: 'solid' | 'outline' | 'text' | 'fallback'
}) {
  return <a className={`portfolio-action portfolio-action-${variant}`} href={href}>
    {children}<ArrowUpRight size={16} aria-hidden="true" />
  </a>
}

function OpeningSection() {
  return <section id="daily-chocolate" className="portfolio-opening" aria-labelledby="daily-chocolate-title" tabIndex={-1}>
    <div className="portfolio-identity"><span>CHOCOLATE & CAKES</span><span>SYDNEY</span></div>
    <div className="portfolio-hero">
      <div className="portfolio-hero-photo">
        <PortfolioPhoto photo={boardFor('daily-chocolate').images[0]} role="hero" first />
        <p className="portfolio-caption">{copy.hero.caption}</p>
      </div>
      <div className="portfolio-hero-copy">
        <p className="portfolio-kicker">{copy.hero.kicker}</p>
        <h1 id="daily-chocolate-title">{copy.hero.title}</h1>
        <p>{copy.hero.body}</p>
        <div className="portfolio-actions">
          <PortfolioAction href={portfolio.links.collection}>{copy.actions.cakes}</PortfolioAction>
          <PortfolioAction href={portfolio.links.chocolates} variant="outline">{copy.actions.chocolates}</PortfolioAction>
        </div>
        <nav className="portfolio-choices" aria-label="Find your occasion">
          {copy.hero.choices.map(choice => <a key={choice.href} href={choice.href}>{choice.label}</a>)}
        </nav>
      </div>
    </div>
  </section>
}

function FeatureSection({ feature }: { feature: (typeof copy.features)[number] }) {
  const board = boardFor(feature.slug)
  const href = portfolio.links[feature.target as keyof typeof portfolio.links]
  return <section id={feature.slug} className="portfolio-feature portfolio-reveal" aria-labelledby={`${feature.slug}-title`} tabIndex={-1}>
    <div className="portfolio-feature-main">
      <PortfolioPhoto photo={board.images[0]} />
      <div className="portfolio-feature-copy">
        <p className="portfolio-kicker">{feature.kicker}</p>
        <h2 id={`${feature.slug}-title`}>{feature.title}</h2>
        <p>{feature.body}</p>
        <p className="portfolio-note">{feature.note}</p>
        <div className="portfolio-actions">
          <PortfolioAction href={href}>{feature.action}</PortfolioAction>
          {feature.instagramFallback && <PortfolioAction href={portfolio.links.instagram} variant="fallback">Instagram</PortfolioAction>}
        </div>
      </div>
    </div>
    {board.images.length > 1 && <div className="portfolio-supporting">
      {board.images.slice(1).map(photo => <PortfolioPhoto key={photo.shapeId} photo={photo} role="supporting" />)}
    </div>}
  </section>
}

function BusinessSection() {
  return <section id="business" className="portfolio-business portfolio-reveal" aria-labelledby="portfolio-business-title" tabIndex={-1}>
    <p className="portfolio-kicker">{copy.business.kicker}</p>
    <h2 id="portfolio-business-title">{copy.business.title}</h2>
    {copy.business.services.map(service => <article key={service.slug} id={service.slug} className="portfolio-business-row" aria-labelledby={`${service.slug}-title`} tabIndex={-1}>
      <PortfolioPhoto photo={boardFor(service.slug).images[0]} role="business" />
      <div>
        <h3 id={`${service.slug}-title`}>{service.title}</h3>
        <p>{service.body}</p>
        <PortfolioAction href={portfolio.links.instagram} variant="text">{service.action}</PortfolioAction>
      </div>
    </article>)}
  </section>
}

function EnquirySection() {
  return <section id="enquire" className="portfolio-enquiry portfolio-reveal" aria-labelledby="enquire-title" tabIndex={-1}>
    <div className="portfolio-guide">
      <p className="portfolio-kicker">{copy.guide.kicker}</p>
      <h2 id="enquire-title">{copy.guide.title}</h2>
      <p>{copy.guide.body}</p>
      <ol className="portfolio-steps">{copy.guide.steps.map((step, index) => <li key={step.title}>
        <strong>{String(index + 1).padStart(2, '0')} / {step.title}</strong><span>{step.body}</span>
      </li>)}</ol>
      <div className="portfolio-actions">
        <PortfolioAction href={portfolio.links.collection}>{copy.actions.cakes}</PortfolioAction>
        <PortfolioAction href={portfolio.links.custom} variant="outline">{copy.actions.custom}</PortfolioAction>
      </div>
      <p className="portfolio-guide-note">{copy.guide.location}<br />{copy.guide.enquiries}</p>
    </div>
  </section>
}

export default function CompanyPortfolioPage() {
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = main.current
    if (!root) return
    let cancelled = false
    let frame = 0
    const followHash = () => {
      let id: string
      try { id = decodeURIComponent(window.location.hash.slice(1)) } catch { return }
      if (id !== 'business' && !portfolio.boards.some(board => board.slug === id)) return
      const target = document.getElementById(id)
      target?.closest('.portfolio-reveal')?.classList.remove('is-reveal-pending')
      frame = window.requestAnimationFrame(() => {
        target?.scrollIntoView({ block: 'start', behavior: 'instant' })
        target?.focus({ preventScroll: true })
      })
    }
    followHash()
    void document.fonts.ready.then(() => { if (!cancelled && window.location.hash) followHash() })
    window.addEventListener('hashchange', followHash)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.portfolio-reveal'))
    let observer: IntersectionObserver | undefined
    const configureReveal = () => {
      observer?.disconnect()
      sections.forEach(section => section.classList.remove('is-reveal-pending'))
      if (motion.matches || !('IntersectionObserver' in window)) return
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('is-reveal-pending')
            observer?.unobserve(entry.target)
          }
        })
      }, { threshold: 0.08 })
      sections.forEach(section => {
        const hashTarget = document.getElementById(window.location.hash.slice(1))
        if (section.getBoundingClientRect().top >= window.innerHeight && !section.contains(hashTarget)) {
          section.classList.add('is-reveal-pending')
          observer?.observe(section)
        }
      })
    }
    configureReveal()
    motion.addEventListener('change', configureReveal)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', followHash)
      motion.removeEventListener('change', configureReveal)
      observer?.disconnect()
      sections.forEach(section => section.classList.remove('is-reveal-pending'))
    }
  }, [])

  return <main className="company-portfolio" lang="en-AU" ref={main}>
    <div className="portfolio-page-inner">
      <OpeningSection />
      {copy.features.map(feature => <FeatureSection key={feature.slug} feature={feature} />)}
      <BusinessSection />
      <EnquirySection />
    </div>
  </main>
}
