const SITE_URL = 'https://au.verygood-chocolate.com'

type SeoConfig = {
  title: string
  description: string
  canonical?: string
  noindex?: boolean
  structuredData?: Array<Record<string, unknown>>
}

const organization: Record<string, unknown> = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Verygood Chocolate',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  description: 'Small-batch, made-to-order chocolate cakes for pre-arranged pick-up in Melrose Park, Sydney.',
  areaServed: {
    '@type': 'City',
    name: 'Sydney',
  },
}

const products = [
  {
    name: 'Pave Chocolate Cake',
    description: 'A round chocolate cake layered with chocolate sponge and smooth pave ganache.',
    image: `${SITE_URL}/og-image.jpg`,
    lowPrice: 75,
    highPrice: 115,
  },
  {
    name: 'Chocolate Pound Cake',
    description: 'A rich rectangular gâteau au chocolat finished with dark chocolate.',
    image: `${SITE_URL}/og-image.jpg`,
    lowPrice: 45,
    highPrice: 52,
  },
  {
    name: 'Chocolate Cupcakes (1 dozen)',
    description: 'A dozen small-batch chocolate cupcakes for parties, sharing and gifting.',
    image: `${SITE_URL}/og-image.jpg`,
    lowPrice: 55,
    highPrice: 62,
  },
].map((product) => ({
  '@type': 'Product',
  name: product.name,
  description: product.description,
  image: product.image,
  brand: { '@id': `${SITE_URL}/#organization` },
  offers: {
    '@type': 'AggregateOffer',
    url: `${SITE_URL}/reserve`,
    priceCurrency: 'AUD',
    lowPrice: product.lowPrice,
    highPrice: product.highPrice,
    offerCount: 1,
    availability: 'https://schema.org/LimitedAvailability',
  },
}))

const publicSeo: Record<string, SeoConfig> = {
  '/': {
    title: 'Made-to-Order Chocolate Cakes Sydney | Verygood Chocolate',
    description: 'Order small-batch chocolate cakes, gâteau au chocolat and cupcakes for pre-arranged pick-up in Melrose Park, Sydney.',
    canonical: SITE_URL,
    structuredData: [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Verygood Chocolate Sydney',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-AU',
      },
      ...products,
    ],
  },
  '/classes': {
    title: 'Kids Cake Decorating Classes Sydney | Verygood Chocolate',
    description: 'Private, hands-on chocolate cake decorating classes for primary school children in Melrose Park, Sydney. Limited school holiday sessions.',
    canonical: `${SITE_URL}/classes`,
    structuredData: [
      organization,
      {
        '@type': 'Course',
        '@id': `${SITE_URL}/classes#course`,
        name: 'Kids Professional Chocolate Cake Course',
        description: 'A private, hands-on cake course where primary school children plan, build and finish their own 15cm chocolate cake.',
        url: `${SITE_URL}/classes`,
        provider: { '@id': `${SITE_URL}/#organization` },
        educationalLevel: 'Primary school (Years 1-6)',
        inLanguage: 'en-AU',
        offers: {
          '@type': 'AggregateOffer',
          url: `${SITE_URL}/class-reserve`,
          priceCurrency: 'AUD',
          lowPrice: 99,
          highPrice: 198,
          availability: 'https://schema.org/LimitedAvailability',
        },
      },
    ],
  },
}

const privateSeo: Record<string, SeoConfig> = {
  '/reserve': {
    title: 'Request a Chocolate Cake | Verygood Chocolate',
    description: 'Submit a cake booking request to Verygood Chocolate Sydney.',
    noindex: true,
  },
  '/complete': {
    title: 'Cake Request Received | Verygood Chocolate',
    description: 'Your cake request has been received.',
    noindex: true,
  },
  '/lookup': {
    title: 'Find Your Booking | Verygood Chocolate',
    description: 'Look up an existing Verygood Chocolate booking.',
    noindex: true,
  },
  '/class-reserve': {
    title: 'Request a Kids Cake Class | Verygood Chocolate',
    description: 'Submit a private kids cake class booking request.',
    noindex: true,
  },
  '/class-complete': {
    title: 'Class Request Received | Verygood Chocolate',
    description: 'Your kids cake class request has been received.',
    noindex: true,
  },
  '/calendar': {
    title: 'Private Schedule | Verygood Chocolate',
    description: 'Private read-only booking schedule.',
    noindex: true,
  },
}

function setMeta(selector: string, attribute: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector)
  if (element) element.setAttribute(attribute, value)
}

export function getSeoConfig(pathname: string): SeoConfig {
  if (publicSeo[pathname]) return publicSeo[pathname]
  if (privateSeo[pathname]) return privateSeo[pathname]
  if (pathname.startsWith('/admin')) {
    return {
      title: 'Admin | Verygood Chocolate',
      description: 'Verygood Chocolate administration.',
      noindex: true,
    }
  }
  return {
    title: 'Page Not Found | Verygood Chocolate',
    description: 'The requested page could not be found.',
    noindex: true,
  }
}

export function applySeo(pathname: string) {
  const config = getSeoConfig(pathname)
  const canonical = config.canonical || `${SITE_URL}${pathname}`

  document.title = config.title
  setMeta('meta[name="description"]', 'content', config.description)
  setMeta('meta[name="robots"]', 'content', config.noindex ? 'noindex, nofollow' : 'index, follow')
  setMeta('meta[property="og:title"]', 'content', config.title)
  setMeta('meta[property="og:description"]', 'content', config.description)
  setMeta('meta[property="og:url"]', 'content', canonical)
  setMeta('meta[name="twitter:title"]', 'content', config.title)
  setMeta('meta[name="twitter:description"]', 'content', config.description)

  const canonicalElement = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonicalElement) canonicalElement.href = canonical

  document.head.querySelectorAll('script[data-vg-structured-data]').forEach((element) => element.remove())
  config.structuredData?.forEach((data) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.vgStructuredData = 'true'
    script.text = JSON.stringify({ '@context': 'https://schema.org', ...data })
    document.head.appendChild(script)
  })
}
