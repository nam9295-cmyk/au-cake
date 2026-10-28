import { useEffect, useState } from 'react'
import { HALLOWEEN_ORDER_DEADLINE, halloweenMeringueAvailable } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'

/** Close an already-open tab at the deadline, and recheck after sleep/refocus. */
export function useHalloweenAvailability() {
  const [available, setAvailable] = useState(() => halloweenMeringueAvailable())
  useEffect(() => {
    const refresh = () => setAvailable(halloweenMeringueAvailable())
    const remaining = Date.parse(HALLOWEEN_ORDER_DEADLINE) - Date.now() + 1
    const timer = window.setTimeout(refresh, Math.max(0, Math.min(remaining, 2_147_483_647)))
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return available
}
