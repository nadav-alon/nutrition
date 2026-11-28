import { nutrition } from 'data-platform'
import { useEffect, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { BackArrow } from '../BackArrow.tsx'
import { StatusScreen } from '../StatusScreen.tsx'
import { errorMessage } from '../error-message.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'
import { FoodForm } from './FoodForm.tsx'

export interface FoodsScreenProps {
  foods: Foods
  /** The open form: `'new'` to add a Food, a Food's id to edit it, none for the list. */
  form?: 'new' | nutrition.FoodId
  /** Called when the Member opens the form to add a Food, or to edit the one with this id. */
  onOpenForm: (form: 'new' | nutrition.FoodId) => void
  /** Called when the form is done: after a save or delete, or when the Member backs out of it. */
  onCloseForm: () => void
  /** Called when the Member leaves the Foods for where they came from. */
  onLeave: () => void
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
export function FoodsScreen({ foods, form, onOpenForm, onCloseForm, onLeave }: FoodsScreenProps) {
  const [list, setList] = useState<readonly SavedFood[] | null>(null)
  const [query, setQuery] = useState('')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    return foods.watch(setList, (error) => setListError(errorMessage(error, 'Could not load Foods.')))
  }, [foods])

  const leave = form === undefined ? onLeave : onCloseForm
  if (listError !== null) return <StatusScreen onBack={leave} alert>{listError}</StatusScreen>
  if (list === null) return <StatusScreen onBack={leave} />
  if (form === 'new') return <FoodForm key="new" foods={foods} onDone={onCloseForm} />
  if (form !== undefined) {
    const food = list.find((candidate) => candidate.id === form)
    if (food === undefined) {
      return (
        <StatusScreen onBack={onCloseForm}>
          <p>That Food is no longer there.</p>
        </StatusScreen>
      )
    }
    return <FoodForm key={food.id} foods={foods} food={food} onDone={onCloseForm} />
  }
  const shown = list.filter((food) => matches(food, query))
  return (
    <main class="screen foods">
      <BackArrow onClick={onLeave} />
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
              onActivate={() => onOpenForm(food.id)}
              trailing={food.estimated ? <span>Estimated</span> : undefined}
            />
          ))}
        </ul>
      )}
      <Button variant="filled" onClick={() => onOpenForm('new')}>
        Add food
      </Button>
    </main>
  )
}
