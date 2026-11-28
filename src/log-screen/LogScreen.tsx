import type { nutrition } from 'data-platform'
import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { Day } from '../day.ts'
import type { EstimateLink } from '../estimate-link.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'
import { BackArrow } from '../BackArrow.tsx'
import { estimatedMark } from '../foods/EstimatedMark.tsx'
import { matches } from '../foods/matches.ts'
import { supportingLine } from '../foods/supporting-line.ts'
import { errorMessage } from '../error-message.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import { recents, type Recent } from '../log/recents.ts'
import { ConfirmStep, type Picked } from './ConfirmStep.tsx'
import { QuickEntryForm } from './QuickEntryForm.tsx'
import { useStepHistory } from './use-step-history.ts'

/** How many of the newest Log Entries Recents are drawn from; enough that duplicates still leave `MAX_RECENTS` distinct ones. */
const RECENT_ENTRY_WINDOW = 100

export interface LogScreenProps {
  log: LogStore
  foods: Foods
  /** The Day being logged on. */
  day: Day
  /** The current instant; the eaten time is defaulted from it. */
  now: Date
  /** Called when the Member leaves the screen, after saving or without logging. */
  onDone: () => void
  /** An estimate link's contents: the screen opens on a Quick Entry filled with them. */
  estimate?: EstimateLink
}

/** What a Recent's row shows and what picking it confirms, resolved once from the Recent and the live Foods. */
interface RecentRow {
  key: string
  name: string
  place?: string
  perServing: nutrition.Nutrition
  estimated: boolean
  picked: Picked
}

/** The confirm step's subject for a saved Food. */
function pickedFood(food: SavedFood): Picked {
  return {
    name: food.name,
    source: { kind: 'food', foodId: food.id },
    perServing: food.perServing,
    servingLabel: food.servingLabel,
  }
}

/** A Recent as a row; undefined when it is a Food that is no longer there. */
function recentRow(recent: Recent, foodsById: ReadonlyMap<nutrition.FoodId, SavedFood>): RecentRow | undefined {
  if (recent.kind === 'quick') {
    const estimated = recent.estimated === true
    return {
      key: `quick:${recent.name}`,
      name: recent.name,
      perServing: recent.perServing,
      estimated,
      picked: { name: recent.name, source: { kind: 'quick' }, perServing: recent.perServing, ...(estimated && { estimated: true as const }) },
    }
  }
  const food = foodsById.get(recent.foodId)
  if (!food) return undefined
  return { key: food.id, name: food.name, place: food.place, perServing: food.perServing, estimated: food.estimated, picked: pickedFood(food) }
}

/** Which step of logging the screen is on: choosing what to log, confirming a pick, or typing a Quick Entry. */
type Mode = { kind: 'choose' } | { kind: 'confirm'; picked: Picked } | { kind: 'quick'; name?: string }

/** Logging one thing on a Day: a Recent, a saved Food, or a Quick Entry. */
export function LogScreen({ log, foods, day, now, onDone, estimate }: LogScreenProps) {
  const [mode, setMode] = useState<Mode>(estimate === undefined ? { kind: 'choose' } : { kind: 'quick' })
  const [savedFoods, setSavedFoods] = useState<readonly SavedFood[]>([])
  const [recentEntries, setRecentEntries] = useState<readonly LogEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => foods.watch(setSavedFoods, (err) => setLoadError(errorMessage(err, 'Could not load Foods.'))), [foods])
  useEffect(() => {
    let current = true
    log
      .recent(RECENT_ENTRY_WINDOW)
      .then((entries) => {
        if (current) setRecentEntries(entries)
      })
      .catch((err: unknown) => {
        if (current) setLoadError(errorMessage(err, 'Could not load Recents.'))
      })
    return () => {
      current = false
    }
  }, [log])

  const stepHistory = useStepHistory({ inStep: mode.kind !== 'choose', onPopped: () => setMode({ kind: 'choose' }), onDone })
  const enter = (next: Mode) => {
    stepHistory.enter()
    setMode(next)
  }

  const [query, setQuery] = useState('')
  const found = query.trim() === '' ? [] : savedFoods.filter((food) => matches(food, query))
  const foodsById = new Map(savedFoods.map((food) => [food.id, food]))
  const offered = recents(recentEntries, foodsById).flatMap((recent) => recentRow(recent, foodsById) ?? [])

  const pickFood = (food: SavedFood) => enter({ kind: 'confirm', picked: pickedFood(food) })
  const backToChoosing = stepHistory.back
  const saved = stepHistory.finish
  if (mode.kind === 'confirm') {
    return <ConfirmStep log={log} picked={mode.picked} day={day} now={now} onSaved={saved} onBack={backToChoosing} />
  }
  if (mode.kind === 'quick') {
    return <QuickEntryForm log={log} foods={foods} day={day} now={now} estimate={estimate} onSaved={saved} onBack={backToChoosing} initialName={mode.name} />
  }
  const searching = query.trim() !== ''
  return (
    <main class="screen log-screen">
      <BackArrow onClick={onDone} />
      <TextField
        label="Search foods"
        type="search"
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      {loadError !== null && <p role="alert">{loadError}</p>}
      {searching ? (
        <section aria-labelledby="foods-heading">
          <h3 id="foods-heading">Foods</h3>
          {found.length === 0 ? (
            <>
              <p>No Foods match.</p>
              <Button variant="tonal" onClick={() => enter({ kind: 'quick', name: query.trim() })}>
                Quick entry for “{query.trim()}”
              </Button>
            </>
          ) : (
            <ul class="entry-list">
              {found.map((food) => (
                <ListRow
                  key={food.id}
                  headline={food.name}
                  supporting={supportingLine(food)}
                  onActivate={() => pickFood(food)}
                  trailing={estimatedMark(food.estimated)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {offered.length > 0 && (
            <section aria-labelledby="recents-heading">
              <h3 id="recents-heading">Recents</h3>
              <ul class="entry-list">
                {offered.map((row) => (
                  <ListRow
                    key={row.key}
                    headline={row.name}
                    supporting={supportingLine(row)}
                    onActivate={() => enter({ kind: 'confirm', picked: row.picked })}
                    trailing={estimatedMark(row.estimated)}
                  />
                ))}
              </ul>
            </section>
          )}
          <Button variant="tonal" onClick={() => enter({ kind: 'quick' })}>
            Quick entry
          </Button>
        </>
      )}
    </main>
  )
}
