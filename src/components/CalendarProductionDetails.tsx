import type { CalendarProductionDetail } from '../lib/calendar-production'
const figurines = { none: 'No Figurine', customer: 'Customer Provided', shop: 'Shop Sourced' }
export function CalendarProductionDetails({ detail, onClose }: { detail: CalendarProductionDetail; onClose: () => void }) {
  return <section className="calendar-production-detail" aria-label="Production details">
    <header><h2>Production details</h2><button type="button" onClick={onClose}>Close details</button></header>
    <dl className="calendar-production-fields">
      <div><dt>Pickup Date</dt><dd>{detail.pickupDate}</dd></div>
      <div><dt>Pickup Time</dt><dd>{detail.pickupTime}</dd></div>
      <div><dt>Status</dt><dd>{detail.status}</dd></div>
    </dl>
    {detail.lines.map((line, index) => <section key={index} aria-label={`Cake ${index + 1}`}>
      {detail.lines.length > 1 && <h3>Cake {index + 1}</h3>}
      <dl className="calendar-production-fields">
        <div><dt>Tier</dt><dd>{line.tier === 'single' ? 'Single' : 'Double'}</dd></div>
        <div><dt>Size</dt><dd>{line.size}</dd></div>
        <div><dt>Quantity</dt><dd>{line.quantity}</dd></div>
        <div><dt>Flavour</dt><dd>{line.flavour || 'Not specified'}</dd></div>
        <div><dt>Figurine</dt><dd>{figurines[line.figurineSource]}</dd></div>
      </dl>
      <dl className="calendar-production-notes"><div><dt>Design Request</dt><dd>{line.designRequest || 'Not specified'}</dd></div></dl>
    </section>)}
    <dl className="calendar-production-notes"><div><dt>Additional Request</dt><dd>{detail.additionalRequest || 'Not specified'}</dd></div></dl>
  </section>
}
