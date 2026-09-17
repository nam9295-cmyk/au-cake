import { getAuPublicContent, SITE_URL } from '../../lib/public-content.js'
import { getHogirlMediaUrl, getHogirlResponsiveWidths, resolveHogirlSocialImage } from './media.js'
import { pathForHogirlRoute, type HogirlRoute } from './routes.js'
import type {
  HogirlEpisodeLocaleContent,
  HogirlEpisodeManifest,
  HogirlPrologueManifest,
  HogirlSeasonManifest,
  HogirlSeriesManifest,
} from './types.js'

const brand = getAuPublicContent().site.brand

type HogirlSeoConfig = {
  title: string
  description: string
  canonical: string
  noindex?: boolean
  omitImage?: boolean
  image?: string
  imageType?: string
  imageWidth?: number
  imageHeight?: number
  alternateLinks?: Array<{ hreflang: string; href: string }>
  structuredData?: Array<Record<string, unknown>>
}

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
}

function removeMeta(selector: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.remove()
}

function applyHogirlSeoConfig(config: HogirlSeoConfig) {
  const image = config.omitImage ? null : config.image
  document.title = config.title
  setMeta('meta[name="description"]', config.description)
  setMeta('meta[name="robots"]', config.noindex ? 'noindex, nofollow' : 'index, follow')
  setMeta('meta[property="og:type"]', 'website')
  setMeta('meta[property="og:title"]', config.title)
  setMeta('meta[property="og:description"]', config.description)
  setMeta('meta[property="og:url"]', config.canonical)
  setMeta('meta[name="twitter:title"]', config.title)
  setMeta('meta[name="twitter:description"]', config.description)
  if (image) {
    setMeta('meta[property="og:image"]', image)
    setMeta('meta[property="og:image:type"]', config.imageType || 'image/webp')
    setMeta('meta[property="og:image:width"]', String(config.imageWidth || ''))
    setMeta('meta[property="og:image:height"]', String(config.imageHeight || ''))
    setMeta('meta[name="twitter:image"]', image)
  } else {
    removeMeta('meta[property="og:image"]')
    removeMeta('meta[property="og:image:type"]')
    removeMeta('meta[property="og:image:width"]')
    removeMeta('meta[property="og:image:height"]')
    removeMeta('meta[name="twitter:image"]')
  }

  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical) canonical.href = config.canonical
  document.head.querySelectorAll('link[data-vg-hreflang]').forEach((element) => element.remove())
  config.alternateLinks?.forEach(({ hreflang, href }) => {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = hreflang
    link.href = href
    link.dataset.vgHreflang = 'true'
    document.head.appendChild(link)
  })
  document.head.querySelectorAll('script[data-vg-structured-data]').forEach((element) => element.remove())
  config.structuredData?.forEach((data) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.vgStructuredData = 'true'
    script.text = JSON.stringify({ '@context': 'https://schema.org', ...data })
    document.head.appendChild(script)
  })
}

function languageTag(locale: string) {
  return locale === 'en' ? 'en-AU' : locale
}

function publishedEpisodeLocales(series: HogirlSeriesManifest, episode: HogirlEpisodeManifest | HogirlPrologueManifest) {
  return Object.entries(series.locales || {})
    .filter(([locale, seriesLocale]) => seriesLocale.status === 'published' && episode.locales[locale]?.status === 'published')
    .map(([locale]) => locale)
}

function storyAlternateLinks(route: Extract<HogirlRoute, { kind: 'episode' | 'prologue' }>, locales: string[]) {
  const suffix = route.kind === 'episode'
    ? `/${route.seasonSlug}/${route.episodeSlug}`
    : `/${route.storySlug}`
  const links = [
    ...locales.map((locale) => ({
      hreflang: languageTag(locale),
      href: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/stories/hogirl${suffix}`,
    })),
  ]
  if (locales.includes('en')) links.push({ hreflang: 'x-default', href: `${SITE_URL}/stories/hogirl${suffix}` })
  return links
}

function seriesAlternateLinks(route: Extract<HogirlRoute, { kind: 'series' | 'season' }>, locales: string[]) {
  const suffix = route.kind === 'series' ? '' : `/${route.seasonSlug}`
  const links = [
    ...locales.map((locale) => ({
      hreflang: languageTag(locale),
      href: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/stories/hogirl${suffix}`,
    })),
  ]
  if (locales.includes('en')) links.push({ hreflang: 'x-default', href: `${SITE_URL}/stories/hogirl${suffix}` })
  return links
}

function publishedSeriesLocales(series: HogirlSeriesManifest) {
  return Object.entries(series.locales || {})
    .filter(([, copy]) => copy.status === 'published')
    .map(([locale]) => locale)
}

export function applyUnpublishedHogirlSeo(route: HogirlRoute) {
  const path = pathForHogirlRoute(route)
  const korean = route.locale === 'ko'
  document.documentElement.lang = korean ? 'ko' : 'en-AU'
  applyHogirlSeoConfig({
    title: `HOGIRL | ${brand}`,
    description: korean ? 'HOGIRL 웹 코믹을 준비하고 있습니다.' : 'The HOGIRL web comic is being prepared.',
    canonical: `${SITE_URL}${path}`,
    noindex: true,
    omitImage: true,
  })
}

export function applyPublishedHogirlEpisodeSeo({
  route,
  series,
  episode,
  copy,
  mediaOrigin,
}: {
  route: Extract<HogirlRoute, { kind: 'episode' }>
  series: HogirlSeriesManifest
  episode: HogirlEpisodeManifest
  copy: HogirlEpisodeLocaleContent
  mediaOrigin: string
}) {
  const path = pathForHogirlRoute(route)
  const socialImageKey = resolveHogirlSocialImage(episode.media)
  const socialImage = episode.media.socialImage || episode.media.panels.find((panel) => panel.media.key === socialImageKey)?.media
  const socialWidth = socialImage ? getHogirlResponsiveWidths(socialImage.sourceWidth).at(-1) : undefined
  const image = socialImage
    ? getHogirlMediaUrl({ mediaOrigin, key: socialImage.key, width: socialWidth, format: 'webp' })
    : undefined
  const language = languageTag(route.locale)
  const seriesCopy = series.locales?.[route.locale]

  document.documentElement.lang = language
  applyHogirlSeoConfig({
    title: `${copy.title} | HOGIRL | ${brand}`,
    description: copy.description,
    canonical: `${SITE_URL}${path}`,
    ...(image ? {
      image,
      imageType: 'image/webp',
      imageWidth: socialImage!.sourceWidth,
      imageHeight: socialImage!.sourceHeight,
    } : { omitImage: true }),
    alternateLinks: storyAlternateLinks(route, publishedEpisodeLocales(series, episode)),
    structuredData: [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${path}#webpage`,
        name: copy.title,
        description: copy.description,
        url: `${SITE_URL}${path}`,
        inLanguage: language,
        mainEntity: { '@id': `${SITE_URL}${path}#creative-work` },
      },
      {
        '@type': 'CreativeWork',
        '@id': `${SITE_URL}${path}#creative-work`,
        name: copy.title,
        abstract: copy.description,
        ...(image ? { image } : {}),
        position: episode.number,
        isPartOf: { '@id': `${SITE_URL}${pathForHogirlRoute({ kind: 'series', locale: route.locale })}#series` },
        inLanguage: language,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: seriesCopy?.title || 'HOGIRL', item: `${SITE_URL}${pathForHogirlRoute({ kind: 'series', locale: route.locale })}` },
          { '@type': 'ListItem', position: 3, name: `Season ${route.seasonSlug.replace('season-', '')}`, item: `${SITE_URL}${pathForHogirlRoute({ kind: 'season', locale: route.locale, seasonSlug: route.seasonSlug })}` },
          { '@type': 'ListItem', position: 4, name: copy.title, item: `${SITE_URL}${path}` },
        ],
      },
    ],
  })
}

export function applyPublishedHogirlPrologueSeo({
  route,
  series,
  prologue,
  copy,
  mediaOrigin,
}: {
  route: Extract<HogirlRoute, { kind: 'prologue' }>
  series: HogirlSeriesManifest
  prologue: HogirlPrologueManifest
  copy: HogirlEpisodeLocaleContent
  mediaOrigin: string
}) {
  const path = pathForHogirlRoute(route)
  const socialImageKey = resolveHogirlSocialImage(prologue.media)
  const socialImage = prologue.media.socialImage || prologue.media.panels.find((panel) => panel.media.key === socialImageKey)?.media
  const socialWidth = socialImage ? getHogirlResponsiveWidths(socialImage.sourceWidth).at(-1) : undefined
  const image = socialImage
    ? getHogirlMediaUrl({ mediaOrigin, key: socialImage.key, width: socialWidth, format: 'webp' })
    : undefined
  const language = languageTag(route.locale)
  const seriesCopy = series.locales?.[route.locale]

  document.documentElement.lang = language
  applyHogirlSeoConfig({
    title: `${copy.title} | HOGIRL | ${brand}`,
    description: copy.description,
    canonical: `${SITE_URL}${path}`,
    ...(image ? {
      image,
      imageType: 'image/webp',
      imageWidth: socialImage!.sourceWidth,
      imageHeight: socialImage!.sourceHeight,
    } : { omitImage: true }),
    alternateLinks: storyAlternateLinks(route, publishedEpisodeLocales(series, prologue)),
    structuredData: [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${path}#webpage`,
        name: copy.title,
        description: copy.description,
        url: `${SITE_URL}${path}`,
        inLanguage: language,
        mainEntity: { '@id': `${SITE_URL}${path}#creative-work` },
      },
      {
        '@type': 'CreativeWork',
        '@id': `${SITE_URL}${path}#creative-work`,
        name: copy.title,
        abstract: copy.description,
        ...(image ? { image } : {}),
        isPartOf: { '@id': `${SITE_URL}${pathForHogirlRoute({ kind: 'series', locale: route.locale })}#series` },
        inLanguage: language,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: seriesCopy?.title || 'HOGIRL', item: `${SITE_URL}${pathForHogirlRoute({ kind: 'series', locale: route.locale })}` },
          { '@type': 'ListItem', position: 3, name: copy.title, item: `${SITE_URL}${path}` },
        ],
      },
    ],
  })
}

export function applyPublishedHogirlSeriesSeo({
  route,
  series,
}: {
  route: Extract<HogirlRoute, { kind: 'series' }>
  series: HogirlSeriesManifest
}) {
  const path = pathForHogirlRoute(route)
  const copy = series.locales?.[route.locale]
  if (!copy) return
  const language = languageTag(route.locale)
  document.documentElement.lang = language
  applyHogirlSeoConfig({
    title: `${copy.title} | ${brand}`,
    description: copy.description,
    canonical: `${SITE_URL}${path}`,
    alternateLinks: seriesAlternateLinks(route, publishedSeriesLocales(series)),
    structuredData: [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${path}#webpage`,
        name: copy.title,
        description: copy.description,
        url: `${SITE_URL}${path}`,
        inLanguage: language,
      },
      {
        '@type': 'CreativeWorkSeries',
        '@id': `${SITE_URL}${path}#series`,
        name: copy.title,
        description: copy.description,
        url: `${SITE_URL}${path}`,
        inLanguage: language,
      },
    ],
  })
}

export function applyPublishedHogirlSeasonSeo({
  route,
  series,
  season,
}: {
  route: Extract<HogirlRoute, { kind: 'season' }>
  series: HogirlSeriesManifest
  season: HogirlSeasonManifest
}) {
  const path = pathForHogirlRoute(route)
  const copy = series.locales?.[route.locale]
  if (!copy) return
  const language = languageTag(route.locale)
  document.documentElement.lang = language
  applyHogirlSeoConfig({
    title: `${copy.title} Season ${season.number} | ${brand}`,
    description: copy.description,
    canonical: `${SITE_URL}${path}`,
    alternateLinks: seriesAlternateLinks(route, publishedSeriesLocales(series)),
    structuredData: [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${path}#webpage`,
        name: `${copy.title} Season ${season.number}`,
        description: copy.description,
        url: `${SITE_URL}${path}`,
        inLanguage: language,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: copy.title, item: `${SITE_URL}${pathForHogirlRoute({ kind: 'series', locale: route.locale })}` },
          { '@type': 'ListItem', position: 3, name: `Season ${season.number}`, item: `${SITE_URL}${path}` },
        ],
      },
    ],
  })
}
