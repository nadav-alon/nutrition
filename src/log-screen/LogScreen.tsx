import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { Day } from '../day.ts'
import type { EstimateLink } from '../estimate-link.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'
import { errorMessage } from '../error-message.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import { recents, type Recent } from '../log/recents.ts'
import { ConfirmStep, type Picked } from './ConfirmStep.tsx'
import { QuickEntryForm } from './QuickEntryForm.tsx'

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

/** Whether `food`'s name or place contains `query`, ignoring case and surrounding whitespace; an empty query matches nothing. */
function matches(food: SavedFood, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return false
  return food.name.toLowerCase().includes(needle) || (food.place?.toLowerCase().includes(needle) ?? false)
}

/** Which step of logging the screen is on: choosing what to log, confirming a pick, or typing a Quick Entry. */
type Mode = { kind: 'choose' } | { kind: 'confirm'; picked: Picked } | { kind: 'quick' }

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

  const [query, setQuery] = useState('')
  const found = savedFoods.filter((food) => matches(food, query))
  const foodsById = new Map(savedFoods.map((food) => [food.id, food]))
  const offered: readonly Recent[] = recents(recentEntries, foodsById)

  const pickFood = (food: SavedFood) =>
    setMode({
      kind: 'confirm',
      picked: {
        name: food.name,
        source: { kind: 'food', foodId: food.id },
        perServing: food.perServing,
        servingLabel: food.servingLabel,
      },
    })
  const pickRecent = (recent: Recent) => {
    if (recent.kind === 'quick') {
      setMode({
        kind: 'confirm',
        picked: { name: recent.name, source: { kind: 'quick' }, perServing: recent.perServing },
      })
      return
    }
    const food = foodsById.get(recent.foodId)
    if (food) pickFood(food)
  }

  const backToChoosing = () => setMode({ kind: 'choose' })
  if (mode.kind === 'confirm') {
    return <ConfirmStep log={log} picked={mode.picked} day={day} now={now} onSaved={onDone} onBack={backToChoosing} />
  }
  if (mode.kind === 'quick') {
    return <QuickEntryForm log={log} foods={foods} day={day} now={now} estimate={estimate} onSaved={onDone} onBack={backToChoosing} />
  }
  return (
    <main class="screen log-screen">
      <Button variant="text" onClick={onDone}>
        Back
      </Button>
      <h2>Log</h2>
      {loadError !== null && <p role="alert">{loadError}</p>}
      <Button variant="tonal" onClick={() => setMode({ kind: 'quick' })}>
        Quick entry
      </Button>
      <section aria-labelledby="recents-heading">
        <h3 id="recents-heading">Recents</h3>
        <ul class="entry-list">
          {offered.map((recent) => (
            <ListRow key={recent.kind === 'food' ? recent.foodId : `quick:${recent.name}`} headline={recent.name} onActivate={() => pickRecent(recent)} />
          ))}
        </ul>
      </section>
      <TextField
        label="Search foods"
        type="search"
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      {query.trim() !== '' && (
        <section aria-labelledby="foods-heading">
          <h3 id="foods-heading">Foods</h3>
          {found.length === 0 ? (
            <p>No Foods match.</p>
          ) : (
            <ul class="entry-list">
              {found.map((food) => (
                <ListRow key={food.id} headline={food.name} supporting={food.place} onActivate={() => pickFood(food)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
