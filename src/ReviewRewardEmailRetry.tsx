import { useCallback, useEffect, useState } from 'react'
import { appwriteConfig, functions } from './lib/appwrite'
import {
  getReviewEmailStatus,
  retryReviewEmail,
  type ReviewEmailDeliveryResult,
} from './lib/review-email-retry'

function statusCopy(result: ReviewEmailDeliveryResult | null) {
  if (!result || result.status === 'not_sent') return 'Reward email not sent'
  if (result.status === 'sent') return 'Reward email sent'
  if (result.status === 'pending') return 'Reward email is being processed'
  if (result.retry === 'eligible') return result.status === 'uncertain'
    ? 'Reward delivery could not be confirmed.'
    : 'Reward email could not be sent.'
  return 'Reward email cannot be retried safely. Use the reward message copy instead.'
}

export function ReviewRewardEmailRetry({ reviewId }: { reviewId: string }) {
  const functionId = appwriteConfig.reviewApiFunctionId
  const [status, setStatus] = useState<ReviewEmailDeliveryResult | null>(null)
  const [loading, setLoading] = useState(Boolean(functionId))
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(() => getReviewEmailStatus(functions, functionId, {
    emailKind: 'review-reward-customer', reviewId,
  }), [functionId, reviewId])

  useEffect(() => {
    let current = true
    if (!functionId) return () => { current = false }
    load().then((result) => { if (current) setStatus(result) })
      .catch(() => { if (current) setStatus({ status: 'uncertain', retry: 'manual_fallback' }) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [functionId, load])

  async function retry() {
    if (!functionId || status?.retry !== 'eligible' || retrying) return
    setRetrying(true)
    try {
      await retryReviewEmail(functions, functionId, { emailKind: 'review-reward-customer', reviewId })
      setStatus(await load())
    } catch {
      setStatus((current) => current ? { ...current, retry: 'manual_fallback' } : { status: 'uncertain', retry: 'manual_fallback' })
    } finally {
      setRetrying(false)
    }
  }

  if (!functionId || loading) return null
  return (
    <div className="admin-review-reward-email" aria-live="polite">
      <p>{statusCopy(status)}</p>
      {status?.retry === 'eligible' && <button className="secondary-button" type="button" disabled={retrying} onClick={() => void retry()}>
        {retrying ? 'Retrying…' : 'Retry email'}
      </button>}
    </div>
  )
}
