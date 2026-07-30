import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import AdminFrame from './AdminFrame'
import { ClassReservationDrawer } from './ClassReservationDrawer'
import type { Page } from './lib/app-routes'
import {
  buildClassConfirmationMessage,
  buildClassPaymentDetails,
  buildClassPaymentMessage,
  classReservationsToCsv,
  CLASS_PAYMENT_STATUS_OPTIONS,
  CLASS_STATUS_OPTIONS,
  formatClassBookingType,
  getClassCoursePlanLabel,
  getClassTypeLabel,
} from './lib/class-utils'
import {
  isAdminLoggedIn,
  listClassReservations,
  updateClassReservation,
} from './lib/repository'
import type {
  ClassReservation,
  ClassReservationFilters,
} from './lib/types'
import {
  formatCurrency,
  todayInputValue,
} from './lib/utils'

const initialClassFilters: ClassReservationFilters = {
  classDate: '',
  status: '',
  paymentStatus: '',
  search: '',
}

export function AdminClassesPage({ navigate }: { navigate: (page: Page) => void }) {
  const [authorized, setAuthorized] = useState(false)
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [filters, setFilters] = useState<ClassReservationFilters>(initialClassFilters)
  const [selected, setSelected] = useState<ClassReservation | null>(null)
  const [toast, setToast] = useState('')

  async function refresh(nextFilters = filters) {
    setReservations(await listClassReservations(nextFilters))
  }

  useEffect(() => {
    isAdminLoggedIn().then((loggedIn) => {
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
  }, [navigate])

  useEffect(() => {
    if (authorized) listClassReservations(initialClassFilters).then(setReservations)
  }, [authorized])

  async function updateFilters(nextFilters: ClassReservationFilters) {
    setFilters(nextFilters)
    await refresh(nextFilters)
  }

  async function saveReservation(id: string, updates: Parameters<typeof updateClassReservation>[1]) {
    const saved = await updateClassReservation(id, updates)
    setReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelected((current) => (current?.id === id ? saved : current))
  }

  async function copyMessage(message: string, label = '클래스 메시지') {
    await navigator.clipboard.writeText(message)
    setToast(`${label}가 복사되었습니다.`)
    window.setTimeout(() => setToast(''), 2500)
  }

  function downloadCsv() {
    const csv = `\uFEFF${classReservationsToCsv(reservations)}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `verygood-au-class-reservations-${todayInputValue()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const totalRequests = reservations.length
  const pendingPayment = reservations.filter(
    (reservation) => reservation.paymentStatus === 'Payment pending' || reservation.status === 'Requested',
  ).length
  const confirmedSpots = reservations.filter((reservation) => reservation.status === 'Confirmed').length
  const firstReservation = reservations[0]
  const paymentTemplate = firstReservation
    ? buildClassPaymentMessage(firstReservation)
    : `Hi [Parent name], thank you for your booking for [Child name]\n\nRequested session:\n[Class date] [Class time]\n\nThe session is currently available.\n\nPlease use the payment details below:\n${buildClassPaymentDetails()}\n\nOnce your payment is confirmed, we will send you a final confirmation message!\n\nPlease note:\n- Please arrive 5 minutes early\n- Long hair should be tied back\n- Clothes may get chocolate/cream on them\n- Please let us know immediately if there are any allergies or dietary concerns\n- If your child has a favourite figure, doll, LEGO, or small toy, please bring it along. It can help them create their own special cake.\n\nLocation:\n1 Bundil Blvd, Melrose Park, Sydney\n\nWe're excited to see you soon.\nThank you:)`
  const confirmationTemplate = firstReservation
    ? buildClassConfirmationMessage(firstReservation)
    : `Hi [Parent name], [Child name]'s cake class booking is confirmed.\n\nDate/time:\n[Class date] [Class time]\n\nPlease note:\n- Please arrive 5 minutes early\n- Long hair should be tied back\n- Clothes may get chocolate/cream on them\n- Please let us know immediately if there are any allergies or dietary concerns\n- If your child has a favourite figure, doll, LEGO, or small toy, please bring it along. It can help them create their own special cake.\n\nLocation:\n1 Bundil Blvd, Melrose Park, Sydney\n\nWe're excited to see you soon.\nThank you:)`
  const stats = [
    { label: 'Total Requests', value: totalRequests, tone: 'neutral' },
    { label: 'Pending Payment', value: pendingPayment, tone: 'warning' },
    { label: 'Confirmed Spots', value: confirmedSpots, tone: 'success' },
  ]

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      {toast && <div className="toast">{toast}</div>}
      <section className="class-admin-page" aria-labelledby="class-admin-title">
        <div className="class-admin-topline">
          <strong>verygood chocolate</strong>
          <span id="class-admin-title">Admin / Class Reservations</span>
        </div>

        <div className="class-admin-summary-row">
          <div className="class-admin-stats" aria-label="Class reservation summary">
            {stats.map((stat) => (
              <article className={`class-admin-stat ${stat.tone}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
          <button className="class-admin-download" type="button" onClick={downloadCsv}>
            <Download size={15} />
            Download CSV
          </button>
        </div>

        <section className="class-admin-filters" aria-label="Class reservation filters">
          <label>
            <span>Date</span>
            <input type="date" value={filters.classDate} onChange={(event) => updateFilters({ ...filters, classDate: event.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
              <option value="">All status</option>
              {CLASS_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select value={filters.paymentStatus} onChange={(event) => updateFilters({ ...filters, paymentStatus: event.target.value })}>
              <option value="">All payments</option>
              {CLASS_PAYMENT_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label className="class-admin-search">
            <span>Search</span>
            <input placeholder="Parent, child, phone, reservation no." value={filters.search} onChange={(event) => updateFilters({ ...filters, search: event.target.value })} />
          </label>
        </section>

        <section className="class-admin-table-card" aria-label="Class reservation table">
          <div className="class-admin-table-scroll">
            <table className="class-admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Session</th>
                  <th>Parent Details</th>
                  <th>Child (Age)</th>
                  <th>Booking Type</th>
                  <th>Allergies</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => {
                  const hasAllergy = reservation.allergyNote.trim().length > 0
                  const subtotalCents = reservation.subtotalCents ?? reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
                  const discountCents = reservation.discountCents || 0
                  const totalPriceCents = reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.createdAt.slice(0, 10)}</td>
                      <td>
                        <strong>{reservation.classDate} {reservation.classTime}</strong>
                        <span>{reservation.durationMinutes || 120} min{reservation.extensionMinutes === 30 ? ' · +30 min extension' : ''}</span>
                        {reservation.advancedClassDate && reservation.advancedClassTime && (
                          <span>Advanced: {reservation.advancedClassDate} {reservation.advancedClassTime} · {reservation.advancedDurationMinutes || 120} min{reservation.advancedExtensionMinutes === 30 ? ' · +30 min extension' : ''}</span>
                        )}
                      </td>
                      <td><strong>{reservation.parentName}</strong><span>{reservation.parentPhone}</span><span>{reservation.parentEmail}</span></td>
                      <td>
                        <strong>{reservation.childName} ({reservation.childAge})</strong>
                        <span>{reservation.schoolYear}</span>
                        {reservation.secondChildName && <span>{reservation.secondChildName} ({reservation.secondChildAge})</span>}
                      </td>
                      <td>
                        <strong>{getClassCoursePlanLabel(reservation.coursePlan)} · {getClassTypeLabel(reservation.classType)}</strong>
                        <span>{formatClassBookingType(reservation.bookingType)}</span>
                        <span>Subtotal {formatCurrency(subtotalCents / 100)}</span>
                        {discountCents > 0 && <span>{reservation.discountPercent || 5}% discount · -{formatCurrency(discountCents / 100)}</span>}
                        <span>Total {formatCurrency(totalPriceCents / 100)}</span>
                      </td>
                      <td className={hasAllergy ? 'class-allergy-cell warning' : 'class-allergy-cell'}>{hasAllergy ? reservation.allergyNote : 'None'}</td>
                      <td>
                        <select className={`class-status-select ${reservation.status.toLowerCase()}`} value={reservation.status} onChange={(event) => saveReservation(reservation.id, { status: event.target.value as ClassReservation['status'] })}>
                          {CLASS_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="class-payment-select" value={reservation.paymentStatus} onChange={(event) => saveReservation(reservation.id, { paymentStatus: event.target.value as ClassReservation['paymentStatus'] })}>
                          {CLASS_PAYMENT_STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="class-admin-actions">
                          <button type="button" onClick={() => copyMessage(buildClassPaymentMessage(reservation), 'Payment message')}>Copy Payment</button>
                          <button type="button" onClick={() => copyMessage(buildClassConfirmationMessage(reservation), 'Confirmation message')}>Copy Confirm</button>
                          <button type="button" onClick={() => setSelected(reservation)}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {reservations.length === 0 && <tr><td colSpan={9} className="empty-cell">No class reservations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="class-copy-library" aria-labelledby="copy-library-title">
          <h2 id="copy-library-title">Copy Templates Library</h2>
          <div className="class-copy-grid">
            <article className="class-copy-card">
              <div className="class-copy-card-header">
                <strong>1. Payment Request (SMS/Email)</strong>
                <button type="button" onClick={() => copyMessage(paymentTemplate, 'Payment template')}>Copy</button>
              </div>
              <pre>{paymentTemplate}</pre>
            </article>
            <article className="class-copy-card">
              <div className="class-copy-card-header">
                <strong>2. Confirmation (SMS/Email)</strong>
                <button type="button" onClick={() => copyMessage(confirmationTemplate, 'Confirmation template')}>Copy</button>
              </div>
              <pre>{confirmationTemplate}</pre>
            </article>
          </div>
        </section>
      </section>
      {selected && <ClassReservationDrawer reservation={selected} onClose={() => setSelected(null)} onSave={saveReservation} onCopy={(message) => copyMessage(message, '클래스 메시지')} />}
    </AdminFrame>
  )
}
