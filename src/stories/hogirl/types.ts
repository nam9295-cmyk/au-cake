export type HogirlPublicationStatus = 'draft' | 'published'

export type HogirlMediaAsset = {
  key: string
  sourceWidth: number
  sourceHeight: number
}

export type HogirlPanel = {
  id: string
  media: HogirlMediaAsset
}

export type HogirlSocialImage = HogirlMediaAsset & {
  key: string
}

export type HogirlEpisodeMedia = {
  socialImage?: HogirlSocialImage
  ogImagePanelId: string
  panels: HogirlPanel[]
}

export type HogirlLocalePublication = {
  status: HogirlPublicationStatus
}

export type HogirlCaption = {
  placement: 'before' | 'after'
  text: string
}

export type HogirlEpisodeManifest = {
  number: number
  slug: string
  locales: Record<string, HogirlLocalePublication>
  media: HogirlEpisodeMedia
}

export type HogirlEpisodeLocaleContent = {
  title: string
  description: string
  panels: Record<string, {
    alt: string
    captions: HogirlCaption[]
  }>
}

export type HogirlSeriesLocaleContent = HogirlLocalePublication & {
  title: string
  description: string
}

export type HogirlSeriesManifest = {
  id: string
  locales?: Record<string, HogirlSeriesLocaleContent>
  publishedSeasons: Array<{
    number: number
    slug: string
    directory: string
  }>
}

export type HogirlSeasonManifest = {
  number: number
  slug: string
  episodes: Array<{
    number: number
    slug: string
  }>
}

export type LoadedHogirlEpisode = {
  series: HogirlSeriesManifest
  manifest: HogirlEpisodeManifest
  locale: HogirlEpisodeLocaleContent
}
