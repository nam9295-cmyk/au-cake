import { useCallback, useEffect, useState } from 'react'
import type { Language } from './lib/i18n'
import {
  getPublicReview,
  listPublicReviewsPage,
  type PublicReview,
  type PublicReviewsPage,
  type PublicReviewExecutor,
} from './lib/public-reviews'
import { reviewIdFromHash } from './lib/public-review-dialog'
import { PublicReviewCard } from './PublicReviewCard'
import { PublicReviewDialog } from './PublicReviewDialog'
import { usePublicReviewDialog } from './usePublicReviewDialog'

const EMPTY_PAGE: PublicReviewsPage = { reviews: [], nextCursor: null, hasMore: false }

export default function ReviewsArchive({
  language,
  executor,
  functionId,
  functionEndpoint,
}: {
  language: Language
  executor: PublicReviewExecutor
  functionId: string
  functionEndpoint: string
}) {
  const [page, setPage] = useState<PublicReviewsPage>(EMPTY_PAGE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [deepLinkedReview, setDeepLinkedReview] = useState<PublicReview | null>(null)
  const [, setHistoryRevision] = useState(0)
  const hashReviewId = reviewIdFromHash(window.location.hash)
  const deepLinkIsOutsidePage = Boolean(
    deepLinkedReview && hashReviewId === deepLinkedReview.id && !page.reviews.some((review) => review.id === deepLinkedReview.id),
  )
  const dialogReviews = deepLinkIsOutsidePage && deepLinkedReview ? [deepLinkedReview] : page.reviews
  const { selectedReview, opener, openReview, selectReview, closeReview } = usePublicReviewDialog(dialogReviews)

  useEffect(() => {
    const syncHistory = () => setHistoryRevision((revision) => revision + 1)
    window.addEventListener('popstate', syncHistory)
    return () => window.removeEventListener('popstate', syncHistory)
  }, [])

  useEffect(() => {
    let current = true
    const requestedReviewId = reviewIdFromHash(window.location.hash)
    const deepLinkRequest = requestedReviewId
      ? getPublicReview(executor, functionId, functionEndpoint, requestedReviewId)
          .then((review) => ({ completed: true as const, review }))
          .catch(() => ({ completed: false as const, review: null }))
      : Promise.resolve({ completed: true as const, review: null })

    Promise.all([
      listPublicReviewsPage(executor, functionId, functionEndpoint, { limit: 6 }),
      deepLinkRequest,
    ])
      .then(([result, directResult]) => {
        if (!current) return
        setPage(result)
        const appearsOnPage = requestedReviewId && result.reviews.some((review) => review.id === requestedReviewId)
        setDeepLinkedReview(!appearsOnPage ? directResult.review : null)
        if (requestedReviewId && !appearsOnPage && directResult.completed && directResult.review === null && reviewIdFromHash(window.location.hash) === requestedReviewId) {
          window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
        }
      })
      .catch(() => { if (current) { setPage(EMPTY_PAGE); setError(true) } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [executor, functionEndpoint, functionId, retryKey])

  const loadMore = useCallback(async () => {
    if (!page.hasMore || !page.nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(false)
    try {
      const nextPage = await listPublicReviewsPage(executor, functionId, functionEndpoint, {
        limit: 6,
        cursor: page.nextCursor,
      })
      const existingIds = new Set(page.reviews.map((review) => review.id))
      if (nextPage.reviews.some((review) => existingIds.has(review.id))) throw new Error('DUPLICATE_PUBLIC_REVIEW_PAGE')
      setPage((previous) => ({
        reviews: [...previous.reviews, ...nextPage.reviews],
        nextCursor: nextPage.nextCursor,
        hasMore: nextPage.hasMore,
      }))
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [executor, functionEndpoint, functionId, loadingMore, page.hasMore, page.nextCursor, page.reviews])

  const copy = language === 'ko'
    ? {
        kicker: '검증된 고객 후기',
        title: '고객이 남긴 이야기',
        support: '실제 케이크 주문과 키즈 클래스 예약 후 공개에 동의한 후기만 소개합니다.',
        empty: '아직 공개된 후기가 없습니다.',
        error: '후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        retry: '다시 시도',
        more: '후기 더 보기',
        loading: '후기를 불러오는 중…',
      }
    : {
        kicker: 'Verified customer reviews',
        title: 'Stories from our customers',
        support: 'Reviews shared with permission after verified cake orders and kids class bookings.',
        empty: 'There are no published reviews yet.',
        error: 'Reviews could not be loaded. Please try again.',
        retry: 'Try again',
        more: 'Load more',
        loading: 'Loading reviews…',
      }

  return (
    <main className="reviews-archive-page">
      <header className="reviews-archive-heading">
        <p className="summary-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.support}</p>
      </header>

      {loading ? (
        <div className="reviews-archive-loading" role="status">{copy.loading}</div>
      ) : page.reviews.length > 0 ? (
        <div className="public-reviews-grid is-archive">
          {page.reviews.map((review) => (
            <PublicReviewCard
              key={review.id}
              review={review}
              language={language}
              onOpen={(nextOpener) => openReview(review, nextOpener)}
            />
          ))}
        </div>
      ) : !error ? (
        <p className="reviews-archive-empty">{copy.empty}</p>
      ) : null}

      {error && (
        <div className="reviews-archive-error" role="alert">
          <p>{copy.error}</p>
          {page.reviews.length === 0 && (
            <button className="secondary-button" type="button" onClick={() => {
              setLoading(true)
              setError(false)
              setRetryKey((key) => key + 1)
            }}>{copy.retry}</button>
          )}
        </div>
      )}

      {page.hasMore && (
        <div className="public-reviews-actions">
          <button className="secondary-button" type="button" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? copy.loading : copy.more}
          </button>
        </div>
      )}

      {selectedReview && (
        <PublicReviewDialog
          review={selectedReview}
          reviews={dialogReviews}
          language={language}
          opener={opener}
          onSelect={selectReview}
          onClose={closeReview}
        />
      )}
    </main>
  )
}
