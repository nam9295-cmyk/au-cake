import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { adjacentReviewId } from './lib/public-review-dialog.js'
import type { PublicReview } from './lib/public-reviews.js'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function PublicReviewDialog({
  review,
  reviews,
  language,
  opener,
  onSelect,
  onClose,
}: {
  review: PublicReview
  reviews: PublicReview[]
  language: 'en' | 'ko'
  opener: HTMLButtonElement | null
  onSelect: (reviewId: string) => void
  onClose: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const ids = useMemo(() => reviews.map((item) => item.id), [reviews])
  const previousId = adjacentReviewId(ids, review.id, -1)
  const nextId = adjacentReviewId(ids, review.id, 1)
  const date = new Date(review.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-AU', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Australia/Sydney',
  })
  const starLabel = language === 'ko' ? `별점 5점 중 ${review.rating}점` : `${review.rating} out of 5 stars`

  useLayoutEffect(() => {
    if (layoutRef.current) layoutRef.current.scrollTop = 0
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [review.id])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      if (opener?.isConnected) opener?.focus()
    }
  }, [onClose, opener])

  function onBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  const sourceLabel = review.sourceType === 'cake'
    ? (language === 'ko' ? '검증된 주문' : 'Verified order')
    : (language === 'ko' ? '검증된 클래스 예약' : 'Verified class booking')

  return createPortal(
    <div className="public-review-dialog-backdrop" onMouseDown={onBackdrop}>
      <div
        ref={dialogRef}
        className={`public-review-dialog${review.hasPhoto ? ' has-photo' : ' no-photo'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="public-review-dialog-header">
          <span>{language === 'ko' ? '고객 후기' : 'Customer review'}</span>
          <button
            ref={closeRef}
            className="public-review-dialog-close"
            type="button"
            onClick={onClose}
            aria-label={language === 'ko' ? '후기 닫기' : 'Close review'}
          >
            <X aria-hidden="true" size={22} />
          </button>
        </header>

        <div ref={layoutRef} className="public-review-dialog-layout">
          {review.photoUrl && (
            <figure className="public-review-dialog-photo-wrap">
              <img
                className="public-review-dialog-photo"
                src={review.photoUrl}
                alt={language === 'ko' ? `${review.displayName}님이 공유한 후기 사진` : `Photo shared with ${review.displayName}'s review`}
                decoding="async"
              />
            </figure>
          )}
          <div ref={contentRef} className="public-review-dialog-content">
            <div className="public-review-dialog-stars" role="img" aria-label={starLabel}>
              <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <h2 id={titleId}>{review.displayName}</h2>
            <p id={descriptionId} className="public-review-dialog-quote">“{review.body}”</p>
            <div className="public-review-dialog-meta">
              <span>{sourceLabel}</span>
              <span>{date}</span>
              <span>{language === 'ko' ? '리워드 제공 후기' : 'Incentivised review'}</span>
            </div>
          </div>
        </div>

        <footer className="public-review-dialog-navigation" aria-label={language === 'ko' ? '후기 이동' : 'Review navigation'}>
          <button type="button" disabled={!previousId} onClick={() => previousId && onSelect(previousId)}>
            <ChevronLeft aria-hidden="true" size={18} />
            {language === 'ko' ? '이전 후기' : 'Previous'}
          </button>
          <span>{ids.indexOf(review.id) + 1} / {ids.length}</span>
          <button type="button" disabled={!nextId} onClick={() => nextId && onSelect(nextId)}>
            {language === 'ko' ? '다음 후기' : 'Next'}
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
