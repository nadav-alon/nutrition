import { useEffect, useState } from 'preact/hooks'
import { dayEnd, dayOf, type Day } from './day.ts'

/**
 * The current instant, taken afresh on every render, and the local Day it falls on, which also
 * re-renders when that Day rolls over: at midnight while the page stays open, and on returning
 * to a page whose timer was suspended past it.
 */
export function useNow(): { now: Date; today: Day } {
  const now = new Date()
  const today = dayOf(now)
  const [, setTick] = useState(0)
  useEffect(() => {
    // Re-render on every firing, so the effect re-arms even when the timer fired early (the wall
    // clock moved under it) and the Day is still the old one.
    const sync = () => setTick((tick) => tick + 1)
    const timer = setTimeout(sync, dayEnd(today).getTime() - now.getTime())
    document.addEventListener('visibilitychange', sync)
    addEventListener('focus', sync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
      removeEventListener('focus', sync)
    }
  })
  return { now, today }
}
