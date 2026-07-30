import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { appwriteConfig, functions } from './lib/appwrite'
import { copyAdminRewardMessage } from './lib/admin-reviews'
import {
  buildReviewRequestMessage,
  canCreateReviewInvite,
  reviewInviteErrorMessage,
} from './lib/review-messages'
import { createReviewInvite } from './lib/review-repository'

export function ReviewInviteButton({
  sourceType,
  sourceReservationId,
  customerName,
  status,
}: {
  sourceType: 'cake' | 'class'
  sourceReservationId: string
  customerName: string
  status: string
}) {
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const issuingRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
  }, [])

  if (!canCreateReviewInvite(sourceType, status)) return null

  async function copyReviewRequest() {
    if (issuingRef.current) return
    issuingRef.current = true
    setIssuing(true)
    setError('')
    setSuccess('')
    try {
      const invite = await createReviewInvite(functions, appwriteConfig.reviewApiFunctionId, {
        sourceType,
        sourceReservationId,
      })
      await copyAdminRewardMessage(buildReviewRequestMessage(sourceType, customerName, invite.token))
      setSuccess('리뷰 요청 메시지가 복사되었습니다.')
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setSuccess(''), 2500)
    } catch (copyError) {
      setError(reviewInviteErrorMessage(copyError))
    } finally {
      issuingRef.current = false
      setIssuing(false)
    }
  }

  return (
    <div className="review-invite-action">
      {success && <div className="toast" role="status">{success}</div>}
      <button className="secondary-button" type="button" disabled={issuing} onClick={copyReviewRequest}>
        <Copy size={16} /> {issuing ? '리뷰 요청 준비 중...' : 'Copy review request'}
      </button>
      {error && <p className="error-text review-invite-error" role="alert">{error}</p>}
    </div>
  )
}
