export type HogirlLocale = 'en' | 'ko'

export type HogirlRoute =
  | { kind: 'series'; locale: HogirlLocale }
  | { kind: 'season'; locale: HogirlLocale; seasonSlug: string }
  | { kind: 'episode'; locale: HogirlLocale; seasonSlug: string; episodeSlug: string }

const HOGIRL_PREFIX = 'stories/hogirl'
const LOCALE_PREFIXES: ReadonlySet<string> = new Set(['ko'])
const SEASON_SLUG = /^season-[1-9][0-9]*$/
const EPISODE_SLUG = /^ep[0-9]{2}-(?:[a-z0-9]+(?:-[a-z0-9]+)*)$/

export function getHogirlRouteFromPath(path: string): HogirlRoute | null {
  const normalizedPath = path.replace(/\/+$/, '') || '/'
  const parts = normalizedPath.split('/').filter(Boolean)
  let locale: HogirlLocale = 'en'
  let offset = 0

  if (LOCALE_PREFIXES.has(parts[0] || '')) {
    locale = 'ko'
    offset = 1
  }

  if (parts.slice(offset, offset + 2).join('/') !== HOGIRL_PREFIX) return null
  const remainder = parts.slice(offset + 2)
  if (remainder.length === 0) return { kind: 'series', locale }
  if (!SEASON_SLUG.test(remainder[0] || '')) return null
  if (remainder.length === 1) return { kind: 'season', locale, seasonSlug: remainder[0]! }
  if (remainder.length !== 2 || !EPISODE_SLUG.test(remainder[1] || '')) return null

  return {
    kind: 'episode',
    locale,
    seasonSlug: remainder[0]!,
    episodeSlug: remainder[1]!,
  }
}

export function isHogirlPath(path: string): boolean {
  return getHogirlRouteFromPath(path) !== null
}

export function pathForHogirlRoute(route: HogirlRoute): string {
  const localePrefix = route.locale === 'ko' ? '/ko' : ''
  const seasonPath = route.kind === 'series' ? '' : `/${route.seasonSlug}`
  const episodePath = route.kind === 'episode' ? `/${route.episodeSlug}` : ''
  return `${localePrefix}/stories/hogirl${seasonPath}${episodePath}`
}
