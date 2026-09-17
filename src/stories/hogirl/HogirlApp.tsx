import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { trackPageView } from '../../lib/analytics.js'
import { HogirlReader } from './HogirlReader.js'
import { loadHogirlEpisode, loadHogirlSeason, loadHogirlSeries } from './loaders.js'
import { getHogirlMediaOriginFromEnvironment } from './media.js'
import { getHogirlRouteFromPath, pathForHogirlRoute, type HogirlRoute } from './routes.js'
import {
  applyPublishedHogirlEpisodeSeo,
  applyPublishedHogirlSeasonSeo,
  applyPublishedHogirlSeriesSeo,
  applyUnpublishedHogirlSeo,
} from './seo.js'
import type { HogirlSeasonManifest, HogirlSeriesManifest, LoadedHogirlEpisode } from './types.js'

type HogirlContentState = {
  pathname: string
  series: HogirlSeriesManifest | null
  season: HogirlSeasonManifest | null
  episode: LoadedHogirlEpisode | null
}

function emptyContent(pathname: string): HogirlContentState {
  return { pathname, series: null, season: null, episode: null }
}

const mediaOrigin = getHogirlMediaOriginFromEnvironment(import.meta.env)
const hogirlStylesheetHref = '/hogirl.css'

function useHogirlStylesheet() {
  useLayoutEffect(() => {
    const existing = document.head.querySelector<HTMLLinkElement>('link[data-vg-hogirl-styles]')
    if (existing) return

    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = hogirlStylesheetHref
    stylesheet.dataset.vgHogirlStyles = 'true'
    document.head.appendChild(stylesheet)
    return () => stylesheet.remove()
  }, [])
}

function isPublishedForRoute(route: HogirlRoute, series: HogirlSeriesManifest | null) {
  return series?.locales?.[route.locale]?.status === 'published'
}

function UnpublishedHogirlPage({ locale }: { locale: HogirlRoute['locale'] }) {
  const korean = locale === 'ko'
  return (
    <main className="hogirl-reader hogirl-unpublished" lang={korean ? 'ko' : 'en-AU'}>
      <p className="hogirl-kicker">HOGIRL</p>
      <h1>{korean ? '준비 중입니다' : 'Coming soon'}</h1>
      <p>{korean ? 'HOGIRL 웹 코믹은 현재 콘텐츠와 이미지를 검토 중입니다.' : 'The HOGIRL web comic is being prepared while its content and artwork are reviewed.'}</p>
      <a href="/">{korean ? 'verygood chocolate 홈으로' : 'Back to verygood chocolate'}</a>
    </main>
  )
}

function SeriesPage({ route, series }: { route: Extract<HogirlRoute, { kind: 'series' }>; series: HogirlSeriesManifest }) {
  const copy = series.locales?.[route.locale]
  if (!copy) return <UnpublishedHogirlPage locale={route.locale} />
  return (
    <main className="hogirl-reader" lang={route.locale === 'ko' ? 'ko' : 'en-AU'}>
      <p className="hogirl-kicker">HOGIRL</p>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <nav aria-label="HOGIRL seasons">
        <ol className="hogirl-episode-navigation">
          {series.publishedSeasons.map((season) => (
            <li key={season.slug}><a href={pathForHogirlRoute({ kind: 'season', locale: route.locale, seasonSlug: season.slug })}>Season {season.number}</a></li>
          ))}
        </ol>
      </nav>
    </main>
  )
}

function SeasonPage({ route, season }: { route: Extract<HogirlRoute, { kind: 'season' }>; season: HogirlSeasonManifest }) {
  return (
    <main className="hogirl-reader" lang={route.locale === 'ko' ? 'ko' : 'en-AU'}>
      <p><a href={pathForHogirlRoute({ kind: 'series', locale: route.locale })}>HOGIRL</a></p>
      <h1>Season {season.number}</h1>
      <nav aria-label="HOGIRL episodes">
        <ol className="hogirl-episode-navigation">
          {season.episodes.map((episode) => (
            <li key={episode.slug}>
              <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: route.seasonSlug, episodeSlug: episode.slug })}>Episode {episode.number}</a>
            </li>
          ))}
        </ol>
      </nav>
    </main>
  )
}

function EpisodeNavigation({ route, season }: { route: Extract<HogirlRoute, { kind: 'episode' }>; season: HogirlSeasonManifest | null }) {
  const currentIndex = season?.episodes.findIndex((episode) => episode.slug === route.episodeSlug) ?? -1
  const previous = currentIndex > 0 ? season?.episodes[currentIndex - 1] : null
  const next = currentIndex >= 0 ? season?.episodes[currentIndex + 1] : null
  if (!previous && !next) return null
  return (
    <nav className="hogirl-reader-navigation" aria-label="Episode navigation">
      {previous ? <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: route.seasonSlug, episodeSlug: previous.slug })}>Previous episode</a> : <span />}
      {next ? <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: route.seasonSlug, episodeSlug: next.slug })}>Next episode</a> : null}
    </nav>
  )
}

function EpisodePage({ route, episode, season }: { route: Extract<HogirlRoute, { kind: 'episode' }>; episode: LoadedHogirlEpisode; season: HogirlSeasonManifest | null }) {
  if (!mediaOrigin) return <UnpublishedHogirlPage locale={route.locale} />
  return (
    <>
      <HogirlReader
        locale={route.locale === 'ko' ? 'ko' : 'en-AU'}
        mediaOrigin={mediaOrigin}
        episode={{
          number: episode.manifest.number,
          title: episode.locale.title,
          panels: episode.manifest.media.panels.map((panel) => ({
            id: panel.id,
            media: panel.media,
            alt: episode.locale.panels[panel.id]?.alt || '',
            captions: episode.locale.panels[panel.id]?.captions || [],
          })),
        }}
      />
      <EpisodeNavigation route={route} season={season} />
    </>
  )
}

export default function HogirlApp({ pathname }: { pathname: string }) {
  useHogirlStylesheet()
  const route = useMemo(() => getHogirlRouteFromPath(pathname), [pathname])
  const [content, setContent] = useState<HogirlContentState>(() => emptyContent(pathname))

  useEffect(() => {
    if (!route) return
    let cancelled = false
    void (async () => {
      const series = await loadHogirlSeries()
      const season = route.kind === 'series' ? null : await loadHogirlSeason(route.seasonSlug)
      const episode = route.kind === 'episode' ? await loadHogirlEpisode(route) : null
      if (!cancelled) setContent({ pathname, series, season, episode })
    })()
    return () => { cancelled = true }
  }, [pathname, route])

  useEffect(() => {
    if (!route) return
    applyUnpublishedHogirlSeo(route)
    trackPageView(pathname)
  }, [pathname, route])

  useEffect(() => {
    if (!route || content.pathname !== pathname || !isPublishedForRoute(route, content.series)) return
    if (route.kind === 'series') {
      applyPublishedHogirlSeriesSeo({ route, series: content.series! })
      return
    }
    if (route.kind === 'season' && content.season) {
      applyPublishedHogirlSeasonSeo({ route, series: content.series!, season: content.season })
      return
    }
    if (route.kind === 'episode' && content.episode && mediaOrigin) {
      applyPublishedHogirlEpisodeSeo({
        route,
        series: content.episode.series,
        episode: content.episode.manifest,
        copy: content.episode.locale,
        mediaOrigin,
      })
    }
  }, [content, pathname, route])

  if (!route) return null
  if (content.pathname !== pathname) return <div className="hogirl-reader" role="status" aria-live="polite">Loading story…</div>
  if (!isPublishedForRoute(route, content.series)) return <UnpublishedHogirlPage locale={route.locale} />
  if (route.kind === 'series') return <SeriesPage route={route} series={content.series!} />
  if (route.kind === 'season' && content.season) return <SeasonPage route={route} season={content.season} />
  if (route.kind === 'episode' && content.episode) return <EpisodePage route={route} episode={content.episode} season={content.season} />
  return <UnpublishedHogirlPage locale={route.locale} />
}
