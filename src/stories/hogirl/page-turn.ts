type HogirlPageTurnInput = {
  current: number
  total: number
  distancePx: number
  widthPx: number
  elapsedMs: number
}

const DISTANCE_THRESHOLD = 0.18
const VELOCITY_THRESHOLD = 0.45

export function resolveHogirlPageTurn({
  current,
  total,
  distancePx,
  widthPx,
  elapsedMs,
}: HogirlPageTurnInput) {
  if (total < 1 || widthPx <= 0 || distancePx === 0) return current
  const distanceRatio = Math.abs(distancePx) / widthPx
  const velocity = Math.abs(distancePx) / Math.max(elapsedMs, 1)
  if (distanceRatio < DISTANCE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return current

  const direction = distancePx < 0 ? 1 : -1
  return Math.min(total, Math.max(1, current + direction))
}
