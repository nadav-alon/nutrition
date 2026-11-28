import { nutrition } from 'data-platform'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import ChevronLeft from '~icons/material-symbols/chevron-left'
import ChevronRight from '~icons/material-symbols/chevron-right'
import { dayLabel, dayOf, isDay, nextDay, previousDay, type Day } from '../day.ts'
import { roundForDisplay } from '../foods/supporting-line.ts'
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
  /** Called when the Member asks to set their Targets. */
  onSetTargets: () => void
}

/** The horizontal travel, in CSS pixels, that makes a touch a swipe between Days. */
const SWIPE_MIN_PX = 60

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

/** The Member's Targets as the subscription has reported them: not yet, unreadable, or loaded (`null` when none are saved). */
type TargetsState = { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; targets: Targets | null }

interface MacroBarProps {
  macro: (typeof MACROS)[number]
  eaten: number
  target: number | undefined
}

function MacroBar({ macro: { label, unit }, eaten: rawEaten, target }: MacroBarProps) {
  const eaten = roundForDisplay(rawEaten)
  const over = target !== undefined && eaten > target
  const eatenFigure = `${eaten} ${unit} eaten`
  const figures =
    target === undefined
      ? eatenFigure
      : over
        ? `${eatenFigure} · ${roundForDisplay(eaten - target)} ${unit} over`
        : `${eatenFigure} · ${roundForDisplay(target - eaten)} ${unit} left`
  return (
    <div
      class={over ? 'macro-bar over' : 'macro-bar'}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuenow={eaten}
      aria-valuemax={target}
      aria-valuetext={figures}
    >
      <span>{`${label} ${figures}`}</span>
      {target === undefined || target <= 0 ? null : (
        <progress aria-hidden="true" max={target} value={Math.min(eaten, target)} />
      )}
    </div>
  )
}

/** One Day's Log Entries against the Member's Targets; stepping to earlier Days. */
export function DayScreen({ log, targets, now, day: viewed, onDayChange, onOpenEntry, onLog, onSetTargets }: DayScreenProps) {
  const today = dayOf(now)
  const [picking, setPicking] = useState(false)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const dayEntries = useDayEntries(log, viewed)
  const [targetsState, setTargetsState] = useState<TargetsState>({ status: 'loading' })
  useEffect(() => {
    return targets.subscribe(
      (loaded) => setTargetsState({ status: 'loaded', targets: loaded }),
      () => setTargetsState({ status: 'failed' }),
    )
  }, [targets])
  const memberTargets = targetsState.status === 'loaded' ? targetsState.targets : null
  // A Member with every Target unset has none either.
  const noTargets =
    targetsState.status === 'loaded' &&
    (memberTargets === null || Object.values(memberTargets).every((value) => value === undefined))
  const entries = dayEntries.status === 'loaded' ? dayEntries.entries : null
  const total = (key: MacroKey) => (entries ?? []).reduce((sum, entry) => sum + entry.nutrition[key], 0)
  return (
    <section
      class="screen day-screen"
      onTouchStart={(event) => {
        const touch = event.changedTouches[0]
        swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
      }}
      onTouchEnd={(event) => {
        const start = swipeStart.current
        const touch = event.changedTouches[0]
        swipeStart.current = null
        if (!start || !touch) return
        const dx = touch.clientX - start.x
        const dy = touch.clientY - start.y
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
        // Dragging right pulls the earlier Day in, as turning a page back does.
        onDayChange(dx > 0 ? previousDay(viewed) : nextDay(viewed, now))
      }}
    >
      <header class="day-nav">
        <IconButton symbol={ChevronLeft} label="Previous day" onClick={() => onDayChange(previousDay(viewed))} />
        <h2>
          {picking ? (
            <input
              type="date"
              aria-label="Pick a day"
              value={viewed}
              max={today}
              ref={(input) => {
                if (!input) return
                // Focus alone does not open the native picker on phones; ask for it where supported.
                input.focus()
                try {
                  input.showPicker?.()
                } catch {
                  // Not allowed here (no user activation): the focused input still works.
                }
              }}
              onChange={(event) => {
                const chosen = event.currentTarget.value
                if (!isDay(chosen)) return
                setPicking(false)
                onDayChange(chosen > today ? today : chosen)
              }}
              onBlur={() => setPicking(false)}
            />
          ) : (
            <button type="button" class="day-heading" title="Pick a day" onClick={() => setPicking(true)}>
              {dayLabel(viewed, now)}
            </button>
          )}
        </h2>
        <IconButton
          symbol={ChevronRight}
          label="Next day"
          disabled={viewed === today}
          onClick={() => onDayChange(nextDay(viewed, now))}
        />
      </header>
      {viewed === today ? null : (
        <Button variant="text" onClick={() => onDayChange(today)}>
          Today
        </Button>
      )}
      {targetsState.status === 'failed' ? <p>Targets unavailable.</p> : null}
      {noTargets ? (
        <p>
          No Targets set. <a
            href="#/targets"
            onClick={(event) => {
              event.preventDefault()
              onSetTargets()
            }}
          >
            Set Targets
          </a>
        </p>
      ) : null}
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
                        supporting={`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'} · ${roundForDisplay(entry.nutrition.kcal)} kcal`}
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
      <div class="day-log-bar">
        <Button variant="filled" onClick={() => onLog(viewed)}>
          Log
        </Button>
      </div>
    </section>
  )
}
