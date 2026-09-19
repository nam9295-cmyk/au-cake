import type { HogirlRoute } from './routes.js'
import type {
  HogirlEpisodeLocaleContent,
  HogirlEpisodeManifest,
  HogirlPrologueManifest,
  HogirlSeasonManifest,
  HogirlSeriesManifest,
  LoadedHogirlEpisode,
  LoadedHogirlPrologue,
} from './types.js'

type JsonLoader = () => Promise<unknown>

// These maps intentionally stay lazy: content JSON must never become part of the
// Vite entry bundle, and a reader requests only its own manifest and locale file.
const episodeManifestLoaders = import.meta.glob('../../content/hogirl/season-*/episodes/*/manifest.json', {
  import: 'default',
}) as Record<string, JsonLoader>
const episodeLocaleLoaders = import.meta.glob('../../content/hogirl/season-*/episodes/*/*.json', {
  import: 'default',
}) as Record<string, JsonLoader>
const prologueManifestLoaders = import.meta.glob('../../content/hogirl/prologue-*/manifest.json', {
  import: 'default',
}) as Record<string, JsonLoader>
const prologueLocaleLoaders = import.meta.glob('../../content/hogirl/prologue-*/*.json', {
  import: 'default',
}) as Record<string, JsonLoader>
const seriesLoaders = import.meta.glob('../../content/hogirl/series.json', {
  import: 'default',
}) as Record<string, JsonLoader>
const seasonManifestLoaders = import.meta.glob('../../content/hogirl/season-*/manifest.json', {
  import: 'default',
}) as Record<string, JsonLoader>

function seasonDirectoryForSlug(seasonSlug: string) {
  const seasonNumber = Number(seasonSlug.replace('season-', ''))
  return `season-${String(seasonNumber).padStart(2, '0')}`
}

function episodeContentPath(seasonSlug: string, episodeSlug: string, filename: string) {
  return `../../content/hogirl/${seasonDirectoryForSlug(seasonSlug)}/episodes/${episodeSlug}/${filename}`
}

function prologueContentPath(storySlug: string, filename: string) {
  return `../../content/hogirl/${storySlug}/${filename}`
}

function localeIsVisible(status: string | undefined, allowDrafts: boolean) {
  return status === 'published' || (allowDrafts && status === 'draft')
}

export async function loadHogirlEpisodeManifest(seasonSlug: string, episodeSlug: string) {
  const loader = episodeManifestLoaders[episodeContentPath(seasonSlug, episodeSlug, 'manifest.json')]
  return loader ? loader() as Promise<HogirlEpisodeManifest> : null
}

export async function loadHogirlPrologueManifest(storySlug: string) {
  const loader = prologueManifestLoaders[prologueContentPath(storySlug, 'manifest.json')]
  return loader ? loader() as Promise<HogirlPrologueManifest> : null
}

export async function loadHogirlSeries() {
  const loader = seriesLoaders['../../content/hogirl/series.json']
  return loader ? loader() as Promise<HogirlSeriesManifest> : null
}

export async function loadHogirlSeason(seasonSlug: string) {
  const loader = seasonManifestLoaders[`../../content/hogirl/${seasonDirectoryForSlug(seasonSlug)}/manifest.json`]
  return loader ? loader() as Promise<HogirlSeasonManifest> : null
}

export async function loadHogirlEpisode(route: Extract<HogirlRoute, { kind: 'episode' }>, allowDrafts = false): Promise<LoadedHogirlEpisode | null> {
  const [series, manifest] = await Promise.all([
    loadHogirlSeries(),
    loadHogirlEpisodeManifest(route.seasonSlug, route.episodeSlug),
  ])
  if (!series || !manifest || !localeIsVisible(series.locales?.[route.locale]?.status, allowDrafts) || !localeIsVisible(manifest.locales[route.locale]?.status, allowDrafts)) return null

  const loader = episodeLocaleLoaders[episodeContentPath(route.seasonSlug, route.episodeSlug, `${route.locale}.json`)]
  if (!loader) return null
  const locale = await loader() as HogirlEpisodeLocaleContent
  return { series, manifest, locale }
}

export async function loadHogirlPrologue(route: Extract<HogirlRoute, { kind: 'prologue' }>, allowDrafts = false): Promise<LoadedHogirlPrologue | null> {
  const [series, manifest] = await Promise.all([
    loadHogirlSeries(),
    loadHogirlPrologueManifest(route.storySlug),
  ])
  if (!series || !manifest || !localeIsVisible(series.locales?.[route.locale]?.status, allowDrafts) || !localeIsVisible(manifest.locales[route.locale]?.status, allowDrafts)) return null

  const loader = prologueLocaleLoaders[prologueContentPath(route.storySlug, `${route.locale}.json`)]
  if (!loader) return null
  const locale = await loader() as HogirlEpisodeLocaleContent
  return { series, manifest, locale }
}
