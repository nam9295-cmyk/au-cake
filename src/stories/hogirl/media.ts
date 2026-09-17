import type { HogirlEpisodeMedia, HogirlLocalePublication } from './types.js'
export {
  getHogirlMediaOriginFromEnvironment,
  getHogirlMediaUrl,
  getHogirlResponsiveWidths,
  HOGIRL_MEDIA_ORIGIN_ENV,
  HOGIRL_RESPONSIVE_WIDTHS,
  resolveHogirlMediaOrigin,
} from './media-contract.mjs'

export function resolveHogirlSocialImage(episode: HogirlEpisodeMedia): string | null {
  if (episode.socialImage) return episode.socialImage.key
  return episode.panels.find((panel) => panel.id === episode.ogImagePanelId)?.media.key || null
}

export function getPublishedHogirlLocales(locales: Record<string, HogirlLocalePublication>): string[] {
  return Object.entries(locales)
    .filter(([, locale]) => locale.status === 'published')
    .map(([language]) => language)
}
