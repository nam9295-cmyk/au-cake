import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { CustomCakeLookupResponse } from '../lib/custom-cake-contract.js'
import {
  formatCents,
  formatExtraCents,
  getStatusInfo,
} from '../lib/custom-cake-ui.js'
import { getCakeWireRepository } from '../lib/custom-cake-repository'
import { createAdminRequestSession } from '../lib/custom-cake-admin'
import { CustomCakePhoto } from './CustomCakePhoto'

export function AdminCustomCakesSection() {
  const [requests, setRequests] = useState<CustomCakeLookupResponse[]>([])
  const [selected, setSelected] = useState<CustomCakeLookupResponse | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchError, setSearchError] = useState('')
  const [session] = useState(createAdminRequestSession)
  const searchSequence = useRef(0)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  // Edit quote form fields
  const [designExtraInput, setDesignExtraInput] = useState('')
  const [figurineExtraInput, setFigurineExtraInput] = useState('')
  const [explanation, setExplanation] = useState('')
  const [updatingQuote, setUpdatingQuote] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadRequests = async () => {
    const sequence = ++searchSequence.current
    session.clear()
    setSelected(null)
    setSearchError('')
    setLoading(true)
    try {
      const repo = await getCakeWireRepository()
      if (sequence !== searchSequence.current) return
      const result = await repo.listCustomCakeRequests()
      if (sequence === searchSequence.current) setRequests(result.requests)
    } catch { if (sequence === searchSequence.current) setSearchError('커스텀 케이크 접수 목록을 불러오지 못했습니다.') }
    finally { if (sequence === searchSequence.current) setLoading(false) }
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void loadRequests() })
    const sequence = searchSequence
    return () => { active = false; session.clear(); sequence.current++ }
    // This screen owns one session-scoped loader and refreshes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const openDrawer = (item: CustomCakeLookupResponse) => {
    session.adopt(item)
    setSelected(item)
    setActionError('')
    setDesignExtraInput(
      item.quote.designExtraCents !== null ? (item.quote.designExtraCents / 100).toString() : '',
    )
    setFigurineExtraInput(
      item.quote.figurineExtraCents !== null ? (item.quote.figurineExtraCents / 100).toString() : '',
    )
    setExplanation('')
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const mutate = async (mutation: Parameters<ReturnType<typeof createAdminRequestSession>['mutate']>[1], message: string) => {
    if (updatingQuote) return
    const sequence = searchSequence.current
    setUpdatingQuote(true)
    setActionError('')
    try {
      const repository = await getCakeWireRepository()
      if (sequence !== searchSequence.current) return
      const outcome = await session.mutate(repository, mutation)
      if (!outcome || sequence !== searchSequence.current) return
      setRequests(current => current.map(item => item.requestNumber === outcome.snapshot.requestNumber ? outcome.snapshot : item))
      openDrawer(outcome.snapshot)
      if (outcome.error) setActionError('다른 변경으로 화면 정보가 바뀌었습니다. 최신 견적을 확인한 후 다시 진행해 주세요.')
      else showToast(message)
    } catch { if (sequence === searchSequence.current) setActionError('처리 결과를 확인할 수 없습니다. 다시 조회해 주세요.') }
    finally { setUpdatingQuote(false) }
  }

  const handleUpdateQuote = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    const cents = (input: string) => {
      if (!input.trim()) return null
      if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) throw new Error('INVALID_CENTS')
      const [whole, fraction = ''] = input.trim().split('.')
      const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
      if (!Number.isSafeInteger(value)) throw new Error('INVALID_CENTS')
      return value
    }
    try {
      const data = { contractVersion: 'custom-cake.v1' as const, requestNumber: selected.requestNumber, expectedQuoteVersion: selected.quote.quoteVersion,
        designExtraCents: cents(designExtraInput), figurineExtraCents: cents(figurineExtraInput), explanation: explanation.trim() }
      await mutate(repo => repo.updateCustomCakeQuote(data), '견적이 수정되었습니다.')
    } catch { setActionError('추가비는 0 이상의 금액을 소수점 두 자리까지 입력해 주세요.') }
  }
  const handleRecordAcceptance = () => {
    if (!selected) return
    const data = { contractVersion: 'custom-cake.v1' as const, requestNumber: selected.requestNumber, quoteVersion: selected.quote.quoteVersion, customerConsent: true as const }
    return mutate(repo => repo.recordCustomCakeAcceptance(data), '고객 동의가 기록되었습니다.')
  }
  const handleConfirmReservation = () => {
    if (!selected) return
    const data = { contractVersion: 'custom-cake.v1' as const, requestNumber: selected.requestNumber, expectedQuoteVersion: selected.quote.quoteVersion }
    return mutate(repo => repo.confirmCustomCakeRequest(data), '예약이 확정되었습니다.')
  }
  const handleCompleteRequest = () => {
    if (!selected || selected.status !== 'confirmed') return
    const data = { contractVersion: 'custom-cake.v1' as const, requestNumber: selected.requestNumber, expectedStatus: 'confirmed' as const, expectedQuoteVersion: selected.quote.quoteVersion }
    return mutate(repo => repo.completeCustomCakeRequest(data), '픽업 완료 처리되었습니다.')
  }
  const handleCancelRequest = () => {
    if (!selected || !['requested', 'quoted', 'confirmed'].includes(selected.status)) return
    if (!window.confirm('이 주문 접수를 취소하시겠습니까? 환불 또는 결제 취소는 처리되지 않습니다.')) return
    const data = { contractVersion: 'custom-cake.v1' as const, requestNumber: selected.requestNumber, expectedStatus: selected.status as 'requested' | 'quoted' | 'confirmed', expectedQuoteVersion: selected.quote.quoteVersion }
    return mutate(repo => repo.cancelCustomCakeRequest(data), '주문이 취소되었습니다.')
  }
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredRequests = normalizedSearch
    ? requests.filter(item => [item.requestNumber, item.customer.customerName, item.customer.customerPhone]
        .some(value => value.toLowerCase().includes(normalizedSearch)))
    : requests

  return (
    <div className="admin-custom-cakes-section">
      <div className="admin-page-header">
        <div>
          <h2>커스텀 케이크 접수 및 견적 관리</h2>
          <p className="admin-subtitle">
            custom-cake.v1 계약 기반 견적 산출, 추가비 협의, 고객 동의 및 예약 확정
          </p>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => void loadRequests()}
          disabled={loading || updatingQuote}
          aria-label="Refresh custom cake requests"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className="admin-filters-bar">
        <div className="search-input-wrap">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search custom cake requests"
            placeholder="접수번호, 신청자, 휴대폰 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="count-label">총 {filteredRequests.length}건</span>
      </div>
      {searchError && <p role="alert">{searchError}</p>}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>접수번호</th>
              <th>상태</th>
              <th>신청자</th>
              <th>픽업일</th>
              <th>구성</th>
              <th>견적 버전</th>
              <th>확정 여부</th>
              <th>고객 동의</th>
              <th>금액 (잠정/확정)</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-cell">
                  {loading ? '커스텀 케이크 주문을 불러오는 중입니다.' : '접수된 커스텀 케이크 주문이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredRequests.map((item) => {
                const statusInfo = getStatusInfo(item.status, 'ko')
                const cakeLine = item.lines.find((l) => l.kind === 'custom-cake')
                const isFinal = item.quote.isFinalQuote
                const hasAcceptance =
                  item.acceptance && item.acceptance.acceptedQuoteVersion === item.quote.quoteVersion

                return (
                  <tr key={item.requestNumber} onClick={() => openDrawer(item)} className="clickable-row">
                    <td>
                      <strong className="request-code">{item.requestNumber}</strong>
                    </td>
                    <td>
                      <span className={statusInfo.className}>{statusInfo.label}</span>
                    </td>
                    <td>
                      <strong>{item.customer.customerName}</strong>
                      <div className="sub-contact">{item.customer.customerPhone}</div>
                    </td>
                    <td>
                      {item.pickup.pickupDate} {item.pickup.pickupTime}
                    </td>
                    <td>
                      {cakeLine && cakeLine.kind === 'custom-cake'
                        ? `${cakeLine.tier === 'single' ? '1단' : '2단'} · ${cakeLine.size} (${cakeLine.quantity}개)`
                        : '-'}
                    </td>
                    <td>
                      <span className="version-pill">v{item.quote.quoteVersion}</span>
                    </td>
                    <td>
                      {isFinal ? (
                        <span className="badge-settled">Final</span>
                      ) : (
                        <span className="badge-provisional">Provisional</span>
                      )}
                    </td>
                    <td>
                      {hasAcceptance ? (
                        <span className="badge-agreed">
                          <Check size={12} /> v{item.acceptance?.acceptedQuoteVersion}
                        </span>
                      ) : (
                        <span className="badge-pending">대기</span>
                      )}
                    </td>
                    <td>
                      {isFinal && item.quote.finalTotalCents !== null ? (
                        <strong className="final-price">{formatCents(item.quote.finalTotalCents)}</strong>
                      ) : (
                        <span className="known-price">{formatCents(item.quote.knownTotalCents)} (잠정)</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="small-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDrawer(item)
                        }}
                      >
                        상세/견적
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail & Quote Mutation Drawer */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="admin-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="drawer-header">
              <div>
                <span className="kicker">Custom Cake v1</span>
                <h2>{selected.requestNumber}</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setSelected(null)}
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </header>

            <div className="drawer-content">
              {actionError && (
                <div className="error-banner" role="alert">
                  {actionError}
                </div>
              )}

              {/* Status banner */}
              <div className="drawer-status-bar">
                <span className={getStatusInfo(selected.status, 'ko').className}>
                  {getStatusInfo(selected.status, 'ko').label}
                </span>
                <span className="version-tag">Quote v{selected.quote.quoteVersion}</span>
                {selected.quote.isFinalQuote ? (
                  <span className="badge-settled">최종 금액 확정 (Final)</span>
                ) : (
                  <span className="badge-provisional">잠정 견적 (Provisional)</span>
                )}
              </div>

              {/* Customer & Pickup info */}
              <section className="drawer-section">
                <h3>주문자 및 픽업 정보</h3>
                <dl className="drawer-dl">
                  <div>
                    <dt>주문자</dt>
                    <dd>{selected.customer.customerName}</dd>
                  </div>
                  <div>
                    <dt>연락처</dt>
                    <dd>{selected.customer.customerPhone}</dd>
                  </div>
                  <div>
                    <dt>이메일</dt>
                    <dd>{selected.customer.customerEmail}</dd>
                  </div>
                  <div>
                    <dt>픽업 일정</dt>
                    <dd>
                      <strong>{selected.pickup.pickupDate}</strong> {selected.pickup.pickupTime}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Cake lines & Reference photos */}
              <section className="drawer-section">
                <h3>케이크 사양 및 디자인</h3>
                {selected.lines
                  .filter((l) => l.kind === 'custom-cake')
                  .map((cake, idx) => (
                    <div className="cake-spec-box" key={idx}>
                      <p>
                        <strong>구성:</strong> {cake.tier === 'single' ? 'Single Tier (1단)' : 'Double Tier (2단)'} ·{' '}
                        {cake.size} ({cake.quantity}개)
                      </p>
                      <p>
                        <strong>피규어:</strong>{' '}
                        {cake.figurineSource === 'none' && '피규어 없음'}
                        {cake.figurineSource === 'customer' && '고객 직접 전달 (구매비 없음)'}
                        {cake.figurineSource === 'shop' && '매장 준비 요청'}
                      </p>
                      {cake.designNote && (
                        <div className="design-note-display">
                          <strong>디자인 설명:</strong>
                          <p>{cake.designNote}</p>
                        </div>
                      )}
                      {cake.photoRefs && cake.photoRefs.length > 0 && (
                        <div className="photo-refs-display">
                          <strong>참고 사진 ({cake.photoRefs.length}개):</strong>
                          <div className="photo-refs-grid" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {cake.photoRefs.map((ref) => (
                              <CustomCakePhoto
                                key={`${selected.requestNumber}:${ref}`}
                                requestNumber={selected.requestNumber}
                                photoRef={ref}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </section>

              {/* Current Quote Breakdown */}
              <section className="drawer-section">
                <h3>현재 견적 스냅샷 (Quote v{selected.quote.quoteVersion})</h3>
                <div className="quote-breakdown-grid">
                  <div className="qb-item">
                    <span>기본 가격</span>
                    <strong>{formatCents(selected.quote.baseCents)}</strong>
                  </div>
                  {selected.quote.cakeDiscountCents > 0 && (
                    <div className="qb-item discount">
                      <span>커스텀 케이크 프로모션 할인</span>
                      <strong>-{formatCents(selected.quote.cakeDiscountCents)}</strong>
                    </div>
                  )}
                  <div className="qb-item">
                    <span>디자인 추가비</span>
                    <strong>{formatExtraCents(selected.quote.designExtraCents, 'ko')}</strong>
                  </div>
                  <div className="qb-item">
                    <span>피규어 추가비</span>
                    <strong>{formatExtraCents(selected.quote.figurineExtraCents, 'ko')}</strong>
                  </div>
                  <div className="qb-item">
                    <span>유료 스모어</span>
                    <strong>
                      {selected.quote.paidSmoreQuantity}개 ({formatCents(selected.quote.paidSmoreTotalCents)})
                    </strong>
                  </div>
                  <div className="qb-item total">
                    <span>잠정 확인 총액</span>
                    <strong>{formatCents(selected.quote.knownTotalCents)}</strong>
                  </div>
                  <div className="qb-item final">
                    <span>최종 확정 총액</span>
                    <strong>
                      {selected.quote.isFinalQuote && selected.quote.finalTotalCents !== null
                        ? formatCents(selected.quote.finalTotalCents)
                        : '미확정 (To be confirmed)'}
                    </strong>
                  </div>
                </div>
              </section>

              {/* Quote Mutation Form */}
              <section className="drawer-section edit-section">
                <h3>견적 및 추가비 수정 (Update Quote)</h3>
                <p className="admin-hint">
                  `expectedQuoteVersion` ({selected.quote.quoteVersion})을 검증하여 안전하게 수정합니다.
                  디자인과 피규어 추가비가 모두 입력되면 최종 견적(Final Quote)으로 전환됩니다.
                </p>

                <form onSubmit={handleUpdateQuote} className="admin-quote-form">
                  <div className="admin-form-row">
                    <label>
                      디자인 추가비 (AUD)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="미정 시 비워둠, 없으면 0"
                        value={designExtraInput}
                        onChange={(e) => setDesignExtraInput(e.target.value)}
                        disabled={selected.status === 'confirmed' || selected.status === 'completed'}
                      />
                      <small>비워두면 null(협의 중), 0이면 추가금 없음 확정</small>
                    </label>

                    <label>
                      피규어 추가비 (AUD)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="미정 시 비워둠, 없으면 0"
                        value={figurineExtraInput}
                        onChange={(e) => setFigurineExtraInput(e.target.value)}
                        disabled={selected.status === 'confirmed' || selected.status === 'completed'}
                      />
                      <small>비워두면 null(협의 중), 0이면 추가금 없음 확정</small>
                    </label>
                  </div>

                  <label className="full-width-label">
                    추가비 산출 사유 및 설명
                    <input
                      type="text"
                      placeholder="예: 입체 꽃 파이핑 추가 $20, 피규어 2종 구매 실비 $15"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      disabled={selected.status === 'confirmed' || selected.status === 'completed'}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      updatingQuote ||
                      selected.status === 'confirmed' ||
                      selected.status === 'completed' ||
                      selected.status === 'cancelled'
                    }
                  >
                    {updatingQuote ? '견적 수정 중...' : `Quote v${selected.quote.quoteVersion + 1}로 갱신하기`}
                  </button>
                </form>
              </section>

              {/* Customer Agreement & Confirm Section */}
              <section className="drawer-section actions-section">
                <h3>고객 동의 및 예약 확정</h3>

                {/* Consent Status */}
                <div className="agreement-status-card">
                  <h4>고객 견적 동의 상태</h4>
                  {selected.acceptance ? (
                    <div className="agreed-info">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>v{selected.acceptance.acceptedQuoteVersion} 동의 완료</strong>
                        <p>동의 일시: {new Date(selected.acceptance.acceptedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pending-info">
                      <Clock size={18} />
                      <span>고객 동의 내역 없음</span>
                    </div>
                  )}

                  {selected.status === 'quoted' && selected.quote.isFinalQuote && (
                    <button
                      type="button"
                      className="secondary-button record-btn"
                      onClick={handleRecordAcceptance}
                      disabled={
                        updatingQuote ||
                        (selected.acceptance?.acceptedQuoteVersion === selected.quote.quoteVersion)
                      }
                    >
                      <Check size={16} />
                      <span>
                        {selected.acceptance?.acceptedQuoteVersion === selected.quote.quoteVersion
                          ? '현재 버전에 이미 동의됨'
                          : `고객 동의 기록하기 (Quote v${selected.quote.quoteVersion})`}
                      </span>
                    </button>
                  )}
                </div>

                {/* Final Confirmation Gate */}
                <div className="confirmation-card">
                  <h4>최종 예약 확정 (Confirm Reservation)</h4>
                  <p>
                    조건: 상태 <code>quoted</code> + 최종 견적 <code>isFinalQuote=true</code> + 고객 동의 일치{' '}
                    <code>v{selected.quote.quoteVersion}</code>
                  </p>

                  <button
                    type="button"
                    className="primary-button confirm-btn"
                    onClick={handleConfirmReservation}
                    disabled={
                      updatingQuote ||
                      selected.status !== 'quoted' ||
                      !selected.quote.isFinalQuote ||
                      selected.acceptance?.acceptedQuoteVersion !== selected.quote.quoteVersion
                    }
                  >
                    <ShieldCheck size={18} />
                    <span>예약 최종 확정하기</span>
                  </button>
                </div>

                {/* Complete Order Action (confirmed -> completed) */}
                {selected.status === 'confirmed' && (
                  <div
                    className="confirmation-card complete-card"
                    style={{
                      marginTop: '16px',
                      background: '#f4fbf7',
                      border: '1px solid #b7eb8f',
                      padding: '16px',
                      borderRadius: '8px',
                    }}
                  >
                    <h4>제작 및 픽업 완료 처리 (Complete)</h4>
                    <p style={{ fontSize: '0.85rem', color: '#555', margin: '4px 0 12px' }}>
                      고객이 케이크를 수령한 후 완료 상태로 전환합니다. (픽업 완료 처리이며 결제/환불과는 무관합니다.)
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ background: '#237804', borderColor: '#237804', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleCompleteRequest}
                      disabled={updatingQuote}
                    >
                      <CheckCircle2 size={16} />
                      <span>제작 및 픽업 완료 처리</span>
                    </button>
                  </div>
                )}

                {/* Cancel Request Action (requested | quoted | confirmed -> cancelled) */}
                {(selected.status === 'requested' || selected.status === 'quoted' || selected.status === 'confirmed') && (
                  <div
                    className="cancellation-card"
                    style={{
                      marginTop: '16px',
                      background: '#fff1f0',
                      border: '1px solid #ffa39e',
                      padding: '16px',
                      borderRadius: '8px',
                    }}
                  >
                    <h4 style={{ color: '#cf1322' }}>주문 접수 취소 (Cancel Request)</h4>
                    <p style={{ fontSize: '0.85rem', color: '#555', margin: '4px 0 12px' }}>
                      주문 취소 시 상태만 취소로 변경되며, 환불 또는 결제 취소와는 무관합니다.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ color: '#cf1322', borderColor: '#ffa39e' }}
                      onClick={handleCancelRequest}
                      disabled={updatingQuote}
                    >
                      <span>주문 접수 취소하기</span>
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
