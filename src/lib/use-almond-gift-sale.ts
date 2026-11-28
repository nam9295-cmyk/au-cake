import { useEffect, useState } from 'react'
import { ALMOND_SALE_END, ALMOND_SALE_START, isAlmondGiftSaleActive } from '../../appwrite-functions/reservation-api/src/au-renewal.js'

const boundaries = [Date.parse(ALMOND_SALE_START), Date.parse(ALMOND_SALE_END)]

export function useAlmondGiftSale(offsetMs = 0) {
  const [active, setActive] = useState(() => isAlmondGiftSaleActive(new Date(Date.now() + offsetMs)))
  useEffect(() => {
    let timer: number | undefined
    function sync() {
      window.clearTimeout(timer)
      const now = new Date(Date.now() + offsetMs)
      setActive(isAlmondGiftSaleActive(now))
      const next = boundaries.find(time => time > now.getTime())
      if (next !== undefined) timer = window.setTimeout(sync, Math.min(next - now.getTime(), 2147483647))
    }
    sync()
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pageshow', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [offsetMs])
  return active
}
