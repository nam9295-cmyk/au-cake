import { useCallback, useEffect, useRef, useState } from 'react'
import AdminFrame from './AdminFrame'
import { appwriteConfig, account, functions } from './lib/appwrite'
import {
  createAdminPhotoPreviewController,
  fetchAdminReviewPhotoBlob,
} from './lib/admin-review-photo-preview'
import type { Page } from './lib/app-routes'
import {
  adminRewardStatusLabel,
  copyAdminRewardMessage,
  copyReviewRewardMessage,
  formatAdminRewardExpiry,
  listAdminReviews,
  mergeAdminReviewPages,
  moderateAdminReview,
  moderationCompletionPlan,
  type AdminReview,
  type AdminReviewFilter,
  type AdminReviewStatus,
} from './lib/admin-reviews'
import { isAdminLoggedIn } from './lib/repository'

const FILTERS: Array<{ value: AdminReviewFilter; label: string }> = [
  { value: 'pending', label: '대기' },
  { value: 'published', label: '게시' },
  { value: 'hidden', label: '숨김' },
]

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value))
}

function actionLabel(status: AdminReviewStatus) {
  if (status === 'published') return '게시'
  if (status === 'hidden') return '숨기기'
  return '대기로 복원'
}

function AdminReviewPhotoPreview({ reviewId, development }: { reviewId: string; development: boolean }) {
  const configured = Boolean(appwriteConfig.reviewApiDirectUrl)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(!configured)

  useEffect(() => {
    let current = true
    if (!configured) return () => { current = false }
    const controller = createAdminPhotoPreviewController({
      loadBlob: (id, signal) => fetchAdminReviewPhotoBlob({
        directUrl: appwriteConfig.reviewApiDirectUrl,
        development,
        reviewId: id,
        account,
        signal,
      }),
      createObjectURL: (blob) => URL.createObjectURL(blob),
      revokeObjectURL: (objectUrl) => URL.revokeObjectURL(objectUrl),
    })
    void controller.load(reviewId).then((nextUrl) => {
      if (current && nextUrl) setUrl(nextUrl)
    }).catch(() => { if (current) setFailed(true) })
    return () => {
      current = false
      controller.dispose()
    }
  }, [configured, development, reviewId])

  if (failed) return <p className="admin-review-photo-seam">Private photo preview unavailable</p>
  if (!url) return <p className="admin-review-photo-seam">Private photo loading…</p>
  return (
    <figure className="admin-review-photo-preview">
      <img src={url} alt="비공개 리뷰 첨부 사진" />
      <figcaption>Private photo · 이 관리자 세션에서만 임시로 표시됩니다.</figcaption>
    </figure>
  )
}

export default function AdminReviewsPage({
  navigate,
  demoEnabled = false,
  development = false,
}: {
  navigate: (page: Page) => void
  demoEnabled?: boolean
  development?: boolean
}) {
  const demoMode = import.meta.env.DEV && demoEnabled && development
  const [authorized, setAuthorized] = useState(false)
  const [filter, setFilter] = useState<AdminReviewFilter>('pending')
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [demoPhotoUrl, setDemoPhotoUrl] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionIds, setActionIds] = useState<Set<string>>(new Set())
  const [rewardCopyIds, setRewardCopyIds] = useState<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState('')
  const generationRef = useRef(0)
  const loadingRef = useRef(false)
  const rewardCopyIdsRef = useRef<Set<string>>(new Set())
  const filterRef = useRef<AdminReviewFilter>('pending')
  const demoReviewsRef = useRef<AdminReview[]>([])

  useEffect(() => {
    let current = true
    isAdminLoggedIn().then((loggedIn) => {
      if (!current) return
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
    return () => { current = false }
  }, [navigate])

  const load = useCallback(async (
    cursor?: string,
    requestedFilter: AdminReviewFilter = filterRef.current,
    replaceInFlight = false,
  ) => {
    if (!authorized || (loadingRef.current && !replaceInFlight)) return
    const generation = ++generationRef.current
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      if (demoMode) {
        if (demoReviewsRef.current.length === 0) {
          const { adminReviewDemoFixtures, adminReviewDemoPhotoUrl } = await import('./lib/admin-reviews-demo')
          demoReviewsRef.current = adminReviewDemoFixtures()
          setDemoPhotoUrl(adminReviewDemoPhotoUrl)
        }
        const matching = demoReviewsRef.current.filter((review) => review.moderationStatus === requestedFilter)
        if (generation !== generationRef.current) return
        setReviews(matching)
        setNextCursor(null)
        return
      }
      if (!appwriteConfig.reviewApiFunctionId) throw new Error('ADMIN_REVIEWS_UNAVAILABLE')
      const page = await listAdminReviews(functions, appwriteConfig.reviewApiFunctionId, requestedFilter, cursor)
      if (generation !== generationRef.current || requestedFilter !== filterRef.current) return
      setReviews((current) => cursor ? mergeAdminReviewPages(current, page.reviews) : page.reviews)
      setNextCursor(page.nextCursor)
    } catch {
      if (generation === generationRef.current) setError('리뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [authorized, demoMode])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [filter, load])

  function selectFilter(nextFilter: AdminReviewFilter) {
    if (nextFilter === filter || loading || actionIds.size > 0) return
    generationRef.current += 1
    loadingRef.current = false
    filterRef.current = nextFilter
    setReviews([])
    setNextCursor(null)
    setFilter(nextFilter)
  }

  async function moderate(review: AdminReview, status: AdminReviewStatus) {
    if (actionIds.has(review.id)) return
    if (status === 'published' && !review.publishConsent) {
      setAnnouncement('게시 동의가 없어 게시할 수 없습니다.')
      return
    }
    const detail = status === 'published' && review.hasPhoto && !review.photoPublishConsent
      ? '\n사진 공개 동의가 없어 글만 공개됩니다.'
      : ''
    const confirmed = window.confirm(
      `${actionLabel(status)}하시겠습니까?\n모더레이션은 개인정보, 스팸, 부적절한 사진만 확인합니다. 부정적인 후기라는 이유로 숨기지 않습니다.${detail}`,
    )
    if (!confirmed) return

    const startedGeneration = generationRef.current
    setActionIds((current) => new Set(current).add(review.id))
    setError('')
    try {
      let updated: AdminReview
      if (demoMode) {
        updated = { ...review, moderationStatus: status, updatedAt: new Date().toISOString() }
        demoReviewsRef.current = demoReviewsRef.current.map((item) => item.id === review.id ? updated : item)
      } else {
        updated = await moderateAdminReview(functions, appwriteConfig.reviewApiFunctionId, review.id, status)
      }
      const plan = moderationCompletionPlan(startedGeneration, generationRef.current, filterRef.current)
      if (plan.applyToStartedGeneration) {
        setReviews((current) => current.filter((item) => item.id !== updated.id))
      }
      setAnnouncement(`${actionLabel(status)} 완료${demoMode ? ' — DEMO, 저장되지 않음' : ''}`)
    } catch {
      setError('모더레이션을 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setActionIds((current) => {
        const next = new Set(current)
        next.delete(review.id)
        return next
      })
      const plan = moderationCompletionPlan(startedGeneration, generationRef.current, filterRef.current)
      void load(undefined, plan.refetchFilter, true)
    }
  }

  async function copyReward(review: AdminReview) {
    if (!review.rewardMessageAvailable || rewardCopyIdsRef.current.has(review.id)) return
    rewardCopyIdsRef.current.add(review.id)
    setRewardCopyIds((current) => new Set(current).add(review.id))
    setAnnouncement('')
    setError('')
    try {
      if (demoMode) {
        const { buildDemoAdminRewardMessage } = await import('./lib/admin-reviews-demo')
        const message = buildDemoAdminRewardMessage(review.id)
        await copyAdminRewardMessage(message)
      } else {
        const { message } = await copyReviewRewardMessage(functions, appwriteConfig.reviewApiFunctionId, review.id)
        await copyAdminRewardMessage(message)
      }
      setAnnouncement(`리워드 메시지를 복사했습니다${demoMode ? ' — DEMO, 저장되지 않음' : ''}`)
    } catch {
      setError('리워드 메시지를 복사하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      rewardCopyIdsRef.current.delete(review.id)
      setRewardCopyIds((current) => {
        const next = new Set(current)
        next.delete(review.id)
        return next
      })
    }
  }

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      <section className="admin-reviews-page" aria-busy={loading}>
        <header className="admin-reviews-header">
          <div>
            <p className="summary-kicker">Review moderation</p>
            <h1>리뷰 관리</h1>
            <p>공개 동의와 개인정보 안전을 확인하고, 감정이 아닌 정책 기준으로 처리합니다.</p>
          </div>
          {demoMode && <strong className="admin-review-demo">DEMO · 저장되지 않음</strong>}
        </header>

        <p className="admin-review-policy">
          모더레이션은 개인정보, 스팸, 부적절한 사진만 확인합니다. 부정적인 후기라는 이유로 숨기지 않습니다.
          게시 후에도 사진 공개 동의가 없으면 글만 공개됩니다.
        </p>

        <div className="admin-review-controls" role="group" aria-label="리뷰 상태 필터">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? 'is-active' : ''}
              aria-pressed={filter === item.value}
              disabled={loading || actionIds.size > 0}
              onClick={() => selectFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="admin-review-announcement" aria-live="polite">{announcement}</div>
        {error && <p className="error-text" role="alert">{error}</p>}
        {!loading && !error && reviews.length === 0 && <p className="admin-review-empty">이 상태의 리뷰가 없습니다.</p>}

        <div className="admin-review-list">
          {reviews.map((review) => {
            const saving = actionIds.has(review.id)
            const copying = rewardCopyIds.has(review.id)
            return (
              <article className="admin-review-card" key={review.id}>
                <div className="admin-review-card-head">
                  <div>
                    <span className={`admin-review-status is-${review.moderationStatus}`}>{review.moderationStatus}</span>
                    <span>{review.sourceType === 'cake' ? '케이크 주문' : '키즈 클래스'}</span>
                  </div>
                  <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                </div>
                <div className="admin-review-stars" aria-label={`별점 5점 중 ${review.rating}점`}>
                  <span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                </div>
                <blockquote>{review.body}</blockquote>
                <p className="admin-review-name">표시 이름: <strong>{review.displayName || '없음'}</strong></p>
                <dl className="admin-review-meta">
                  <div><dt>리워드</dt><dd>{review.rewardPercent}%</dd></div>
                  <div><dt>글 공개 동의</dt><dd>{review.publishConsent ? '동의' : '미동의'}</dd></div>
                  <div><dt>사진 첨부</dt><dd>{review.hasPhoto ? '있음' : '없음'}</dd></div>
                  <div><dt>사진 공개 동의</dt><dd>{review.photoPublishConsent ? '동의' : '미동의'}</dd></div>
                </dl>
                <section className={`admin-review-reward is-${review.rewardStatus}`} aria-label="리뷰 리워드">
                  <dl>
                    <div>
                      <dt>리워드 코드</dt>
                      <dd>{review.rewardCodeLast4 ? <>••••{review.rewardCodeLast4}</> : '확인 불가'}</dd>
                    </div>
                    <div><dt>할인</dt><dd>{review.rewardPercent}%</dd></div>
                    <div><dt>상태</dt><dd>{adminRewardStatusLabel(review.rewardStatus)}</dd></div>
                    <div><dt>만료일</dt><dd>{formatAdminRewardExpiry(review.rewardExpiresAt)}</dd></div>
                  </dl>
                  <button
                    className="admin-review-reward-copy secondary-button"
                    type="button"
                    disabled={copying || !review.rewardMessageAvailable}
                    onClick={() => void copyReward(review)}
                  >
                    {copying ? '복사 중…' : '리워드 메시지 복사'}
                  </button>
                </section>
                {review.hasPhoto && (
                  demoMode ? (
                    <figure className="admin-review-photo-preview">
                      <img src={demoPhotoUrl} alt="DEMO · 리뷰에 첨부된 케이크 사진" loading="lazy" />
                      <figcaption>DEMO photo · 운영 Storage에서 불러온 사진이 아닙니다.</figcaption>
                    </figure>
                  ) : (
                    <AdminReviewPhotoPreview reviewId={review.id} development={development} />
                  )
                )}
                <div className="admin-review-actions">
                  {review.moderationStatus !== 'published' && (
                    <button
                      className="admin-review-action primary-button"
                      type="button"
                      disabled={saving || !review.publishConsent}
                      title={!review.publishConsent ? '게시 동의가 없어 게시할 수 없습니다.' : undefined}
                      onClick={() => void moderate(review, 'published')}
                    >
                      {saving ? '처리 중…' : '게시'}
                    </button>
                  )}
                  {review.moderationStatus !== 'hidden' && (
                    <button className="admin-review-action secondary-button" type="button" disabled={saving} onClick={() => void moderate(review, 'hidden')}>
                      {saving ? '처리 중…' : '숨기기'}
                    </button>
                  )}
                  {review.moderationStatus !== 'pending' && (
                    <button className="admin-review-action secondary-button" type="button" disabled={saving} onClick={() => void moderate(review, 'pending')}>
                      {saving ? '처리 중…' : '대기로 복원'}
                    </button>
                  )}
                  {!review.publishConsent && <span className="admin-review-disabled-reason">게시 동의가 없어 게시할 수 없습니다.</span>}
                  {review.hasPhoto && !review.photoPublishConsent && <span className="admin-review-disabled-reason">사진 공개 동의가 없으면 글만 공개됩니다.</span>}
                </div>
              </article>
            )
          })}
        </div>

        {loading && <p className="admin-review-loading">불러오는 중…</p>}
        {nextCursor && (
          <button className="admin-review-load-more secondary-button" type="button" disabled={loading || actionIds.size > 0} onClick={() => void load(nextCursor)}>
            {loading ? '불러오는 중…' : '더 보기'}
          </button>
        )}
      </section>
    </AdminFrame>
  )
}
