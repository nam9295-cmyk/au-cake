import { AuBreadcrumb, AuProductCard } from '../components/AuRedesignChrome'
import { getAuChocolatePreview, getAuChocolatePreviews } from '../lib/au-chocolate-preview'
import { auChocolateAssets } from '../lib/au-chocolate-assets'
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { CHOCOLATE_OPTIONS_V1 } from '../../appwrite-functions/reservation-api/src/chocolate-products.js'
import type { CakeDetailSelection } from '../lib/cake-detail'

export function AuChocolatePage({ slug, onAddToOrder, onViewOrder }: { slug: string; onAddToOrder: (selection: CakeDetailSelection) => void; onViewOrder: () => void }) {
  const [variantIndex, setVariantIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const product = getAuChocolatePreview(slug)
  if (!product) return null
  const selected = product.variants[variantIndex] || product.variants[0]
  const photography = auChocolateAssets[product.slug]
  const referencePhoto = selected.family === 'almond-chocoball' && selected.id !== 'almond-chocoball-80g'
  return <main className="au-redesign-chocolate" data-au-template="chocolate">
    <AuBreadcrumb><a href="/chocolates">CHOCOLATES</a><span aria-hidden="true">/</span><span>{product.name}</span></AuBreadcrumb>
    <section className="au-redesign-chocolate-hero">
      <figure><img src={photography.src} alt={photography.alt} width={1080} height={1012} /><figcaption>{referencePhoto ? 'Reference photo: single 80g pouch. Selected packaging is not pictured.' : photography.caption}</figcaption></figure>
      <div className="au-redesign-chocolate-info">
        <p className="au-redesign-kicker">VERYGOOD ATELIER · CHOCOLATE COLLECTION</p>
        <h1>{product.name}</h1>
        <p className="au-redesign-price">AUD {(selected.unitPriceCents / 100).toFixed(2)}</p>
        <p>{selected.saleUnit}</p>
        <p>{product.description}.</p>
        {product.variants.length > 1 && <fieldset className="cake-detail-fieldset au-chocolate-control">
          <legend>Pack</legend>
          <div className="cake-detail-options au-chocolate-variants">
            {product.variants.map((variant, index) => {
              const active = selected.id === variant.id
              const label = variant.id === 'almond-chocoball-80g' ? '80g'
                : variant.id === 'almond-chocoball-6pack' ? '6 PACK' : 'BLACK TUB'
              return <button key={variant.id} type="button" className={`cake-detail-option${active ? ' is-selected' : ''}`}
                aria-pressed={active} onClick={() => { setVariantIndex(index); setAdded(false) }}>
                <strong>{label}</strong>
                {variant.id !== 'almond-chocoball-80g' && <span>{variant.saleUnit}</span>}
                <span>AUD {(variant.unitPriceCents / 100).toFixed(2)}</span>
                {variant.id === 'almond-chocoball-6pack' && <span>BUY 5, GET 1 FREE</span>}
              </button>
            })}
          </div>
        </fieldset>}
        {selected.id === 'almond-chocoball-6pack' && <p className="au-chocolate-promo-note">BUY 5, GET 1 FREE — 6 PACK / AUD 60<br />Coupons do not apply to this six pack.</p>}
        <fieldset className="cake-detail-fieldset au-chocolate-control">
          <legend>Quantity</legend>
          <div className="cake-detail-quantity au-chocolate-quantity">
            <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1}
              onClick={() => { setQuantity((value) => Math.max(1, value - 1)); setAdded(false) }}><Minus aria-hidden="true" /></button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" aria-label="Increase quantity" disabled={quantity >= 5}
              onClick={() => { setQuantity((value) => Math.min(5, value + 1)); setAdded(false) }}><Plus aria-hidden="true" /></button>
          </div>
        </fieldset>
        <p>Total · AUD {(selected.unitPriceCents * quantity / 100).toFixed(2)}</p>
        <button className="primary-button" type="button" onClick={() => { onAddToOrder({ ...CHOCOLATE_OPTIONS_V1, productId: selected.id, quantity }); setAdded(true) }}>Add to order</button>
        {added && <p role="status">Added to your order.</p>}
        <button className="secondary-button" type="button" onClick={onViewOrder}>View order</button>
        <p>Melrose Park pick-up by arrangement. Availability and payment details are confirmed after your request.</p>
      </div>
    </section>
    <section className="au-redesign-related"><h2>MORE ARTISAN CHOCOLATES</h2><div className="au-redesign-product-grid">
      {getAuChocolatePreviews().filter((item) => item.slug !== slug).map((item) => <AuProductCard key={item.slug}
        slug={item.slug} href={`/chocolates/${item.slug}`} name={item.name} image={auChocolateAssets[item.slug].src} imageAlt={auChocolateAssets[item.slug].alt}
        description={item.packLabel} price={item.price} />)}
    </div></section>
  </main>
}
