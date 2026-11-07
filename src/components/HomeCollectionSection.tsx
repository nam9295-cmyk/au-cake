import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { HomeProduct } from '../lib/au-home'
import type { Language } from '../lib/i18n'

type Collection = { id: string; label: string; products: readonly HomeProduct[] }
type CollectionLink = { href: string; label: string; arrow?: boolean }

function CollectionCard({ product }: { product: HomeProduct }) {
  const body = <>
    <div className="au-v02-product-heading">
      <h3>{product.name}</h3>
      <p>{product.description}</p>
    </div>
    {product.image && <img src={product.image} alt={product.imageAlt} width={1080} height={1012} loading="lazy" decoding="async" />}
    <div className="au-v02-product-price">
      <strong>{product.comingSoon ? product.description : product.price}</strong>
      {product.href && <ArrowUpRight size={16} aria-hidden="true" />}
    </div>
  </>
  return <article className="au-v02-product" data-home-product={product.id}>
    {product.href ? <a href={product.href}>{body}</a> : <div className="au-v02-coming-soon">{body}</div>}
  </article>
}

export function HomeCollectionSection({ id, categories, language, label, note, links, className = '' }: {
  id: string
  categories: readonly Collection[]
  language: Language
  label: string
  note: string
  links: readonly CollectionLink[]
  className?: string
}) {
  const [activeId, setActiveId] = useState(categories[0].id)
  const active = categories.find(category => category.id === activeId) || categories[0]
  const prefix = id === 'au-collection' ? 'home' : 'home-custom'
  const panelId = `${prefix}-collection-panel`
  return <section id={id} className={`rd-collection-section au-v02-collection${className ? ` ${className}` : ''}`} aria-label={label}>
    <aside className="au-v02-collection-sidebar">
      <p className="au-v02-collection-brand">VERYGOOD</p>
      <div className="au-v02-tabs" role="tablist" aria-label={label}>
        {categories.map((category, index) => <button key={category.id} id={`${prefix}-tab-${category.id}`} type="button" role="tab"
          aria-selected={active.id === category.id} aria-controls={panelId} tabIndex={active.id === category.id ? 0 : -1}
          onClick={() => setActiveId(category.id)} onKeyDown={event => {
            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1
              : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : categories.length - 1)) % categories.length
            setActiveId(categories[next].id)
            document.getElementById(`${prefix}-tab-${categories[next].id}`)?.focus()
          }}>
          {category.label}<span>[{category.products.length}]</span>
        </button>)}
      </div>
      <div className="au-v02-atelier-note">
        <p className="au-v02-eyebrow">MELROSE PARK ATELIER</p>
        <p>{note}</p>
      </div>
    </aside>
    <div id={panelId} className="au-v02-collection-main" role="tabpanel" aria-labelledby={`${prefix}-tab-${active.id}`}>
      <div className="au-v02-collection-heading">
        <h2>{active.label}</h2>
        <span>{active.products.length} {language === 'ko' ? '개의 메뉴' : 'ATELIER CREATIONS'}</span>
      </div>
      <div className="au-v02-product-grid">{active.products.map(product => <CollectionCard key={product.id} product={product} />)}</div>
      <div className="au-v02-collection-links">{links.map(link => <a key={link.href} href={link.href}>
        {link.label}{link.arrow !== false && <ArrowUpRight size={14} aria-hidden="true" />}
      </a>)}</div>
    </div>
  </section>
}
