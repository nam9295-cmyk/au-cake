import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Mail } from 'lucide-react'
import { appwriteConfig, functions } from './lib/appwrite'
import { copyAdminRewardMessage } from './lib/admin-reviews'
import { canCreateReviewInvite, reviewInviteErrorMessage } from './lib/review-messages'
import {
  copyReviewInviteRequest,
  sendReviewInviteEmail,
} from './lib/review-repository'
import {
  getReviewEmailStatus,
  retryReviewEmail,
  type ReviewEmailDeliveryResult,
} from './lib/review-email-retry'

export function ReviewInviteButton({
  sourceType,
  sourceReservationId,
  status,
}: {
  sourceType: 'cake' | 'class'
  sourceReservationId: string
  status: string
}) {
  const [issuing, setIssuing] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [delivery, setDelivery] = useState<ReviewEmailDeliveryResult | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const issuingRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
  }, [])

  const refresh = useCallback(() => getReviewEmailStatus(functions, appwriteConfig.reviewApiFunctionId, {
      emailKind: 'review-invite-customer', sourceType, reservationId: sourceReservationId,
    }), [sourceReservationId, sourceType])

  useEffect(() => {
    let current = true
    if (!canCreateReviewInvite(sourceType, status)) return () => { current = false }
    refresh()
      .then((result) => { if (current) setDelivery(result) })
      .catch((statusError) => { if (current) setError(reviewInviteErrorMessage(statusError)) })
      .finally(() => { if (current) setLoadingStatus(false) })
    return () => { current = false }
  }, [refresh, sourceType, sourceReservationId, status])

  if (!canCreateReviewInvite(sourceType, status)) return null

  const deliveryStatus = delivery?.status
  const recipientMissing = delivery?.safeErrorCode === 'recipient_recovery_unavailable'
  const copyAllowed = !loadingStatus && !issuing && !['used', 'expired', 'legacy_invite_unrecoverable'].includes(deliveryStatus || '')
  const sendAllowed = !loadingStatus && !issuing && Boolean(delivery) && !recipientMissing && deliveryStatus === 'not_sent'
  const retryAllowed = !loadingStatus && !issuing && !recipientMissing && delivery?.retry === 'eligible'
  const statusNotice = deliveryStatus === 'sent'
    ? 'Review email sent'
    : deliveryStatus === 'pending'
      ? 'Email send in progress'
      : deliveryStatus === 'failed'
        ? retryAllowed ? 'Review email could not be sent' : 'Review email could not be sent. Use the message copy option instead.'
      : deliveryStatus === 'uncertain'
          ? retryAllowed ? 'Email delivery status is uncertain' : 'Email delivery status is uncertain. Do not resend automatically.'
          : deliveryStatus === 'used'
            ? 'Review already submitted'
            : deliveryStatus === 'expired'
              ? 'Review link expired'
              : deliveryStatus === 'legacy_invite_unrecoverable'
                ? 'Existing review link cannot be recovered'
                : recipientMissing
                  ? 'Email address is missing'
                  : ''

  async function sendReviewEmail() {
    if (!sendAllowed || issuingRef.current) return
    issuingRef.current = true
    setIssuing(true)
    setError('')
    setSuccess('')
    try {
      const result = await sendReviewInviteEmail(functions, appwriteConfig.reviewApiFunctionId, sourceType, sourceReservationId)
      setDelivery(await refresh())
      if (result.status !== 'sent' && result.status !== 'already_sent') {
        setError(result.status === 'failed' ? 'Review email could not be sent' : 'Email delivery status is uncertain')
        return
      }
      setSuccess('Review email sent')
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setSuccess(''), 2500)
    } catch (sendError) {
      setError(reviewInviteErrorMessage(sendError))
    } finally {
      issuingRef.current = false
      setIssuing(false)
    }
  }

  async function retryReviewEmailSafely() {
    if (!retryAllowed || issuingRef.current) return
    issuingRef.current = true
    setIssuing(true)
    setError('')
    setSuccess('')
    try {
      await retryReviewEmail(functions, appwriteConfig.reviewApiFunctionId, {
        emailKind: 'review-invite-customer', sourceType, reservationId: sourceReservationId,
      })
      setDelivery(await refresh())
    } catch (retryError) {
      setError(reviewInviteErrorMessage(retryError))
    } finally {
      issuingRef.current = false
      setIssuing(false)
    }
  }

  async function copyReviewRequest() {
    if (!copyAllowed || issuingRef.current) return
    issuingRef.current = true
    setIssuing(true)
    setError('')
    setSuccess('')
    try {
      const copy = await copyReviewInviteRequest(functions, appwriteConfig.reviewApiFunctionId, sourceType, sourceReservationId)
      await copyAdminRewardMessage(copy.message)
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
      <div className="button-row">
        <button className="primary-button" type="button" disabled={!sendAllowed} onClick={sendReviewEmail}>
          <Mail size={16} /> {issuing ? 'Sending…' : 'Send review email'}
        </button>
        <button className="secondary-button" type="button" disabled={!copyAllowed} onClick={copyReviewRequest}>
          <Copy size={16} /> {issuing ? '리뷰 요청 준비 중...' : 'Copy review request'}
        </button>
        {retryAllowed && <button className="secondary-button" type="button" disabled={issuing} onClick={retryReviewEmailSafely}>
          <Mail size={16} /> {issuing ? 'Retrying…' : 'Retry email'}
        </button>}
      </div>
      {statusNotice && <p className="notice-line" role="status">{statusNotice}</p>}
      {error && <p className="error-text review-invite-error" role="alert">{error}</p>}
    </div>
  )
}
