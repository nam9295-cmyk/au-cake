import mediaContract from '../../content/hogirl/media-contract.json' with { type: 'json' }

export const HOGIRL_MEDIA_ORIGIN_ENV = mediaContract.mediaOriginEnvironmentVariable
export const HOGIRL_RESPONSIVE_WIDTHS = mediaContract.responsiveWidths

export function resolveHogirlMediaOrigin(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    return url.href.replace(/\/$/, '')
  } catch {
    return null
  }
}

export function getHogirlMediaOriginFromEnvironment(environment) {
  return resolveHogirlMediaOrigin(environment[HOGIRL_MEDIA_ORIGIN_ENV])
}

export function getHogirlResponsiveWidths(sourceWidth) {
  if (!Number.isSafeInteger(sourceWidth) || sourceWidth <= 0) return []
  return HOGIRL_RESPONSIVE_WIDTHS.filter((width) => width <= sourceWidth)
}

export function getHogirlMediaUrl({ mediaOrigin, key, width, format }) {
  const origin = resolveHogirlMediaOrigin(mediaOrigin)
  if (!origin) throw new Error(`HOGIRL media origin must use ${HOGIRL_MEDIA_ORIGIN_ENV}`)
  if (width !== undefined && !HOGIRL_RESPONSIVE_WIDTHS.includes(width)) {
    throw new Error(`HOGIRL media width ${width} is not a guaranteed derivative`)
  }
  const suffix = width === undefined ? '' : `-${width}`
  return `${origin}/${key}${suffix}.${format}`
}
