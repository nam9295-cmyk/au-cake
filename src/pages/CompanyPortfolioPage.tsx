import { useEffect, useRef } from 'react'
import portfolio from '../content/au-company-portfolio.json' with { type: 'json' }

type Board = (typeof portfolio.boards)[number]
type Photo = Board['images'][number]
const text = (board: Board, name: string) => board.texts.find((item) => item.name === name)?.text || ''
const texts = (board: Board, name: string) => board.texts.filter((item) => item.name === name).map((item) => item.text)

function PortfolioPhoto({ photo, primary, first }: { photo: Photo; primary: boolean; first: boolean }) {
  const variants = photo.web.variants
  const fallback = variants.find((variant) => variant.width >= 640) || variants[variants.length - 1]
  // Sizes follow the collage, tablet pair, and 390px reading compositions.
  const desktopWidth = primary ? 610 : 300
  const sizes = primary
    ? `(max-width: 767px) calc(100vw - 40px), (max-width: 1099px) calc((100vw - 88px) / 2), (max-width: 1375px) 45vw, ${desktopWidth}px`
    : `(max-width: 767px) calc((100vw - 52px) / 2), (max-width: 1099px) calc((100vw - 112px) / 4), (max-width: 1375px) 22vw, ${desktopWidth}px`
  return <figure className={`portfolio-photo${primary ? ' portfolio-primary' : ''}`}>
    <img src={fallback.src} srcSet={variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')} sizes={sizes}
      width={photo.web.width} height={photo.web.height} alt={photo.web.alt}
      loading={first ? 'eager' : 'lazy'} fetchPriority={first ? 'high' : 'auto'} decoding="async" />
  </figure>
}

function ServiceNavigation({ board }: { board: Board }) {
  return <nav className="portfolio-services" aria-label={text(board, 'BOTTOM LABEL')}>
    <h2>{text(board, 'BOTTOM LABEL')}</h2>
    <ul>{board.texts.filter((item) => item.name.startsWith('CHOICE ')).sort((a, b) => a.name.localeCompare(b.name)).map((item, index) =>
      <li key={item.name}><a href={`#${portfolio.boards[index].slug}`}>{item.text}</a></li>)}</ul>
  </nav>
}

function ServiceSection({ board, index }: { board: Board; index: number }) {
  const Heading = index === 0 ? 'h1' : 'h2'
  const gallery = board.images.length > 1
  return <section id={board.slug} aria-labelledby={`${board.slug}-title`} tabIndex={-1}
    className={`portfolio-service portfolio-reveal${index % 2 ? ' portfolio-image-left' : ''}${gallery ? ' portfolio-gallery' : ''}${board.images.length === 1 ? ' portfolio-single' : ''}${index === 0 ? ' portfolio-opening' : ''}`}>
    <PortfolioPhoto photo={board.images[0]} primary first={index === 0} />
    <header className="portfolio-heading">
      <p className="portfolio-question">{text(board, 'QUESTION')}</p>
      <Heading id={`${board.slug}-title`}>{text(board, 'TITLE')}</Heading>
      <p className="portfolio-intro">{text(board, 'INTRO')}</p>
    </header>
    {board.images.length > 1 && <div className="portfolio-supporting">
      {board.images.slice(1).map((photo) => <PortfolioPhoto key={photo.shapeId} photo={photo} primary={false} first={false} />)}
    </div>}
    {index === 0 ? <ServiceNavigation board={board} /> : <div className="portfolio-details">
      {text(board, 'PHOTO LABEL') && <p className="portfolio-photo-note">{text(board, 'PHOTO LABEL')}</p>}
      {text(board, 'BOTTOM LABEL') && <div className="portfolio-service-note">
        <h3>{text(board, 'BOTTOM LABEL')}</h3><p>{text(board, 'BOTTOM COPY')}</p>
      </div>}
      {text(board, 'PRODUCT LINE') && <p className="portfolio-product-line">{text(board, 'PRODUCT LINE')}</p>}
    </div>}
    <div className="portfolio-contact">
      <p>{text(board, 'CONTACT LABEL')}</p>
      <a href={portfolio.links.instagram}>{text(board, 'CONTACT LINK')}</a>
    </div>
  </section>
}

function EnquirySection({ board }: { board: Board }) {
  const numbers = texts(board, 'STEP NUMBER')
  const titles = texts(board, 'STEP TITLE')
  const descriptions = texts(board, 'STEP COPY')
  return <section id={board.slug} className="portfolio-enquiry portfolio-reveal" aria-labelledby="enquire-title" tabIndex={-1}>
    <div className="portfolio-enquiry-inner">
      <p className="portfolio-question">{text(board, 'SECTION')}</p>
      <h2 id="enquire-title">{text(board, 'TITLE')}</h2>
      <p className="portfolio-intro">{text(board, 'INTRO')}</p>
      <ol className="portfolio-steps">{titles.map((title, index) => <li key={title}>
        <span aria-hidden="true">{numbers[index]}</span><h3>{title}</h3><p>{descriptions[index]}</p>
      </li>)}</ol>
      <div className="portfolio-destinations">
        <a href={portfolio.links.collection}><strong>{text(board, 'COLLECTION LINK')}</strong><span>{text(board, 'COLLECTION COPY')}</span></a>
        <a href={portfolio.links.custom}><strong>{text(board, 'CUSTOM LINK')}</strong><span>{text(board, 'CUSTOM COPY')}</span></a>
      </div>
      <div className="portfolio-availability">
        <div><p>{text(board, 'COLLECTION HOURS LABEL')}</p><strong>{text(board, 'COLLECTION HOURS')}</strong><p>{text(board, 'COLLECTION LOCATION')}</p></div>
        <div><p>{text(board, 'ONLINE LABEL')}</p><strong>{text(board, 'ONLINE HOURS')}</strong></div>
      </div>
      <div className="portfolio-enquiry-links">
        <a href={portfolio.links.website}>{text(board, 'WEBSITE')}</a>
        <a href={portfolio.links.instagram}>{text(board, 'INSTAGRAM')}</a>
      </div>
      <p className="portfolio-confirmation">{text(board, 'ORDER CONFIRMATION')}</p>
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
      if (!portfolio.boards.some((board) => board.slug === id)) return
      const target = document.getElementById(id)
      target?.classList.remove('is-reveal-pending')
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
      sections.forEach((section) => section.classList.remove('is-reveal-pending'))
      if (motion.matches || !('IntersectionObserver' in window)) return
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('is-reveal-pending')
            observer?.unobserve(entry.target)
          }
        })
      }, { threshold: 0.08 })
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top >= window.innerHeight && `#${section.id}` !== window.location.hash) {
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
      sections.forEach((section) => section.classList.remove('is-reveal-pending'))
    }
  }, [])

  return <main className="company-portfolio" lang="en-AU" ref={main}>
    <div className="portfolio-identity"><span>{text(portfolio.boards[0], 'BRAND · descriptor')}</span><span>{text(portfolio.boards[0], 'LOCATION')}</span></div>
    {portfolio.boards.slice(0, 6).map((board, index) => <ServiceSection key={board.id} board={board} index={index} />)}
    <EnquirySection board={portfolio.boards[6]} />
  </main>
}
