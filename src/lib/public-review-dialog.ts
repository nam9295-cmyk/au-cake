const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

export function reviewDialogHref(pathname: string, search: string, reviewId: string) {
  if (!OPAQUE_ID_PATTERN.test(reviewId)) throw new Error('INVALID_PUBLIC_REVIEW_ID')
  return `${pathname}${search}#review=${encodeURIComponent(reviewId)}`
}

export function reviewIdFromHash(hash: string) {
  if (!hash.startsWith('#review=')) return null
  let reviewId: string
  try {
    reviewId = decodeURIComponent(hash.slice('#review='.length))
  } catch {
    return null
  }
  return OPAQUE_ID_PATTERN.test(reviewId) ? reviewId : null
}

export function adjacentReviewId(ids: readonly string[], currentId: string, direction: -1 | 1) {
  const index = ids.indexOf(currentId)
  if (index < 0) return null
  return ids[index + direction] || null
}
