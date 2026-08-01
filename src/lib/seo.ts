import { getCakeDetailBySlug } from './cake-detail.js'
import { getAuCakeCatalog } from './cake-catalog.js'
import {
  getPublicCakePage,
  getAuPublicContent,
  SITE_URL,
} from './public-content.js'
import type { PublicCakePage } from './public-content.js'

type SeoConfig = {
  title: string
  description: string
  canonical?: string
  noindex?: boolean
  ogType?: 'website' | 'product'
  image?: string
  structuredData?: Array<Record<string, unknown>>
}

const organization: Record<string, unknown> = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Very Good Chocolate',
  alternateName: 'Very Good Chocolate Sydney',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  description: 'Small-batch, made-to-order cakes for pre-arranged pick-up in Melrose Park, Sydney.',
  areaServed: {
    '@type': 'City',
    name: 'Sydney',
  },
}

const cakeListItems = getAuCakeCatalog().map((entry, index) => {
  const detail = getCakeDetailBySlug(entry.slug, 'en')
  return {
    '@type': 'ListItem',
    position: index + 1,
    name: detail?.name || entry.slug,
    url: `${SITE_URL}/cakes/${entry.slug}`,
  }
})

const cakeItemList: Record<string, unknown> = {
  '@type': 'ItemList',
  '@id': `${SITE_URL}/cakes#item-list`,
  name: 'Verygood Chocolate Sydney cake catalogue',
  numberOfItems: cakeListItems.length,
  itemListElement: cakeListItems,
}

function getBreadcrumbList(pathname: string, name: string): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${SITE_URL}${pathname}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Cakes', item: `${SITE_URL}/cakes` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_URL}${pathname}` },
    ],
  }
}

const publicSeo: Record<string, SeoConfig> = {
  '/': {
    title: getAuPublicContent().home.title,
    description: getAuPublicContent().home.description,
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
      cakeItemList,
    ],
  },
  '/classes': {
    title: 'Kids Cake Decorating Classes Sydney | Verygood Chocolate',
    description: 'Private weekend cake decorating classes in Melrose Park, Sydney: Basic from Kindy to Year 6 and Advanced for Years 2–6.',
    canonical: `${SITE_URL}/classes`,
    structuredData: [
      organization,
      {
        '@type': 'Course',
        '@id': `${SITE_URL}/classes#course`,
        name: 'Kids Professional Chocolate Cake Course',
        description: 'Private weekend cake courses with Basic classes from Kindy to Year 6 and Advanced 2-Tier classes for Years 2–6.',
        url: `${SITE_URL}/classes`,
        provider: { '@id': `${SITE_URL}/#organization` },
        educationalLevel: 'Basic: Kindy–Year 6; Advanced: Years 2–6',
        inLanguage: 'en-AU',
        offers: {
          '@type': 'AggregateOffer',
          url: `${SITE_URL}/class-reserve`,
          priceCurrency: 'AUD',
          lowPrice: 99,
          highPrice: 198,
        },
      },
    ],
  },
  '/reviews': {
    title: 'Customer Reviews | Verygood Chocolate Sydney',
    description: 'Read verified customer reviews from Verygood Chocolate cake orders and kids cake class bookings in Sydney.',
    canonical: `${SITE_URL}/reviews`,
    structuredData: [organization],
  },
  '/cakes': {
    title: 'Made-to-Order Cakes Sydney | Verygood Chocolate',
    description: 'Browse five small-batch cakes and request confirmed pick-up in Melrose Park, Sydney.',
    canonical: `${SITE_URL}/cakes`,
    structuredData: [
      organization,
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/cakes#collection`,
        name: 'Made-to-Order Cakes Sydney',
        description: 'Browse five small-batch cakes and request confirmed pick-up in Melrose Park, Sydney.',
        url: `${SITE_URL}/cakes`,
        mainEntity: `${SITE_URL}/cakes#item-list`,
      },
      cakeItemList,
    ],
  },
}

function productFromPublicPage(pathname: string, page: PublicCakePage): SeoConfig {
  const image = page.imagePath ? `${SITE_URL}${page.imagePath}` : undefined
  const breadcrumb = getBreadcrumbList(pathname, page.name)

  if (page.schema === 'webpage-only') {
    return {
      title: `${page.name} Sydney | Very Good Chocolate`,
      description: page.priceSummary,
      canonical: `${SITE_URL}${pathname}`,
      ogType: 'website',
      ...(image ? { image } : {}),
      structuredData: [
        {
          '@type': 'WebPage',
          '@id': `${SITE_URL}${pathname}#webpage`,
          name: page.name,
          description: page.priceSummary,
          url: `${SITE_URL}${pathname}`,
        },
        breadcrumb,
      ],
    }
  }

  const product: Record<string, unknown> = {
    '@type': 'Product',
    '@id': `${SITE_URL}${pathname}#product`,
    name: page.name,
    description: page.priceSummary,
    ...(image ? { image } : {}),
    brand: { '@type': 'Brand', name: 'Very Good Chocolate' },
    category: 'Made-to-order cake',
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${pathname}`,
      priceCurrency: 'AUD',
      price: page.startingPrice,
      seller: { '@type': 'Organization', name: 'Very Good Chocolate', url: SITE_URL },
    },
  }

  return {
    title: `${page.name} Sydney | Very Good Chocolate`,
    description: page.priceSummary,
    canonical: `${SITE_URL}${pathname}`,
    ogType: 'product',
    ...(image ? { image } : {}),
    structuredData: [product, breadcrumb],
  }
}

function getCakeDetailSeo(pathname: string): SeoConfig | null {
  const match = /^\/cakes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname)
  if (!match) return null
  const page = getPublicCakePage(match[1])
  return page ? productFromPublicPage(pathname, page) : null
}

const privateSeo: Record<string, SeoConfig> = {
  '/cart': {
    title: 'Your Cart | Verygood Chocolate',
    description: 'Review your selected cakes before sending one cake request to Verygood Chocolate Sydney.',
    noindex: true,
  },
  '/admin/reviews': {
    title: 'Review Moderation Admin | Verygood Chocolate',
    description: 'Private review moderation administration.',
    noindex: true,
  },
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
  '/review': {
    title: 'Share Your Review | Verygood Chocolate',
    description: 'Share private feedback about your Verygood Chocolate experience.',
    canonical: `${SITE_URL}/review`,
    noindex: true,
  },
}

function setMeta(selector: string, attribute: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector)
  if (element) element.setAttribute(attribute, value)
}

export function getSeoConfig(pathname: string): SeoConfig {
  if (publicSeo[pathname]) return publicSeo[pathname]
  const cakeDetailSeo = getCakeDetailSeo(pathname)
  if (cakeDetailSeo) return cakeDetailSeo
  if (pathname === '/review.html') return privateSeo['/review']
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
  const image = config.image || `${SITE_URL}/og-image.jpg`

  document.title = config.title
  setMeta('meta[name="description"]', 'content', config.description)
  setMeta('meta[name="robots"]', 'content', config.noindex ? 'noindex, nofollow' : 'index, follow')
  setMeta('meta[property="og:type"]', 'content', config.ogType || 'website')
  setMeta('meta[property="og:title"]', 'content', config.title)
  setMeta('meta[property="og:description"]', 'content', config.description)
  setMeta('meta[property="og:url"]', 'content', canonical)
  setMeta('meta[property="og:image"]', 'content', image)
  setMeta('meta[name="twitter:title"]', 'content', config.title)
  setMeta('meta[name="twitter:description"]', 'content', config.description)
  setMeta('meta[name="twitter:image"]', 'content', image)

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
