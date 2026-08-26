import { useEffect, useState } from 'react'
import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, functions } from './lib/appwrite'
import {
  BookingConfirmationEmailError,
  bookingConfirmationRecipientAvailable,
  getBookingConfirmationStatus,
  sendBookingConfirmation,
  type BookingConfirmationResult,
  type BookingConfirmationSourceType,
} from './lib/booking-confirmation-email'

type Props = {
  sourceType: BookingConfirmationSourceType
  reservationId: string
  status: string
  recipientEmail?: string
}

function isConfirmationStatus(sourceType: BookingConfirmationSourceType, status: string) {
  return sourceType === 'cake' ? status === '예약확정' : status === 'Confirmed'
}

function statusCopy(result: BookingConfirmationResult | null) {
  if (!result) return null
  if (result.status === 'sent' || result.status === 'already_sent') return 'Confirmation email sent'
  if (result.status === 'pending') return 'Confirmation email is being processed'
  if (result.status === 'uncertain') return 'Delivery status is uncertain. Do not resend automatically.'
  if (result.status === 'failed') return 'Email could not be sent. You can use the SMS copy instead.'
  return null
}

function executor() {
  return {
    createExecution(input: { functionId: string; body: string; async: false }) {
      return functions.createExecution({
        ...input,
        method: ExecutionMethod.POST,
        xpath: '/',
      })
    },
  }
}

export function BookingConfirmationEmailButton({ sourceType, reservationId, status, recipientEmail }: Props) {
  const [result, setResult] = useState<BookingConfirmationResult | null>(null)
  const [loading, setLoading] = useState(Boolean(appwriteConfig.reservationNotificationFunctionId))
  const [sending, setSending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const functionId = appwriteConfig.reservationNotificationFunctionId
  const recipientAvailable = bookingConfirmationRecipientAvailable(recipientEmail)
  const statusAllowed = isConfirmationStatus(sourceType, status)

  useEffect(() => {
    let active = true
    if (!functionId) {
      return () => { active = false }
    }
    getBookingConfirmationStatus(executor(), functionId, sourceType, reservationId)
      .then((next) => {
        if (!active) return
        setResult(next)
        setRequestError(null)
      })
      .catch(() => { if (active) setRequestError('Email status is unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [functionId, reservationId, sourceType])

  const deliveryLocked = result?.status === 'sent' || result?.status === 'already_sent' ||
    result?.status === 'pending' || result?.status === 'failed' || result?.status === 'uncertain'
  const disabled = !functionId || !statusAllowed || !recipientAvailable || loading || sending || deliveryLocked

  async function send() {
    if (disabled || !functionId) return
    setSending(true)
    setRequestError(null)
    try {
      setResult(await sendBookingConfirmation(executor(), functionId, sourceType, reservationId))
    } catch (error) {
      setRequestError(error instanceof BookingConfirmationEmailError && error.code === 'BOOKING_CONFIRMATION_EMAIL_UNAVAILABLE'
        ? 'Email address is missing'
        : 'Email could not be sent. You can use the SMS copy instead.')
    } finally {
      setSending(false)
    }
  }

  const notice = requestError ||
    (!recipientAvailable ? 'Email address is missing' : null) ||
    (!statusAllowed ? 'Save the final confirmation status before sending email.' : null) ||
    statusCopy(result)

  return (
    <div className="booking-confirmation-email">
      <button className="primary-button" type="button" disabled={disabled} onClick={send}>
        {sending ? 'Sending…' : result?.status === 'sent' || result?.status === 'already_sent' ? 'Confirmation email sent' : 'Send confirmation email'}
      </button>
      {notice && <p className="notice-line" role="status">{notice}</p>}
    </div>
  )
}
