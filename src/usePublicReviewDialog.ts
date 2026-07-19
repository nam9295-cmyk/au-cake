import { useCallback, useEffect, useMemo, useState } from 'react'
import { reviewDialogHref, reviewIdFromHash } from './lib/public-review-dialog.js'
import type { PublicReview } from './lib/public-reviews.js'

export function usePublicReviewDialog(reviews: PublicReview[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  const reviewIds = useMemo(() => new Set(reviews.map((review) => review.id)), [reviews])
  const selectedReview = reviews.find((review) => review.id === selectedId) || null

  useEffect(() => {
    function syncFromHistory() {
      const reviewId = reviewIdFromHash(window.location.hash)
      setSelectedId(reviewId && reviewIds.has(reviewId) ? reviewId : null)
    }
    window.addEventListener('popstate', syncFromHistory)
    syncFromHistory()
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [reviewIds])

  const openReview = useCallback((review: PublicReview, nextOpener: HTMLButtonElement) => {
    setOpener(nextOpener)
    setSelectedId(review.id)
    window.history.pushState(
      { ...(window.history.state || {}), vgReviewDialog: true },
      '',
      reviewDialogHref(window.location.pathname, window.location.search, review.id),
    )
  }, [])

  const selectReview = useCallback((reviewId: string) => {
    if (!reviewIds.has(reviewId)) return
    setSelectedId(reviewId)
    window.history.replaceState(
      window.history.state,
      '',
      reviewDialogHref(window.location.pathname, window.location.search, reviewId),
    )
  }, [reviewIds])

  const closeReview = useCallback(() => {
    if (reviewIdFromHash(window.location.hash) && window.history.state?.vgReviewDialog === true) {
      window.history.back()
      return
    }
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    setSelectedId(null)
  }, [])

  return { selectedReview, opener, openReview, selectReview, closeReview }
}
