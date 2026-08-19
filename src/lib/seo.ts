import { getCakeDetailBySlug } from './cake-detail.js'
import { getAuCakeCatalog } from './cake-catalog.js'
import {
  getPublicCakePage,
  getAuPublicContent,
  isLegacyCakePublicPage,
  getPublicRoutePage,
  SITE_URL,
} from './public-content.js'
import type { PublicCakePage } from './public-content.js'

const publicContent = getAuPublicContent()
const brand = publicContent.site.brand

type SeoConfig = {
  title: string
  description: string
  canonical?: string
  noindex?: boolean
  ogType?: 'website' | 'product'
  image?: string
  imageType?: string
  imageWidth?: number
  imageHeight?: number
  structuredData?: Array<Record<string, unknown>>
}

const organization: Record<string, unknown> = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: publicContent.site.brand,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  description: publicContent.site.organizationDescription,
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
  name: `${publicContent.site.brand} Sydney cake catalogue`,
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
    title: getPublicRoutePage('/')!.title,
    description: getPublicRoutePage('/')!.description,
    canonical: SITE_URL,
    structuredData: [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: `${publicContent.site.brand} Sydney`,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-AU',
      },
      cakeItemList,
    ],
  },
  '/classes': {
    title: getPublicRoutePage('/classes')!.title,
    description: getPublicRoutePage('/classes')!.description,
    canonical: `${SITE_URL}/classes`,
    structuredData: [
      organization,
      {
        '@type': 'Course',
        '@id': `${SITE_URL}/classes#course`,
        name: publicContent.classes.courseName,
        description: publicContent.classes.courseDescription,
        url: `${SITE_URL}/classes`,
        provider: { '@id': `${SITE_URL}/#organization` },
        educationalLevel: publicContent.classes.educationalLevel,
        inLanguage: publicContent.site.language,
        offers: {
          '@type': 'AggregateOffer',
          url: `${SITE_URL}/class-reserve`,
          priceCurrency: 'AUD',
          lowPrice: publicContent.classes.baseLowPrice,
          highPrice: publicContent.classes.baseHighPrice,
        },
      },
    ],
  },
  '/reviews': {
    title: getPublicRoutePage('/reviews')!.title,
    description: getPublicRoutePage('/reviews')!.description,
    canonical: `${SITE_URL}/reviews`,
    structuredData: [organization],
  },
  '/cakes': {
    title: getPublicRoutePage('/cakes')!.title,
    description: getPublicRoutePage('/cakes')!.description,
    canonical: `${SITE_URL}/cakes`,
    structuredData: [
      organization,
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/cakes#collection`,
        name: publicContent.catalogue.collectionName,
        description: publicContent.catalogue.description,
        url: `${SITE_URL}/cakes`,
        mainEntity: `${SITE_URL}/cakes#item-list`,
      },
      cakeItemList,
    ],
  },
}

function productFromPublicPage(pathname: string, page: PublicCakePage, noindex = false): SeoConfig {
  const image = page.imagePath ? `${SITE_URL}${page.imagePath}` : undefined
  const imageAttributes = image
    ? { image, imageType: page.imageType, imageWidth: page.imageWidth, imageHeight: page.imageHeight }
    : {}
  const breadcrumb = getBreadcrumbList(pathname, page.name)

  if (page.schema === 'webpage-only') {
    return {
      title: page.title,
      description: page.description,
      canonical: `${SITE_URL}${pathname}`,
      ...(noindex ? { noindex: true } : {}),
      ogType: 'website',
      ...imageAttributes,
      structuredData: [
        {
          '@type': 'WebPage',
          '@id': `${SITE_URL}${pathname}#webpage`,
          name: page.name,
          description: page.description,
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
    description: page.description,
    ...(image ? { image } : {}),
    brand: { '@type': 'Brand', name: publicContent.site.brand },
    category: 'Made-to-order cake',
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${pathname}`,
      priceCurrency: 'AUD',
      price: page.startingPrice,
      seller: { '@type': 'Organization', name: publicContent.site.brand, url: SITE_URL },
    },
  }

  return {
    title: page.title,
    description: page.description,
    canonical: `${SITE_URL}${pathname}`,
    ...(noindex ? { noindex: true } : {}),
    ogType: 'product',
    ...imageAttributes,
    structuredData: [product, breadcrumb],
  }
}

function getCakeDetailSeo(pathname: string): SeoConfig | null {
  const match = /^\/cakes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname)
  if (!match) return null
  const page = getPublicCakePage(match[1])
  return page ? productFromPublicPage(pathname, page, isLegacyCakePublicPage(match[1])) : null
}

const privateSeo: Record<string, SeoConfig> = {
  '/cart': {
    title: `Your Cart | ${brand}`,
    description: `Review your selected cakes before sending one cake request to ${brand} Sydney.`,
    noindex: true,
  },
  '/admin/reviews': {
    title: `Review Moderation Admin | ${brand}`,
    description: 'Private review moderation administration.',
    noindex: true,
  },
  '/reserve': {
    title: `Request a Chocolate Cake | ${brand}`,
    description: `Submit a cake booking request to ${brand} Sydney.`,
    noindex: true,
  },
  '/complete': {
    title: `Cake Request Received | ${brand}`,
    description: 'Your cake request has been received.',
    noindex: true,
  },
  '/lookup': {
    title: `Find Your Booking | ${brand}`,
    description: `Look up an existing ${brand} booking.`,
    noindex: true,
  },
  '/class-reserve': {
    title: `Request a Kids Cake Class | ${brand}`,
    description: 'Submit a private kids cake class booking request.',
    noindex: true,
  },
  '/class-complete': {
    title: `Class Request Received | ${brand}`,
    description: 'Your kids cake class request has been received.',
    noindex: true,
  },
  '/calendar': {
    title: `Private Schedule | ${brand}`,
    description: 'Private read-only booking schedule.',
    noindex: true,
  },
  '/review': {
    title: `Share Your Review | ${brand}`,
    description: `Share private feedback about your ${brand} experience.`,
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
      title: `Admin | ${brand}`,
      description: `${brand} administration.`,
      noindex: true,
    }
  }
  return {
    title: `Page Not Found | ${brand}`,
    description: 'The requested page could not be found.',
    noindex: true,
  }
}

export function applySeo(pathname: string) {
  const config = getSeoConfig(pathname)
  const canonical = config.canonical || `${SITE_URL}${pathname}`
  const defaultImage = publicContent.site.defaultSocialImage
  const image = config.image || SITE_URL + defaultImage.path
  const imageType = config.imageType || defaultImage.type
  const imageWidth = config.imageWidth || defaultImage.width
  const imageHeight = config.imageHeight || defaultImage.height

  document.title = config.title
  setMeta('meta[name="description"]', 'content', config.description)
  setMeta('meta[name="robots"]', 'content', config.noindex ? 'noindex, nofollow' : 'index, follow')
  setMeta('meta[property="og:type"]', 'content', config.ogType || 'website')
  setMeta('meta[property="og:title"]', 'content', config.title)
  setMeta('meta[property="og:description"]', 'content', config.description)
  setMeta('meta[property="og:url"]', 'content', canonical)
  setMeta('meta[property="og:image"]', 'content', image)
  setMeta('meta[property="og:image:type"]', 'content', imageType)
  setMeta('meta[property="og:image:width"]', 'content', String(imageWidth))
  setMeta('meta[property="og:image:height"]', 'content', String(imageHeight))
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
