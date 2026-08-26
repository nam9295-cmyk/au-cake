import { useCallback, useEffect, useState } from 'react'
import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, functions } from './lib/appwrite'
import {
  BookingConfirmationEmailError,
  bookingConfirmationRecipientAvailable,
  sendBookingConfirmation,
  type BookingConfirmationSourceType,
} from './lib/booking-confirmation-email'
import {
  getBookingEmailStatus,
  retryBookingEmail,
  type BookingEmailDeliveryResult,
  type BookingEmailKind,
} from './lib/booking-email-retry'

type Props = {
  sourceType: BookingConfirmationSourceType
  reservationId: string
  status: string
  recipientEmail?: string
}

function isConfirmationStatus(sourceType: BookingConfirmationSourceType, status: string) {
  return sourceType === 'cake' ? status === '예약확정' : status === 'Confirmed'
}

function deliveryCopy(label: string, result: BookingEmailDeliveryResult | null) {
  if (!result || result.status === 'not_sent') return `${label}: Not sent`
  if (result.status === 'sent') return `${label}: Email sent`
  if (result.status === 'pending') return `${label}: Email send in progress`
  if (result.retry === 'eligible') {
    return result.status === 'uncertain'
      ? `${label}: Delivery could not be confirmed.`
      : `${label}: Email could not be sent.`
  }
  if (['expired_window', 'payload_changed', 'recipient_changed', 'terminal_error', 'manual_fallback'].includes(result.retry)) {
    return `${label}: Cannot safely retry. Use the message copy option instead.`
  }
  return `${label}: Email could not be sent. Use the message copy option instead.`
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
  const [receipt, setReceipt] = useState<BookingEmailDeliveryResult | null>(null)
  const [confirmation, setConfirmation] = useState<BookingEmailDeliveryResult | null>(null)
  const [loading, setLoading] = useState(Boolean(appwriteConfig.reservationNotificationFunctionId))
  const [sending, setSending] = useState(false)
  const [retrying, setRetrying] = useState<BookingEmailKind | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const functionId = appwriteConfig.reservationNotificationFunctionId
  const recipientAvailable = bookingConfirmationRecipientAvailable(recipientEmail)
  const statusAllowed = isConfirmationStatus(sourceType, status)

  const load = useCallback(async () => {
    if (!functionId) return null
    return Promise.all([
      getBookingEmailStatus(executor(), functionId, sourceType, reservationId, 'booking-received-customer'),
      getBookingEmailStatus(executor(), functionId, sourceType, reservationId, 'booking-confirmed-customer'),
    ])
  }, [functionId, reservationId, sourceType])

  const refresh = useCallback(async () => {
    const deliveries = await load()
    if (!deliveries) return
    const [nextReceipt, nextConfirmation] = deliveries
    setReceipt(nextReceipt)
    setConfirmation(nextConfirmation)
  }, [load])

  useEffect(() => {
    let active = true
    if (!functionId) return () => { active = false }
    load()
      .then((deliveries) => {
        if (!active || !deliveries) return
        setReceipt(deliveries[0])
        setConfirmation(deliveries[1])
        setRequestError(null)
      })
      .catch(() => { if (active) setRequestError('Email status is unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [functionId, load])

  const deliveryLocked = confirmation !== null && confirmation.status !== 'not_sent'
  const disabled = !functionId || !statusAllowed || !recipientAvailable || loading || sending || deliveryLocked

  async function send() {
    if (disabled || !functionId) return
    setSending(true)
    setRequestError(null)
    try {
      await sendBookingConfirmation(executor(), functionId, sourceType, reservationId)
      await refresh()
    } catch (error) {
      setRequestError(error instanceof BookingConfirmationEmailError && error.code === 'BOOKING_CONFIRMATION_EMAIL_UNAVAILABLE'
        ? 'Email address is missing'
        : 'Email could not be sent. You can use the SMS copy instead.')
    } finally {
      setSending(false)
    }
  }

  async function retry(emailKind: BookingEmailKind) {
    if (!functionId || retrying || !recipientAvailable) return
    setRetrying(emailKind)
    setRequestError(null)
    try {
      await retryBookingEmail(executor(), functionId, sourceType, reservationId, emailKind)
      await refresh()
    } catch {
      setRequestError('Email could not be retried safely. Use the message copy option instead.')
    } finally {
      setRetrying(null)
    }
  }

  const notice = requestError ||
    (!recipientAvailable ? 'Email address is missing' : null) ||
    (!statusAllowed ? 'Save the final confirmation status before sending email.' : null)

  return (
    <div className="booking-confirmation-email">
      <button className="primary-button" type="button" disabled={disabled} onClick={send}>
        {sending ? 'Sending…' : confirmation?.status === 'sent' ? 'Confirmation email sent' : 'Send confirmation email'}
      </button>
      <div className="booking-email-delivery-status" aria-live="polite">
        <p>{deliveryCopy('Booking receipt', receipt)}</p>
        {receipt?.retry === 'eligible' && <button className="secondary-button" type="button" disabled={Boolean(retrying)} onClick={() => void retry('booking-received-customer')}>
          {retrying === 'booking-received-customer' ? 'Retrying…' : 'Retry email'}
        </button>}
        <p>{deliveryCopy('Confirmation', confirmation)}</p>
        {confirmation?.retry === 'eligible' && <button className="secondary-button" type="button" disabled={Boolean(retrying)} onClick={() => void retry('booking-confirmed-customer')}>
          {retrying === 'booking-confirmed-customer' ? 'Retrying…' : 'Retry email'}
        </button>}
      </div>
      {notice && <p className="notice-line" role="status">{notice}</p>}
    </div>
  )
}
