// Public AU customer-support contact approved by the store owner.
export const AU_CUSTOMER_EMAIL_CONTACT = Object.freeze({
  name: 'Jenny',
  local: '0421 567 776',
  international: '+61 421 567 776',
  telephoneUri: 'tel:+61421567776',
})

export function customerEmailContactText(language = 'en') {
  const korean = language === 'ko'
  return `${korean ? '문의' : 'Contact'}: ${AU_CUSTOMER_EMAIL_CONTACT.name} · ${korean ? AU_CUSTOMER_EMAIL_CONTACT.local : AU_CUSTOMER_EMAIL_CONTACT.international}`
}

export function customerEmailContactHtml(language = 'en') {
  const korean = language === 'ko'
  const phone = korean ? AU_CUSTOMER_EMAIL_CONTACT.local : AU_CUSTOMER_EMAIL_CONTACT.international
  return `<p style="margin:12px 0 0;">${korean ? '문의' : 'Contact'}: ${AU_CUSTOMER_EMAIL_CONTACT.name} · <a href="${AU_CUSTOMER_EMAIL_CONTACT.telephoneUri}">${phone}</a></p>`
}
