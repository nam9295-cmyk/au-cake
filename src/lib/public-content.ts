import auPublicPages from '../content/au-public-pages.json' with { type: 'json' }

export const AU_SITE_ORIGIN = auPublicPages.site.url
export const SITE_URL = AU_SITE_ORIGIN

export type AuPublicContent = typeof auPublicPages
export type PublicCakeSlug = keyof AuPublicContent['cakePages']
export type PublicCakePage = AuPublicContent['cakePages'][PublicCakeSlug] | AuPublicContent['legacyCakePages'][keyof AuPublicContent['legacyCakePages']]
export type IndexablePublicPath = '/' | '/cakes' | '/classes' | '/reviews'

export type PublicRoutePage = {
  title: string
  h1: string
  description: string
  intro?: string
}

export const AU_PUBLIC_CONTENT = auPublicPages
export const KNOWN_DIRECT_ACCESS_ROUTES = auPublicPages.knownDirectAccessRoutes
export const NOINDEX_OPERATIONAL_ROUTES = auPublicPages.noindexOperationalRoutes

const PUBLIC_ROUTE_PAGES: Record<IndexablePublicPath, PublicRoutePage> = {
  '/': AU_PUBLIC_CONTENT.home,
  '/cakes': AU_PUBLIC_CONTENT.catalogue,
  '/classes': AU_PUBLIC_CONTENT.classes,
  '/reviews': AU_PUBLIC_CONTENT.reviews,
}

export function getAuPublicContent(): AuPublicContent {
  return AU_PUBLIC_CONTENT
}

export function getCakePublicPage(slug: string): PublicCakePage | undefined {
  if (Object.hasOwn(AU_PUBLIC_CONTENT.cakePages, slug)) return AU_PUBLIC_CONTENT.cakePages[slug as PublicCakeSlug]
  if (Object.hasOwn(AU_PUBLIC_CONTENT.legacyCakePages, slug)) {
    return AU_PUBLIC_CONTENT.legacyCakePages[slug as keyof AuPublicContent['legacyCakePages']]
  }
  return undefined
}

export function isLegacyCakePublicPage(slug: string): boolean {
  return Object.hasOwn(AU_PUBLIC_CONTENT.legacyCakePages, slug)
}

export function getPublicRoutePage(path: string): PublicRoutePage | undefined {
  return Object.hasOwn(PUBLIC_ROUTE_PAGES, path)
    ? PUBLIC_ROUTE_PAGES[path as IndexablePublicPath]
    : undefined
}

export function getStartingPrice(slug: string): number | null {
  return getCakePublicPage(slug)?.startingPrice ?? null
}

export const getPublicCakePage = getCakePublicPage
export const getPublicStartingPrice = getStartingPrice
