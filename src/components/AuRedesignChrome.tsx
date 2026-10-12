import { type MouseEvent, type ReactNode } from 'react'
import { AuNavigation } from './AuNavigation'
import { useAuLanguage } from '../lib/au-language'

export function AuRedesignHeader({ cartItemCount, home = false }: { cartItemCount: number; home?: boolean }) {
  return <AuNavigation cartItemCount={cartItemCount} home={home} />
}

export function AuRedesignFooter() {
  const { t } = useAuLanguage()
  return <footer className="au-redesign-footer">
    <a className="au-redesign-wordmark" href="/">VERYGOOD / AU-CAKE</a>
    <nav aria-label="Footer navigation"><a href="/lookup">{t('ORDER LOOKUP', '주문 조회')}</a><a href="/reviews">{t('REVIEWS', '후기')}</a><a href="/classes">{t('CLASSES', '클래스')}</a></nav>
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
