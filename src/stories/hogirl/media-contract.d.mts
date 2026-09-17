export const HOGIRL_MEDIA_ORIGIN_ENV: string
export const HOGIRL_RESPONSIVE_WIDTHS: readonly number[]
export function resolveHogirlMediaOrigin(value: unknown): string | null
export function getHogirlMediaOriginFromEnvironment(environment: Record<string, unknown>): string | null
export function getHogirlResponsiveWidths(sourceWidth: number): number[]
export function getHogirlMediaUrl(input: {
  mediaOrigin: string
  key: string
  width?: number
  format: 'avif' | 'webp'
}): string
