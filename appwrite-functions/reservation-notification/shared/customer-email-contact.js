// Public AU customer-support contact approved by the store owner.
export const AU_CUSTOMER_EMAIL_CONTACT = Object.freeze({
  name: 'Jenny',
  local: '0421 567 776',
  international: '+61 421 567 776',
  instagram: 'verygood_syd',
  telephoneUri: 'tel:+61421567776',
})

function customerEmailContactNotice(language) {
  return language === 'ko'
    ? '본 메일은 발송 전용으로 회신을 확인하지 않습니다. 변경사항이나 문의는 아래 연락처 또는 인스타그램으로 부탁드립니다.'
    : 'This is a send-only email address; replies are not monitored. For changes or enquiries, please use the phone number or Instagram below.'
}

export function customerEmailContactText(language = 'en') {
  const korean = language === 'ko'
  return [
    customerEmailContactNotice(language),
    `${korean ? '문의' : 'Contact'}: ${AU_CUSTOMER_EMAIL_CONTACT.name} · ${korean ? AU_CUSTOMER_EMAIL_CONTACT.local : AU_CUSTOMER_EMAIL_CONTACT.international}`,
    `${korean ? '인스타그램' : 'Instagram'}: @${AU_CUSTOMER_EMAIL_CONTACT.instagram}`,
  ].join('\n')
}

export function customerEmailContactHtml(language = 'en') {
  const korean = language === 'ko'
  const phone = korean ? AU_CUSTOMER_EMAIL_CONTACT.local : AU_CUSTOMER_EMAIL_CONTACT.international
  return `<p style="margin:12px 0 0;">${customerEmailContactNotice(language)}<br>${korean ? '문의' : 'Contact'}: ${AU_CUSTOMER_EMAIL_CONTACT.name} · <a href="${AU_CUSTOMER_EMAIL_CONTACT.telephoneUri}">${phone}</a><br>${korean ? '인스타그램' : 'Instagram'}: <a href="https://www.instagram.com/${AU_CUSTOMER_EMAIL_CONTACT.instagram}/">@${AU_CUSTOMER_EMAIL_CONTACT.instagram}</a></p>`
}
