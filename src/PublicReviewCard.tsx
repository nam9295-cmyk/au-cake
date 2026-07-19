import type { Ref } from 'react'
import type { PublicReview } from './lib/public-reviews.js'

export function PublicReviewCard({
  review,
  language,
  onOpen,
  buttonRef,
}: {
  review: PublicReview
  language: 'en' | 'ko'
  onOpen: (opener: HTMLButtonElement) => void
  buttonRef?: Ref<HTMLButtonElement>
}) {
  const sourceLabel = review.sourceType === 'cake'
    ? (language === 'ko' ? '검증된 주문' : 'Verified order')
    : (language === 'ko' ? '검증된 클래스 예약' : 'Verified class booking')
  const date = new Date(review.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-AU', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Australia/Sydney',
  })
  const starLabel = language === 'ko' ? `별점 5점 중 ${review.rating}점` : `${review.rating} out of 5 stars`
  const openLabel = language === 'ko'
    ? `${review.displayName}님의 후기 전체 보기`
    : `Read the full review from ${review.displayName}`

  return (
    <button
      ref={buttonRef}
      className={`public-review-card${review.hasPhoto ? ' has-photo' : ' no-photo'}`}
      type="button"
      aria-haspopup="dialog"
      aria-label={openLabel}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      {review.thumbnailUrl && (
        <span className="public-review-photo-wrap" aria-hidden="true">
          <img
            className="public-review-photo"
            src={review.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width="640"
            height="480"
          />
        </span>
      )}
      <span className="public-review-card-content">
        <span className="public-review-stars" role="img" aria-label={starLabel}>
          <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
        </span>
        <span className="public-review-quote">“{review.body}”</span>
        <span className="public-review-card-footer">
          <span className="public-review-card-person">
            <strong>{review.displayName}</strong>
            <small>{sourceLabel} · {date}</small>
          </span>
          <span className="public-review-incentive">
            {language === 'ko' ? '리워드 제공 후기' : 'Incentivised review'}
          </span>
        </span>
      </span>
    </button>
  )
}
