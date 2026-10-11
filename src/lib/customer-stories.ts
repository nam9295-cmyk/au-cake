export type StoryPhoto = {
  id: string
  src: string
  thumbnail: string
  width: number
  height: number
  privacyMasked: boolean
}
export type CustomerStory = {
  id: string
  platform: string
  nickname: string
  date: string
  rating: number
  original: string
  english: string
  originalLanguage: string | null
  translated: boolean
  photos: StoryPhoto[]
  products: { id: string; label: string; evidence: string }[]
  title?: string
  mobileExcerpt?: string
}
export const storySource = (story: CustomerStory) =>
  `${story.platform === 'baemin' ? 'Baemin' : 'Coupang Eats'} · Korea`
export const storyDate = (date: string) =>
  new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
export function filterStories(
  stories: CustomerStory[],
  filters: {
    platform: string
    photos: boolean
    product: string
    query: string
  },
) {
  const query = filters.query.trim().toLocaleLowerCase()
  return stories
    .filter(
      (story) =>
        (!filters.platform || story.platform === filters.platform) &&
        (!filters.photos || story.photos.length > 0) &&
        (!filters.product ||
          story.products.some((p) => p.id === filters.product)) &&
        (!query ||
          `${story.original}\n${story.english}\n${story.nickname}`
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
