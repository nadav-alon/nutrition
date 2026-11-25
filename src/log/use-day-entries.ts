import { useEffect, useState } from 'preact/hooks'
import { dayEnd, dayStart, type Day } from '../day.ts'
import type { LogEntry, LogStore } from './log-store.ts'

/** What watching a Day's Log Entries has delivered so far. */
export type DayEntries =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; entries: readonly LogEntry[] }

/** The Log Entries on `day`, kept live. Another Day's snapshot counts as still loading. */
export function useDayEntries(log: LogStore, day: Day): DayEntries {
  const [loaded, setLoaded] = useState<{ day: Day; result: DayEntries } | null>(null)
  useEffect(() => {
    return log.watchDay(
      dayStart(day),
      dayEnd(day),
      (entries) => setLoaded({ day, result: { status: 'loaded', entries } }),
      () => setLoaded({ day, result: { status: 'error' } }),
    )
  }, [log, day])
  return loaded?.day === day ? loaded.result : { status: 'loading' }
}
