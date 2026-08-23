const LEGACY_AU_DAILY_LIMIT_TEXT = 'Small-batch cakes, limited daily availability'
const AU_COUVERTURE_DAILY_LIMIT_TEXT = 'Made to order with chocolatier-grade couverture chocolate'

export function normalizeAuDailyLimitText(value: string) {
  return value === LEGACY_AU_DAILY_LIMIT_TEXT ? AU_COUVERTURE_DAILY_LIMIT_TEXT : value
}
