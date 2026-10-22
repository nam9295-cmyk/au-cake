import type { StoreSettings } from '../lib/types'
import { BankAccountBox } from './BankAccountBox'

export function RenewalPaymentNotice({ settings, language, reservationNumber }: { settings: StoreSettings; language: 'en' | 'ko'; reservationNumber?: string }) {
  const korean = language === 'ko'
  const hasBankAccount = [settings.bankName, settings.bankAccount, settings.accountHolder]
    .every(value => typeof value === 'string' && value.trim().length > 0)
  const reference = reservationNumber?.trim()

  return (
    <section className="renewal-payment-notice" aria-label={korean ? '결제 및 예약 확정 안내' : 'Payment and booking confirmation'}>
      <p>
        <strong>{korean ? '지금은 결제되지 않습니다.' : 'No payment is taken now.'}</strong>{' '}
        {korean
          ? '예약 가능 여부를 확인한 뒤 결제 방법을 안내해 드립니다.'
          : 'We’ll check availability and send payment instructions.'}
      </p>
      <p>
        {korean
          ? '안내를 받으신 후 입금해 주세요. 입금 확인 후 예약이 확정됩니다.'
          : 'Please wait for our instructions before transferring. Your booking is confirmed once payment is received.'}
      </p>
      {hasBankAccount && <BankAccountBox settings={settings} language={language} />}
      {reference && (
        <p className="renewal-transfer-reference">
          <strong>{korean ? '입금 참조 번호' : 'Transfer reference'}: {reference}</strong>
          <span>{korean
            ? '결제 안내를 받으신 후 입금하실 때 이 예약번호를 함께 적어 주세요.'
            : 'After receiving payment instructions, include this booking number with your transfer.'}</span>
        </p>
      )}
    </section>
  )
}
