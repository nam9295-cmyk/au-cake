import type { StoreSettings } from '../lib/types'
import { BankAccountBox } from './BankAccountBox'

type Props = {
  settings: StoreSettings
  language: 'en' | 'ko'
  customerName?: string
  // Kept for existing receipt callers; payment references use the customer's name.
  reservationNumber?: string
}

export function RenewalPaymentNotice({ settings, language, customerName }: Props) {
  const korean = language === 'ko'
  const hasBankAccount = [settings.bankName, settings.bankAccount, settings.accountHolder]
    .every(value => typeof value === 'string' && value.trim().length > 0)
  const reference = customerName?.trim() || (korean ? '예약자 이름' : 'name on the booking')

  return (
    <section className="renewal-payment-notice" aria-label={korean ? '결제 및 예약 확정 안내' : 'Payment and booking confirmation'}>
      <p>
        <strong>{korean ? '지금은 결제되지 않습니다.' : 'No payment is taken now.'}</strong>{' '}
        {korean
          ? '주문 접수 이메일에서 결제 안내를 확인해 주세요.'
          : 'Check your order-received email for payment instructions.'}
      </p>
      <p>
        {korean
          ? '이메일 안내에 따라 PayID 또는 계좌이체 중 한 가지 방법으로 한 번만 입금해 주세요. 이미 입금하셨다면 다시 보내지 않으셔도 됩니다.'
          : 'Pay once using either PayID or bank transfer, following the email instructions. If you have already paid, please do not pay again.'}
      </p>
      <p>
        {korean
          ? '담당자가 입금을 직접 확인한 뒤 최종 결제·예약 확정 이메일을 보내드립니다.'
          : 'We will manually check your payment, then send your final payment and booking confirmation email.'}
      </p>
      <p><strong>PayID: 0421 567 776</strong></p>
      {hasBankAccount && <BankAccountBox settings={settings} language={language} />}
      <p className="renewal-transfer-reference">
        <strong>{korean ? '입금자명' : 'Transfer reference'}: {reference}</strong>
        <span>{korean
          ? '입금 시 예약자 이름을 적어 주세요.'
          : 'Use the name on the booking as your transfer reference.'}</span>
      </p>
    </section>
  )
}
