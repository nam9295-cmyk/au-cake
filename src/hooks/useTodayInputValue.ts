import { useEffect, useState } from 'react'
import { todayInputValue } from '../lib/utils'

export function useTodayInputValue() {
  const [today, setToday] = useState(() => todayInputValue())

  useEffect(() => {
    const refreshToday = () => setToday(todayInputValue())
    refreshToday()

    const interval = window.setInterval(refreshToday, 60_000)
    window.addEventListener('focus', refreshToday)
    document.addEventListener('visibilitychange', refreshToday)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshToday)
      document.removeEventListener('visibilitychange', refreshToday)
    }
  }, [])

  return today
}
