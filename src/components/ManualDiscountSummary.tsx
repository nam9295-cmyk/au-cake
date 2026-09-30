import type { CustomCakeQuote } from '../lib/custom-cake-contract'
import { formatQuoteCents, manualDiscountLabel } from '../lib/custom-cake-ui'

export function ManualDiscountSummary({ quote }: { quote: CustomCakeQuote }) {
  const discount = quote.manualDiscount
  if (!discount) return null
  return <div className="manual-discount-summary">
    <dl>
      <div className="quote-row"><dt>Subtotal before discount</dt><dd>{formatQuoteCents(quote, discount.basisCents)}</dd></div>
      <div className="quote-row discount"><dt>{manualDiscountLabel(quote)}</dt><dd>−{formatQuoteCents(quote, discount.discountCents)}</dd></div>
      <div className="quote-row"><dt>Discount reason</dt><dd className="note-body">{discount.reason}</dd></div>
      <div className="quote-row final"><dt>Final quote</dt><dd><strong>{formatQuoteCents(quote, quote.finalTotalCents)}</strong></dd></div>
    </dl>
  </div>
}
