import { useRef, type MouseEvent, type ReactNode } from 'react'

export function AuRedesignHeader({ cartItemCount }: { cartItemCount: number }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const links = <>
    <a href="/cakes">SHOP</a>
    <a href="/chocolates">CHOCOLATES</a>
    <a href="/cakes/custom-cake">CUSTOM CAKES</a>
    <a href="/classes">EVENTS & BUSINESS</a>
    <a href="/reviews">ABOUT</a>
  </>
  return (
    <header className="au-redesign-header">
      <a className="au-redesign-wordmark" href="/">verygood</a>
      <nav className="au-redesign-desktop-nav" aria-label="Main navigation">{links}</nav>
      <div className="au-redesign-header-actions">
        <span className="au-redesign-currency">AUD</span>
        <details className="au-redesign-mobile-menu" ref={menu} onKeyDown={(event) => {
          if (event.key === 'Escape' && menu.current) {
            menu.current.open = false
            menu.current.querySelector('summary')?.focus()
          }
        }}>
          <summary>MENU</summary>
          <nav aria-label="Mobile navigation">{links}<a href="/lookup">ORDER LOOKUP</a></nav>
        </details>
        <a href="/cart" aria-label={`Cart with ${cartItemCount} items`}>CART [{cartItemCount}]</a>
      </div>
    </header>
  )
}

export function AuRedesignFooter() {
  return <footer className="au-redesign-footer">
    <a className="au-redesign-wordmark" href="/">VERYGOOD / AU-CAKE</a>
    <nav aria-label="Footer navigation"><a href="/lookup">ORDER LOOKUP</a><a href="/reviews">REVIEWS</a><a href="/classes">CLASSES</a></nav>
    <small>© 2026 VERYGOOD. Sydney, Australia.</small>
  </footer>
}

export function AuProductCard({ slug, href, name, image, imageAlt, description, price, unavailable, onOpen }: {
  slug: string
  href: string
  name: string
  image: string
  imageAlt?: string
  description: string
  price: string | null
  unavailable?: boolean
  onOpen?: () => void
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onOpen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      onOpen()
    }
  }
  return <article className="au-redesign-product-card" data-au-product={slug}>
    <a href={href} onClick={open}>
      <header><h3>{name}</h3><p>{description}</p></header>
      <div className="au-redesign-card-image">
        <img src={image} alt={imageAlt || name} width={1080} height={1012} loading="lazy" decoding="async" />
      </div>
      <div className="au-redesign-card-bottom">
        <span>{unavailable ? price ?? 'PRICE TBD' : price}</span>
        {unavailable && <small>Preview</small>}
        <span aria-hidden="true">→</span>
      </div>
    </a>
  </article>
}

export function AuBreadcrumb({ children }: { children: ReactNode }) {
  return <nav className="au-redesign-breadcrumb" aria-label="Breadcrumb"><a href="/">HOME</a><span aria-hidden="true">/</span>{children}</nav>
}
