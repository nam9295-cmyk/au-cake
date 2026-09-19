import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { trackPageView } from '../../lib/analytics.js'
import { HogirlReader } from './HogirlReader.js'
import { loadHogirlEpisode, loadHogirlPrologue, loadHogirlSeason, loadHogirlSeries } from './loaders.js'
import { getHogirlMediaOriginFromEnvironment } from './media.js'
import { getHogirlRouteFromPath, pathForHogirlRoute, type HogirlRoute } from './routes.js'
import {
  applyPublishedHogirlEpisodeSeo,
  applyPublishedHogirlPrologueSeo,
  applyPublishedHogirlSeasonSeo,
  applyPublishedHogirlSeriesSeo,
  applyUnpublishedHogirlSeo,
} from './seo.js'
import type { HogirlSeasonManifest, HogirlSeriesManifest, LoadedHogirlEpisode, LoadedHogirlPrologue } from './types.js'

type HogirlContentState = {
  pathname: string
  series: HogirlSeriesManifest | null
  season: HogirlSeasonManifest | null
  episode: LoadedHogirlEpisode | null
  prologue: LoadedHogirlPrologue | null
}

function emptyContent(pathname: string): HogirlContentState {
  return { pathname, series: null, season: null, episode: null, prologue: null }
}

const mediaOrigin = getHogirlMediaOriginFromEnvironment(import.meta.env)
const allowDrafts = import.meta.env.DEV
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

function visiblePrologue(series: HogirlSeriesManifest, previewDrafts: boolean) {
  return series.publishedPrologue || (previewDrafts ? series.draftPrologue : undefined)
}

function visibleSeasons(series: HogirlSeriesManifest, previewDrafts: boolean) {
  if (!previewDrafts) return series.publishedSeasons
  const bySlug = new Map(series.publishedSeasons.map((season) => [season.slug, season]))
  for (const season of series.draftSeasons || []) bySlug.set(season.slug, season)
  return [...bySlug.values()]
}

function isPublishedForRoute(route: HogirlRoute, content: HogirlContentState) {
  if (content.series?.locales?.[route.locale]?.status !== 'published') return false
  if (route.kind === 'series') return true
  if (route.kind === 'prologue') return content.prologue !== null
  if (route.kind === 'season') return content.series.publishedSeasons.some((season) => season.slug === route.seasonSlug)
  return content.episode !== null
}

function isVisibleForRoute(route: HogirlRoute, content: HogirlContentState) {
  const locale = content.series?.locales?.[route.locale]
  if (!locale || (locale.status !== 'published' && !allowDrafts)) return false
  if (route.kind === 'series') return true
  if (route.kind === 'prologue') return content.prologue !== null
  if (route.kind === 'season') return content.series ? visibleSeasons(content.series, allowDrafts).some((season) => season.slug === route.seasonSlug) : false
  return content.episode !== null
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
  const prologue = visiblePrologue(series, allowDrafts)
  const seasons = visibleSeasons(series, allowDrafts)
  return (
    <main className="hogirl-reader" lang={route.locale === 'ko' ? 'ko' : 'en-AU'}>
      <p className="hogirl-kicker">HOGIRL</p>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <nav aria-label="HOGIRL seasons">
        <ol className="hogirl-episode-navigation">
          {prologue && (
            <li><a href={pathForHogirlRoute({ kind: 'prologue', locale: route.locale, storySlug: prologue.slug })}>Prologue — A TIGER DREAM</a></li>
          )}
          {seasons.map((season) => (
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

function EpisodeNavigation({ route, episode, season }: { route: Extract<HogirlRoute, { kind: 'episode' }>; episode: LoadedHogirlEpisode; season: HogirlSeasonManifest | null }) {
  const currentIndex = season?.episodes.findIndex((episode) => episode.slug === route.episodeSlug) ?? -1
  const previous = currentIndex > 0 ? season?.episodes[currentIndex - 1] : null
  const next = currentIndex >= 0 ? season?.episodes[currentIndex + 1] : null
  const previousStory = !previous && episode.manifest.previous?.kind === 'prologue' ? episode.manifest.previous : null
  if (!previous && !previousStory && !next) return null
  return (
    <nav className="hogirl-reader-navigation" aria-label="Episode navigation">
      {previous
        ? <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: route.seasonSlug, episodeSlug: previous.slug })}>Previous episode</a>
        : previousStory
          ? <a href={pathForHogirlRoute({ kind: 'prologue', locale: route.locale, storySlug: previousStory.storySlug })}>Prologue — A TIGER DREAM</a>
          : <span />}
      {next ? <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: route.seasonSlug, episodeSlug: next.slug })}>Next episode</a> : null}
    </nav>
  )
}

function PrologueNavigation({ route, prologue }: { route: Extract<HogirlRoute, { kind: 'prologue' }>; prologue: LoadedHogirlPrologue }) {
  const next = prologue.manifest.next
  if (!next || next.kind !== 'episode') return null
  const korean = route.locale === 'ko'
  return (
    <nav className="hogirl-reader-navigation" aria-label="Story navigation">
      <span />
      <a href={pathForHogirlRoute({ kind: 'episode', locale: route.locale, seasonSlug: next.seasonSlug, episodeSlug: next.episodeSlug })}>
        {korean ? '시즌 1 EP01 시작하기 — I KNOW WHAT I WANT' : 'Start Season 1 / EP01 — I KNOW WHAT I WANT'}
      </a>
    </nav>
  )
}

function ProloguePage({ route, prologue }: { route: Extract<HogirlRoute, { kind: 'prologue' }>; prologue: LoadedHogirlPrologue }) {
  if (!mediaOrigin) return <UnpublishedHogirlPage locale={route.locale} />
  return (
    <>
      <HogirlReader
        locale={route.locale === 'ko' ? 'ko' : 'en-AU'}
        mediaOrigin={mediaOrigin}
        episode={{
          eyebrow: 'Prologue',
          title: prologue.locale.title,
          panels: prologue.manifest.media.panels.map((panel) => ({
            id: panel.id,
            media: panel.media,
            alt: prologue.locale.panels[panel.id]?.alt || '',
            captions: prologue.locale.panels[panel.id]?.captions || [],
            captionLayout: prologue.locale.panels[panel.id]?.captionLayout,
          })),
        }}
      />
      <PrologueNavigation route={route} prologue={prologue} />
    </>
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
            captionLayout: episode.locale.panels[panel.id]?.captionLayout,
          })),
        }}
      />
      <EpisodeNavigation route={route} episode={episode} season={season} />
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
      const season = route.kind === 'season' || route.kind === 'episode' ? await loadHogirlSeason(route.seasonSlug) : null
      const episode = route.kind === 'episode' ? await loadHogirlEpisode(route, allowDrafts) : null
      const prologue = route.kind === 'prologue' ? await loadHogirlPrologue(route, allowDrafts) : null
      if (!cancelled) setContent({ pathname, series, season, episode, prologue })
    })()
    return () => { cancelled = true }
  }, [pathname, route])

  useEffect(() => {
    if (!route) return
    applyUnpublishedHogirlSeo(route)
    trackPageView(pathname)
  }, [pathname, route])

  useEffect(() => {
    if (!route || content.pathname !== pathname || !isPublishedForRoute(route, content)) return
    if (route.kind === 'series') {
      applyPublishedHogirlSeriesSeo({ route, series: content.series! })
      return
    }
    if (route.kind === 'season' && content.season) {
      applyPublishedHogirlSeasonSeo({ route, series: content.series!, season: content.season })
      return
    }
    if (route.kind === 'prologue' && content.prologue && mediaOrigin) {
      applyPublishedHogirlPrologueSeo({
        route,
        series: content.prologue.series,
        prologue: content.prologue.manifest,
        copy: content.prologue.locale,
        mediaOrigin,
      })
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
  if (!isVisibleForRoute(route, content)) return <UnpublishedHogirlPage locale={route.locale} />
  if (route.kind === 'series') return <SeriesPage route={route} series={content.series!} />
  if (route.kind === 'prologue' && content.prologue) return <ProloguePage route={route} prologue={content.prologue} />
  if (route.kind === 'season' && content.season) return <SeasonPage route={route} season={content.season} />
  if (route.kind === 'episode' && content.episode) return <EpisodePage route={route} episode={content.episode} season={content.season} />
  return <UnpublishedHogirlPage locale={route.locale} />
}
