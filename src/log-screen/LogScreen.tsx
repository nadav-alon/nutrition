import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { Day } from '../day.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'
import type { LogStore } from '../log/log-store.ts'
import { recents, type Recent } from '../log/recents.ts'

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
}

/** Whether `food`'s name or place contains `query`, ignoring case and surrounding whitespace; an empty query matches nothing. */
function matches(food: SavedFood, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return false
  return food.name.toLowerCase().includes(needle) || (food.place?.toLowerCase().includes(needle) ?? false)
}

/** Logging one thing on a Day: a Recent, a saved Food, or a Quick Entry. */
export function LogScreen({ log, foods, onDone }: LogScreenProps) {
  const [savedFoods, setSavedFoods] = useState<readonly SavedFood[]>([])
  const [recentEntries, setRecentEntries] = useState<Awaited<ReturnType<LogStore['recent']>>>([])
  useEffect(() => foods.watch(setSavedFoods), [foods])
  useEffect(() => {
    let current = true
    log.recent(RECENT_ENTRY_WINDOW).then((entries) => {
      if (current) setRecentEntries(entries)
    })
    return () => {
      current = false
    }
  }, [log])

  const [query, setQuery] = useState('')
  const found = savedFoods.filter((food) => matches(food, query))
  const offered: readonly Recent[] = recents(recentEntries, new Map(savedFoods.map((food) => [food.id, food])))
  return (
    <main class="screen log-screen">
      <Button variant="text" onClick={onDone}>
        Back
      </Button>
      <h2>Log</h2>
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
                <ListRow key={food.id} headline={food.name} supporting={food.place} onActivate={() => {}} />
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="recents-heading">
        <h3 id="recents-heading">Recents</h3>
        <ul class="entry-list">
          {offered.map((recent) => (
            <ListRow key={recent.kind === 'food' ? recent.foodId : `quick:${recent.name}`} headline={recent.name} onActivate={() => {}} />
          ))}
        </ul>
      </section>
    </main>
  )
}
