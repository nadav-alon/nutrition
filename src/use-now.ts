import { useEffect, useState } from 'preact/hooks'
import { dayEnd, dayOf } from './day.ts'

/**
 * The current instant, taken afresh on every render, which also re-renders when the local Day
 * rolls over: at midnight while the page stays open, and on returning to a page whose timer was
 * suspended past it.
 */
export function useNow(): Date {
  const [today, setToday] = useState(() => dayOf(new Date()))
  useEffect(() => {
    const sync = () => setToday(dayOf(new Date()))
    const now = new Date()
    const timer = setTimeout(sync, dayEnd(dayOf(now)).getTime() - now.getTime())
    document.addEventListener('visibilitychange', sync)
    addEventListener('focus', sync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
      removeEventListener('focus', sync)
    }
  }, [today])
  return new Date()
}
