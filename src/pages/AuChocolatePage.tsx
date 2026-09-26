import { AuBreadcrumb, AuProductCard } from '../components/AuRedesignChrome'
import { getAuChocolatePreview, getAuChocolatePreviews } from '../lib/au-chocolate-preview'
import { auChocolateAssets } from '../lib/au-chocolate-assets'
import { useState } from 'react'
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
        {product.variants.length > 1 && <label className="au-chocolate-control">Pack<select aria-label="Pack" value={selected.id} onChange={(event) => { setVariantIndex(product.variants.findIndex((variant) => variant.id === event.target.value)); setAdded(false) }}>
          {product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.saleUnit} · AUD {(variant.unitPriceCents / 100).toFixed(2)}</option>)}
        </select></label>}
        {selected.id === 'almond-chocoball-6pack' && <p>BUY 5, GET 1 FREE — 6 PACK / AUD 60<br />Coupons do not apply to this six pack.</p>}
        <label className="au-chocolate-control">Quantity<select aria-label="Quantity" value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); setAdded(false) }}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
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
