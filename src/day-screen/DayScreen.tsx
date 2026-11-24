import { useState } from 'preact/hooks'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import ChevronLeft from '~icons/material-symbols/chevron-left'
import ChevronRight from '~icons/material-symbols/chevron-right'
import { dayOf, nextDay, previousDay, type Day } from '../day.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import type { TargetsPort } from '../targets/targets-port.ts'

export interface DayScreenProps {
  log: LogStore
  targets: TargetsPort
  /** The current instant; decides which Day is today. */
  now: Date
  /** Called with the tapped entry. */
  onOpenEntry: (entry: LogEntry) => void
  /** Called with the viewed Day when the Member asks to log on it. */
  onLog: (day: Day) => void
}

/** One Day's Log Entries against the Member's Targets; today by default, stepping to earlier Days. */
export function DayScreen({ now }: DayScreenProps) {
  const today = dayOf(now)
  const [viewed, setViewed] = useState<Day>(today)
  return (
    <section class="screen day-screen">
      <header class="day-nav">
        <IconButton symbol={ChevronLeft} label="Previous day" onClick={() => setViewed(previousDay(viewed))} />
        <h2>{viewed === today ? 'Today' : viewed}</h2>
        <IconButton
          symbol={ChevronRight}
          label="Next day"
          disabled={viewed === today}
          onClick={() => setViewed(nextDay(viewed, now))}
        />
      </header>
    </section>
  )
}
