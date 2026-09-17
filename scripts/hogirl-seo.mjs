import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getHogirlMediaOriginFromEnvironment,
  getHogirlMediaUrl,
  getHogirlResponsiveWidths,
  HOGIRL_MEDIA_ORIGIN_ENV,
  resolveHogirlMediaOrigin,
} from '../src/stories/hogirl/media-contract.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const productionContentRoot = resolve(scriptDirectory, '../src/content/hogirl')
const fixtureContentRoot = resolve(scriptDirectory, '../tests/fixtures/hogirl/content')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function languageTag(locale) {
  return locale === 'en' ? 'en-AU' : locale
}

function pathFor(locale, suffix = '') {
  return `${locale === 'en' ? '' : `/${locale}`}/stories/hogirl${suffix}`
}

function canonicalFor(siteUrl, path) {
  return `${siteUrl}${path}`
}

function mediaUrl(mediaOrigin, media) {
  const width = getHogirlResponsiveWidths(media.sourceWidth).at(-1)
  return getHogirlMediaUrl({ mediaOrigin, key: media.key, width, format: 'webp' })
}

function fallbackImage({ mediaOrigin, media, alt, eager }) {
  return `<img src="${escapeHtml(mediaUrl(mediaOrigin, media))}" alt="${escapeHtml(alt)}" width="${media.sourceWidth}" height="${media.sourceHeight}" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async" />`
}

function breadcrumb(siteUrl, path, items) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalFor(siteUrl, path)}#breadcrumb`,
    itemListElement: items.map(({ name, path: itemPath }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: canonicalFor(siteUrl, itemPath),
    })),
  }
}

function alternates(siteUrl, locales, suffix) {
  const links = locales.map((locale) => ({
    href: canonicalFor(siteUrl, pathFor(locale, suffix)),
    hreflang: languageTag(locale),
  }))
  if (locales.includes('en')) {
    links.push({ href: canonicalFor(siteUrl, pathFor('en', suffix)), hreflang: 'x-default' })
  }
  return links
}

function publishedLocales(locales = {}) {
  return Object.entries(locales)
    .filter(([, value]) => value?.status === 'published')
    .map(([locale]) => locale)
}

async function readJson(contentRoot, relativePath) {
  return JSON.parse(await readFile(resolve(contentRoot, relativePath), 'utf8'))
}

function readerFallback({ locale, episode, copy, mediaOrigin, season, previousEpisode, nextEpisode }) {
  return `
      <main class="hogirl-static-reader" lang="${languageTag(locale)}">
        <p><a href="${pathFor(locale)}">HOGIRL</a></p>
        <p>Season 1 · Episode ${episode.number}</p>
        <h1>${escapeHtml(copy.title)}</h1>
        <p>${escapeHtml(copy.description)}</p>
        <ol>
          ${episode.media.panels.map((panel, index) => {
            const panelCopy = copy.panels[panel.id]
            if (!panelCopy) throw new Error(`HOGIRL episode ${episode.slug} locale ${locale} lacks panel ${panel.id} copy`)
            return `<li>
              <figure>
                ${fallbackImage({ mediaOrigin, media: panel.media, alt: panelCopy.alt, eager: index === 0 })}
                ${panelCopy.captions.map((caption) => `<figcaption>${escapeHtml(caption.text)}</figcaption>`).join('')}
              </figure>
            </li>`
          }).join('')}
        </ol>
        <nav aria-label="Episode navigation">
          <a href="${pathFor(locale, `/${season.slug}`)}">Season ${season.number}</a>
          ${previousEpisode ? `<a href="${pathFor(locale, `/${season.slug}/${previousEpisode.slug}`)}">Previous episode</a>` : ''}
          ${nextEpisode ? `<a href="${pathFor(locale, `/${season.slug}/${nextEpisode.slug}`)}">Next episode</a>` : ''}
        </nav>
      </main>`
}

async function pagesForContent({ contentRoot, siteUrl, brand, mediaOrigin, includeLlms }) {
  const series = await readJson(contentRoot, 'series.json')
  const seriesLocales = publishedLocales(series.locales)
  if (seriesLocales.length === 0 || !Array.isArray(series.publishedSeasons) || series.publishedSeasons.length === 0) {
    return { pages: {}, indexablePaths: [], llmsEntries: [] }
  }
  if (!mediaOrigin) throw new Error(`Published HOGIRL content requires ${HOGIRL_MEDIA_ORIGIN_ENV}`)

  const pages = {}
  const llmsLocale = seriesLocales.includes('en') ? 'en' : seriesLocales[0]
  const llmsEntries = includeLlms
    ? [`${series.locales[llmsLocale].title}: ${series.locales[llmsLocale].description}`]
    : []
  for (const locale of seriesLocales) {
    const rootPath = pathFor(locale)
    const seriesCopy = series.locales[locale]
    pages[rootPath] = {
      title: `${seriesCopy.title} | ${brand}`,
      description: seriesCopy.description,
      robots: 'index, follow',
      canonical: canonicalFor(siteUrl, rootPath),
      htmlLang: languageTag(locale),
      output: 'directory',
      alternateLinks: alternates(siteUrl, seriesLocales, ''),
      structuredData: [
        {
          '@type': 'WebPage',
          '@id': `${canonicalFor(siteUrl, rootPath)}#webpage`,
          name: seriesCopy.title,
          description: seriesCopy.description,
          url: canonicalFor(siteUrl, rootPath),
          inLanguage: languageTag(locale),
        },
        {
          '@type': 'CreativeWorkSeries',
          '@id': `${canonicalFor(siteUrl, rootPath)}#series`,
          name: seriesCopy.title,
          description: seriesCopy.description,
          url: canonicalFor(siteUrl, rootPath),
          inLanguage: languageTag(locale),
        },
      ],
      fallbackHtml: `
        <main class="hogirl-static-reader" lang="${languageTag(locale)}">
          <h1>${escapeHtml(seriesCopy.title)}</h1>
          <p>${escapeHtml(seriesCopy.description)}</p>
          <ol>
            ${series.publishedSeasons.map((season) => `<li><a href="${pathFor(locale, `/${season.slug}`)}">Season ${season.number}</a></li>`).join('')}
          </ol>
        </main>`,
    }
  }

  for (const seasonReference of series.publishedSeasons) {
    const season = await readJson(contentRoot, `${seasonReference.directory}/manifest.json`)
    if (season.slug !== seasonReference.slug || season.number !== seasonReference.number) {
      throw new Error(`HOGIRL season manifest does not match series entry ${seasonReference.directory}`)
    }
    if (includeLlms) llmsEntries.push(`- Season ${season.number}`)
    const episodeManifests = await Promise.all(season.episodes.map(async ({ number, slug }) => ({
      manifest: await readJson(contentRoot, `${seasonReference.directory}/episodes/${slug}/manifest.json`),
      directory: seasonReference.directory,
      expectedNumber: number,
    })))

    for (const locale of seriesLocales) {
      const seriesCopy = series.locales[locale]
      const seasonPath = pathFor(locale, `/${season.slug}`)
      const episodeLinks = episodeManifests
        .filter(({ manifest }) => manifest.locales?.[locale]?.status === 'published')
        .map(({ manifest }) => `<li><a href="${pathFor(locale, `/${season.slug}/${manifest.slug}`)}">Episode ${manifest.number}</a></li>`)
        .join('')
      pages[seasonPath] = {
        title: `${seriesCopy.title} Season ${season.number} | ${brand}`,
        description: seriesCopy.description,
        robots: 'index, follow',
        canonical: canonicalFor(siteUrl, seasonPath),
        htmlLang: languageTag(locale),
        output: 'directory',
        alternateLinks: alternates(siteUrl, seriesLocales, `/${season.slug}`),
        structuredData: [
          {
            '@type': 'WebPage',
            '@id': `${canonicalFor(siteUrl, seasonPath)}#webpage`,
            name: `${seriesCopy.title} Season ${season.number}`,
            description: seriesCopy.description,
            url: canonicalFor(siteUrl, seasonPath),
            inLanguage: languageTag(locale),
          },
          breadcrumb(siteUrl, seasonPath, [
            { name: 'Home', path: '/' },
            { name: seriesCopy.title, path: pathFor(locale) },
            { name: `Season ${season.number}`, path: seasonPath },
          ]),
        ],
        fallbackHtml: `
          <main class="hogirl-static-reader" lang="${languageTag(locale)}">
            <p><a href="${pathFor(locale)}">${escapeHtml(seriesCopy.title)}</a></p>
            <h1>Season ${season.number}</h1>
            <ol>${episodeLinks}</ol>
          </main>`,
      }
    }

    for (const { manifest: episode, directory } of episodeManifests) {
      if (episode.slug === undefined || episode.number === undefined) {
        throw new Error(`HOGIRL episode manifest in ${directory} is missing its slug or number`)
      }
      const episodeLocales = publishedLocales(episode.locales).filter((locale) => seriesLocales.includes(locale))
      const socialPanel = episode.media?.panels?.find((panel) => panel.id === episode.media.ogImagePanelId)
      if (!socialPanel) throw new Error(`HOGIRL episode ${episode.slug} lacks its designated OG panel`)
      for (const locale of episodeLocales) {
        const path = pathFor(locale, `/${season.slug}/${episode.slug}`)
        const copy = await readJson(contentRoot, `${directory}/episodes/${episode.slug}/${locale}.json`)
        const localeEpisodes = episodeManifests
          .map(({ manifest }) => manifest)
          .filter((candidate) => candidate.locales?.[locale]?.status === 'published')
        const episodeIndex = localeEpisodes.findIndex((candidate) => candidate.slug === episode.slug)
        const previousEpisode = episodeIndex > 0 ? localeEpisodes[episodeIndex - 1] : null
        const nextEpisode = episodeIndex >= 0 ? localeEpisodes[episodeIndex + 1] : null
        const imageAsset = episode.media.socialImage || socialPanel.media
        const image = mediaUrl(mediaOrigin, imageAsset)
        if (includeLlms && locale === llmsLocale) {
          llmsEntries.push(`- ${copy.title}: ${canonicalFor(siteUrl, path)}`)
        }
        pages[path] = {
          title: `${copy.title} | HOGIRL | ${brand}`,
          description: copy.description,
          robots: 'index, follow',
          ogType: 'website',
          canonical: canonicalFor(siteUrl, path),
          image,
          imageType: 'image/webp',
          imageWidth: imageAsset.sourceWidth,
          imageHeight: imageAsset.sourceHeight,
          htmlLang: languageTag(locale),
          output: 'directory',
          alternateLinks: alternates(siteUrl, episodeLocales, `/${season.slug}/${episode.slug}`),
          structuredData: [
            {
              '@type': 'WebPage',
              '@id': `${canonicalFor(siteUrl, path)}#webpage`,
              name: copy.title,
              description: copy.description,
              url: canonicalFor(siteUrl, path),
              inLanguage: languageTag(locale),
              mainEntity: { '@id': `${canonicalFor(siteUrl, path)}#creative-work` },
            },
            {
              '@type': 'CreativeWork',
              '@id': `${canonicalFor(siteUrl, path)}#creative-work`,
              name: copy.title,
              abstract: copy.description,
              image,
              position: episode.number,
              isPartOf: { '@id': `${canonicalFor(siteUrl, pathFor(locale))}#series` },
              inLanguage: languageTag(locale),
            },
            breadcrumb(siteUrl, path, [
              { name: 'Home', path: '/' },
              { name: series.locales[locale].title, path: pathFor(locale) },
              { name: `Season ${season.number}`, path: pathFor(locale, `/${season.slug}`) },
              { name: copy.title, path },
            ]),
          ],
          fallbackHtml: readerFallback({
            locale,
            episode,
            copy,
            mediaOrigin,
            season,
            previousEpisode,
            nextEpisode,
          }),
        }
      }
    }
  }

  return {
    pages,
    indexablePaths: Object.keys(pages),
    llmsEntries,
  }
}

export async function getHogirlSeoDefinitions({
  siteUrl,
  brand,
  mediaOrigin,
  useTestFixture = process.env.HOGIRL_TEST_FIXTURE === '1',
  contentRoot,
} = {}) {
  if (!siteUrl || !brand) throw new Error('HOGIRL SEO generation requires siteUrl and brand')
  if (useTestFixture && (process.env.NODE_ENV !== 'test' || process.env.HOGIRL_TEST_FIXTURE_ACK !== 'test-only')) {
    throw new Error('HOGIRL_TEST_FIXTURE requires NODE_ENV=test and HOGIRL_TEST_FIXTURE_ACK=test-only')
  }
  const resolvedContentRoot = contentRoot || (useTestFixture ? fixtureContentRoot : productionContentRoot)
  const series = await readJson(resolvedContentRoot, 'series.json')
  if (useTestFixture && series.fixture !== true) {
    throw new Error('HOGIRL SEO fixture must be explicitly marked as test-only')
  }
  if (!useTestFixture && series.fixture === true) {
    throw new Error('HOGIRL production content cannot be marked as a test fixture')
  }
  const resolvedMediaOrigin = mediaOrigin === undefined
    ? getHogirlMediaOriginFromEnvironment(process.env)
    : resolveHogirlMediaOrigin(mediaOrigin)
  return pagesForContent({
    contentRoot: resolvedContentRoot,
    siteUrl,
    brand,
    mediaOrigin: resolvedMediaOrigin,
    includeLlms: !useTestFixture,
  })
}
