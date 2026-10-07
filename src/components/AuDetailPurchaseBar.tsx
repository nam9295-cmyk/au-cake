// Presentation only: callers supply their existing total and purchase handlers.
export function AuDetailPurchaseBar({ total, quantity, added, onAdd, onViewOrder }: {
  total: string; quantity: number; added: boolean; onAdd: () => void; onViewOrder: () => void
}) {
  return <aside className="au-pave-sticky-order" aria-label="Quick order">
    <div aria-live="polite"><strong>{total}</strong><span>Quantity · {quantity}</span></div>
    <button type="button" className="au-pave-order-button" onClick={onAdd}>ADD TO ORDER</button>
    {added && <button type="button" className="au-pave-view-order" onClick={onViewOrder}>View order</button>}
  </aside>
}
