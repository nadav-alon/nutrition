import { nutrition } from 'data-platform'
import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import ChevronLeft from '~icons/material-symbols/chevron-left'
import ChevronRight from '~icons/material-symbols/chevron-right'
import { dayEnd, dayOf, dayStart, nextDay, previousDay, type Day } from '../day.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import type { Targets, TargetsPort } from '../targets/targets-port.ts'

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

interface Bar {
  label: string
  unit: string
  eaten: number
  target: number | undefined
}

function MacroBar({ label, unit, eaten, target }: Bar) {
  const over = target !== undefined && eaten > target
  const text =
    target === undefined
      ? `${eaten} ${unit} eaten`
      : over
        ? `${eaten} ${unit} eaten · ${eaten - target} ${unit} over`
        : `${eaten} ${unit} eaten · ${target - eaten} ${unit} left`
  return (
    <div
      class={over ? 'macro-bar over' : 'macro-bar'}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuenow={eaten}
      aria-valuemax={target}
    >
      <span>{text}</span>
      {target === undefined ? null : (
        <progress aria-hidden="true" max={target} value={Math.min(eaten, target)} />
      )}
    </div>
  )
}

/** One Day's Log Entries against the Member's Targets; today by default, stepping to earlier Days. */
export function DayScreen({ log, targets, now, onOpenEntry, onLog }: DayScreenProps) {
  const today = dayOf(now)
  const [viewed, setViewed] = useState<Day>(today)
  const [entries, setEntries] = useState<readonly LogEntry[]>([])
  const [memberTargets, setMemberTargets] = useState<Targets | null>(null)
  const [targetsFailed, setTargetsFailed] = useState(false)
  useEffect(() => {
    return targets.subscribe(setMemberTargets, () => setTargetsFailed(true))
  }, [targets])
  const total = (pick: (n: nutrition.Nutrition) => number) =>
    entries.reduce((sum, entry) => sum + pick(entry.nutrition), 0)
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
      {targetsFailed ? <p>Targets unavailable.</p> : null}
      <div class="macro-bars">
        <MacroBar label="Calories" unit="kcal" eaten={total((n) => n.kcal)} target={memberTargets?.kcal} />
        <MacroBar label="Protein" unit="g" eaten={total((n) => n.proteinG)} target={memberTargets?.proteinG} />
        <MacroBar label="Carbs" unit="g" eaten={total((n) => n.carbsG)} target={memberTargets?.carbsG} />
        <MacroBar label="Fat" unit="g" eaten={total((n) => n.fatG)} target={memberTargets?.fatG} />
      </div>
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
      <Button variant="filled" onClick={() => onLog(viewed)}>
        Log
      </Button>
    </section>
  )
}
