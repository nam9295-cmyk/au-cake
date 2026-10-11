import content from '../content/au-business-services.json'
import assets from '../content/au-service-assets.json'
import publicContent from '../content/au-public-pages.json'

type Card = { title: string; body: string; image?: string; href?: string }
type Section = {
  id: string
  layout: string
  title: string
  kicker?: string
  body: string
  image?: string
  cards?: Card[]
}
const contact = publicContent.site.socialProfiles.find((url) =>
  url.startsWith('https://www.instagram.com/'),
)!
function ServicePhoto({
  id,
  hero = false,
  wide = false,
}: {
  id: string
  hero?: boolean
  wide?: boolean
}) {
  const photo = assets[id as keyof typeof assets]
  return (
    <img
      src={photo.variants[0].src}
      srcSet={photo.variants.map((v) => `${v.src} ${v.width}w`).join(', ')}
      sizes={
        hero || wide
          ? '(max-width: 600px) calc(100vw - 40px), (max-width: 1440px) calc(100vw - 160px), 1280px'
          : '(max-width: 600px) calc(100vw - 40px), (max-width: 1099px) 45vw, 42vw'
      }
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={hero ? 'eager' : 'lazy'}
      fetchPriority={hero ? 'high' : 'auto'}
      decoding="async"
    />
  )
}
export default function AuBusinessServicePage({ slug }: { slug: string }) {
  const page = content.pages.find((p) => p.slug === slug)
  if (!page) return null
  return (
    <main className={`au-business au-business-${page.slug}`}>
      <section className="au-business-hero">
        <p className="au-business-eyebrow">{page.eyebrow}</p>
        <h1>{page.headline}</h1>
        <p className="au-business-intro">{page.intro}</p>
        <div className="au-business-actions">
          <a className="au-business-button" href="#enquire">
            {page.primary}
          </a>
          <a
            className="au-business-button au-business-outline"
            href={`#${page.target}`}
          >
            {page.secondary}
          </a>
        </div>
        <div className="au-business-tags">
          {page.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="au-business-status">{page.status}</p>
        <div className="au-business-hero-photo">
          <ServicePhoto id={page.hero} hero />
        </div>
      </section>
      {(page.sections as Section[]).map((section) => (
        <section
          id={section.id}
          key={section.id}
          className={`au-business-section au-business-${section.layout}`}
        >
          {section.layout === 'editorial' &&
            section.id === 'share' &&
            section.image && <ServicePhoto id={section.image} wide />}
          <header>
            {section.kicker && (
              <p className="au-business-eyebrow">{section.kicker}</p>
            )}
            <h2>{section.title}</h2>
            {section.body && <p>{section.body}</p>}
          </header>
          {section.image && section.id !== 'share' && (
            <ServicePhoto
              id={section.image}
              wide={section.layout === 'editorial'}
            />
          )}
          {section.cards && (
            <div className="au-business-grid">
              {section.cards.map((card, index) => (
                <article key={card.title} className="au-business-card">
                  {card.image && (
                    <div className="au-business-card-photo">
                      <ServicePhoto id={card.image} />
                    </div>
                  )}
                  <div className="au-business-card-copy">
                    {!card.image && (
                      <span className="au-business-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    )}
                    <h3>
                      {card.href ? (
                        <a href={card.href}>{card.title}</a>
                      ) : (
                        card.title
                      )}
                    </h3>
                    <p>{card.body}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
      <section id="enquire" className="au-business-enquire">
        <p className="au-business-eyebrow">{page.cta.eyebrow}</p>
        <h2>{page.cta.title}</h2>
        <p>{page.cta.body}</p>
        <a className="au-business-button" href={contact}>
          {page.cta.button}
        </a>
        <p className="au-business-contact-note">
          Enquiries via @verygood_syd · Melrose Park, Sydney
        </p>
      </section>
      <nav className="au-business-related" aria-label="Business services">
        {content.pages.map((p) => (
          <a
            key={p.slug}
            href={`/business/${p.slug}`}
            aria-current={p.slug === slug ? 'page' : undefined}
          >
            {p.title}
          </a>
        ))}
        <a href="/classes">Classes</a>
        <a href="/portfolio">Our portfolio</a>
      </nav>
    </main>
  )
}
