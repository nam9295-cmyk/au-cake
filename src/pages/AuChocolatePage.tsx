import { AuBreadcrumb, AuProductCard } from '../components/AuRedesignChrome'
import { getAuChocolatePreview, getAuChocolatePreviews } from '../lib/au-chocolate-preview'

export function AuChocolatePage({ slug }: { slug: string }) {
  const product = getAuChocolatePreview(slug)
  if (!product) return null
  return <main className="au-redesign-chocolate" data-au-template="chocolate">
    <AuBreadcrumb><a href="/chocolates">CHOCOLATES</a><span aria-hidden="true">/</span><span>{product.name}</span></AuBreadcrumb>
    <section className="au-redesign-chocolate-hero">
      <figure><img src={product.image} alt={`${product.name} — reference photography`} width={1080} height={1012} /><figcaption>Reference image · Product photography to be updated</figcaption></figure>
      <div className="au-redesign-chocolate-info">
        <p className="au-redesign-kicker">VERYGOOD ATELIER · CHOCOLATE COLLECTION</p>
        <h1>{product.name}</h1>
        {product.price && <p className="au-redesign-price">{product.price}</p>}
        {product.weight && <p>{product.weight} net weight</p>}
        <p>{product.description}.</p>
        <div className="au-redesign-coming-soon" role="status"><strong>Coming Soon</strong><p>Not available for independent online orders yet.</p></div>
        <p>Ordering details{product.price ? '' : ' and pricing'} will be published when this item is ready. No reservation or payment is being accepted for this preview.</p>
        <a className="au-redesign-text-link" href="/cakes">Explore available cakes →</a>
      </div>
    </section>
    <section className="au-redesign-related"><h2>MORE ARTISAN CHOCOLATES</h2><div className="au-redesign-product-grid">
      {getAuChocolatePreviews().filter((item) => item.slug !== slug).map((item) => <AuProductCard key={item.slug}
        slug={item.slug} href={`/chocolates/${item.slug}`} name={item.name} image={item.image}
        description={item.weight || item.description} price={item.price} unavailable />)}
    </div></section>
  </main>
}
