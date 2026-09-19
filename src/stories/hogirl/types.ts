export type HogirlPublicationStatus = 'draft' | 'published'

export type HogirlMediaAsset = {
  key: string
  sourceWidth: number
  sourceHeight: number
}

export type HogirlPanel = {
  id: string
  presentation?: 'integrated-cover'
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

export type HogirlStoryReference =
  | { kind: 'prologue'; storySlug: string }
  | { kind: 'episode'; seasonSlug: string; episodeSlug: string }

export type HogirlLocalePublication = {
  status: HogirlPublicationStatus
}

export type HogirlHistoricalPublication = {
  status: 'published'
}

export type HogirlCaptionLayout = {
  x: number
  y: number
  maxWidth: number
  align: 'left' | 'center' | 'right'
  tone?: 'light' | 'forest'
}

export type HogirlCaption = {
  placement: 'before' | 'after' | 'overlay'
  text: string
  emphasis?: boolean
  layout?: HogirlCaptionLayout
}

export type HogirlEpisodeManifest = {
  kind?: 'episode'
  number: number
  slug: string
  historicalPublication?: HogirlHistoricalPublication
  previous?: HogirlStoryReference
  locales: Record<string, HogirlLocalePublication>
  media: HogirlEpisodeMedia
}

export type HogirlPrologueManifest = {
  kind: 'prologue'
  slug: string
  historicalPublication?: HogirlHistoricalPublication
  next?: HogirlStoryReference
  locales: Record<string, HogirlLocalePublication>
  media: HogirlEpisodeMedia
}

export type HogirlEpisodeLocalePanel = {
  alt: string
  captions: HogirlCaption[]
  captionLayout?: HogirlCaptionLayout
}

export type HogirlEpisodeLocaleContent = {
  title: string
  description: string
  panels: Record<string, HogirlEpisodeLocalePanel>
}

export type HogirlSeriesLocaleContent = HogirlLocalePublication & {
  title: string
  description: string
}

export type HogirlSeriesManifest = {
  id: string
  historicalPublication?: HogirlHistoricalPublication
  locales?: Record<string, HogirlSeriesLocaleContent>
  publishedPrologue?: {
    slug: string
    directory: string
  }
  draftPrologue?: {
    slug: string
    directory: string
  }
  draftSeasons?: Array<{
    number: number
    slug: string
    directory: string
  }>
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

export type LoadedHogirlPrologue = {
  series: HogirlSeriesManifest
  manifest: HogirlPrologueManifest
  locale: HogirlEpisodeLocaleContent
}
