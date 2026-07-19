import { useEffect, useState } from 'react'
import type { Language } from './lib/i18n'
import {
  listPublicReviews,
  type PublicReview,
  type PublicReviewExecutor,
} from './lib/public-reviews'

function reviewDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function PublicReviewsSection({
  language,
  executor,
  functionId,
  functionEndpoint,
  demoEnabled = false,
  development = false,
}: {
  language: Language
  executor: PublicReviewExecutor
  functionId: string
  functionEndpoint: string
  demoEnabled?: boolean
  development?: boolean
}) {
  const [reviews, setReviews] = useState<PublicReview[]>([])

  useEffect(() => {
    let current = true
    if (import.meta.env.DEV && demoEnabled && development) {
      void import('./lib/public-reviews-demo').then(({ publicReviewDemoFixtures }) => {
        if (current) setReviews(publicReviewDemoFixtures())
      }).catch(() => { if (current) setReviews([]) })
      return () => { current = false }
    }
    if (!functionId || !functionEndpoint) return () => { current = false }
    listPublicReviews(executor, functionId, functionEndpoint)
      .then((result) => { if (current) setReviews(result) })
      .catch(() => { if (current) setReviews([]) })
    return () => { current = false }
  }, [demoEnabled, development, executor, functionEndpoint, functionId])

  if (reviews.length === 0) return null

  const copy = language === 'ko'
    ? { kicker: '실제 주문 후기', title: '소중한 날을 위해 만들었어요', support: '케이크 주문과 키즈 클래스 이용 후 공개에 동의한 후기입니다.', disclosure: '리워드 제공 후기' }
    : { kicker: 'From verified bookings', title: 'Made for real celebrations', support: 'A few words from cake orders and class bookings shared with permission.', disclosure: 'Incentivised review' }

  return (
    <section className="public-reviews-section" aria-labelledby="public-reviews-title">
      <header className="public-reviews-heading">
        <p className="summary-kicker">{copy.kicker}</p>
        <h2 id="public-reviews-title">{copy.title}</h2>
        <p>{copy.support}</p>
      </header>
      <div className="public-reviews-grid">
        {reviews.map((review, index) => {
          const sourceBadge = review.sourceType === 'cake'
            ? (language === 'ko' ? '확인된 주문' : 'Verified order')
            : (language === 'ko' ? '확인된 클래스 예약' : 'Verified class booking')
          const starLabel = language === 'ko' ? `별점 5점 중 ${review.rating}점` : `${review.rating} out of 5 stars`
          return (
            <article className="public-review-card" key={`${review.createdAt}-${index}`}>
              {review.hasPhoto && review.photoUrl && (
                <img className="public-review-photo" src={review.photoUrl} alt={language === 'ko' ? '후기와 함께 공유된 사진' : 'Photo shared with this review'} />
              )}
              <div className="public-review-stars" role="img" aria-label={starLabel}>
                <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
              </div>
              <blockquote>{review.body}</blockquote>
              <footer>
                <div className="public-review-byline">
                  <strong>{review.displayName}</strong>
                  <time dateTime={review.createdAt}>{reviewDate(review.createdAt, language)}</time>
                </div>
                <div className="public-review-labels">
                  <span className="public-review-source">{sourceBadge}</span>
                  <span className="public-review-disclosure">{copy.disclosure}</span>
                </div>
              </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}
