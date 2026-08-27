import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Clipboard,
  Download,
  Search,
} from 'lucide-react'
import AdminFrame from './AdminFrame'
import { ReservationDrawer } from './ReservationDrawer'
import type { Page } from './lib/app-routes'
import {
  CACAO_OPTIONS,
  DEFAULT_SETTINGS,
  PAYMENT_STATUSES,
  RESERVATION_STATUSES,
  formatCakeSizeLabel,
  formatCacaoLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getProductById,
  isCheesecakeProduct,
  usesReservationChocolateType,
} from './lib/constants'
import {
  getSettings,
  isAdminLoggedIn,
  listReservations,
  updateReservation,
} from './lib/repository'
import { formatOrderLineSummary, getReservationItemCount } from './lib/order-lines'
import type {
  Reservation,
  ReservationFilters,
  StoreSettings,
} from './lib/types'
import {
  buildSmsMessage,
  reservationsToCsv,
  todayInputValue,
} from './lib/utils'

const initialFilters: ReservationFilters = {
  pickupDate: '',
  status: '',
  paymentStatus: '',
  cacaoPercent: '',
  search: '',
}

function reservationCacaoText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesCacaoOptions ? formatCacaoLabel(reservation.cacaoPercent) : '-'
}

function reservationCakeSizeText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesSizeOptions || isCheesecakeProduct(product.id) ? formatCakeSizeLabel(reservation.cakeSize) : '-'
}

function reservationChocolateText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return usesReservationChocolateType(product.id, reservation.poundAddon) ? formatChocolateTypeLabel(reservation.chocolateType) : '-'
}

function reservationFinishText(reservation: Reservation) {
  const product = getProductById(reservation.productId)
  return product.usesPoundAddonOptions ? formatPoundAddonLabel(reservation.poundAddon) : '-'
}

export function AdminReservationsPage({
  navigate,
}: {
  navigate: (page: Page) => void
}) {
  const [authorized, setAuthorized] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filters, setFilters] = useState<ReservationFilters>(initialFilters)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)

  async function refresh(nextFilters = filters) {
    setReservations(await listReservations(nextFilters))
  }

  useEffect(() => {
    isAdminLoggedIn().then((loggedIn) => {
      if (!loggedIn) navigate('admin-login')
      setAuthorized(loggedIn)
    })
  }, [navigate])

  useEffect(() => {
    if (authorized) {
      listReservations(initialFilters).then(setReservations)
      getSettings().then(setSettings)
    }
  }, [authorized])

  async function updateFilters(nextFilters: ReservationFilters) {
    setFilters(nextFilters)
    await refresh(nextFilters)
  }

  async function saveReservation(id: string, updates: Parameters<typeof updateReservation>[1]) {
    const saved = await updateReservation(id, updates)
    setReservations((current) => current.map((item) => (item.id === id ? saved : item)))
    setSelected((current) => (current?.id === id ? saved : current))
  }

  async function copySms(reservation: Reservation) {
    await navigator.clipboard.writeText(buildSmsMessage(reservation, settings))
    setToast('문자 내용이 복사되었습니다.')
    window.setTimeout(() => setToast(''), 2500)
  }

  function downloadCsv() {
    const csv = `\uFEFF${reservationsToCsv(reservations)}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `verygood-cake-reservations-${todayInputValue()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!authorized) return null

  return (
    <AdminFrame navigate={navigate}>
      {toast && <div className="toast">{toast}</div>}
      <div className="admin-header">
        <h1>예약 목록</h1>
        <button className="primary-button" type="button" onClick={downloadCsv}>
          <Download size={16} /> 엑셀 다운로드
        </button>
      </div>

      <section className="filters">
        <label>
          <CalendarDays size={16} />
          <input
            type="date"
            value={filters.pickupDate}
            onChange={(event) => updateFilters({ ...filters, pickupDate: event.target.value })}
          />
        </label>
        <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
          <option value="">예약상태 전체</option>
          {RESERVATION_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(event) => updateFilters({ ...filters, paymentStatus: event.target.value })}
        >
          <option value="">입금상태 전체</option>
          {PAYMENT_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filters.cacaoPercent}
          onChange={(event) => updateFilters({ ...filters, cacaoPercent: event.target.value })}
        >
          <option value="">카카오 전체</option>
          {CACAO_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="고객명, 연락처, 이메일, 예약번호"
            value={filters.search}
            onChange={(event) => updateFilters({ ...filters, search: event.target.value })}
          />
        </label>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>신청일시</th>
              <th>예약번호</th>
              <th>예약자</th>
              <th>연락처</th>
              <th>이메일</th>
              <th>제품</th>
              <th>사이즈</th>
              <th>카카오</th>
              <th>초콜릿</th>
              <th>마감</th>
              <th>수량</th>
              <th>픽업일</th>
              <th>픽업시간</th>
              <th>요청사항</th>
              <th>예약상태</th>
              <th>입금상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>{reservation.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>{reservation.reservationNumber}</td>
                <td>{reservation.customerName}</td>
                <td>{reservation.customerPhone}</td>
                <td>{reservation.customerEmail || '-'}</td>
                <td>
                  {reservation.orderLines?.length ? (
                    <ul className="admin-order-lines">
                      {reservation.orderLines?.map((line, index) => (
                        <li key={`${line.productId}-${index}`}>{formatOrderLineSummary(line)}</li>
                      ))}
                    </ul>
                  ) : getProductById(reservation.productId).name}
                </td>
                <td>{reservation.orderLines?.length ? '-' : reservationCakeSizeText(reservation)}</td>
                <td>{reservation.orderLines?.length ? '-' : reservationCacaoText(reservation)}</td>
                <td>{reservation.orderLines?.length ? '-' : reservationChocolateText(reservation)}</td>
                <td>{reservation.orderLines?.length ? '-' : reservationFinishText(reservation)}</td>
                <td>{getReservationItemCount(reservation)}개</td>
                <td>{reservation.pickupDate}</td>
                <td>{reservation.pickupTime}</td>
                <td className="note-cell">{reservation.requestNote || '-'}</td>
                <td>
                  <select
                    value={reservation.status}
                    onChange={(event) =>
                      saveReservation(reservation.id, { status: event.target.value as Reservation['status'] })
                    }
                  >
                    {RESERVATION_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={reservation.paymentStatus}
                    onChange={(event) =>
                      saveReservation(reservation.id, {
                        paymentStatus: event.target.value as Reservation['paymentStatus'],
                      })
                    }
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="table-actions">
                    <button type="button" onClick={() => copySms(reservation)} title="문자 복사">
                      <Clipboard size={16} />
                    </button>
                    <button type="button" onClick={() => setSelected(reservation)}>
                      상세
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={17} className="empty-cell">
                  표시할 예약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <ReservationDrawer
          key={selected.id}
          reservation={selected}
          onClose={() => setSelected(null)}
          onSave={saveReservation}
          onCopy={copySms}
          settings={settings}
        />
      )}
    </AdminFrame>
  )
}
