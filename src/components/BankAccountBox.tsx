import { useState } from 'react'
import { Copy } from 'lucide-react'
import { cakeCopy, type Language } from '../lib/i18n'
import type { StoreSettings } from '../lib/types'
import { formatCurrency } from '../lib/utils'

export function BankAccountBox({ settings, totalPrice, language = 'en' }: { settings: StoreSettings; totalPrice?: number; language?: Language }) {
  const copy = cakeCopy(language)
  const bankName = settings.bankName
  const bankAccount = settings.bankAccount
  const accountHolder = settings.accountHolder
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`${bankName} ${bankAccount}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bank-account-card">
      <div className="bank-account-header">
        <span className="bank-label">{copy.paymentLabel}</span>
      </div>
      <div className="bank-account-body">
        <div className="bank-info">
          <strong className="bank-number">
            {bankName} {bankAccount}
          </strong>
          <span className="bank-holder">
            {copy.accountHolderLabel}: {accountHolder}
          </span>
          {totalPrice !== undefined && (
            <span className="bank-total-price" style={{ marginTop: '4px', fontSize: '15px' }}>
              {copy.paymentAmountLabel}:{' '}
              <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(totalPrice)}</strong>
            </span>
          )}
        </div>
        <button type="button" className="copy-button" onClick={handleCopy}>
          <Copy size={16} />
          {copied ? copy.copiedButton : copy.copyButton}
        </button>
      </div>
    </div>
  )
}
