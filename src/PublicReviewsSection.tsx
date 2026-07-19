import { useEffect, useState } from 'react'
import type { Language } from './lib/i18n'
import {
  listPublicReviewsPage,
  type PublicReviewsPage,
  type PublicReviewExecutor,
} from './lib/public-reviews'
import { PublicReviewCard } from './PublicReviewCard'
import { PublicReviewDialog } from './PublicReviewDialog'
import { usePublicReviewDialog } from './usePublicReviewDialog'

const EMPTY_PAGE: PublicReviewsPage = { reviews: [], nextCursor: null, hasMore: false }

export default function PublicReviewsSection({
  language,
  executor,
  functionId,
  functionEndpoint,
  onViewAll,
  demoEnabled = false,
  development = false,
}: {
  language: Language
  executor: PublicReviewExecutor
  functionId: string
  functionEndpoint: string
  onViewAll?: () => void
  demoEnabled?: boolean
  development?: boolean
}) {
  const [page, setPage] = useState<PublicReviewsPage>(EMPTY_PAGE)
  const { selectedReview, opener, openReview, selectReview, closeReview } = usePublicReviewDialog(page.reviews)

  useEffect(() => {
    let current = true
    if (import.meta.env.DEV && demoEnabled && development) {
      void import('./lib/public-reviews-demo').then(({ publicReviewDemoFixtures }) => {
        if (current) setPage({ reviews: publicReviewDemoFixtures(), nextCursor: null, hasMore: false })
      }).catch(() => { if (current) setPage(EMPTY_PAGE) })
      return () => { current = false }
    }
    if (!functionId || !functionEndpoint) return () => { current = false }
    listPublicReviewsPage(executor, functionId, functionEndpoint, { limit: 3 })
      .then((result) => { if (current) setPage(result) })
      .catch(() => { if (current) setPage(EMPTY_PAGE) })
    return () => { current = false }
  }, [demoEnabled, development, executor, functionEndpoint, functionId])

  if (page.reviews.length === 0) return null

  const copy = language === 'ko'
    ? {
        kicker: '실제 주문 후기',
        title: '소중한 날을 위해 만들었어요',
        support: '케이크 주문과 키즈 클래스 이용 후 공개에 동의한 후기입니다.',
        viewAll: '후기 전체 보기',
      }
    : {
        kicker: 'From verified bookings',
        title: 'Made for real celebrations',
        support: 'A few words from cake orders and class bookings shared with permission.',
        viewAll: 'View all reviews',
      }

  return (
    <section className="public-reviews-section" aria-labelledby="public-reviews-title">
      <header className="public-reviews-heading">
        <p className="summary-kicker">{copy.kicker}</p>
        <h2 id="public-reviews-title">{copy.title}</h2>
        <p>{copy.support}</p>
      </header>
      <div className="public-reviews-grid" data-count={page.reviews.length}>
        {page.reviews.map((review) => (
          <PublicReviewCard
            key={review.id}
            review={review}
            language={language}
            onOpen={(nextOpener) => openReview(review, nextOpener)}
          />
        ))}
      </div>
      {page.hasMore && onViewAll && (
        <div className="public-reviews-actions">
          <button className="secondary-button" type="button" onClick={onViewAll}>{copy.viewAll}</button>
        </div>
      )}
      {selectedReview && (
        <PublicReviewDialog
          review={selectedReview}
          reviews={page.reviews}
          language={language}
          opener={opener}
          onSelect={selectReview}
          onClose={closeReview}
        />
      )}
    </section>
  )
}
