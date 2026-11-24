import { nutrition } from 'data-platform'
import { useEffect, useState } from 'preact/hooks'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import ChevronLeft from '~icons/material-symbols/chevron-left'
import ChevronRight from '~icons/material-symbols/chevron-right'
import { dayEnd, dayOf, dayStart, nextDay, previousDay, type Day } from '../day.ts'
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

const MEAL_TYPE_LABELS: Record<nutrition.MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/** One Day's Log Entries against the Member's Targets; today by default, stepping to earlier Days. */
export function DayScreen({ log, now, onOpenEntry }: DayScreenProps) {
  const today = dayOf(now)
  const [viewed, setViewed] = useState<Day>(today)
  const [entries, setEntries] = useState<readonly LogEntry[]>([])
  useEffect(() => {
    setEntries([])
    return log.watchDay(dayStart(viewed), dayEnd(viewed), setEntries)
  }, [log, viewed])
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
      {entries.length === 0 ? (
        <p>Nothing logged this day.</p>
      ) : (
        nutrition.MEAL_TYPES.map((mealType) => {
          const group = entries.filter((entry) => entry.mealType === mealType)
          if (group.length === 0) return null
          return (
            <section key={mealType} role="group" aria-labelledby={`meal-${mealType}`}>
              <h3 id={`meal-${mealType}`}>{MEAL_TYPE_LABELS[mealType]}</h3>
              <ul class="entry-list">
                {group.map((entry) => (
                  <ListRow
                    key={entry.id}
                    headline={entry.name}
                    supporting={`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'} · ${entry.nutrition.kcal} kcal`}
                    onActivate={() => onOpenEntry(entry)}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </section>
  )
}
