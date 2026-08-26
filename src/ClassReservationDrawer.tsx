import { useState } from 'react'
import { ReviewInviteButton } from './ReviewInviteButton'
import { BookingConfirmationEmailButton } from './BookingConfirmationEmailButton'
import {
  buildClassConfirmationMessage,
  buildClassPaymentMessage,
  getClassCoursePlanLabel,
  getClassTypeLabel,
} from './lib/class-utils'
import { updateClassReservation } from './lib/repository'
import type { ClassReservation } from './lib/types'
import { formatCurrency } from './lib/utils'

export function ClassReservationDrawer({ reservation, onClose, onSave, onCopy }: { reservation: ClassReservation; onClose: () => void; onSave: (id: string, updates: Parameters<typeof updateClassReservation>[1]) => Promise<void>; onCopy: (message: string) => Promise<void> }) {
  const [memo, setMemo] = useState(reservation.adminMemo)
  const subtotalCents = reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
  const discountCents = reservation.discountCents || 0
  const totalPriceCents = reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
  return (
    <div className="drawer-backdrop">
      <aside className="drawer">
        <div className="drawer-header"><h2>{reservation.reservationNumber}</h2><button type="button" onClick={onClose}>닫기</button></div>
        <dl className="detail-list">
          <div><dt>부모</dt><dd>{reservation.parentName}<br />{reservation.parentPhone}<br />{reservation.parentEmail}</dd></div>
          <div><dt>아이</dt><dd>{reservation.childName}, {reservation.childAge}, {reservation.schoolYear}</dd></div>
          <div><dt>과정</dt><dd>{getClassCoursePlanLabel(reservation.coursePlan)}<br />{getClassTypeLabel(reservation.classType)}</dd></div>
          <div><dt>첫 세션</dt><dd>{reservation.classDate} {reservation.classTime}<br />{reservation.durationMinutes || 120} min{reservation.extensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>
          {reservation.advancedClassDate && reservation.advancedClassTime && (
            <div><dt>Advanced 세션</dt><dd>{reservation.advancedClassDate} {reservation.advancedClassTime}<br />{reservation.advancedDurationMinutes || 120} min{reservation.advancedExtensionMinutes === 30 ? ' · +30 min extension' : ''}</dd></div>
          )}
          <div><dt>금액 감사</dt><dd>Subtotal {formatCurrency(subtotalCents / 100)}<br />Discount {reservation.discountPercent || 0}% · -{formatCurrency(discountCents / 100)}<br />Total {formatCurrency(totalPriceCents / 100)}</dd></div>
          <div><dt>안전</dt><dd>{reservation.allergyNote || 'none'}<br />Emergency: {reservation.emergencyContact}<br />Pick-up: {reservation.pickupPerson}</dd></div>
          <div><dt>동의</dt><dd>Parent {reservation.parentConsent ? 'yes' : 'no'} / Photo {reservation.photoConsent ? 'yes' : 'no'} / Cancellation {reservation.cancellationAgreement ? 'yes' : 'no'}</dd></div>
        </dl>
        <label>관리자 메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        <ReviewInviteButton sourceType="class" sourceReservationId={reservation.id} customerName={reservation.parentName} status={reservation.status} />
        <BookingConfirmationEmailButton key={`class-confirmation-${reservation.id}`} sourceType="class" reservationId={reservation.id} status={reservation.status} recipientEmail={reservation.parentEmail} />
        <div className="button-row"><button className="secondary-button" type="button" onClick={() => onCopy(buildClassPaymentMessage(reservation))}>결제 안내 복사</button><button className="secondary-button" type="button" onClick={() => onCopy(buildClassConfirmationMessage(reservation))}>확정 안내 복사</button><button className="primary-button" type="button" onClick={() => onSave(reservation.id, { adminMemo: memo })}>메모 저장</button></div>
        <div className="sms-preview"><pre>{buildClassConfirmationMessage(reservation)}</pre></div>
      </aside>
    </div>
  )
}
