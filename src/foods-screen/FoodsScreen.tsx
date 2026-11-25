import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { errorMessage } from '../error-message.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'
import { FoodForm } from './FoodForm.tsx'

export interface FoodsScreenProps {
  foods: Foods
}

/** The supporting line of a Food's row: its place, when it has one, then the kcal of one Serving. */
function supportingLine(food: SavedFood): string {
  const kcal = `${Math.round(food.perServing.kcal * 10) / 10} kcal`
  return food.place === undefined ? kcal : `${food.place} · ${kcal}`
}

/** Whether the query, ignoring case and surrounding space, appears in the Food's name or place. */
function matches(food: SavedFood, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return food.name.toLowerCase().includes(needle) || (food.place?.toLowerCase().includes(needle) ?? false)
}

/** The Household's Foods: listed by name with place and per-Serving kcal, Estimated ones marked. */
export function FoodsScreen({ foods }: FoodsScreenProps) {
  const [list, setList] = useState<readonly SavedFood[] | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    return foods.watch(setList, (error) => setListError(errorMessage(error, 'Could not load Foods.')))
  }, [foods])

  if (formOpen) return <FoodForm foods={foods} onDone={() => setFormOpen(false)} />
  if (listError !== null) return <main class="screen foods" role="alert">{listError}</main>
  if (list === null) return <main class="screen foods" />
  const shown = list.filter((food) => matches(food, query))
  return (
    <main class="screen foods">
      <TextField label="Search" type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} />
      {list.length === 0 ? (
        <p>No Foods yet.</p>
      ) : shown.length === 0 ? (
        <p>No Foods match.</p>
      ) : (
        <ul class="food-list">
          {shown.map((food) => (
            <ListRow
              key={food.id}
              headline={food.name}
              supporting={supportingLine(food)}
              trailing={food.estimated ? <span>Estimated</span> : undefined}
            />
          ))}
        </ul>
      )}
      <Button variant="filled" onClick={() => setFormOpen(true)}>
        Add food
      </Button>
    </main>
  )
}
