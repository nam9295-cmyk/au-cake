import auPublicPages from '../content/au-public-pages.json' with { type: 'json' }

export const AU_SITE_ORIGIN = auPublicPages.site.url
export const SITE_URL = AU_SITE_ORIGIN

export type AuPublicContent = typeof auPublicPages
export type PublicCakeSlug = keyof AuPublicContent['cakePages']
export type PublicCakePage = AuPublicContent['cakePages'][PublicCakeSlug]

export const AU_PUBLIC_CONTENT = auPublicPages
export const KNOWN_DIRECT_ACCESS_ROUTES = auPublicPages.knownDirectAccessRoutes
export const NOINDEX_OPERATIONAL_ROUTES = auPublicPages.noindexOperationalRoutes

export function getAuPublicContent(): AuPublicContent {
  return AU_PUBLIC_CONTENT
}

export function getCakePublicPage(slug: string): PublicCakePage | undefined {
  if (!Object.hasOwn(AU_PUBLIC_CONTENT.cakePages, slug)) return undefined
  return AU_PUBLIC_CONTENT.cakePages[slug as PublicCakeSlug]
}

export function getStartingPrice(slug: string): number | null {
  return getCakePublicPage(slug)?.startingPrice ?? null
}

export const getPublicCakePage = getCakePublicPage
export const getPublicStartingPrice = getStartingPrice
