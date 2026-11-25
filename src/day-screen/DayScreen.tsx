import { nutrition } from 'data-platform'
import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import ChevronLeft from '~icons/material-symbols/chevron-left'
import ChevronRight from '~icons/material-symbols/chevron-right'
import { dayOf, nextDay, previousDay, type Day } from '../day.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import { useDayEntries } from '../log/use-day-entries.ts'
import type { Targets, TargetsPort } from '../targets/targets-port.ts'

export interface DayScreenProps {
  log: LogStore
  targets: TargetsPort
  /** The current instant; decides which Day is today. */
  now: Date
  /** The Day being viewed. */
  day: Day
  /** Called with the Day the Member steps to. */
  onDayChange: (day: Day) => void
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

type MacroKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'

const MACROS: readonly { key: MacroKey; label: string; unit: 'kcal' | 'g' }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
]

/** Display rounding: one decimal, so summed floats never print as `30.000000000000004`. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

interface MacroBarProps {
  macro: (typeof MACROS)[number]
  eaten: number
  target: number | undefined
}

function MacroBar({ macro: { label, unit }, eaten: rawEaten, target }: MacroBarProps) {
  const eaten = round(rawEaten)
  const over = target !== undefined && eaten > target
  const text =
    target === undefined
      ? `${eaten} ${unit} eaten`
      : over
        ? `${eaten} ${unit} eaten · ${round(eaten - target)} ${unit} over`
        : `${eaten} ${unit} eaten · ${round(target - eaten)} ${unit} left`
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
      {target === undefined || target <= 0 ? null : (
        <progress aria-hidden="true" max={target} value={Math.min(eaten, target)} />
      )}
    </div>
  )
}

/** One Day's Log Entries against the Member's Targets; stepping to earlier Days. */
export function DayScreen({ log, targets, now, day: viewed, onDayChange, onOpenEntry, onLog }: DayScreenProps) {
  const today = dayOf(now)
  const dayEntries = useDayEntries(log, viewed)
  const [memberTargets, setMemberTargets] = useState<Targets | null>(null)
  const [targetsFailed, setTargetsFailed] = useState(false)
  useEffect(() => {
    return targets.subscribe(setMemberTargets, () => setTargetsFailed(true))
  }, [targets])
  const entries = dayEntries.status === 'loaded' ? dayEntries.entries : null
  const total = (key: MacroKey) => (entries ?? []).reduce((sum, entry) => sum + entry.nutrition[key], 0)
  return (
    <section class="screen day-screen">
      <header class="day-nav">
        <IconButton symbol={ChevronLeft} label="Previous day" onClick={() => onDayChange(previousDay(viewed))} />
        <h2>{viewed === today ? 'Today' : viewed}</h2>
        <IconButton
          symbol={ChevronRight}
          label="Next day"
          disabled={viewed === today}
          onClick={() => onDayChange(nextDay(viewed, now))}
        />
      </header>
      {targetsFailed ? <p>Targets unavailable.</p> : null}
      {dayEntries.status === 'error' ? (
        <p>Log unavailable.</p>
      ) : entries === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <div class="macro-bars">
            {MACROS.map((macro) => (
              <MacroBar key={macro.key} macro={macro} eaten={total(macro.key)} target={memberTargets?.[macro.key]} />
            ))}
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
                        supporting={`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'} · ${round(entry.nutrition.kcal)} kcal`}
                        onActivate={() => onOpenEntry(entry)}
                      />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </>
      )}
      <Button variant="filled" onClick={() => onLog(viewed)}>
        Log
      </Button>
    </section>
  )
}
