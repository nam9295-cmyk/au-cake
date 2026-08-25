import { useEffect, useRef, useState, type UIEvent } from 'react'
import {
  clampReviewStart,
  getKoreanCakeReviewsBySlug,
  getReviewRangeLabel,
} from './lib/korean-cake-reviews'
import type { Language } from './lib/i18n'

const DESKTOP_VISIBLE_COUNT = 3

const SECTION_COPY = {
  en: {
    title: 'REVIEWS FROM OUR STORE IN KOREA',
    intro: 'Reviews from our store in Korea. Korean is shown as posted with an English translation; products and availability may differ in Sydney.',
    location: 'Store in Korea',
  },
  ko: {
    title: '한국 매장 고객 후기',
    intro: '한국 매장에 등록된 후기입니다. 한국어 원문은 게시된 그대로 표시하며 영어 번역을 함께 제공합니다. 시드니의 제품과 판매 여부는 다를 수 있습니다.',
    location: '한국 매장',
  },
} as const

function formatReviewDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00.000Z`)
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function getTrackRelativeLeft(track: HTMLElement, card: HTMLElement) {
  return card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft
}

export default function KoreanCakeReviewsSection({
  slug,
  language,
}: {
  slug: string
  language: Language
}) {
  const reviews = getKoreanCakeReviewsBySlug(slug)
  const trackRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(DESKTOP_VISIBLE_COUNT)
  const [start, setStart] = useState(0)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateVisibleCount = () => {
      const nextVisibleCount = media.matches ? 1 : DESKTOP_VISIBLE_COUNT
      setVisibleCount(nextVisibleCount)
      setStart((current) => clampReviewStart(current, reviews.length, nextVisibleCount))
    }

    updateVisibleCount()
    media.addEventListener('change', updateVisibleCount)
    return () => media.removeEventListener('change', updateVisibleCount)
  }, [reviews.length])

  if (reviews.length === 0) return null

  const copy = SECTION_COPY[language]
  const maxStart = clampReviewStart(reviews.length, reviews.length, visibleCount)
  const controlsAreStatic = reviews.length <= DESKTOP_VISIBLE_COUNT

  function scrollToReview(requested: number) {
    const nextStart = clampReviewStart(requested, reviews.length, visibleCount)
    const track = trackRef.current
    const target = track?.children.item(nextStart) as HTMLElement | null
    if (!track || !target) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: getTrackRelativeLeft(track, target), behavior: reduceMotion ? 'auto' : 'smooth' })
    setStart(nextStart)
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const track = event.currentTarget
    const cards = Array.from(track.children) as HTMLElement[]
    if (cards.length === 0) return

    const nearestIndex = cards.reduce((nearest, card, index) => (
      Math.abs(getTrackRelativeLeft(track, card) - track.scrollLeft)
        < Math.abs(getTrackRelativeLeft(track, cards[nearest]) - track.scrollLeft)
        ? index
        : nearest
    ), 0)
    setStart(clampReviewStart(nearestIndex, reviews.length, visibleCount))
  }

  return (
    <section className="korean-cake-reviews" aria-labelledby="korean-cake-reviews-title">
      <header className="korean-cake-reviews-heading">
        <div>
          <h2 id="korean-cake-reviews-title">{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <div className={`korean-cake-reviews-header-controls${controlsAreStatic ? ' is-static' : ''}`}>
          <span className="korean-cake-reviews-counter" aria-live="polite">
            {getReviewRangeLabel(start, reviews.length, visibleCount)}
          </span>
          <button
            type="button"
            className="korean-cake-reviews-control"
            aria-label="Previous Korean review"
            disabled={start === 0}
            onClick={() => scrollToReview(start - 1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="korean-cake-reviews-control"
            aria-label="Next Korean review"
            disabled={start >= maxStart}
            onClick={() => scrollToReview(start + 1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <div className="korean-cake-reviews-viewport">
        <div
          ref={trackRef}
          className="korean-cake-reviews-track"
          role="region"
          aria-roledescription="carousel"
          aria-label={language === 'ko' ? '한국 매장 고객 후기' : 'Customer reviews from our store in Korea'}
          onScroll={handleScroll}
        >
          {reviews.map((review, index) => (
            <article
              className="korean-cake-review"
              key={review.id}
              aria-label={`${language === 'ko' ? '후기' : 'Review'} ${index + 1} / ${reviews.length}`}
            >
              <div className="korean-cake-review-context">
                <span lang="ko">{review.orderContextKo}</span>
                <span lang="en-AU">{review.orderContextEn}</span>
              </div>

              <blockquote lang="ko">{review.originalKo}</blockquote>
              <div className="korean-cake-review-divider" aria-hidden="true" />
              <blockquote lang="en-AU">{review.translationEn}</blockquote>

              <footer className="korean-cake-review-footer">
                <time dateTime={review.reviewDate}>{formatReviewDate(review.reviewDate, language)}</time>
                <span>{copy.location}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>

      <div className="korean-cake-reviews-mobile-controls">
        <button
          type="button"
          className="korean-cake-reviews-control"
          aria-label="Previous Korean review"
          disabled={start === 0}
          onClick={() => scrollToReview(start - 1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <span className="korean-cake-reviews-counter" aria-live="polite">
          {getReviewRangeLabel(start, reviews.length, visibleCount)}
        </span>
        <button
          type="button"
          className="korean-cake-reviews-control"
          aria-label="Next Korean review"
          disabled={start >= maxStart}
          onClick={() => scrollToReview(start + 1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}
