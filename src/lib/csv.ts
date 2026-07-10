const FORMULA_PREFIX = /^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/

export function sanitizeCsvCell(value: string) {
  const text = String(value ?? '')
  let firstVisibleIndex = 0
  while (firstVisibleIndex < text.length && text.charCodeAt(firstVisibleIndex) <= 0x20) {
    firstVisibleIndex += 1
  }
  const withoutLeadingControlCharacters = text.slice(firstVisibleIndex).trimStart()
  return FORMULA_PREFIX.test(withoutLeadingControlCharacters) ? `'${text}` : text
}

export function escapeCsvCell(value: string) {
  return `"${sanitizeCsvCell(value).replaceAll('"', '""')}"`
}
